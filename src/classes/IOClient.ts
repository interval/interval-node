import { v4 } from 'uuid'
import { z } from 'zod'
import superjson from '../utils/superjson'
import {
  T_IO_RENDER_INPUT,
  T_IO_RESPONSE,
  T_IO_PROPS,
  T_IO_RETURNS,
  T_IO_METHOD_NAMES,
  T_IO_DISPLAY_METHOD_NAMES,
  T_IO_INPUT_METHOD_NAMES,
  T_IO_MULTIPLEABLE_METHOD_NAMES,
  supportsMultiple,
  resolvesImmediately,
  ioSchema,
} from '../ioSchema'
import Logger from './Logger'
import { AnyIOComponent } from './IOComponent'
import {
  ExclusiveIOPromise,
  IOGroupPromise,
  IOPromiseValidator,
  DisplayIOPromise,
  InputIOPromise,
  MultipleableIOPromise,
} from './IOPromise'
import IOError from './IOError'
import spreadsheet from '../components/spreadsheet'
import displayTable from '../components/displayTable'
import selectTable from '../components/selectTable'
import selectSingle from '../components/selectSingle'
import search from '../components/search'
import selectMultiple from '../components/selectMultiple'
import displayGrid from '../components/displayGrid'
import displayLink from '../components/displayLink'
import displayImage from '../components/displayImage'
import displayVideo from '../components/displayVideo'
import urlInput from '../components/url'
import { date, datetime } from '../components/inputDate'
import { file } from '../components/upload'
import {
  IORenderSender,
  ResponseHandlerFn,
  MaybeOptionalGroupIOPromise,
  ExclusiveIOComponentFunction,
  ComponentRenderer,
  IOComponentDefinition,
  DisplayIOComponentFunction,
  RequiredPropsDisplayIOComponentFunction,
  InputIOComponentFunction,
  RequiredPropsInputIOComponentFunction,
  GroupConfig,
  ButtonConfig,
  RequiredPropsMultipleableInputIOComponentFunction,
  MultipleableInputIOComponentFunction,
} from '../types'
import { stripUndefined } from '../utils/deserialize'
import { IntervalError } from '..'

interface ClientConfig {
  logger: Logger
  send: IORenderSender
  isDemo?: boolean
  displayResolvesImmediately?: boolean
  // onAddInlineAction: (handler: IntervalActionHandler) => string
}

export type IOClientRenderReturnValues<
  Components extends [AnyIOComponent, ...AnyIOComponent[]]
> = {
  response: {
    [Idx in keyof Components]: Components[Idx] extends AnyIOComponent
      ? z.infer<Components[Idx]['schema']['returns']> | undefined
      : Components[Idx]
  }
}

export type IOClientRenderValidator<
  Components extends [AnyIOComponent, ...AnyIOComponent[]]
> = IOPromiseValidator<IOClientRenderReturnValues<Components>>

/**
 * The client class that handles IO calls for a given transaction.
 *
 * Each transaction has its own IOClient which creates the IO argument
 * passed to action handlers that are aware of the transaction in order
 * to transmit IO calls correctly.
 */
export class IOClient {
  logger: Logger
  send: IORenderSender
  isDemo: boolean
  displayResolvesImmediately: boolean | undefined
  // onAddInlineAction: (handler: IntervalActionHandler) => string

  previousInputGroupKey: string | undefined
  onResponseHandlers = new Map<string, ResponseHandlerFn>()
  inlineActionKeys = new Set<string>()
  isCanceled = false

  constructor(config: ClientConfig) {
    this.logger = config.logger
    this.send = config.send
    this.isDemo = !!config.isDemo
    this.displayResolvesImmediately = config.displayResolvesImmediately
    // this.onAddInlineAction = config.onAddInlineAction
  }

  // addInlineAction(handler: IntervalActionHandler): string {
  //   const key = this.onAddInlineAction(handler)
  //   this.inlineActionKeys.add(key)
  //   return key
  // }

  /**
   * Creates a render loop for an IO call.
   *
   * Given a list of components (potentially only one if not rendering a group)
   * this method is responsible for sending the initial render call and handling
   * responses (returns, state updates, or cancellations) from Interval.
   * Resolves when it receives final responses or from Interval,
   * or throws an IOError of kind `CANCELED` if canceled.
   */
  async renderComponents<
    Components extends [AnyIOComponent, ...AnyIOComponent[]]
  >(
    components: Components,
    groupValidator?: IOClientRenderValidator<Components>,
    continueButton?: ButtonConfig,
    submitButtons?: ButtonConfig[]
  ) {
    if (this.isCanceled) {
      // Transaction is already canceled, host attempted more IO calls
      throw new IOError('TRANSACTION_CLOSED')
    }

    let validationErrorMessage: string | undefined

    return new Promise<IOClientRenderReturnValues<Components>>(
      async (resolve, reject) => {
        const inputGroupKey = v4()
        let isReturned = false

        const render = async () => {
          const packed: T_IO_RENDER_INPUT = {
            id: v4(),
            inputGroupKey,
            toRender: components
              .map(c => c.getRenderInfo())
              .map(({ props, ...renderInfo }) => {
                const { json, meta } = superjson.serialize(
                  stripUndefined(props)
                )
                return {
                  ...renderInfo,
                  props: json,
                  propsMeta: meta,
                }
              }),
            validationErrorMessage,
            kind: 'RENDER',
            continueButton,
            submitButtons,
          }

          await this.send(packed)
        }

        const inputGroupResponseHandler: ResponseHandlerFn = async result => {
          try {
            if (
              result.inputGroupKey &&
              result.inputGroupKey !== inputGroupKey
            ) {
              this.logger.debug('Received response for other input group')
              return
            }

            if (
              (this.isCanceled || isReturned) &&
              (result.kind === 'RETURN' || result.kind === 'CANCELED')
            ) {
              this.logger.debug('Received response after IO call complete')
              return
            }

            // Transaction canceled from Interval cloud UI
            if (result.kind === 'CANCELED') {
              this.isCanceled = true
              reject(new IOError('CANCELED'))
              return
            }

            if (result.values.length !== components.length) {
              throw new Error('Mismatch in return array length')
            }

            if (result.valuesMeta) {
              result.values = superjson.deserialize({
                json: result.values,
                meta: result.valuesMeta,
              })
            }

            if (result.kind === 'RETURN') {
              const validities = await Promise.all(
                result.values.map(async (v, index) => {
                  const component = components[index]
                  if (component.validator) {
                    const resp = await component.handleValidation(v)
                    if (resp !== undefined) {
                      return false
                    }
                  }
                  return true
                })
              )

              validationErrorMessage = undefined

              if (validities.some(v => !v)) {
                render()
                return
              }

              if (groupValidator) {
                validationErrorMessage = await groupValidator({
                  response: result.values,
                } as IOClientRenderReturnValues<typeof components>)

                if (validationErrorMessage) {
                  render()
                  return
                }
              }

              isReturned = true

              result.values.forEach((v, index) => {
                // @ts-ignore
                components[index].setReturnValue(v)
              })

              return
            }

            if (result.kind === 'SET_STATE') {
              for (const [index, newState] of result.values.entries()) {
                const prevState = components[index].getInstance().state

                if (JSON.stringify(newState) !== JSON.stringify(prevState)) {
                  this.logger.debug(`New state at ${index}`, newState)
                  // @ts-ignore
                  await components[index].setState(newState)
                }
              }
              render()
            }
          } catch (err) {
            if (err instanceof Error) {
              const errorCause = err.cause
                ? err.cause instanceof Error
                  ? err.cause.message
                  : err.cause
                : undefined
              if (errorCause) {
                this.logger.error(`${err.message}:`, errorCause)
              } else {
                this.logger.error(err.message)
              }
            } else {
              this.logger.error(err)
            }
            reject(err)
          }
        }

        this.onResponseHandlers.set(inputGroupKey, inputGroupResponseHandler)
        this.previousInputGroupKey = inputGroupKey

        for (const c of components) {
          // every time any component changes their state, we call render (again)
          c.onStateChange(render)
        }

        // Initial render
        render()
          .then(() => {
            for (const c of components) {
              if (c.resolvesImmediately) {
                // return value type will be validated inside the function
                c.setReturnValue(null as never)
              }
            }
          })
          .catch(err => {
            this.logger.warn('Failed resolving component immediately', err)
          })

        const response = {
          response: await Promise.all(components.map(comp => comp.returnValue)),
        } as unknown as Promise<IOClientRenderReturnValues<Components>>

        resolve(response)
      }
    )
  }

  /**
   * Combines multiple I/O method calls into a single form.
   *
   * Individual I/O methods await within your action until user input is provided, such that each I/O method call results in a distinct step within the generated app. `io.group` allows you to group multiple I/O methods together to request input all at once in a single step.
   *
   * Custom validation can be performed on groups by chaining a `.validate()` method call to the group.
   *
   * **Usage:**
   *
   * ```typescript
   * const [name, email, age] = await io.group([
   *   io.input.text("Name"),
   *   io.input.email("Email"),
   *   io.input.number("Age"),
   * ]);
   *
   * ```
   *
   * ```typescript
   * const { name, email, age } = await io.group({
   *   name: io.input.text("Name"),
   *   email: io.input.email("Email"),
   *   age: io.input.number("Age"),
   * });
   *
   * ```
   */
  group<
    IOPromises extends
      | [MaybeOptionalGroupIOPromise, ...MaybeOptionalGroupIOPromise[]]
      | Record<string, MaybeOptionalGroupIOPromise>
      | MaybeOptionalGroupIOPromise[]
  >(promises: IOPromises, props?: GroupConfig) {
    const promiseValues = Array.isArray(promises)
      ? promises
      : Object.values(promises)

    const exclusivePromises = promiseValues.filter(
      pi => pi instanceof ExclusiveIOPromise
    )

    if (exclusivePromises.length > 0) {
      throw new IntervalError(
        `Components with the following labels are not supported inside groups, please remove them from the group: ${exclusivePromises
          .map(pi => pi.component.label)
          .join(', ')}`
      )
    }

    return new IOGroupPromise({
      promises,
      renderer: this.renderComponents.bind(this),
      continueButton: props?.continueButton,
    })
  }

  getPromiseProps<
    MethodName extends T_IO_METHOD_NAMES,
    Props extends object = T_IO_PROPS<MethodName>,
    Output = T_IO_RETURNS<MethodName>,
    DefaultValue = Output
  >(
    methodName: MethodName,
    inputProps?: Props,
    componentDef?: IOComponentDefinition<
      MethodName,
      Props,
      Output,
      DefaultValue
    >
  ) {
    let props: T_IO_PROPS<MethodName> = inputProps
      ? (inputProps as T_IO_PROPS<MethodName>)
      : {}
    let getValue = (r: T_IO_RETURNS<MethodName>) => r as unknown as Output
    let getDefaultValue = (defaultValue: DefaultValue) =>
      defaultValue as unknown as Output
    let onStateChange: ReturnType<
      IOComponentDefinition<MethodName, Props, Output>
    >['onStateChange'] = undefined

    if (componentDef) {
      const componentGetters = componentDef.bind(this)(
        inputProps ?? ({} as Props)
      )

      if (componentGetters.props) {
        props = componentGetters.props
      }

      if (componentGetters.getValue) {
        getValue = componentGetters.getValue
      }

      if (componentGetters.getDefaultValue) {
        getDefaultValue = componentGetters.getDefaultValue
      }

      if (componentGetters.onStateChange) {
        onStateChange = componentGetters.onStateChange
      }
    }

    return {
      methodName,
      props,
      valueGetter: getValue,
      defaultValueGetter: getDefaultValue,
      onStateChange,
    }
  }

  createIOMethod<
    MethodName extends T_IO_MULTIPLEABLE_METHOD_NAMES,
    Props extends object = T_IO_PROPS<MethodName>,
    Output = T_IO_RETURNS<MethodName>
  >(
    methodName: MethodName,
    config?: {
      propsRequired?: false
      componentDef?: IOComponentDefinition<MethodName, Props, Output>
    }
  ): MultipleableInputIOComponentFunction<MethodName, Props, Output>
  createIOMethod<
    MethodName extends T_IO_MULTIPLEABLE_METHOD_NAMES,
    Props extends object = T_IO_PROPS<MethodName>,
    Output = T_IO_RETURNS<MethodName>
  >(
    methodName: MethodName,
    config: {
      propsRequired?: true
      componentDef?: IOComponentDefinition<MethodName, Props, Output>
    }
  ): RequiredPropsMultipleableInputIOComponentFunction<
    MethodName,
    Props,
    Output
  >
  createIOMethod<
    MethodName extends T_IO_DISPLAY_METHOD_NAMES,
    Props extends object = T_IO_PROPS<MethodName>,
    Output = T_IO_RETURNS<MethodName>
  >(
    methodName: MethodName,
    config?: {
      propsRequired?: false
      componentDef?: IOComponentDefinition<MethodName, Props, Output>
    }
  ): DisplayIOComponentFunction<MethodName, Props, Output>
  createIOMethod<
    MethodName extends T_IO_DISPLAY_METHOD_NAMES,
    Props extends object = T_IO_PROPS<MethodName>,
    Output = T_IO_RETURNS<MethodName>
  >(
    methodName: MethodName,
    config: {
      propsRequired?: true
      componentDef?: IOComponentDefinition<MethodName, Props, Output>
    }
  ): RequiredPropsDisplayIOComponentFunction<MethodName, Props, Output>
  createIOMethod<
    MethodName extends T_IO_INPUT_METHOD_NAMES,
    Props extends object = T_IO_PROPS<MethodName>,
    Output = T_IO_RETURNS<MethodName>
  >(
    methodName: MethodName,
    config?: {
      propsRequired?: false
      componentDef?: IOComponentDefinition<MethodName, Props, Output>
    }
  ): InputIOComponentFunction<MethodName, Props, Output>
  createIOMethod<
    MethodName extends T_IO_INPUT_METHOD_NAMES,
    Props extends object = T_IO_PROPS<MethodName>,
    Output = T_IO_RETURNS<MethodName>
  >(
    methodName: MethodName,
    config: {
      propsRequired?: true
      componentDef?: IOComponentDefinition<MethodName, Props, Output>
    }
  ): RequiredPropsInputIOComponentFunction<MethodName, Props, Output>
  createIOMethod<
    MethodName extends T_IO_METHOD_NAMES,
    Props extends object = T_IO_PROPS<MethodName>,
    Output = T_IO_RETURNS<MethodName>
  >(
    methodName: MethodName,
    {
      componentDef,
    }: {
      propsRequired?: boolean
      componentDef?: IOComponentDefinition<MethodName, Props, Output>
    } = {}
  ) {
    return (label: string, props?: Props) => {
      if (supportsMultiple(methodName)) {
        return new MultipleableIOPromise({
          ...this.getPromiseProps(
            methodName as T_IO_MULTIPLEABLE_METHOD_NAMES,
            props,
            componentDef as
              | IOComponentDefinition<
                  T_IO_MULTIPLEABLE_METHOD_NAMES,
                  Props,
                  T_IO_RETURNS<T_IO_MULTIPLEABLE_METHOD_NAMES>
                >
              | undefined
          ),
          methodName: methodName as T_IO_MULTIPLEABLE_METHOD_NAMES,
          renderer: this.renderComponents.bind(
            this
          ) as ComponentRenderer<T_IO_MULTIPLEABLE_METHOD_NAMES>,
          label,
          displayResolvesImmediately: this.displayResolvesImmediately,
        })
      }

      return methodName.startsWith('DISPLAY_')
        ? new DisplayIOPromise({
            ...this.getPromiseProps(
              methodName as T_IO_DISPLAY_METHOD_NAMES,
              props,
              componentDef as
                | IOComponentDefinition<
                    T_IO_DISPLAY_METHOD_NAMES,
                    Props,
                    T_IO_RETURNS<T_IO_DISPLAY_METHOD_NAMES>
                  >
                | undefined
            ),
            methodName: methodName as T_IO_DISPLAY_METHOD_NAMES,
            renderer: this.renderComponents.bind(
              this
            ) as ComponentRenderer<T_IO_DISPLAY_METHOD_NAMES>,
            label,
            displayResolvesImmediately: this.displayResolvesImmediately,
          })
        : new InputIOPromise({
            ...this.getPromiseProps(
              methodName as T_IO_INPUT_METHOD_NAMES,
              props,
              componentDef as
                | IOComponentDefinition<
                    T_IO_INPUT_METHOD_NAMES,
                    Props,
                    T_IO_RETURNS<T_IO_INPUT_METHOD_NAMES>
                  >
                | undefined
            ),
            methodName: methodName as T_IO_INPUT_METHOD_NAMES,
            renderer: this.renderComponents.bind(
              this
            ) as ComponentRenderer<T_IO_INPUT_METHOD_NAMES>,
            label,
            displayResolvesImmediately: this.displayResolvesImmediately,
          })
    }
  }

  createExclusiveIOMethod<
    MethodName extends T_IO_INPUT_METHOD_NAMES,
    Props extends object = T_IO_PROPS<MethodName>,
    Output = T_IO_RETURNS<MethodName>
  >(
    methodName: MethodName,
    {
      componentDef,
      demoUnsupported = false,
    }: {
      componentDef?: IOComponentDefinition<MethodName, Props, Output>
      demoUnsupported?: boolean
    } = {}
  ): ExclusiveIOComponentFunction<MethodName, Props, Output> {
    return (label: string, props?: Props) => {
      if (demoUnsupported && this.isDemo) {
        throw new IntervalError(
          `The ${methodName} method isn't supported in demo mode`
        )
      }
      const promiseProps = this.getPromiseProps(methodName, props, componentDef)
      return new ExclusiveIOPromise({
        ...promiseProps,
        methodName,
        renderer: this.renderComponents.bind(
          this
        ) as ComponentRenderer<MethodName>,
        label,
        displayResolvesImmediately: this.displayResolvesImmediately,
      })
    }
  }

  /**
   * The namespace of I/O methods available in action handlers.
   */
  get io() {
    return {
      // This doc comment is on the group function above
      group: this.group.bind(this),

      /**
       * Requests confirmation of an action using a full-screen dialog box.
       *
       * **Note:** `io.confirm` is not supported within an `io.group`.
       *
       * **Usage:**
       *
       * ```typescript
       * const shouldDelete = await io.confirm("Delete this user account?", {
       *   helpText: "All of their data will be deleted immediately.",
       * });
       * ```
       */
      confirm: this.createExclusiveIOMethod('CONFIRM'),

      /**
       * Requests multi-factor authentication or password confirmation of the person running the action.
       *
       * **Note:** `io.confirmIdentity` is not supported within an `io.group`.
       *
       * **Usage:**
       *
       * ```typescript
       * const shouldDelete = await io.confirmIdentity("This is a sensitive action.");
       * ```
       */
      confirmIdentity: this.createExclusiveIOMethod('CONFIRM_IDENTITY', {
        demoUnsupported: true,
      }),

      /**
       * Allows searching for arbitrary results from a search box.
       *
       * **Usage:**
       *
       * ```typescript
       * const user = await io.search("Search for a user", {
       *   renderResult: user => ({
       *     label: user.name,
       *     description: user.email,
       *     image: {
       *       url: user.avatar,
       *       size: "small",
       *     },
       *   }),
       *   onSearch: async query => {
       *     return users.filter(user => user.name.includes(query));
       *   },
       * });
       * ```
       */
      search: this.createIOMethod('SEARCH', {
        propsRequired: true,
        componentDef: search,
      }),

      /**
       * The namespace for methods to collect user input.
       */
      input: {
        /**
         * Requests a string value.
         *
         * **Usage:**
         *
         * ```typescript
         * const text = await io.input.text("Company name", {
         *   placeholder: "Acme Inc.",
         * });
         * ```
         */
        text: this.createIOMethod('INPUT_TEXT'),
        /**
         * Requests a boolean value.
         *
         * **Usage:**
         *
         * ```typescript
         * const shouldSubscribe = await io.input.boolean("Subscribe to our newsletter?");
         * ```
         */
        boolean: this.createIOMethod('INPUT_BOOLEAN'),
        /**
         * Requests a numeric value.
         *
         * **Usage:**
         *
         * ```typescript
         * const amount = await io.input.number("Amount", {
         *   helpText: "Enter a number between one and ten.",
         *   min: 1,
         *   max: 10,
         * });
         * ```
         */
        number: this.createIOMethod('INPUT_NUMBER'),
        /**
         * Requests an email address.
         *
         * **Usage:**
         *
         * ```typescript
         * const email = await io.input.email("Email address", {
         *   helpText: "Please provide your work email.",
         *   placeholder: "you@example.com",
         * });
         * ```
         */
        email: this.createIOMethod('INPUT_EMAIL'),
        /**
         * Requests rich text input and returns a string of HTML.
         *
         * **Usage:**
         *
         * ```typescript
         * const body = await io.input.richText("Email body", {
         *   helpText: "Please include user activation information.",
         * });
         * ```
         */
        richText: this.createIOMethod('INPUT_RICH_TEXT'),
        /**
         * Requests a URL.
         *
         * The URL is validated and an error is shown if the provided value is not a URL. You can perform additional URL validation by using the validation API with `.validate()`.
         *
         * **Usage:**
         *
         * ```typescript
         * const redirectUrl = await io.input.url("Redirect URL", {
         *   helpText: "Please provide a URL for the redirect.",
         *   placeholder: "https://example.com",
         *   allowedProtocols: ["https"],
         * });
         *
         *  return redirectUrl.href;
         * ```
         */
        url: this.createIOMethod('INPUT_URL', {
          componentDef: urlInput,
        }),
        /**
         * Requests a date.
         *
         * **Usage:**
         *
         * ```typescript
         * const date = await io.input.date("Date");
         * ```
         */
        date: this.createIOMethod('INPUT_DATE', { componentDef: date }),
        /**
         * Requests a time.
         *
         * **Usage:**
         *
         * ```typescript
         * const time = await io.input.time("Time");
         * ```
         */
        time: this.createIOMethod('INPUT_TIME'),
        /**
         * Requests a date & time.
         *
         * **Usage:**
         *
         * ```typescript
         * const datetime = await io.input.datetime("Date & time");
         * ```
         */
        datetime: this.createIOMethod('INPUT_DATETIME', {
          componentDef: datetime,
        }),

        /**
         * Prompts the app user to select and upload a file.
         *
         * The resulting object points to a temporary file that expires after the action finishes running. You can access its contents in your action and optionally persist the file elsewhere if it should live longer.
         *
         * You may upload the file directly to your own S3-compatible API by providing custom presigned upload and download URLs via the `generatePresignedUrls` property.
         *
         * **Usage:**
         *
         * ```typescript
         * const datetime = await io.input.datetime("Date & time");
         * ```
         */
        file: this.createIOMethod('UPLOAD_FILE', {
          componentDef: file(this.logger),
        }),
      },
      /**
       * The namespace for methods which allow users to select items from a predefined list.
       */
      select: {
        /**
         * Prompts the app user to select a single value from a set of provided values.
         *
         * **Usage:**
         *
         * ```typescript
         * const currency = await io.select.single("Currency", {
         *   options: [
         *     { label: "US Dollar", value: "USD" },
         *     { label: "Canadian Dollar", value: "CAD" },
         *     { label: "Euro", value: "EUR" },
         *   ],
         *   defaultValue: "USD",
         *   helpText: "Currency for this transaction",
         * });
         *
         * const currencyCode = currency.value;
         * ```
         */
        single: this.createIOMethod('SELECT_SINGLE', {
          propsRequired: true,
          componentDef: selectSingle(this.logger),
        }),
        /**
         * Prompts the app user to select a number of values from a set of provided values.
         *
         * **Usage:**
         *
         * ```typescript
         * const condiments = await io.select.multiple("Condiments", {
         *   options: [
         *     { label: "Ketchup", value: 0 },
         *     { label: "Mustard", value: 1 },
         *     { label: "Mayo", value: 2 },
         *   ],
         *   defaultValue: [
         *     { label: "Ketchup", value: 0 },
         *     { label: "Mustard", value: 1 },
         *   ],
         *   helpText: "What goes on it?",
         * });
         *
         * const condimentIds = condiments.map(condiment => condiment.value);
         * ```
         */
        multiple: this.createIOMethod('SELECT_MULTIPLE', {
          propsRequired: true,
          componentDef: selectMultiple(this.logger),
        }),
        /**
         * Prompts the app user to select a number of values from an array of tabular data.
         *
         * **Usage:**
         *
         * ```typescript
         * const albums = await io.select.table("Select your favorites", {
         *   data: [
         *     {
         *       album: "Exile on Main Street",
         *       artist: "The Rolling Stones",
         *       year: 1972,
         *     },
         *     {
         *       artist: "Michael Jackson",
         *       album: "Thriller",
         *       year: 1982,
         *     },
         *     {
         *       album: "Enter the Wu-Tang (36 Chambers)",
         *       artist: "Wu-Tang Clan",
         *       year: 1993,
         *     },
         *   ],
         * });
         * ```
         */
        table: this.createIOMethod('SELECT_TABLE', {
          propsRequired: true,
          componentDef: selectTable(this.logger),
        }),
      },
      /**
       * The namespace for methods that display information to the user. These methods return `null` and can be used inside pages as well as actions.
       */
      display: {
        /**
         * Displays a block of code to the action user.
         *
         * **Usage:**
         *
         * ```typescript
         * await io.display.code("Check out the source code", {
         *   code: 'console.log("Hello world!")',
         *   language: "javascript",
         * });
         * ```
         */
        code: this.createIOMethod('DISPLAY_CODE', {
          propsRequired: true,
        }),
        /**
         * Displays a heading to the action user.
         *
         * **Usage:**
         *
         * ```typescript
         * await io.display.heading("User created!", {
         *   description: "Updated 5 minutes ago",
         *   menuItems: [
         *     {
         *       label: "Edit user",
         *       action: "edit_user",
         *       params: { userId: 12 },
         *     },
         *   ],
         * });
         * ```
         */
        heading: this.createIOMethod('DISPLAY_HEADING'),

        /**
         * Displays rendered markdown to the action user. Accepts GitHub Flavored Markdown.
         *
         * **Usage:**
         *
         * ```typescript
         * await io.display.markdown("**Warning:** This _will_ erase user data.");
         * ```
         */
        markdown: this.createIOMethod('DISPLAY_MARKDOWN'),
        /**
         * Displays an image to the action user.
         *
         * One of `url` or `buffer` must be provided.
         *
         * **Usage:**
         *
         * ```typescript
         * await io.display.image("An animated gif", {
         *   url: "https://media.giphy.com/media/26ybw6AltpBRmyS76/giphy.gif",
         *   alt: "Man makes like he's going to jump on a skateboard but doesn't",
         *   size: "medium",
         * });
         * ```
         */
        image: this.createIOMethod('DISPLAY_IMAGE', {
          componentDef: displayImage,
          propsRequired: true,
        }),
        /**
         * Displays a series of label/value pairs in a variety of layout options.
         *
         * **Usage:**
         *
         * ```typescript
         * await io.display.metadata("User info", {
         *   layout: "card",
         *   data: [
         *     {
         *       label: "Name",
         *       value: `${user.firstName} ${user.lastName}`,
         *     },
         *     {
         *       label: "Email",
         *       value: user.email,
         *       url: `mailto:${user.email}`,
         *     },
         *     {
         *       label: "Friends",
         *       value: user.friends.length,
         *     },
         *   ],
         * });
         * ```
         */
        metadata: this.createIOMethod('DISPLAY_METADATA', {
          propsRequired: true,
        }),
        /**
         * Displays a button-styled action link to the action user. Can link to an external URL or to another action or page.
         *
         * **Usage:**
         *
         * ```typescript
         * await io.display.link("Run another action", {
         *   route: "usefulAction",
         *   theme: "danger",
         * });
         * ```
         */
        link: this.createIOMethod('DISPLAY_LINK', {
          componentDef: displayLink,
          propsRequired: true,
        }),
        /**
         * Displays an object of nested arbitrary data to the action user.
         *
         * **Usage:**
         *
         * ```typescript
         * await io.display.object("Example object", {
         *   data: [
         *     {
         *       album: "Exile on Main Street",
         *       artist: "The Rolling Stones",
         *       year: 1972,
         *     },
         *   ],
         * });
         * ```
         */
        object: this.createIOMethod('DISPLAY_OBJECT', {
          propsRequired: true,
        }),
        /**
         * Displays tabular data.
         *
         * **Usage:**
         *
         * ```typescript
         * await io.display.table("Albums", {
         *   helpText: "Includes the artist and its year of release.",
         *   data: [
         *     {
         *       album: "Exile on Main Street",
         *       artist: "The Rolling Stones",
         *       year: 1972,
         *     },
         *     {
         *       album: "Thriller",
         *       artist: "Michael Jackson",
         *       year: 1982,
         *     },
         *     {
         *       album: "Enter the Wu-Tang (36 Chambers)",
         *       artist: "Wu-Tang Clan",
         *       year: 1993,
         *     },
         *   ],
         * });
         * ```
         */
        table: this.createIOMethod('DISPLAY_TABLE', {
          propsRequired: true,
          componentDef: displayTable(this.logger),
        }),
        /**
         * Displays data in a grid layout.
         *
         * Grid items can include a label, description, image, and options menu, and can optionally link to another page, action, or external URL.
         *
         * Grid item size can be controlled using the idealColumnWidth property. Interval will calculate a column width that is as close as possible to that number while factoring in gutter size and window width.
         *
         * Images default to a 16:9 aspect ratio with `object-fit` set to cover, and can be customized via the `image.aspectRatio` and `image.fit` properties respectively in the renderItem callback.
         *
         * **Usage:**
         *
         * ```typescript
         * await io.display.grid("Albums", {
         *   idealColumnWidth: 180,
         *   data: [
         *     {
         *       album: "Exile on Main Street",
         *       artist: "The Rolling Stones",
         *       imageUrl:
         *         "https://upload.wikimedia.org/wikipedia/en/c/ca/ExileMainSt.jpg",
         *       spotifyId: "1D0PTM0bg7skufClSUOxTP",
         *     },
         *     {
         *       album: "Thriller",
         *       artist: "Michael Jackson",
         *       imageUrl:
         *         "https://upload.wikimedia.org/wikipedia/en/5/55/Michael_Jackson_-_Thriller.png",
         *       spotifyId: "2ANVost0y2y52ema1E9xAZ",
         *     },
         *     {
         *       album: "Enter the Wu-Tang (36 Chambers)",
         *       artist: "Wu-Tang Clan",
         *       imageUrl:
         *         "https://upload.wikimedia.org/wikipedia/en/5/53/Wu-TangClanEntertheWu-Tangalbumcover.jpg",
         *       spotifyId: "6acGx168JViE5LLFR1rGRE",
         *     },
         *   ],
         *   renderItem: row => ({
         *     label: row.album,
         *     description: row.artist,
         *     image: {
         *       url: row.imageUrl,
         *       aspectRatio: 1,
         *     },
         *   }),
         * });
         * ```
         */
        grid: this.createIOMethod('DISPLAY_GRID', {
          propsRequired: true,
          componentDef: displayGrid,
        }),
        /**
         * Displays a video to the action user. One of url or buffer must be provided.
         *
         * **Usage:**
         *
         * ```typescript
         * await io.display.video("A video", {
         *   url: "https://upload.wikimedia.org/wikipedia/commons/a/ad/The_Kid_scenes.ogv",
         *   size: "medium",
         *   muted: true,
         * });
         * ```
         */
        video: this.createIOMethod('DISPLAY_VIDEO', {
          componentDef: displayVideo,
          propsRequired: true,
        }),
      },
      experimental: {
        spreadsheet: this.createIOMethod('INPUT_SPREADSHEET', {
          propsRequired: true,
          componentDef: spreadsheet,
        }),
      },
    }
  }

  onResponse(result: T_IO_RESPONSE) {
    const inputGroupKey = result.inputGroupKey ?? this.previousInputGroupKey

    if (!inputGroupKey) {
      this.logger.error('Received response without an inputGroupKey')
      return
    }

    const inputGroupHandler = this.onResponseHandlers.get(inputGroupKey)

    if (!inputGroupHandler) {
      this.logger.error(
        'No response handler defined for inputGroupKey',
        inputGroupKey
      )
      return
    }

    try {
      inputGroupHandler(result)
    } catch (err) {
      this.logger.error('Error in input group response handler:', err)
    }
  }
}

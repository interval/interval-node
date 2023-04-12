import Logger from './Logger'
import Interval, { IntervalActionDefinition, Page, QueuedAction } from '..'
import { Ctx } from 'evt'

/**
 * This is effectively a namespace inside of Interval with a little bit of its own state.
 */
export default class Routes {
  protected interval: Interval
  #logger: Logger
  #apiKey?: string
  #endpoint: string
  #groupChangeCtx: Ctx<void>

  constructor(
    interval: Interval,
    endpoint: string,
    logger: Logger,
    ctx: Ctx<void>,
    apiKey?: string
  ) {
    this.interval = interval
    this.#apiKey = apiKey
    this.#logger = logger
    this.#endpoint = endpoint + '/api/actions'
    this.#groupChangeCtx = ctx
  }

  /**
   * @deprecated Use `interval.enqueue()` instead.
   */
  async enqueue(
    slug: string,
    args: Pick<QueuedAction, 'assignee' | 'params'> = {}
  ): Promise<QueuedAction> {
    return this.interval.enqueue(slug, args)
  }

  /**
   * @deprecated Use `interval.dequeue()` instead.
   */
  async dequeue(id: string): Promise<QueuedAction> {
    return this.interval.dequeue(id)
  }

  add(slug: string, route: IntervalActionDefinition | Page) {
    if (!this.interval.config.routes) {
      this.interval.config.routes = {}
    }

    if (route instanceof Page) {
      route.onChange.attach(this.#groupChangeCtx, () => {
        this.interval.client?.handleActionsChange(this.interval.config)
      })
    }

    this.interval.config.routes[slug] = route
    this.interval.client?.handleActionsChange(this.interval.config)
  }

  remove(slug: string) {
    for (const key of ['routes', 'actions', 'groups'] as const) {
      const routes = this.interval.config[key]

      if (!routes) continue
      const route = routes[slug]
      if (!route) continue

      if (route instanceof Page) {
        route.onChange.detach(this.#groupChangeCtx)
      }

      delete routes[slug]

      this.interval.client?.handleActionsChange(this.interval.config)
      return
    }
  }
}

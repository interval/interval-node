import { Evt } from 'evt'
import {
  PageCtx,
  IO,
  IntervalActionDefinition,
  IntervalActionDefinitions,
} from '../types'
import { Page } from './Page'

export interface ActionGroupConfig {
  name: string
  description?: string
  actions?: IntervalActionDefinitions
  groups?: Record<string, ActionGroup>
  render?: (display: IO['display'], ctx: PageCtx) => Promise<Page>
}

export default class ActionGroup {
  name: string
  description?: string
  actions: IntervalActionDefinitions
  render?: (display: IO['display'], ctx: PageCtx) => Promise<Page>

  onChange: Evt<void>
  #groupChangeCtx = Evt.newCtx()

  constructor(config: ActionGroupConfig) {
    this.name = config.name
    this.description = config.description
    this.actions = config.actions ?? {}
    this.render = config.render
    this.onChange = new Evt()

    for (const actionOrGroup of Object.values(this.actions)) {
      if (actionOrGroup instanceof ActionGroup) {
        actionOrGroup.onChange.attach(this.#groupChangeCtx, this.onChange.post)
      }
    }
  }

  add(slug: string, actionOrGroup: IntervalActionDefinition | ActionGroup) {
    this.actions[slug] = actionOrGroup

    if (actionOrGroup instanceof ActionGroup) {
      actionOrGroup.onChange.attach(this.#groupChangeCtx, this.onChange.post)
    }

    this.onChange.post()
  }

  remove(slug: string) {
    const actionOrGroup = this.actions[slug]
    if (actionOrGroup) {
      if (actionOrGroup instanceof ActionGroup) {
        actionOrGroup.onChange.detach(this.#groupChangeCtx)
      }

      delete this.actions[slug]
      this.onChange.post()
    }
  }
}

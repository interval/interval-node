import { Evt } from 'evt'
import { IntervalActionDefinition, IntervalActionDefinitions } from '../types'

export interface ActionGroupConfig {
  name: string
  actions: IntervalActionDefinitions
  groups?: Record<string, ActionGroup>
}

export default class ActionGroup {
  name: string
  actions: IntervalActionDefinitions
  groups: Record<string, ActionGroup> = {}

  onChange: Evt<void>
  #groupChangeCtx = Evt.newCtx()

  constructor(config: ActionGroupConfig) {
    this.name = config.name
    this.actions = config.actions
    this.groups = config.groups ?? {}
    this.onChange = new Evt()

    for (const group of Object.values(this.groups)) {
      group.onChange.attach(this.#groupChangeCtx, this.onChange.post)
    }
  }

  use(groupSlug: string, group: ActionGroup) {
    group.onChange.attach(this.#groupChangeCtx, this.onChange.post)
    this.groups[groupSlug] = group
    this.onChange.post()
  }

  unuse(groupSlug: string) {
    const group = this.groups[groupSlug]
    if (!group) return

    group.onChange.detach(this.#groupChangeCtx)
    delete this.groups[groupSlug]
  }

  add(slug: string, action: IntervalActionDefinition) {
    this.actions[slug] = action

    this.onChange.post()
  }

  remove(slug: string) {
    if (this.actions[slug]) {
      delete this.actions[slug]
      this.onChange.post()
    }
  }
}

import { IntervalActionDefinitions } from '../types'

export interface ActionGroupConfig {
  name: string
  actions: IntervalActionDefinitions
}

export default class ActionGroup {
  name: string
  actions: IntervalActionDefinitions
  groups: Record<string, ActionGroup> = {}

  constructor(config: ActionGroupConfig) {
    this.name = config.name
    this.actions = config.actions
  }

  use(groupSlug: string, group: ActionGroup) {
    this.groups[groupSlug] = group
  }
}

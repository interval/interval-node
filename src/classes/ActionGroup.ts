import { IntervalActionDefinitions } from '../types'

export default class ActionGroup {
  name: string
  actions: IntervalActionDefinitions
  groups: Record<string, ActionGroup> = {}

  constructor(name: string, actions: IntervalActionDefinitions) {
    this.name = name
    this.actions = actions
  }

  use(groupSlug: string, group: ActionGroup) {
    this.groups[groupSlug] = group
  }
}

import { Evt } from 'evt'
import {
  PageCtx,
  IO,
  IntervalActionDefinition,
  IntervalActionDefinitions,
} from '../types'
import { Layout } from './Layout'

export interface RouterConfig {
  name: string
  description?: string
  routes?: IntervalActionDefinitions
  index?: (display: IO['display'], ctx: PageCtx) => Promise<Layout>
}

export default class Router {
  name: string
  description?: string
  routes: IntervalActionDefinitions
  index?: (display: IO['display'], ctx: PageCtx) => Promise<Layout>

  onChange: Evt<void>
  #groupChangeCtx = Evt.newCtx()

  constructor(config: RouterConfig) {
    this.name = config.name
    this.description = config.description
    this.routes = config.routes ?? {}
    this.index = config.index
    this.onChange = new Evt()

    for (const actionOrGroup of Object.values(this.routes)) {
      if (actionOrGroup instanceof Router) {
        actionOrGroup.onChange.attach(this.#groupChangeCtx, this.onChange.post)
      }
    }
  }

  add(slug: string, route: IntervalActionDefinition | Router) {
    this.routes[slug] = route

    if (route instanceof Router) {
      route.onChange.attach(this.#groupChangeCtx, this.onChange.post)
    }

    this.onChange.post()
  }

  remove(slug: string) {
    const route = this.routes[slug]
    if (route) {
      if (route instanceof Router) {
        route.onChange.detach(this.#groupChangeCtx)
      }

      delete this.routes[slug]
      this.onChange.post()
    }
  }
}

import { z } from 'zod'
import { primitiveValue, Literal, IO_RENDER } from '../ioSchema'
import { AnyDisplayIOPromise } from '../types'

type EventualString =
  | string
  | Promise<string>
  | (() => string)
  | (() => Promise<string>)

interface PageConfig {
  title?: EventualString
  description?: EventualString
  children: AnyDisplayIOPromise[]
}

// Base class
export class Page {
  title?: EventualString
  description?: EventualString
  children: AnyDisplayIOPromise[]

  constructor({ title, description, children }: PageConfig) {
    this.title = title
    this.description = description
    this.children = children
  }
}

export interface MetaItem {
  label: string
  value: Literal | Promise<Literal> | (() => Literal) | (() => Promise<Literal>)
}

interface ResourceConfig extends PageConfig {
  metadata?: MetaItem[]
}

export class Resource extends Page {
  metadata?: MetaItem[]

  constructor(config: ResourceConfig) {
    super(config)
    this.metadata = config.metadata
  }
}

export const META_ITEM_SCHEMA = z.object({
  label: z.string(),
  value: primitiveValue.nullish(),
})

export type MetaItemSchema = z.infer<typeof META_ITEM_SCHEMA>

// For superjson (de)serialization
export const META_ITEMS_SCHEMA = z.object({
  json: z.array(META_ITEM_SCHEMA),
  meta: z.any(),
})

export type MetaItemsSchema = z.infer<typeof META_ITEMS_SCHEMA>

export const RESOURCE_PAGE_SCHEMA = z.object({
  kind: z.literal('RESOURCE'),
  title: z.string().nullish(),
  description: z.string().nullish(),
  children: IO_RENDER.optional(),
  metadata: META_ITEMS_SCHEMA.optional(),
})

// To be extended with z.discriminatedUnion when adding different pages
export const PAGE_SCHEMA = RESOURCE_PAGE_SCHEMA

export type PageSchema = z.infer<typeof PAGE_SCHEMA>
export type PageSchemaInput = z.input<typeof PAGE_SCHEMA>
export type ResourcePageSchema = z.infer<typeof RESOURCE_PAGE_SCHEMA>
export type ResourcePageSchemaInput = z.input<typeof RESOURCE_PAGE_SCHEMA>

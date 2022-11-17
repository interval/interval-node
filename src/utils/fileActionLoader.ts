/**
 * Loads actions from the file system
 */
import path from 'path'
import fs from 'fs/promises'

import Action from '../classes/Action'
import Page from '../classes/Page'
import Logger from '../classes/Logger'

async function loadFolder(currentDirectory: string, logger: Logger) {
  const absPath = path.resolve(currentDirectory)
  const dirName = path.basename(absPath)
  const files = await fs.readdir(absPath)

  let router = new Page({
    name: slugToName(dirName),
  })

  for (const file of files) {
    const fullPath = path.resolve(currentDirectory, file)

    if (file.endsWith('.d.ts')) {
      continue
    }

    const ext = path.extname(file)
    const slug = path.basename(file, ext || undefined)
    if ((await fs.stat(fullPath)).isDirectory()) {
      const group = await loadFolder(path.join(currentDirectory, slug), logger)
      router.routes[slug] = group
    } else if (ext === '.ts' || ext === '.js') {
      try {
        const fileExports = await import(fullPath)

        if (slug === 'index') {
          if ('default' in fileExports) {
            if (fileExports.default instanceof Page) {
              Object.assign(fileExports.default.routes, router.routes)
              router = fileExports.default
            } else {
              logger.warn(
                `Default export of ${fullPath} is not a Page class instance, skipping.`
              )
            }
          }
        } else {
          if ('default' in fileExports) {
            if (
              fileExports.default instanceof Page ||
              fileExports.default instanceof Action
            ) {
              router.routes[slug] = fileExports.default
            } else {
              logger.warn(
                `Default export of ${fullPath} is not a Page or Action class instance, skipping.`
              )
            }
          }
        }
      } catch (err) {
        logger.error(
          `Failed loading file at ${fullPath} as module, skipping.`,
          err
        )
      }
    }
  }

  return router
}

export default async function loadRoutesFromFileSystem(
  dirPath: string,
  logger: Logger
) {
  const { routes } = await loadFolder(dirPath, logger)
  return routes
}

function ucfirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.substring(1)
}

function slugToName(slug: string): string {
  if (slug.includes('/')) {
    slug = slug.substring(slug.lastIndexOf('/') + 1)
  }

  if (slug === slug.toUpperCase()) {
    slug = slug.toLowerCase()
  }

  // Don't split on multiple caps in a row like URL
  const matches = slug.match(/[A-Z][A-Z]+/g)
  if (matches && matches.length) {
    for (const match of matches) {
      const toReplace = match.substring(0, match.length - 1)
      slug = slug.replace(toReplace, ` ${toReplace.toLowerCase()} `)
    }
  }

  return ucfirst(
    slug
      .replace(/[-_.]+/g, ' ')
      // Split on camelCase and whitespace
      .split(/((?!^)(?=[A-Z]))|\s+/g)
      .filter(Boolean)
      .map(s => s.trim())
      .filter(s => s.length)
      .map(s => s.toLowerCase())
      .join(' ')
  )
}

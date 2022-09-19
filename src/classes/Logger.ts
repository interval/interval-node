import type { SdkAlert } from '../internalRpcSchema'
import {
  detectPackageManager,
  getInstallCommand,
} from '../utils/packageManager'
import * as pkg from '../../package.json'

export type LogLevel = 'prod' | 'debug'

export const CHANGELOG_URL = 'https://interval.com/changelog'

export default class Logger {
  logLevel: LogLevel = 'prod'

  constructor(logLevel?: LogLevel) {
    if (logLevel) {
      this.logLevel = logLevel
    }
  }

  prod(...args: any[]) {
    console.log('[Interval] ', ...args)
  }

  warn(...args: any[]) {
    console.warn('[Interval] ', ...args)
  }

  error(...args: any[]) {
    console.error('[Interval] ', ...args)
  }

  debug(...args: any[]) {
    if (this.logLevel === 'debug') {
      console.debug('[Interval] ', ...args)
    }
  }

  handleSdkAlert(sdkAlert: SdkAlert) {
    console.log('')

    const WARN_EMOJI = '\u26A0\uFE0F'
    const ERROR_EMOJI = '‼️'

    const { severity, message } = sdkAlert

    switch (severity) {
      case 'INFO':
        this.prod('🆕\tA new Interval SDK version is available.')
        break
      case 'WARNING':
        this.prod(
          `${WARN_EMOJI}\tThis version of the Interval SDK has been deprecated. Please update as soon as possible, it will not work in a future update.`
        )
        break
      case 'ERROR':
        this.prod(
          `${ERROR_EMOJI}\tThis version of the Interval SDK is no longer supported. Your app will not work until you update.`
        )
        break
    }

    if (message) {
      this.prod(message)
    }

    this.prod("\t- See what's new at:", CHANGELOG_URL)
    this.prod(
      '\t- Update now by running:',
      getInstallCommand(`${pkg.name}@latest`, detectPackageManager())
    )

    console.log('')
  }
}

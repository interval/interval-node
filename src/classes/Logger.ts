export type LogLevel = 'prod' | 'debug'

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
    console.warn(...args)
  }

  error(...args: any[]) {
    console.error(...args)
  }

  debug(...args: any[]) {
    if (this.logLevel === 'debug') {
      console.debug(...args)
    }
  }
}

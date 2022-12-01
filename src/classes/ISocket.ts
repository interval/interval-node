import type { WebSocket as NodeWebSocket } from 'ws'
import type { DataChannel } from 'node-datachannel'
import { Evt } from 'evt'
import { v4 } from 'uuid'
import { z } from 'zod'

const MESSAGE_META = z.object({
  data: z.any(),
  id: z.string(),
  type: z.union([z.literal('ACK'), z.literal('MESSAGE')]),
})

export class TimeoutError extends Error {}

export class NotConnectedError extends Error {}

interface PendingMessage {
  data: string
  onAckReceived: () => void
}

interface ISocketConfig {
  connectTimeout?: number
  sendTimeout?: number
  pingTimeout?: number
  id?: string // manually specifying ids is helpful for debugging
}

export class DataChannelSocket {
  dc: DataChannel | RTCDataChannel
  #readyState: string = 'connecting'

  constructor(dc: DataChannel | RTCDataChannel) {
    this.dc = dc
  }

  public static OPEN = 'open' as const

  get readyState(): string {
    if ('readyState' in this.dc) {
      return this.dc.readyState
    }

    return this.#readyState
  }

  get OPEN() {
    return DataChannelSocket.OPEN
  }

  send(message: string) {
    if ('sendMessage' in this.dc) {
      // node
      this.dc.sendMessage(message)
    } else {
      // web
      this.dc.send(message)
    }
  }

  get maxMessageSize(): number {
    // This is unreliable, is the max size the other end supports but not necessarily what the originating end supports.
    // Also it's not always implemented in browsers yet, for some reason.
    //
    // if ('maxMessageSize' in this.dc) {
    //   return this.dc.maxMessageSize()
    // }

    // Firefox can support up to 1GB, but this is the safe lower-bound assumption for compatibility
    // https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels#concerns_with_large_messages
    return 16_000
  }

  close(code?: number, reason?: string) {
    // TODO: Do something with codes?
    this.#readyState = 'closing'
    this.dc.close()
  }

  set onopen(cb: () => void) {
    if ('onOpen' in this.dc) {
      // node
      this.dc.onOpen(cb)
    } else {
      // web
      this.dc.onopen = cb
    }
  }

  set onclose(cb: () => void) {
    const handleClose = () => {
      this.#readyState = 'closed'
      cb()
    }
    if ('onClosed' in this.dc) {
      // node
      this.dc.onClosed(handleClose)
    } else {
      // web
      this.dc.onclose = handleClose
    }
  }

  set onerror(cb: (ev: ErrorEvent | Event) => void) {
    if ('onError' in this.dc) {
      // node
      this.dc.onError((err: string) => {
        // ??
        cb(
          new ErrorEvent('ErrorEvent', {
            message: err,
          })
        )
      })
    } else {
      // web
      this.dc.onerror = cb
    }
  }

  set onmessage(cb: (evt: MessageEvent) => void) {
    if ('onMessage' in this.dc) {
      // node
      this.dc.onMessage((msg: string | Buffer) => {
        cb(
          new MessageEvent('MessageEvent', {
            data: msg,
          })
        )
      })
    } else {
      // web
      this.dc.onmessage = cb
    }
  }
}

/**
 * A relatively thin wrapper around an underlying WebSocket connection. Can be thought of as a TCP layer on top of WebSockets,
 * ISockets send and expect `ACK` messages following receipt of a `MESSAGE` message containing the transmitted data.
 * Can also ping its connected counterpart to determine if the
 * connection has been lost.
 *
 * @property connectTimeout - The number of ms that this ISocket will
 * wait to establish connection to its counterpart before rejecting
 * the `connect` Promise.
 * @property sendTimeout - The number of ms that this ISocket will
 * wait to receive an `ACK` response after sending a `MESSAGE`
 * before rejecting the `send` Promise.
 * @property pingTimeout - The number of ms that this ISocket will
 * wait to receive a `pong` after sending a `ping` before
 * rejecting the `ping` Promise.
 */
export default class ISocket {
  private ws: WebSocket | NodeWebSocket | DataChannelSocket
  private connectTimeout: number
  private sendTimeout: number
  private pingTimeout: number
  private isAuthenticated: boolean
  private timeouts: Set<NodeJS.Timeout>
  private isClosed = false
  onMessage: Evt<string>
  onOpen: Evt<void>
  onError: Evt<Error>
  onClose: Evt<[number, string]>
  onAuthenticated: Evt<void>
  id: string

  private pendingMessages = new Map<string, PendingMessage>()

  get maxMessageSize(): number | undefined {
    if ('maxMessageSize' in this.ws) {
      return this.ws.maxMessageSize
    }

    return undefined
  }

  /** Client **/
  /**
   * Establishes an ISocket connection to the connected WebSocket
   * counterpart, throwing an error if connection is not established
   * within `connectTimeout`.
   */
  async connect() {
    return new Promise<void>((resolve, reject) => {
      if (this.ws.readyState === this.ws.OPEN && this.isAuthenticated) {
        return resolve()
      }

      const failTimeout = setTimeout(
        () => reject(new TimeoutError()),
        this.connectTimeout
      )

      this.timeouts.add(failTimeout)

      this.onAuthenticated.attach(() => {
        clearTimeout(failTimeout)
        this.timeouts.delete(failTimeout)
        return resolve()
      })
    })
  }

  /** Server **/
  async confirmAuthentication() {
    return this.send('authenticated')
    // .then(() => console.log('Client knows it is authenticated'))
    // .catch(e => console.log('client does not know its authenticated'))
  }

  /** Both **/
  /**
   * Send a `MESSAGE` containing data to the connected counterpart,
   * throwing an error if `ACK` is not received within `sendTimeout`.
   */
  async send(data: string) {
    if (this.isClosed) throw new NotConnectedError()

    return new Promise<void>((resolve, reject) => {
      const id = v4()

      const failTimeout = setTimeout(() => {
        reject(new TimeoutError())
      }, this.sendTimeout)

      this.timeouts.add(failTimeout)

      this.pendingMessages.set(id, {
        data,
        onAckReceived: () => {
          clearTimeout(failTimeout)
          this.timeouts.delete(failTimeout)
          resolve()
        },
      })
      this.ws.send(JSON.stringify({ id, data, type: 'MESSAGE' }))
    })
  }

  /** Both **/
  /**
   * Close the underlying WebSocket connection, and this ISocket
   * connection.
   */
  close(code?: number, reason?: string) {
    this.isClosed = true
    this.onMessage.detach()
    return this.ws.close(code, reason)
  }

  constructor(
    ws: WebSocket | NodeWebSocket | DataChannelSocket,
    config?: ISocketConfig
  ) {
    // this works but on("error") does not. No idea why ¯\_(ツ)_/¯
    // will emit "closed" regardless
    // this.ws.addEventListener('error', e => {
    //   this.dispatchEvent(e)
    // })

    this.onMessage = new Evt<string>()
    this.onOpen = new Evt<void>()
    this.onError = new Evt<Error>()
    this.onClose = new Evt<[number, string]>()
    this.onAuthenticated = new Evt<void>()
    this.timeouts = new Set()

    this.ws = ws

    this.id = config?.id || v4()
    this.connectTimeout = config?.connectTimeout ?? 15_000
    this.sendTimeout = config?.sendTimeout ?? 3000
    this.pingTimeout = config?.pingTimeout ?? 3000
    this.isAuthenticated = false

    this.onClose.attach(() => {
      this.isClosed = true
      for (const timeout of this.timeouts) {
        clearTimeout(timeout)
      }
      this.timeouts.clear()
    })

    this.ws.onopen = () => {
      this.isClosed = false
      this.onOpen.post()
    }

    this.ws.onclose = (ev?: CloseEvent) => {
      this.onClose.post([ev?.code ?? 0, ev?.reason ?? 'Unknown'])
    }

    this.ws.onerror = (ev: ErrorEvent | Event) => {
      const message = 'message' in ev ? ev.message : 'Unknown error'
      this.onError.post(new Error(message))
    }

    this.ws.onmessage = (evt: MessageEvent) => {
      // only in browser
      if (evt.stopPropagation) {
        evt.stopPropagation()
      }

      if (this.isClosed) return

      const data = JSON.parse(evt.data.toString())
      const meta = MESSAGE_META.parse(data)

      if (meta.type === 'ACK') {
        const pm = this.pendingMessages.get(meta.id)
        if (pm) {
          pm.onAckReceived()
          this.pendingMessages.delete(meta.id)
        }
      }
      if (meta.type === 'MESSAGE') {
        ws.send(JSON.stringify({ type: 'ACK', id: meta.id }))
        if (meta.data === 'authenticated') {
          this.isAuthenticated = true
          this.onAuthenticated.post()
        } else if (meta.data === 'ping') {
          // do nothing
        } else {
          this.onMessage.post(meta.data)
        }
      }
    }

    if ('pong' in ws) {
      ws.on('pong', buf => {
        const id = buf.toString()
        const pm = this.pendingMessages.get(id)
        if (pm?.data === 'ping') {
          pm.onAckReceived()
        }
      })
    }
  }

  get isPingSupported() {
    return 'ping' in this.ws
  }

  get readyState() {
    return this.ws.readyState
  }

  /** Both **/
  /**
   * Ping the connected counterpart, throwing a TimeoutError if a
   * `pong` is not received within `pingTimeout`.
   */
  async ping() {
    if (this.isClosed) throw new NotConnectedError()

    const ws = this.ws
    return new Promise<void>((resolve, reject) => {
      const pongTimeout = setTimeout(
        () => reject(new TimeoutError('Pong not received in time')),
        this.pingTimeout
      )
      this.timeouts.add(pongTimeout)

      const id = v4()
      this.pendingMessages.set(id, {
        data: 'ping',
        onAckReceived: () => {
          clearTimeout(pongTimeout)
          this.timeouts.delete(pongTimeout)
          resolve()
        },
      })

      if ('ping' in ws) {
        ws.ping(id, undefined, err => {
          if (err) {
            reject(err)
          }
        })
      } else {
        ws.send(JSON.stringify({ type: 'MESSAGE', id, data: 'ping' }))
      }
    })
  }
}

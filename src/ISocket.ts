import type { WebSocket as NodeWebSocket } from 'ws'
import { Evt } from 'evt'
import { v4 } from 'uuid'
import { z } from 'zod'

const MESSAGE_META = z.object({
  data: z.any(),
  id: z.string(),
  type: z.union([z.literal('ACK'), z.literal('MESSAGE')]),
})

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

export default class ISocket {
  private ws: WebSocket | NodeWebSocket
  private connectTimeout: number
  private sendTimeout: number
  private pingTimeout: number
  private isAuthenticated: boolean
  private timeouts: Set<NodeJS.Timeout>
  onMessage: Evt<string>
  onOpen: Evt<void>
  onError: Evt<Error>
  onClose: Evt<[number, string]>
  onAuthenticated: Evt<void>
  id: string

  private pendingMessages = new Map<string, PendingMessage>()

  /** Client **/
  async connect() {
    return new Promise<void>((resolve, reject) => {
      if (this.ws.readyState === this.ws.OPEN && this.isAuthenticated) {
        return resolve()
      }

      const failTimeout = setTimeout(
        () => reject('Socket did not connect on time'),
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
  confirmAuthentication() {
    this.send('authenticated')
    // .then(() => console.log('Client knows it is authenticated'))
    // .catch(e => console.log('client does not know its authenticated'))
  }

  /** Both **/
  async send(data: string) {
    return new Promise<void>((resolve, reject) => {
      const id = v4()

      const failTimeout = setTimeout(
        () => reject('Socket did not respond on time'),
        this.sendTimeout
      )

      this.pendingMessages.set(id, {
        data,
        onAckReceived: () => {
          clearTimeout(failTimeout)
          this.timeouts.delete(failTimeout)
          resolve()
        },
      })
      this.ws.send(JSON.stringify({ id, data, type: 'MESSAGE' }))
    }).catch(err => {
      console.error(err)
    })
  }

  /** Client **/
  close() {
    return this.ws.close()
  }

  constructor(ws: WebSocket | NodeWebSocket, config?: ISocketConfig) {
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
      for (const timeout of this.timeouts) {
        clearTimeout(timeout)
      }
      this.timeouts.clear()
    })

    this.ws.onopen = () => {
      this.onOpen.post()
    }

    this.ws.onclose = (ev: CloseEvent) => {
      this.onClose.post([ev.code, ev.reason])
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
          return
        }
        this.onMessage.post(meta.data)
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

  /** Both **/
  async ping() {
    if (!('ping' in this.ws)) {
      // Not supported in web client WebSocket
      throw new Error(
        'ping not supported in this underlying websocket connection'
      )
    }

    const ws = this.ws
    return new Promise<void>((resolve, reject) => {
      const pongTimeout = setTimeout(
        () => reject('Pong not received in time'),
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
      ws.ping(id, undefined, err => {
        if (err) {
          reject(err)
        }
      })
    })
  }
}

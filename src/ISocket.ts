import type { WebSocket as NodeWebSocket } from 'ws'
import { Evt, to } from 'evt'
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
  id?: string // manually specifying ids is helpful for debugging
}

export default class ISocket {
  private ws: WebSocket | NodeWebSocket
  private connectTimeout: number
  private sendTimeout: number
  private isAuthenticated: boolean
  onMessage: Evt<string>
  onOpen: Evt<void>
  onError: Evt<Error>
  onClose: Evt<[number, string]>
  onAuthenticated: Evt<void>
  id: string

  private pendingMessages = new Map<string, PendingMessage>()

  connect() {
    return new Promise<void>((resolve, reject) => {
      if (this.ws.readyState === this.ws.OPEN && this.isAuthenticated) {
        return resolve()
      }

      const failTimeout = setTimeout(
        () => reject('Socket did not connect on time'),
        this.connectTimeout
      )

      this.onAuthenticated.attach(() => {
        clearTimeout(failTimeout)
        return resolve()
      })

      this.onClose.attach(() => {
        clearTimeout(failTimeout)
      })
    })
  }

  confirmAuthentication() {
    this.send('authenticated')
    // .then(() => console.log('Client knows it is authenticated'))
    // .catch(e => console.log('client does not know its authenticated'))
  }

  send(data: string) {
    return new Promise<void>((resolve, reject) => {
      const id = v4()

      const failTimeout = setTimeout(
        () => reject('Socket did not respond on time'),
        this.sendTimeout
      )

      // FIXME: This adds a new handler every time data is sent, not sustainable
      this.onClose.attach(() => {
        clearTimeout(failTimeout)
      })

      this.pendingMessages.set(id, {
        data,
        onAckReceived: () => {
          clearTimeout(failTimeout)
          resolve()
        },
      })
      this.ws.send(JSON.stringify({ id, data, type: 'MESSAGE' }))
    })
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

    this.ws = ws

    this.id = config?.id || v4()
    this.connectTimeout = config?.connectTimeout || 15_000
    this.sendTimeout = config?.sendTimeout || 3000
    this.isAuthenticated = false

    this.ws.onopen = () => {
      this.onOpen.post()
    }

    this.ws.onclose = (ev: CloseEvent) => {
      this.onClose.post([ev.code, ev.reason])
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
  }
}

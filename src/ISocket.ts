import type { WebSocket as NodeWebSocket } from 'ws'
import { EventEmitter as EE } from 'ee-ts'
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

interface Events {
  message: (message: string) => void
  open: () => void
  error: (error: Error) => void
  close: (code: number, reason: string) => void
  authenticated: () => void
}

interface ISocketConfig {
  connectTimeout?: number
  sendTimeout?: number
  id?: string // manually specifying ids is helpful for debugging
}

export default class ISocket extends EE<Events> {
  private ws: WebSocket | NodeWebSocket
  private connectTimeout: number
  private sendTimeout: number
  private isAuthenticated: boolean
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

      this.on('authenticated', () => {
        clearTimeout(failTimeout)
        return resolve()
      })

      this.on('close', () => {
        clearTimeout(failTimeout)
      })
    })
  }

  confirmAuthentication() {
    this.send('authenticated')
      .then(() => console.log('Client knows it is authenticated'))
      .catch(e => console.log('client does not know its authenticated'))
  }

  send(data: string) {
    return new Promise<void>((resolve, reject) => {
      const id = v4()

      const failTimeout = setTimeout(
        () => reject('Socket did not respond on time'),
        this.sendTimeout
      )

      this.on('close', () => {
        clearTimeout(failTimeout)
      })

      this.pendingMessages.set(id, {
        data,
        onAckReceived: () => {
          clearTimeout(failTimeout)
          resolve()
        },
      })
      console.log('sending', { id, data })
      this.ws.send(JSON.stringify({ id, data, type: 'MESSAGE' }))
    })
  }

  constructor(ws: WebSocket | NodeWebSocket, config?: ISocketConfig) {
    super()

    // this works but on("error") does not. No idea why ¯\_(ツ)_/¯
    // will emit "closed" regardless
    // this.ws.addEventListener('error', e => {
    //   this.dispatchEvent(e)
    // })

    this.ws = ws

    this.id = config?.id || v4()
    this.connectTimeout = config?.connectTimeout || 15_000
    this.sendTimeout = config?.sendTimeout || 3000
    this.isAuthenticated = false

    this.ws.onopen = () => {
      this.emit('open')
    }

    this.ws.onclose = (ev: CloseEvent) => {
      this.emit('close', ev.code, ev.reason)
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
          this.emit('authenticated')
          return
        }
        this.emit('message', meta.data)
      }
    }
  }
}

import type { WebSocket as NodeWebSocket } from "ws";
import { EventEmitter as EE } from "ee-ts";
import { v4 } from "uuid";
import { z } from "zod";

const MESSAGE_META = z.object({
  data: z.any(),
  id: z.string(),
  type: z.union([z.literal("ACK"), z.literal("MESSAGE")]),
});

interface PendingMessage {
  data: string;
  onAckReceived: () => void;
}

interface Events {
  message: (message: string) => void;
  open: () => void;
  error: (error: Error) => void;
  close: () => void;
}

interface ISocketConfig {
  timeout?: number;
  id?: string; // manually specifying ids is helpful for debugging
}

export default class ISocket extends EE<Events> {
  private ws: WebSocket | NodeWebSocket;
  private timeout: number;
  id: string;

  pendingMessages = new Map<string, PendingMessage>();

  connect() {
    return new Promise<void>((resolve, reject) => {
      if (this.ws.readyState === this.ws.OPEN) {
        return resolve();
      }

      const failTimeout = setTimeout(
        () => reject("Socket did not connect on time"),
        this.timeout
      );

      this.on("open", () => {
        clearTimeout(failTimeout);
        return resolve();
      });
    });
  }

  send(data: string) {
    return new Promise<void>((resolve, reject) => {
      const id = v4();

      const failTimeout = setTimeout(
        () => reject("Socket did not respond on time"),
        this.timeout
      );

      this.pendingMessages.set(id, {
        data,
        onAckReceived: () => {
          clearTimeout(failTimeout);
          resolve();
        },
      });
      this.ws.send(JSON.stringify({ id, data, type: "MESSAGE" }));
    });
  }

  constructor(ws: WebSocket | NodeWebSocket, config?: ISocketConfig) {
    super();

    // this works but on("error") does not. No idea why ¯\_(ツ)_/¯
    // will emit "closed" regardless
    // this.ws.addEventListener('error', e => {
    //   this.dispatchEvent(e)
    // })

    this.ws = ws;

    this.id = config?.id || v4();
    this.timeout = config?.timeout || 3000;

    this.ws.onopen = () => {
      this.emit("open");
    };

    this.ws.onclose = () => {
      this.emit("close");
    };

    this.ws.onmessage = (evt: MessageEvent) => {
      // only in browser
      if (evt.stopPropagation) {
        evt.stopPropagation();
      }
      const data = JSON.parse(evt.data.toString());
      const meta = MESSAGE_META.parse(data);

      if (meta.type === "ACK") {
        const pm = this.pendingMessages.get(meta.id);
        if (pm) {
          pm.onAckReceived();
          this.pendingMessages.delete(meta.id);
        }
      }
      if (meta.type === "MESSAGE") {
        ws.send(JSON.stringify({ type: "ACK", id: meta.id }));
        this.emit("message", meta.data);
      }
    };
  }
}

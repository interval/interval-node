import { WebSocket } from "ws";
import ISocket from "../../common/ISocket";
import { createCaller } from "../../common/rpc";
import { internalRpcSchema } from "../../common/internalRpcSchema";

interface InternalConfig {
  apiKey: string;
}

export default async function createIntervalHost(config: InternalConfig) {
  console.log("Create Interval Host :)", config);
  const ws = new ISocket(new WebSocket("ws://localhost:2023"), {
    timeout: 3000,
  });

  await ws.connect();

  const caller = createCaller({
    schema: internalRpcSchema,
    send: (rawInput) => ws.send(rawInput),
  });
  ws.on("message", (m) => caller.replyHandler(m));

  const lo = await caller.client("LOGIN", { apiKey: config.apiKey });
  console.log("Login response:", lo);

  return true;
}

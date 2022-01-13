import { WebSocket } from "ws";
import ISocket from "../../common/ISocket";
import { createCaller } from "../../common/rpc";
import { internalRpcSchema } from "../../common/internalRpcSchema";

interface InternalConfig {
  apiKey: string;
}

export default async function createIntervalHost(config: InternalConfig) {
  console.log("Create Interval Host :)", config);
  const ws = new ISocket(new WebSocket("ws://localhost:2023"));

  await ws.connect();

  const caller = createCaller({
    schema: internalRpcSchema,
    send: (rawInput) => ws.send(rawInput),
  });
  ws.on("message", (m) => caller.replyHandler(m));

  const loggedIn = await caller.client("LOGIN", { apiKey: config.apiKey });
  if (!loggedIn) throw new Error("The provided API key is not valid");

  return true;
}

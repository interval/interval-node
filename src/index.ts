import { WebSocket } from "ws";
interface InternalConfig {
  name: string;
}

export default function createIntervalHost(config: InternalConfig) {
  console.log("Create internal app!");
  const ws = new WebSocket("ws://localhost:2023");
  ws.onclose = () => console.log("closed");
  ws.onopen = async () => {
    console.log("Connected, making caller!");
  };

  return true;
}

import { PeerConnection, IceServer } from 'node-datachannel'
import type { DuplexRPCClient } from './DuplexRPCClient'
import {
  HostSchema,
  PeerConnectionInitializer,
  ClientSchema,
  clientSchema,
} from '../internalRpcSchema'
import ISocket, { DataChannelSocket, ISocketConfig } from './ISocket'

export default class DataChannelConnection {
  peer: PeerConnection
  ds?: DataChannelSocket
  rpc?: DuplexRPCClient<ClientSchema, HostSchema>

  constructor({
    id,
    iceServers,
    send,
    rpcConstructor,
    isocketConfig,
  }: {
    id: string
    iceServers: (string | IceServer)[]
    send: PeerConnectionInitializer
    rpcConstructor: (props: {
      communicator: ISocket
      canCall: ClientSchema
    }) => DuplexRPCClient<ClientSchema, HostSchema>
    isocketConfig?: ISocketConfig
  }) {
    this.peer = new PeerConnection(id, {
      iceServers,
    })
    // For some reason these cause segfaults?
    // this.peer.onStateChange(state => {
    //   console.log('State:', state)
    // })
    // this.peer.onGatheringStateChange(state => {
    //   console.log('GatheringState:', state)
    // })
    this.peer.onLocalDescription((description, type) => {
      send({ id, type, description })
    })
    this.peer.onLocalCandidate((candidate, mid) => {
      send({ id, type: 'candidate', candidate, mid })
    })
    this.peer.onDataChannel(dc => {
      const ds = new DataChannelSocket(dc)
      this.ds = ds

      const communicator = new ISocket(ds, { id, ...isocketConfig })

      this.rpc = rpcConstructor({
        communicator,
        canCall: clientSchema,
      })
    })
  }
}

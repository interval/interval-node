import { PeerConnection } from 'node-datachannel'
import type { DuplexRPCClient } from './DuplexRPCClient'
import {
  HostSchema,
  PeerConnectionInitializer,
  ClientSchema,
  clientSchema,
} from '../internalRpcSchema'
import ISocket, { DataChannelSocket } from './ISocket'

export default class DataChannelConnection {
  peer: PeerConnection
  ds?: DataChannelSocket
  rpc?: DuplexRPCClient<ClientSchema, HostSchema>

  constructor({
    id,
    send,
    rpcConstructor,
  }: {
    id: string
    send: PeerConnectionInitializer
    rpcConstructor: (props: {
      communicator: ISocket
      canCall: ClientSchema
    }) => DuplexRPCClient<ClientSchema, HostSchema>
  }) {
    this.peer = new PeerConnection(id, {
      iceServers: [
        'stun:stun.l.google.com:19302',
        'stun:global.stun.twilio.com:3478',
      ],
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

      const communicator = new ISocket(ds)

      this.rpc = rpcConstructor({
        communicator,
        canCall: clientSchema,
      })
    })
  }
}

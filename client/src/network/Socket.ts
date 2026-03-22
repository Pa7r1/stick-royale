// ─────────────────────────────────────────────────────────────
//  STICK ROYALE — Socket.IO Client Wrapper
// ─────────────────────────────────────────────────────────────

import { io, Socket } from 'socket.io-client'
import { EVENTS, type PlayerInput, type ShootPayload } from 'shared'

export class SocketClient {
  private socket: Socket
  private _id: string | null = null
  private inputSeq = 0

  constructor() {
    this.socket = io({
      transports:        ['websocket'],
      reconnectionDelay: 1000,
      timeout:           5000,
    })

    this.socket.on('connect', () => {
      this._id = this.socket.id ?? null
      console.log(`[socket] Conectado: ${this._id}`)
    })

    this.socket.on('disconnect', (reason) => {
      console.warn(`[socket] Desconectado: ${reason}`)
    })

    this.socket.on('connect_error', (err) => {
      console.error(`[socket] Error de conexión: ${err.message}`)
    })
  }

  get id() { return this._id }

  // ── Emitters ────────────────────────────────────────────

  join(name: string, color: string) {
    this.socket.emit(EVENTS.C_JOIN, { name, color })
  }

  sendInput(input: Omit<PlayerInput, 'seq'>) {
    this.socket.emit(EVENTS.C_INPUT, { ...input, seq: ++this.inputSeq })
  }

  shoot(aimX: number, aimZ: number) {
    this.socket.emit(EVENTS.C_SHOOT, { aimX, aimZ } satisfies ShootPayload)
  }

  melee() {
    this.socket.emit(EVENTS.C_MELEE)
  }

  pickup() {
    this.socket.emit(EVENTS.C_PICKUP)
  }

  // ── Listeners ───────────────────────────────────────────

  on(event: string, handler: (...args: any[]) => void) {
    this.socket.on(event, handler)
  }

  off(event: string, handler?: (...args: any[]) => void) {
    this.socket.off(event, handler)
  }
}

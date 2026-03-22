// ─────────────────────────────────────────────────────────────
//  STICK ROYALE — Server Entry Point
// ─────────────────────────────────────────────────────────────

import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { GameRoom } from './GameRoom'
import {
  EVENTS,
  MAX_PLAYERS,
  type JoinPayload,
  type PlayerInput,
  type ShootPayload,
} from 'shared'

const app  = express()
const http = createServer(app)

const io = new Server(http, {
  cors: {
    origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
  // Reducir latencia: deshabilitar polling, solo websocket
  transports: ['websocket'],
})

// ── Estado global ────────────────────────────────────────────
// Una sala de juego (por ahora). Se puede extender a múltiples salas.
const room = new GameRoom(io)

// ── Healthcheck ───────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    players: room.playerCount,
    phase: room.phase,
    uptime: process.uptime(),
  })
})

// ── Socket connections ────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Conectado: ${socket.id}`)

  // ── JOIN ──────────────────────────────────────────────────
  socket.on(EVENTS.C_JOIN, (payload: JoinPayload) => {
    // Validación básica
    if (!payload?.name || !payload?.color) {
      socket.emit(EVENTS.S_ERROR, { message: 'Payload inválido' })
      return
    }
    if (room.playerCount >= MAX_PLAYERS) {
      socket.emit(EVENTS.S_ERROR, { message: 'Sala llena' })
      return
    }

    const name  = String(payload.name).substring(0, 10).toUpperCase()
    const color = /^#[0-9a-fA-F]{6}$/.test(payload.color)
      ? payload.color
      : '#ff4040'

    room.addPlayer(socket, name, color)
  })

  // ── INPUT (movimiento) ────────────────────────────────────
  socket.on(EVENTS.C_INPUT, (input: PlayerInput) => {
    room.handleInput(socket.id, input)
  })

  // ── SHOOT ─────────────────────────────────────────────────
  socket.on(EVENTS.C_SHOOT, (payload: ShootPayload) => {
    room.handleShoot(socket.id, payload)
  })

  // ── MELEE ─────────────────────────────────────────────────
  socket.on(EVENTS.C_MELEE, () => {
    room.handleMelee(socket.id)
  })

  // ── PICKUP ────────────────────────────────────────────────
  socket.on(EVENTS.C_PICKUP, () => {
    room.handlePickup(socket.id)
  })

  // ── DISCONNECT ────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log(`[-] Desconectado: ${socket.id} (${reason})`)
    room.removePlayer(socket.id)
  })
})

// ── Start ─────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3001)
http.listen(PORT, () => {
  console.log(`\n🎮 Stick Royale Server`)
  console.log(`   Puerto:  ${PORT}`)
  console.log(`   Cliente: ${process.env.CLIENT_URL ?? 'http://localhost:5173'}`)
  console.log(`   Env:     ${process.env.NODE_ENV ?? 'development'}\n`)
})

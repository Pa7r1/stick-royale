// ─────────────────────────────────────────────────────────────
//  STICK ROYALE — Shared Types
// ─────────────────────────────────────────────────────────────

import type { WeaponType } from './constants'

// ── PRIMITIVOS ────────────────────────────────────────────────
export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Vec2 {
  x: number
  z: number
}

// ── JUGADOR ───────────────────────────────────────────────────
export interface PlayerInput {
  dx: number          // -1 a 1 (movimiento horizontal)
  dz: number          // -1 a 1 (movimiento profundidad)
  aimX: number        // dirección de apuntado X (mundo)
  aimZ: number        // dirección de apuntado Z (mundo)
  seq: number         // sequence number para client-side prediction
}

export interface PlayerState {
  id: string
  name: string
  color: string
  x: number
  y: number
  z: number
  rotY: number        // rotación en Y (ángulo de apuntado)
  health: number
  alive: boolean
  weapon: WeaponType | null
  ammo: number
  isLocal?: boolean   // solo en cliente
}

// ── ARMAS EN EL SUELO ─────────────────────────────────────────
export interface WeaponPickup {
  id: string
  type: WeaponType
  ammo: number
  x: number
  z: number
}

// ── BALAS ─────────────────────────────────────────────────────
export interface BulletState {
  id: string
  ownerId: string
  x: number
  y: number
  z: number
  dx: number          // dirección normalizada
  dz: number
  color: string
}

// ── MAPA ─────────────────────────────────────────────────────
export interface PlatformState {
  id: string
  x: number
  z: number
  width: number
  depth: number
  alive: boolean
  warning: boolean    // parpadeando, a punto de caer
}

// ── ESTADO COMPLETO DE LA PARTIDA ────────────────────────────
export interface GameState {
  tick: number
  players: PlayerState[]
  weapons: WeaponPickup[]
  bullets: BulletState[]
  platforms: PlatformState[]
  globalAmmo: number
  phase: 1 | 2        // 1=balas, 2=cuerpo a cuerpo
  aliveCount: number
}

// ── LOBBY ─────────────────────────────────────────────────────
export interface LobbyState {
  players: Array<{
    id: string
    name: string
    color: string
    ready: boolean
  }>
  countdown: number | null  // null = esperando, número = segundos
}

// ── EVENTOS ───────────────────────────────────────────────────
export interface JoinPayload {
  name: string
  color: string
}

export interface ShootPayload {
  aimX: number
  aimZ: number
}

export interface HitPayload {
  targetId: string
  damage: number
  attackerId: string
}

export interface DeadPayload {
  playerId: string
  killerId: string | null
}

export interface GameOverPayload {
  winnerId: string | null
  winnerName: string | null
}

export interface PhaseChangePayload {
  phase: 1 | 2
}

export interface TileEventPayload {
  platformId: string
}

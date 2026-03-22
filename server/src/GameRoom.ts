// ─────────────────────────────────────────────────────────────
//  STICK ROYALE — GameRoom
//  Maneja el estado de una partida completa
// ─────────────────────────────────────────────────────────────

import type { Server, Socket } from 'socket.io'
import { randomUUID } from 'crypto'
import {
  EVENTS,
  MAX_PLAYERS,
  LOBBY_COUNTDOWN_MS,
  SERVER_TICK_MS,
  PLAYER_SPEED,
  PLAYER_RADIUS,
  BULLET_SPEED,
  BULLET_LIFETIME_MS,
  BULLET_RADIUS,
  MELEE_RANGE,
  MELEE_COOLDOWN_MS,
  SHOOT_COOLDOWN_MS,
  TOTAL_MAP_AMMO,
  WEAPONS_ON_MAP,
  WEAPON_STATS,
  MAP_RADIUS,
  PLATFORM_Y,
  VOID_DEATH_Y,
  FALL_WARNING_MS,
  FALL_INTERVAL_MS,
  FALL_INTERVAL_RAND,
  MAX_HEALTH,
  type PlayerInput,
  type PlayerState,
  type WeaponPickup,
  type BulletState,
  type PlatformState,
  type GameState,
  type LobbyState,
  type ShootPayload,
  type WeaponType,
} from 'shared'

// ── Tipos internos del servidor ───────────────────────────────
interface ServerPlayer extends PlayerState {
  socketId: string
  vx: number          // velocidad actual X
  vz: number          // velocidad actual Z
  lastShot: number
  lastMelee: number
  lastInput: PlayerInput | null
}

interface ServerBullet extends BulletState {
  spawnTime: number
  speed: number
}

type RoomPhase = 'lobby' | 'playing' | 'gameover'

export class GameRoom {
  private io: Server
  private roomPhase: RoomPhase = 'lobby'

  // Estado del juego
  private players   = new Map<string, ServerPlayer>()
  private bullets   = new Map<string, ServerBullet>()
  private weapons   = new Map<string, WeaponPickup>()
  private platforms = new Map<string, PlatformState>()
  private globalAmmo = TOTAL_MAP_AMMO
  private gamePhase: 1 | 2 = 1
  private tick = 0

  // Timers
  private gameLoopTimer: NodeJS.Timeout | null = null
  private lobbyTimer:    NodeJS.Timeout | null = null
  private fallTimer:     NodeJS.Timeout | null = null

  constructor(io: Server) {
    this.io = io
  }

  get playerCount() { return this.players.size }
  get phase()       { return this.gamePhase }

  // ── LOBBY ─────────────────────────────────────────────────

  addPlayer(socket: Socket, name: string, color: string) {
    if (this.roomPhase !== 'lobby') {
      socket.emit(EVENTS.S_ERROR, { message: 'Partida en curso' })
      return
    }

    const player: ServerPlayer = {
      id:         socket.id,
      socketId:   socket.id,
      name,
      color,
      x: 0, y: PLATFORM_Y + 1.1, z: 0,
      rotY: 0,
      health:     MAX_HEALTH,
      alive:      true,
      weapon:     null,
      ammo:       0,
      vx: 0, vz: 0,
      lastShot:   0,
      lastMelee:  0,
      lastInput:  null,
    }

    this.players.set(socket.id, player)
    socket.join('game')
    console.log(`  Player joined: ${name} (${socket.id})`)

    this.broadcastLobbyState()

    // Con 1 jugador ya arranca (modo testing). En producción cambiar a >= 2
    if (this.players.size >= 1 && !this.lobbyTimer) {
      this.startLobbyCountdown()
    }
    // Si llegamos a MAX_PLAYERS, arrancar inmediatamente
    if (this.players.size >= MAX_PLAYERS) {
      this.clearLobbyTimer()
      this.startGame()
    }
  }

  removePlayer(socketId: string) {
    const player = this.players.get(socketId)
    if (!player) return

    if (this.roomPhase === 'playing') {
      // Marcar como muerto en vez de eliminar, para el historial
      player.alive = false
      this.checkWinCondition()
    } else {
      this.players.delete(socketId)
      this.broadcastLobbyState()
    }

    // Si queda 0 jugadores, resetear sala
    if (this.players.size === 0) this.resetRoom()
  }

  private startLobbyCountdown() {
    this.lobbyTimer = setTimeout(() => {
      if (this.players.size >= 1) this.startGame()
    }, LOBBY_COUNTDOWN_MS)

    // Broadcast countdown
    let remaining = LOBBY_COUNTDOWN_MS / 1000
    const interval = setInterval(() => {
      remaining--
      this.broadcastLobbyState(remaining)
      if (remaining <= 0) clearInterval(interval)
    }, 1000)
  }

  private clearLobbyTimer() {
    if (this.lobbyTimer) { clearTimeout(this.lobbyTimer); this.lobbyTimer = null }
  }

  private broadcastLobbyState(countdown: number | null = null) {
    const state: LobbyState = {
      players: Array.from(this.players.values()).map(p => ({
        id:    p.id,
        name:  p.name,
        color: p.color,
        ready: true,
      })),
      countdown,
    }
    this.io.to('game').emit(EVENTS.S_LOBBY_STATE, state)
  }

  // ── GAME START ────────────────────────────────────────────

  private startGame() {
    this.clearLobbyTimer()
    this.roomPhase = 'playing'
    this.gamePhase = 1
    this.globalAmmo = TOTAL_MAP_AMMO
    this.tick = 0

    this.buildMap()
    this.spawnPlayers()
    this.spawnWeapons()

    // Notificar a cada jugador individualmente con su propio id
    for (const [socketId] of this.players) {
      const sock = this.io.sockets.sockets.get(socketId)
      if (sock) {
        sock.emit(EVENTS.S_GAME_START, {
          localId:   socketId,
          platforms: Array.from(this.platforms.values()),
          weapons:   Array.from(this.weapons.values()),
        })
      }
    }

    // Game loop
    this.gameLoopTimer = setInterval(() => this.update(), SERVER_TICK_MS)

    // Primer caída de plataforma
    this.schedulePlatformFall()

    console.log(`  Game started with ${this.players.size} players`)
  }

  // ── MAPA ──────────────────────────────────────────────────

  private buildMap() {
    this.platforms.clear()

    // Plataforma central principal
    this.addPlatform('main', 0, 0, MAP_RADIUS * 2, MAP_RADIUS * 2)

    // Plataformas secundarias en los bordes
    const angles = [0, 72, 144, 216, 288]
    const dist   = MAP_RADIUS * 0.7
    angles.forEach((deg, i) => {
      const rad = (deg * Math.PI) / 180
      this.addPlatform(
        `island_${i}`,
        Math.cos(rad) * dist,
        Math.sin(rad) * dist,
        MAP_RADIUS * 0.55,
        MAP_RADIUS * 0.55,
      )
    })
  }

  private addPlatform(id: string, x: number, z: number, w: number, d: number) {
    this.platforms.set(id, { id, x, z, width: w, depth: d, alive: true, warning: false })
  }

  private schedulePlatformFall() {
    const delay = FALL_INTERVAL_MS + Math.random() * FALL_INTERVAL_RAND
    this.fallTimer = setTimeout(() => {
      if (this.roomPhase !== 'playing') return
      this.dropRandomPlatform()
    }, delay)
  }

  private dropRandomPlatform() {
    const candidates = Array.from(this.platforms.values())
      .filter(p => p.alive && !p.warning && p.id !== 'main')

    if (candidates.length === 0) { this.schedulePlatformFall(); return }

    const tile = candidates[Math.floor(Math.random() * candidates.length)]
    tile.warning = true
    this.io.to('game').emit(EVENTS.S_TILE_WARN, { platformId: tile.id })

    setTimeout(() => {
      if (this.roomPhase !== 'playing') return
      tile.alive = false
      this.io.to('game').emit(EVENTS.S_TILE_FALL, { platformId: tile.id })

      // Matar jugadores sobre ese tile sin otra plataforma debajo
      for (const p of this.players.values()) {
        if (!p.alive) continue
        if (this.isOnPlatform(p, tile) && !this.hasGroundBelow(p)) {
          this.killPlayer(p.id, null)
        }
      }

      this.schedulePlatformFall()
    }, FALL_WARNING_MS)
  }

  private isOnPlatform(p: ServerPlayer, tile: PlatformState): boolean {
    const hw = tile.width / 2 + PLAYER_RADIUS
    const hd = tile.depth / 2 + PLAYER_RADIUS
    return Math.abs(p.x - tile.x) < hw && Math.abs(p.z - tile.z) < hd
  }

  private hasGroundBelow(p: ServerPlayer): boolean {
    return Array.from(this.platforms.values()).some(t => {
      if (!t.alive || t.warning) return false
      return this.isOnPlatform(p, t)
    })
  }

  // ── SPAWN ─────────────────────────────────────────────────

  private spawnPlayers() {
    const playerList = Array.from(this.players.values())
    const total      = playerList.length

    playerList.forEach((p, i) => {
      const angle = (i / total) * Math.PI * 2
      const r     = MAP_RADIUS * 0.45
      p.x      = Math.cos(angle) * r
      p.z      = Math.sin(angle) * r
      p.y      = PLATFORM_Y + 1.1
      p.health = MAX_HEALTH
      p.alive  = true
      p.weapon = null
      p.ammo   = 0
      p.vx     = 0
      p.vz     = 0
      p.rotY   = -angle
    })
  }

  private spawnWeapons() {
    this.weapons.clear()
    const types: WeaponType[] = ['pistol', 'pistol', 'rifle', 'rifle', 'shotgun', 'pistol', 'rifle', 'shotgun']
    for (let i = 0; i < Math.min(WEAPONS_ON_MAP, types.length); i++) {
      const type  = types[i]
      const angle = Math.random() * Math.PI * 2
      const r     = Math.random() * MAP_RADIUS * 0.7
      const id    = randomUUID()
      this.weapons.set(id, {
        id,
        type,
        ammo: WEAPON_STATS[type].ammo,
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
      })
    }
  }

  // ── INPUT HANDLERS ────────────────────────────────────────

  handleInput(socketId: string, input: PlayerInput) {
    const p = this.players.get(socketId)
    if (!p || !p.alive) return
    p.lastInput = input
    p.rotY = Math.atan2(input.aimX, input.aimZ)
  }

  handleShoot(socketId: string, payload: ShootPayload) {
    const p   = this.players.get(socketId)
    const now = Date.now()
    if (!p || !p.alive)          return
    if (this.gamePhase !== 1)    return
    if (!p.weapon || p.ammo <= 0) return
    if (now - p.lastShot < SHOOT_COOLDOWN_MS) return

    const stats   = WEAPON_STATS[p.weapon]
    const pellets = stats.pellets

    for (let i = 0; i < pellets; i++) {
      const spread = (Math.random() - 0.5) * stats.spread * 2
      const angle  = Math.atan2(payload.aimX, payload.aimZ) + spread
      const id     = randomUUID()
      this.bullets.set(id, {
        id,
        ownerId:   socketId,
        x:         p.x,
        y:         p.y + 1.0,  // altura del arma
        z:         p.z,
        dx:        Math.sin(angle),
        dz:        Math.cos(angle),
        color:     p.color,
        speed:     BULLET_SPEED,
        spawnTime: now,
      })
    }

    p.ammo--
    p.lastShot = now
    this.globalAmmo--

    if (this.globalAmmo <= 0) this.triggerPhase2()
  }

  handleMelee(socketId: string) {
    const p   = this.players.get(socketId)
    const now = Date.now()
    if (!p || !p.alive) return
    if (now - p.lastMelee < MELEE_COOLDOWN_MS) return
    p.lastMelee = now

    for (const target of this.players.values()) {
      if (target.id === socketId || !target.alive) continue
      const dx = target.x - p.x
      const dz = target.z - p.z
      const d  = Math.sqrt(dx * dx + dz * dz)
      if (d < MELEE_RANGE) {
        this.applyDamage(target.id, MELEE_DAMAGE, socketId)
        // Knockback
        target.vx += (dx / d) * 4
        target.vz += (dz / d) * 4
      }
    }
  }

  handlePickup(socketId: string) {
    const p = this.players.get(socketId)
    if (!p || !p.alive) return

    for (const [wid, w] of this.weapons) {
      const dx = p.x - w.x
      const dz = p.z - w.z
      if (Math.sqrt(dx * dx + dz * dz) < 2.0) {
        p.weapon = w.type
        p.ammo   = w.ammo
        this.weapons.delete(wid)
        return
      }
    }
  }

  // ── DAMAGE ────────────────────────────────────────────────

  private applyDamage(targetId: string, damage: number, attackerId: string) {
    const target = this.players.get(targetId)
    if (!target || !target.alive) return

    target.health -= damage
    target.health  = Math.max(0, target.health)

    this.io.to('game').emit(EVENTS.S_PLAYER_HIT, {
      targetId,
      damage,
      attackerId,
    })

    if (target.health <= 0) this.killPlayer(targetId, attackerId)
  }

  private killPlayer(playerId: string, killerId: string | null) {
    const p = this.players.get(playerId)
    if (!p || !p.alive) return

    p.alive  = false
    p.health = 0

    this.io.to('game').emit(EVENTS.S_PLAYER_DEAD, { playerId, killerId })
    console.log(`  ${p.name} eliminated by ${killerId ?? 'fall'}`)

    this.checkWinCondition()
  }

  private checkWinCondition() {
    const alive = Array.from(this.players.values()).filter(p => p.alive)
    if (alive.length <= 1) {
      const winner = alive[0] ?? null
      setTimeout(() => {
        this.io.to('game').emit(EVENTS.S_GAME_OVER, {
          winnerId:   winner?.id ?? null,
          winnerName: winner?.name ?? null,
        })
        setTimeout(() => this.resetRoom(), 5000)
      }, 1200)
    }
  }

  private triggerPhase2() {
    this.gamePhase = 2
    this.io.to('game').emit(EVENTS.S_PHASE_CHANGE, { phase: 2 })
    console.log('  Phase 2: melee only')
  }

  // ── GAME LOOP (server tick) ────────────────────────────────

  private update() {
    this.tick++
    const dt = SERVER_TICK_MS / 1000  // segundos

    // Mover jugadores
    for (const p of this.players.values()) {
      if (!p.alive) continue
      if (p.lastInput) {
        const { dx, dz } = p.lastInput
        const len = Math.sqrt(dx * dx + dz * dz) || 1
        if (dx !== 0 || dz !== 0) {
          p.vx += (dx / len) * PLAYER_SPEED * dt
          p.vz += (dz / len) * PLAYER_SPEED * dt
        }
      }
      // Fricción
      p.vx *= 0.75
      p.vz *= 0.75
      p.x  += p.vx
      p.z  += p.vz

      // Caída al vacío
      if (p.y < VOID_DEATH_Y) this.killPlayer(p.id, null)
    }

    // Mover balas y chequear colisiones
    const now = Date.now()
    for (const [bid, b] of this.bullets) {
      // Expirar
      if (now - b.spawnTime > BULLET_LIFETIME_MS) { this.bullets.delete(bid); continue }

      b.x += b.dx * b.speed * dt
      b.z += b.dz * b.speed * dt

      // Salir del mapa
      if (b.x * b.x + b.z * b.z > (MAP_RADIUS + 4) ** 2) { this.bullets.delete(bid); continue }

      // Impacto en jugadores
      let hit = false
      for (const p of this.players.values()) {
        if (!p.alive || p.id === b.ownerId) continue
        const dx = b.x - p.x
        const dz = b.z - p.z
        if (Math.sqrt(dx * dx + dz * dz) < PLAYER_RADIUS + BULLET_RADIUS) {
          this.applyDamage(p.id, WEAPON_STATS[
            (this.players.get(b.ownerId)?.weapon ?? 'pistol')
          ].damage, b.ownerId)
          this.bullets.delete(bid)
          hit = true
          break
        }
      }
      if (hit) continue
    }

    // Broadcast estado
    const state: GameState = {
      tick:        this.tick,
      players:     Array.from(this.players.values()).map(({ socketId: _, vx: __, vz: ___, lastShot: ____, lastMelee: _____, lastInput: ______, ...p }) => p),
      weapons:     Array.from(this.weapons.values()),
      bullets:     Array.from(this.bullets.values()).map(({ spawnTime: _, speed: __, ...b }) => b),
      platforms:   Array.from(this.platforms.values()),
      globalAmmo:  this.globalAmmo,
      phase:       this.gamePhase,
      aliveCount:  Array.from(this.players.values()).filter(p => p.alive).length,
    }

    this.io.to('game').emit(EVENTS.S_GAME_STATE, state)
  }

  // ── RESET ─────────────────────────────────────────────────

  private resetRoom() {
    if (this.gameLoopTimer) { clearInterval(this.gameLoopTimer); this.gameLoopTimer = null }
    if (this.fallTimer)     { clearTimeout(this.fallTimer);      this.fallTimer     = null }

    this.players.clear()
    this.bullets.clear()
    this.weapons.clear()
    this.platforms.clear()

    this.roomPhase  = 'lobby'
    this.gamePhase  = 1
    this.globalAmmo = TOTAL_MAP_AMMO
    this.tick       = 0

    console.log('  Room reset')
  }
}

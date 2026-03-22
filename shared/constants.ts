// ─────────────────────────────────────────────────────────────
//  STICK ROYALE — Shared Constants
//  Única fuente de verdad para cliente Y servidor
// ─────────────────────────────────────────────────────────────

// ── LOBBY ────────────────────────────────────────────────────
export const MAX_PLAYERS        = 5
export const LOBBY_COUNTDOWN_MS = 3000   // tiempo antes de arrancar

// ── MAPA ─────────────────────────────────────────────────────
export const MAP_RADIUS         = 28     // radio del mapa circular (unidades Three.js)
export const PLATFORM_Y         = 0      // altura del suelo
export const VOID_DEATH_Y       = -6     // caer por debajo de esto = muerte

// Plataformas que caen
export const FALL_WARNING_MS    = 3000   // aviso visual antes de caer
export const FALL_INTERVAL_MS   = 12000  // cada cuánto cae una plataforma
export const FALL_INTERVAL_RAND = 6000   // variación aleatoria extra

// ── JUGADOR ───────────────────────────────────────────────────
export const PLAYER_SPEED       = 6.5    // unidades por segundo
export const PLAYER_RADIUS      = 0.5    // radio de colisión
export const PLAYER_HEIGHT      = 2.2    // altura total del stickman
export const MAX_HEALTH         = 100

// ── COMBATE ───────────────────────────────────────────────────
export const BULLET_SPEED       = 24     // unidades por segundo
export const BULLET_RADIUS      = 0.12
export const BULLET_LIFETIME_MS = 2200   // ms antes de desaparecer

export const BULLET_DAMAGE      = 28
export const MELEE_DAMAGE       = 15
export const MELEE_RANGE        = 2.2    // unidades
export const MELEE_COOLDOWN_MS  = 700
export const SHOOT_COOLDOWN_MS  = 380

export const TOTAL_MAP_AMMO     = 60     // balas totales en toda la partida
export const WEAPONS_ON_MAP     = 8

// Daño de spread por tipo de arma
export const WEAPON_STATS = {
  pistol:  { damage: 28, ammo: 10, spread: 0.04, fireRate: 380, pellets: 1 },
  rifle:   { damage: 22, ammo: 22, spread: 0.02, fireRate: 220, pellets: 1 },
  shotgun: { damage: 18, ammo:  7, spread: 0.18, fireRate: 700, pellets: 4 },
} as const

export type WeaponType = keyof typeof WEAPON_STATS

// ── TICK RATE ─────────────────────────────────────────────────
export const SERVER_TICK_MS     = 50     // 20 ticks/segundo en el server
export const CLIENT_LERP_FACTOR = 0.18   // suavizado de interpolación

// ── NETWORK EVENTS ────────────────────────────────────────────
// Tipados como constantes para evitar typos
export const EVENTS = {
  // Client → Server
  C_JOIN:          'c:join',
  C_INPUT:         'c:input',
  C_SHOOT:         'c:shoot',
  C_MELEE:         'c:melee',
  C_PICKUP:        'c:pickup',

  // Server → Client
  S_LOBBY_STATE:   's:lobby',
  S_GAME_START:    's:start',
  S_GAME_STATE:    's:state',
  S_PLAYER_HIT:    's:hit',
  S_PLAYER_DEAD:   's:dead',
  S_PHASE_CHANGE:  's:phase',
  S_TILE_WARN:     's:tile_warn',
  S_TILE_FALL:     's:tile_fall',
  S_GAME_OVER:     's:over',
  S_ERROR:         's:error',
} as const

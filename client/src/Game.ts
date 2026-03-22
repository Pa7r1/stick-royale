// ─────────────────────────────────────────────────────────────
//  STICK ROYALE — Game Orchestrator
//  Conecta todos los sistemas: renderer, input, network, UI
// ─────────────────────────────────────────────────────────────

import * as THREE from 'three'
import { SocketClient } from './network/Socket'
import { InputSystem } from './systems/Input'
import { CameraSystem } from './systems/Camera'
import { WorldMap } from './world/Map'
import { PlayerManager } from './entities/PlayerManager'
import { BulletManager } from './entities/BulletManager'
import { WeaponManager } from './world/WeaponManager'
import { HUD } from './ui/HUD'
import { LobbyScreen } from './ui/LobbyScreen'
import { GameOverScreen } from './ui/GameOverScreen'
import {
  EVENTS,
  CLIENT_LERP_FACTOR,
  type GameState,
  type LobbyState,
  type GameOverPayload,
  type TileEventPayload,
  type PhaseChangePayload,
} from 'shared'

export class Game {
  // Three.js core
  private renderer!: THREE.WebGLRenderer
  private scene!:    THREE.Scene
  private clock!:    THREE.Clock

  // Sistemas
  private camera!:  CameraSystem
  private input!:   InputSystem
  private socket!:  SocketClient
  private map!:     WorldMap
  private players!: PlayerManager
  private bullets!: BulletManager
  private weapons!: WeaponManager
  private hud!:     HUD
  private lobby!:   LobbyScreen
  private gameOver!: GameOverScreen

  // Estado
  private localPlayerId: string | null = null
  private isPlaying = false
  private animFrameId: number | null = null

  // ── INIT ─────────────────────────────────────────────────

  init() {
    this.setupRenderer()
    this.setupScene()
    this.setupSystems()
    this.setupNetworkHandlers()
    this.setupResizeHandler()

    // Mostrar lobby primero
    this.lobby.show()

    // Arrancar render loop siempre (para animaciones de lobby)
    this.startRenderLoop()
  }

  // ── RENDERER ─────────────────────────────────────────────

  private setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias:  true,
      powerPreference: 'high-performance',
    })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1

    document.getElementById('canvas-container')!.appendChild(this.renderer.domElement)
  }

  private setupScene() {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x08090f)
    this.scene.fog = new THREE.Fog(0x08090f, 40, 90)

    // Luz ambiental suave
    const ambient = new THREE.AmbientLight(0x334466, 0.8)
    this.scene.add(ambient)

    // Luz principal (sol)
    const sun = new THREE.DirectionalLight(0xffffff, 2.0)
    sun.position.set(15, 30, 15)
    sun.castShadow = true
    sun.shadow.mapSize.width  = 2048
    sun.shadow.mapSize.height = 2048
    sun.shadow.camera.near    = 0.5
    sun.shadow.camera.far     = 120
    sun.shadow.camera.left    = -50
    sun.shadow.camera.right   = 50
    sun.shadow.camera.top     = 50
    sun.shadow.camera.bottom  = -50
    sun.shadow.bias           = -0.001
    this.scene.add(sun)

    // Luz de relleno desde abajo (efecto de suelo)
    const fill = new THREE.DirectionalLight(0x2244aa, 0.4)
    fill.position.set(-10, -5, -10)
    this.scene.add(fill)

    this.clock = new THREE.Clock()
  }

  // ── SISTEMAS ─────────────────────────────────────────────

  private setupSystems() {
    this.camera  = new CameraSystem()
    this.input   = new InputSystem()
    this.socket  = new SocketClient()
    this.map     = new WorldMap(this.scene)
    this.players = new PlayerManager(this.scene)
    this.bullets = new BulletManager(this.scene)
    this.weapons = new WeaponManager(this.scene)
    this.hud     = new HUD(document.getElementById('hud')!)
    this.lobby   = new LobbyScreen(
      document.getElementById('lobby-screen')!,
      (name, color) => this.socket.join(name, color),
    )
    this.gameOver = new GameOverScreen(
      document.getElementById('gameover-screen')!,
      () => { this.gameOver.hide(); this.lobby.show() },
    )

    this.scene.add(this.camera.instance)
  }

  // ── NETWORK HANDLERS ─────────────────────────────────────

  private setupNetworkHandlers() {
    const s = this.socket

    s.on(EVENTS.S_LOBBY_STATE, (state: LobbyState) => {
      this.lobby.update(state)
    })

    s.on(EVENTS.S_GAME_START, (data: { platforms: any[]; weapons: any[]; localId: string }) => {
      // El servidor nos manda nuestro propio id en el evento de inicio
      this.localPlayerId = data.localId ?? s.id
      this.startGame(data)
    })

    s.on(EVENTS.S_GAME_STATE, (state: GameState) => {
      if (!this.isPlaying) return
      this.reconcileState(state)
    })

    s.on(EVENTS.S_TILE_WARN, (data: TileEventPayload) => {
      this.map.warnPlatform(data.platformId)
    })

    s.on(EVENTS.S_TILE_FALL, (data: TileEventPayload) => {
      this.map.dropPlatform(data.platformId)
    })

    s.on(EVENTS.S_PHASE_CHANGE, (data: PhaseChangePayload) => {
      this.hud.setPhase(data.phase)
    })

    s.on(EVENTS.S_GAME_OVER, (data: GameOverPayload) => {
      const isWinner = data.winnerId === this.localPlayerId
      setTimeout(() => {
        this.stopGame()
        this.gameOver.show(data.winnerName, isWinner)
      }, 1500)
    })
  }

  // ── GAME FLOW ─────────────────────────────────────────────

  private startGame(data: { platforms: any[]; weapons: any[]; localId?: string }) {
    this.isPlaying = true
    this.lobby.hide()
    this.hud.show()

    this.map.build(data.platforms)
    this.weapons.spawn(data.weapons)

    // Configurar input para emitir al servidor
    this.input.onShoot  = (ax, az) => this.socket.shoot(ax, az)
    this.input.onMelee  = ()       => this.socket.melee()
    this.input.onPickup = ()       => this.socket.pickup()
  }

  private stopGame() {
    this.isPlaying = false
    this.hud.hide()
    this.players.clear()
    this.bullets.clear()
    this.weapons.clear()
    this.map.clear()
  }

  // ── STATE RECONCILIATION ──────────────────────────────────
  // Interpola el estado del servidor hacia el estado local

  private reconcileState(state: GameState) {
    // Players
    this.players.reconcile(state.players, this.localPlayerId, CLIENT_LERP_FACTOR)

    // Balas (servidor es autoritario, no interpolamos)
    this.bullets.update(state.bullets)

    // Armas
    this.weapons.update(state.weapons)

    // HUD
    const localPlayer = state.players.find(p => p.id === this.localPlayerId)
    if (localPlayer) {
      this.hud.update(localPlayer, state.aliveCount, state.globalAmmo, state.phase)
    }

    // Seguir al jugador local con la cámara
    const localMesh = this.players.getLocalMesh(this.localPlayerId)
    if (localMesh) this.camera.follow(localMesh.position)
  }

  // ── RENDER LOOP ───────────────────────────────────────────

  private startRenderLoop() {
    const loop = () => {
      this.animFrameId = requestAnimationFrame(loop)
      const dt = this.clock.getDelta()
      this.update(dt)
      this.renderer.render(this.scene, this.camera.instance)
    }
    loop()
  }

  private update(dt: number) {
    // Input → enviar al servidor cada frame (el server lo acumula)
    if (this.isPlaying && this.localPlayerId) {
      const input = this.input.getInput()
      this.socket.sendInput(input)
    }

    // Actualizar sistemas locales
    this.players.update(dt)
    this.bullets.update3D(dt)
    this.map.update(dt)
    this.input.update(dt)
  }

  // ── RESIZE ───────────────────────────────────────────────

  private setupResizeHandler() {
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight)
      this.camera.updateAspect(window.innerWidth / window.innerHeight)
    })
  }
}

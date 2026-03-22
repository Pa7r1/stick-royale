// ─────────────────────────────────────────────────────────────
//  STICK ROYALE — Input System
//  Teclado para desktop, joystick táctil para mobile
// ─────────────────────────────────────────────────────────────

import type { PlayerInput } from 'shared'

const JOY_RADIUS = 52   // px, radio máximo del joystick
const JOY_SIZE   = 110  // px, diámetro de la base
const KNOB_SIZE  = 46   // px

export class InputSystem {
  // Callbacks que se inyectan desde Game.ts
  onShoot:  ((ax: number, az: number) => void) | null = null
  onMelee:  (() => void) | null = null
  onPickup: (() => void) | null = null

  // Estado
  private keys  = new Set<string>()
  private joyDX = 0
  private joyDZ = 0
  private joyActive = false
  private joyTouchId: number | null = null
  private joyOriginX = 0
  private joyOriginY = 0

  // Aim (para disparar)
  private aimX = 0
  private aimZ = 1

  // DOM del joystick
  private joyContainer: HTMLElement
  private joyBase!:  HTMLElement
  private joyKnob!:  HTMLElement

  constructor() {
    this.joyContainer = document.getElementById('joystick-container')!
    this.buildJoystickDOM()
    this.bindKeyboard()
    this.bindTouch()
    this.bindMouse()
  }

  // ── Getters ──────────────────────────────────────────────

  getInput(): Omit<PlayerInput, 'seq'> {
    let dx = 0, dz = 0

    // Teclado
    if (this.keys.has('w') || this.keys.has('arrowup'))    dz -= 1
    if (this.keys.has('s') || this.keys.has('arrowdown'))  dz += 1
    if (this.keys.has('a') || this.keys.has('arrowleft'))  dx -= 1
    if (this.keys.has('d') || this.keys.has('arrowright')) dx += 1

    // Joystick (override si está activo)
    if (this.joyActive) { dx = this.joyDX; dz = this.joyDZ }

    // Normalizar diagonal
    const len = Math.sqrt(dx * dx + dz * dz)
    if (len > 1) { dx /= len; dz /= len }

    return { dx, dz, aimX: this.aimX, aimZ: this.aimZ }
  }

  update(_dt: number) {
    // Pickup con E
    if (this.keys.has('e')) {
      this.onPickup?.()
      this.keys.delete('e')
    }
  }

  // ── Keyboard ─────────────────────────────────────────────

  private bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase())
      if (e.key === ' ' || e.key === 'Enter') {
        // Melee / disparo
        this.onMelee?.()
      }
      e.preventDefault()
    })
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase())
    })
  }

  // ── Mouse (desktop) ───────────────────────────────────────

  private bindMouse() {
    const canvas = document.getElementById('canvas-container')!

    canvas.addEventListener('mousemove', (e) => {
      // Convertir posición del mouse a dirección de apuntado
      // El jugador está aprox en el centro de la pantalla
      const cx = window.innerWidth  / 2
      const cz = window.innerHeight / 2
      const dx = e.clientX - cx
      const dz = e.clientY - cz
      const len = Math.sqrt(dx * dx + dz * dz) || 1
      this.aimX = dx / len
      this.aimZ = dz / len
    })

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.onShoot?.(this.aimX, this.aimZ)
      }
    })

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      this.onMelee?.()
    })
  }

  // ── Touch (joystick) ─────────────────────────────────────

  private bindTouch() {
    const joyZone = this.joyContainer

    joyZone.addEventListener('touchstart', (e) => {
      e.preventDefault()
      if (this.joyTouchId !== null) return
      const t = e.changedTouches[0]
      this.joyTouchId = t.identifier
      this.joyActive  = true
      this.joyOriginX = t.clientX
      this.joyOriginY = t.clientY
      this.showJoystick(t.clientX, t.clientY)
    }, { passive: false })

    joyZone.addEventListener('touchmove', (e) => {
      e.preventDefault()
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== this.joyTouchId) continue
        const dx = t.clientX - this.joyOriginX
        const dz = t.clientY - this.joyOriginY
        const d  = Math.sqrt(dx * dx + dz * dz)
        const cx = d > JOY_RADIUS ? (dx / d) * JOY_RADIUS : dx
        const cz = d > JOY_RADIUS ? (dz / d) * JOY_RADIUS : dz
        this.joyDX = cx / JOY_RADIUS
        this.joyDZ = cz / JOY_RADIUS
        // Aim sigue el joystick
        this.aimX = this.joyDX
        this.aimZ = this.joyDZ
        this.moveKnob(this.joyOriginX + cx, this.joyOriginY + cz)
      }
    }, { passive: false })

    const endJoy = (e: TouchEvent) => {
      e.preventDefault()
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.joyTouchId) {
          this.joyTouchId = null
          this.joyActive  = false
          this.joyDX = 0
          this.joyDZ = 0
          this.hideJoystick()
        }
      }
    }

    joyZone.addEventListener('touchend',    endJoy, { passive: false })
    joyZone.addEventListener('touchcancel', endJoy, { passive: false })

    // Fire button (zona derecha de la pantalla)
    this.buildFireButton()
  }

  // ── Joystick DOM ─────────────────────────────────────────

  private buildJoystickDOM() {
    Object.assign(this.joyContainer.style, {
      position:      'fixed',
      bottom:        '0',
      left:          '0',
      width:         '50%',
      height:        '180px',
      pointerEvents: 'all',
      zIndex:        '20',
    })

    this.joyBase = document.createElement('div')
    Object.assign(this.joyBase.style, {
      position:     'absolute',
      width:        `${JOY_SIZE}px`,
      height:       `${JOY_SIZE}px`,
      borderRadius: '50%',
      background:   'rgba(255,255,255,0.04)',
      border:       '2px solid rgba(255,255,255,0.10)',
      display:      'none',
      transform:    'translate(-50%, -50%)',
    })

    this.joyKnob = document.createElement('div')
    Object.assign(this.joyKnob.style, {
      position:     'absolute',
      width:        `${KNOB_SIZE}px`,
      height:       `${KNOB_SIZE}px`,
      borderRadius: '50%',
      background:   'rgba(255,255,255,0.20)',
      border:       '2px solid rgba(255,255,255,0.35)',
      display:      'none',
      transform:    'translate(-50%, -50%)',
    })

    this.joyContainer.appendChild(this.joyBase)
    this.joyContainer.appendChild(this.joyKnob)
  }

  private showJoystick(x: number, y: number) {
    const rect = this.joyContainer.getBoundingClientRect()
    const lx   = x - rect.left
    const ly   = y - rect.top
    this.joyBase.style.left    = `${lx}px`
    this.joyBase.style.top     = `${ly}px`
    this.joyBase.style.display = 'block'
    this.joyKnob.style.left    = `${lx}px`
    this.joyKnob.style.top     = `${ly}px`
    this.joyKnob.style.display = 'block'
  }

  private moveKnob(x: number, y: number) {
    const rect = this.joyContainer.getBoundingClientRect()
    this.joyKnob.style.left = `${x - rect.left}px`
    this.joyKnob.style.top  = `${y - rect.top}px`
  }

  private hideJoystick() {
    this.joyBase.style.display = 'none'
    this.joyKnob.style.display = 'none'
  }

  private buildFireButton() {
    const fireZone = document.createElement('div')
    Object.assign(fireZone.style, {
      position:       'fixed',
      bottom:         '0',
      right:          '0',
      width:          '50%',
      height:         '180px',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      pointerEvents:  'all',
      zIndex:         '20',
    })

    const fireBtn = document.createElement('div')
    Object.assign(fireBtn.style, {
      width:          '72px',
      height:         '72px',
      borderRadius:   '50%',
      background:     'rgba(255,64,64,0.15)',
      border:         '3px solid rgba(255,64,64,0.45)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      fontFamily:     "'Bebas Neue', cursive",
      fontSize:       '13px',
      letterSpacing:  '2px',
      color:          'rgba(255,64,64,0.85)',
      cursor:         'pointer',
      transition:     'transform .1s, background .1s',
      userSelect:     'none',
    })
    fireBtn.textContent = 'FUEGO'

    fireBtn.addEventListener('touchstart', (e) => {
      e.preventDefault()
      fireBtn.style.background   = 'rgba(255,64,64,0.35)'
      fireBtn.style.transform    = 'scale(0.93)'
      this.onShoot?.(this.aimX, this.aimZ)
    }, { passive: false })

    fireBtn.addEventListener('touchend', (e) => {
      e.preventDefault()
      fireBtn.style.background = 'rgba(255,64,64,0.15)'
      fireBtn.style.transform  = 'scale(1)'
    }, { passive: false })

    // Botón de melee (arriba del fire)
    const meleeBtn = document.createElement('div')
    Object.assign(meleeBtn.style, {
      width:          '56px',
      height:         '56px',
      borderRadius:   '50%',
      background:     'rgba(255,201,64,0.15)',
      border:         '2px solid rgba(255,201,64,0.4)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      fontFamily:     "'Bebas Neue', cursive",
      fontSize:       '11px',
      letterSpacing:  '1px',
      color:          '#ffc940',
      cursor:         'pointer',
      marginRight:    '16px',
      transition:     'transform .1s',
    })
    meleeBtn.textContent = 'GOLPE'

    meleeBtn.addEventListener('touchstart', (e) => {
      e.preventDefault()
      meleeBtn.style.transform = 'scale(0.93)'
      this.onMelee?.()
    }, { passive: false })
    meleeBtn.addEventListener('touchend', (e) => {
      e.preventDefault()
      meleeBtn.style.transform = 'scale(1)'
    }, { passive: false })

    const btnRow = document.createElement('div')
    Object.assign(btnRow.style, { display: 'flex', alignItems: 'center' })
    btnRow.appendChild(meleeBtn)
    btnRow.appendChild(fireBtn)
    fireZone.appendChild(btnRow)
    document.getElementById('ui-root')!.appendChild(fireZone)
  }
}

// ─────────────────────────────────────────────────────────────
//  STICK ROYALE — Player (Stickman 3D)
//  Rig de geometrías simples: esferas + cilindros
// ─────────────────────────────────────────────────────────────

import * as THREE from 'three'
import type { PlayerState } from 'shared'

// Dimensiones del stickman (en unidades Three.js)
const HEAD_R  = 0.32
const BODY_H  = 0.80
const BODY_R  = 0.06
const LIMB_R  = 0.055
const ARM_H   = 0.55
const LEG_H   = 0.65

export class PlayerMesh {
  readonly group: THREE.Group
  private color: string

  // Partes del stickman
  private head!:      THREE.Mesh
  private body!:      THREE.Mesh
  private armL!:      THREE.Group
  private armR!:      THREE.Group
  private legL!:      THREE.Group
  private legR!:      THREE.Group
  private weaponMesh: THREE.Group | null = null

  // Animación
  private limbPhase  = 0
  private hitFlash   = 0
  private deadAnim   = 0  // 0=vivo, 1=muerto

  // Estado
  private isAlive   = true
  private targetPos = new THREE.Vector3()
  private targetRotY = 0

  // Material
  private mat!: THREE.MeshToonMaterial
  private shadowMat!: THREE.MeshBasicMaterial

  constructor(state: PlayerState, isLocal: boolean) {
    this.color = state.color
    this.group = new THREE.Group()
    this.group.name = `player_${state.id}`
    this.buildMesh(isLocal)
    this.applyState(state, true)
  }

  // ── Build ────────────────────────────────────────────────

  private buildMesh(isLocal: boolean) {
    const color = new THREE.Color(this.color)
    this.mat = new THREE.MeshToonMaterial({ color })

    const sphere = (r: number) => new THREE.SphereGeometry(r, 8, 8)

    // Cabeza
    this.head = new THREE.Mesh(sphere(HEAD_R), this.mat.clone())
    this.head.position.y = BODY_H + HEAD_R + 0.05
    this.head.castShadow = true

    // Cuerpo
    this.body = new THREE.Mesh(new THREE.CylinderGeometry(BODY_R * 1.2, BODY_R, BODY_H, 6), this.mat.clone())
    this.body.position.y = BODY_H / 2
    this.body.castShadow = true

    // Brazos
    this.armL = this.buildLimb(ARM_H, 0.5)
    this.armR = this.buildLimb(ARM_H, 0.5)
    this.armL.position.set(-0.28, BODY_H - 0.08, 0)
    this.armR.position.set( 0.28, BODY_H - 0.08, 0)
    this.armL.rotation.z =  0.3
    this.armR.rotation.z = -0.3

    // Piernas
    this.legL = this.buildLimb(LEG_H, 0.0)
    this.legR = this.buildLimb(LEG_H, 0.0)
    this.legL.position.set(-0.16, 0, 0)
    this.legR.position.set( 0.16, 0, 0)

    // Sombra proyectada en el suelo
    const shadowGeo = new THREE.CircleGeometry(0.4, 12)
    this.shadowMat  = new THREE.MeshBasicMaterial({
      color:       0x000000,
      opacity:     0.25,
      transparent: true,
      depthWrite:  false,
    })
    const shadow = new THREE.Mesh(shadowGeo, this.shadowMat)
    shadow.rotation.x   = -Math.PI / 2
    shadow.position.y   = 0.01
    shadow.renderOrder  = -1

    this.group.add(this.head, this.body, this.armL, this.armR, this.legL, this.legR, shadow)

    // Outline para jugador local
    if (isLocal) {
      const outlineMat = new THREE.MeshBasicMaterial({
        color:   new THREE.Color(this.color),
        side:    THREE.BackSide,
        opacity: 0.35,
        transparent: true,
      })
      const outlineHead = new THREE.Mesh(sphere(HEAD_R * 1.15), outlineMat)
      outlineHead.position.copy(this.head.position)
      this.group.add(outlineHead)
    }
  }

  private buildLimb(height: number, pivot: number): THREE.Group {
    const g    = new THREE.Group()
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(LIMB_R, LIMB_R * 0.9, height, 6),
      this.mat.clone(),
    )
    mesh.position.y = -(height * pivot + height / 2)
    mesh.castShadow = true
    g.add(mesh)
    return g
  }

  // ── Update ────────────────────────────────────────────────

  private update(dt: number, alive: boolean) {
    if (!alive) {
      this.playDeathAnim(dt)
      return
    }

    // Interpolar posición
    this.group.position.lerp(this.targetPos, 0.18)

    // Interpolar rotación
    const da = this.shortAngle(this.group.rotation.y, this.targetRotY)
    this.group.rotation.y += da * 0.18 * 3

    // Velocidad estimada para animar piernas
    const speed = this.group.position.distanceTo(this.targetPos)
    if (speed > 0.01) {
      this.limbPhase += dt * 6
      this.animateLegs(this.limbPhase)
      this.animateArms(this.limbPhase)
    } else {
      this.idleBob(dt)
    }

    // Hit flash
    if (this.hitFlash > 0) {
      this.hitFlash -= dt * 4
      const white = Math.max(0, this.hitFlash)
      this.setAllColor(new THREE.Color(this.color).lerp(new THREE.Color(0xffffff), white))
    }
  }

  applyState(state: PlayerState, immediate = false) {
    this.targetPos.set(state.x, state.y, state.z)
    this.targetRotY = state.rotY
    this.isAlive    = state.alive

    if (immediate) {
      this.group.position.copy(this.targetPos)
      this.group.rotation.y = this.targetRotY
    }

    this.updateWeapon(state.weapon)
  }

  /** Llamado por PlayerManager cada frame, independiente del server tick */
  updateAnimations(dt: number) {
    this.update(dt, this.isAlive)
  }

  triggerHit() {
    this.hitFlash = 1
  }

  // ── Weapon ───────────────────────────────────────────────

  private updateWeapon(type: string | null) {
    if (this.weaponMesh) {
      this.armR.remove(this.weaponMesh)
      this.weaponMesh = null
    }
    if (!type) return

    this.weaponMesh = this.buildWeaponMesh(type)
    this.armR.add(this.weaponMesh)
  }

  private buildWeaponMesh(type: string): THREE.Group {
    const g = new THREE.Group()

    const box = (w: number, h: number, d: number, color = 0xbbbbbb) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshToonMaterial({ color }),
      )
      return m
    }

    if (type === 'pistol') {
      const body    = box(0.12, 0.08, 0.38, 0x888888)
      body.position.set(0, -ARM_H * 0.5 - 0.06, 0.18)
      const grip    = box(0.08, 0.14, 0.08, 0x666666)
      grip.position.set(0, -ARM_H * 0.5 - 0.14, 0.10)
      g.add(body, grip)

    } else if (type === 'rifle') {
      const body    = box(0.10, 0.08, 0.56, 0x557799)
      body.position.set(0, -ARM_H * 0.5 - 0.06, 0.22)
      const stock   = box(0.08, 0.10, 0.18, 0x445566)
      stock.position.set(0, -ARM_H * 0.5 - 0.06, -0.12)
      const barrel  = box(0.06, 0.06, 0.20, 0x7799aa)
      barrel.position.set(0, -ARM_H * 0.5 - 0.02, 0.44)
      const grip    = box(0.07, 0.16, 0.07, 0x445566)
      grip.position.set(0, -ARM_H * 0.5 - 0.14, 0.10)
      g.add(body, stock, barrel, grip)

    } else if (type === 'shotgun') {
      const body    = box(0.14, 0.10, 0.50, 0x996644)
      body.position.set(0, -ARM_H * 0.5 - 0.05, 0.18)
      const barrel1 = box(0.05, 0.05, 0.22, 0x887755)
      barrel1.position.set( 0.04, -ARM_H * 0.5, 0.42)
      const barrel2 = box(0.05, 0.05, 0.22, 0x887755)
      barrel2.position.set(-0.04, -ARM_H * 0.5, 0.42)
      const grip    = box(0.08, 0.14, 0.08, 0x775533)
      grip.position.set(0, -ARM_H * 0.5 - 0.13, 0.06)
      g.add(body, barrel1, barrel2, grip)
    }

    return g
  }

  // ── Animations ───────────────────────────────────────────

  private animateLegs(phase: number) {
    const swing = Math.sin(phase) * 0.4
    this.legL.rotation.x =  swing
    this.legR.rotation.x = -swing
  }

  private animateArms(phase: number) {
    const swing = Math.sin(phase) * 0.25
    this.armL.rotation.x =  swing
    this.armR.rotation.x = -swing
  }

  private idleBob(dt: number) {
    // Respiración suave
    const bob = Math.sin(Date.now() * 0.0015) * 0.008
    this.head.position.y = BODY_H + HEAD_R + 0.05 + bob
    // Resetear piernas
    this.legL.rotation.x *= 0.85
    this.legR.rotation.x *= 0.85
  }

  private playDeathAnim(dt: number) {
    if (this.deadAnim < 1) {
      this.deadAnim += dt * 1.5
      this.group.rotation.z = Math.min(this.deadAnim * Math.PI / 2, Math.PI / 2)
      this.group.position.y = Math.max(0, this.group.position.y - dt * 1.5)
      const fade = 1 - this.deadAnim
      this.shadowMat.opacity = 0.25 * fade
      ;(this.mat as any).opacity = fade
      this.mat.transparent     = true
    }
  }

  // ── Helpers ──────────────────────────────────────────────

  private setAllColor(color: THREE.Color) {
    this.group.traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshToonMaterial) {
        obj.material.color.copy(color)
      }
    })
  }

  private shortAngle(current: number, target: number): number {
    const diff = ((target - current) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI
    return diff
  }
}

// ─────────────────────────────────────────────────────────────
//  STICK ROYALE — WeaponManager
//  Armas en el suelo con glow y animación de flotación
// ─────────────────────────────────────────────────────────────

import * as THREE from 'three'
import type { WeaponPickup } from 'shared'

interface WeaponObject {
  group:  THREE.Group
  inner:  THREE.Group   // el que flota y rota
  glow:   THREE.Mesh
  baseY:  number
}

const WEAPON_COLORS: Record<string, number> = {
  pistol:  0xaaaaaa,
  rifle:   0x7799bb,
  shotgun: 0xaa8855,
}

export class WeaponManager {
  private scene:   THREE.Scene
  private weapons  = new Map<string, WeaponObject>()

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  spawn(pickups: WeaponPickup[]) {
    for (const w of pickups) this.add(w)
  }

  update(serverWeapons: WeaponPickup[]) {
    const seen = new Set<string>()
    for (const w of serverWeapons) {
      seen.add(w.id)
      if (!this.weapons.has(w.id)) this.add(w)
    }
    // Eliminar recogidas
    for (const [id, wo] of this.weapons) {
      if (!seen.has(id)) {
        this.scene.remove(wo.group)
        this.weapons.delete(id)
      }
    }
    // Animar flotación
    this.animateFloat()
  }

  clear() {
    for (const [, wo] of this.weapons) this.scene.remove(wo.group)
    this.weapons.clear()
  }

  // ── Animación ────────────────────────────────────────────

  private animateFloat() {
    const t = Date.now() * 0.002
    for (const [, wo] of this.weapons) {
      wo.inner.position.y = wo.baseY + Math.sin(t + wo.baseY) * 0.12
      wo.inner.rotation.y += 0.018
      // Glow pulsa
      const s = 1 + Math.sin(t * 1.5) * 0.08
      wo.glow.scale.setScalar(s)
    }
  }

  // ── Factory ──────────────────────────────────────────────

  private add(pickup: WeaponPickup) {
    const group = new THREE.Group()
    group.position.set(pickup.x, 0, pickup.z)

    // Plataformita base
    const baseMat = new THREE.MeshToonMaterial({ color: 0x223344, transparent: true, opacity: 0.6 })
    const base    = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 12), baseMat)
    base.position.y = 0.03
    group.add(base)

    // Glow ring en el suelo
    const glowMat = new THREE.MeshBasicMaterial({
      color:       new THREE.Color(WEAPON_COLORS[pickup.type] ?? 0xffffff),
      transparent: true,
      opacity:     0.18,
      side:        THREE.DoubleSide,
      depthWrite:  false,
    })
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), glowMat)
    glow.rotation.x   = -Math.PI / 2
    glow.position.y   = 0.02
    glow.renderOrder  = 1
    group.add(glow)

    // Arma 3D en miniatura que flota
    const inner = new THREE.Group()
    inner.position.y = 0.55
    inner.add(this.buildWeaponModel(pickup.type))
    group.add(inner)

    // Etiqueta de ammo (sprite simple)
    group.add(this.buildAmmoLabel(pickup.ammo, pickup.type))

    this.scene.add(group)
    this.weapons.set(pickup.id, { group, inner, glow, baseY: 0.55 })
  }

  private buildWeaponModel(type: string): THREE.Group {
    const g   = new THREE.Group()
    const col = WEAPON_COLORS[type] ?? 0xaaaaaa

    const box = (w: number, h: number, d: number, c = col) =>
      new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshToonMaterial({ color: c }))

    if (type === 'pistol') {
      const b = box(0.14, 0.10, 0.34, 0x888888)
      b.position.z = 0.05
      const grip = box(0.10, 0.18, 0.10, 0x555555)
      grip.position.set(0, -0.13, -0.06)
      g.add(b, grip)

    } else if (type === 'rifle') {
      const b = box(0.11, 0.10, 0.58, 0x557799)
      b.position.z = 0.10
      const stock = box(0.09, 0.12, 0.18, 0x445566)
      stock.position.z = -0.22
      const barrel = box(0.07, 0.07, 0.22, 0x7799aa)
      barrel.position.z = 0.38
      const grip = box(0.08, 0.18, 0.08, 0x334455)
      grip.position.set(0, -0.14, 0.06)
      g.add(b, stock, barrel, grip)

    } else {
      const b = box(0.16, 0.12, 0.45, 0x996644)
      b.position.z = 0.06
      const b1 = box(0.06, 0.06, 0.20, 0x887755)
      b1.position.set( 0.05, 0, 0.32)
      const b2 = box(0.06, 0.06, 0.20, 0x887755)
      b2.position.set(-0.05, 0, 0.32)
      const grip = box(0.09, 0.16, 0.09, 0x664422)
      grip.position.set(0, -0.14, -0.06)
      g.add(b, b1, b2, grip)
    }

    g.scale.setScalar(1.3)
    return g
  }

  private buildAmmoLabel(ammo: number, type: string): THREE.Group {
    // Canvas texture para el texto de ammo
    const canvas = document.createElement('canvas')
    canvas.width  = 128
    canvas.height = 48
    const ctx2d   = canvas.getContext('2d')!
    ctx2d.fillStyle   = 'rgba(0,0,0,0)'
    ctx2d.clearRect(0, 0, 128, 48)
    ctx2d.fillStyle   = '#ffc940'
    ctx2d.font        = 'bold 22px monospace'
    ctx2d.textAlign   = 'center'
    ctx2d.fillText(`${ammo}x`, 64, 30)

    const tex = new THREE.CanvasTexture(canvas)
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true })
    const sprite = new THREE.Sprite(mat)
    sprite.position.y   = 1.2
    sprite.scale.set(0.8, 0.3, 1)

    const g = new THREE.Group()
    g.add(sprite)
    return g
  }
}

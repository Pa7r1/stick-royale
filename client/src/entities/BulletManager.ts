// ─────────────────────────────────────────────────────────────
//  STICK ROYALE — BulletManager
//  Renderiza balas recibidas del servidor + trail visual
// ─────────────────────────────────────────────────────────────

import * as THREE from 'three'
import type { BulletState } from 'shared'

interface LiveBullet {
  mesh:  THREE.Mesh
  trail: THREE.Points
  trailPositions: Float32Array
  trailIndex: number
}

const TRAIL_LENGTH = 10
const BULLET_GEO   = new THREE.SphereGeometry(0.12, 6, 6)

export class BulletManager {
  private scene:   THREE.Scene
  private bullets  = new Map<string, LiveBullet>()

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  // Llamado por el reconciliador de estado del servidor
  update(serverBullets: BulletState[]) {
    const seen = new Set<string>()

    for (const b of serverBullets) {
      seen.add(b.id)
      let lb = this.bullets.get(b.id)

      if (!lb) {
        lb = this.createBullet(b.color)
        this.bullets.set(b.id, lb)
        this.scene.add(lb.mesh, lb.trail)
      }

      // Actualizar posición
      lb.mesh.position.set(b.x, b.y, b.z)

      // Avanzar trail
      const base = lb.trailIndex * 3
      lb.trailPositions[base]     = b.x
      lb.trailPositions[base + 1] = b.y
      lb.trailPositions[base + 2] = b.z
      lb.trailIndex = (lb.trailIndex + 1) % TRAIL_LENGTH
      ;(lb.trail.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    }

    // Eliminar balas que ya no están en el servidor
    for (const [id, lb] of this.bullets) {
      if (!seen.has(id)) {
        this.scene.remove(lb.mesh, lb.trail)
        lb.mesh.geometry.dispose()
        ;(lb.mesh.material as THREE.Material).dispose()
        this.bullets.delete(id)
      }
    }
  }

  // Interpolación local (entre ticks del servidor)
  update3D(dt: number) {
    // Las balas se mueven suavemente en cliente entre ticks
    for (const [, lb] of this.bullets) {
      // El glow de la bala pulsa levemente
      const s = 1 + Math.sin(Date.now() * 0.01) * 0.06
      lb.mesh.scale.setScalar(s)
    }
  }

  clear() {
    for (const [, lb] of this.bullets) {
      this.scene.remove(lb.mesh, lb.trail)
    }
    this.bullets.clear()
  }

  // ── Factory ──────────────────────────────────────────────

  private createBullet(color: string): LiveBullet {
    const col = new THREE.Color(color)

    // Mesh de la bala
    const mat  = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const mesh = new THREE.Mesh(BULLET_GEO, mat)
    mesh.castShadow = false

    // Trail (puntos)
    const trailPositions = new Float32Array(TRAIL_LENGTH * 3)
    const trailGeo  = new THREE.BufferGeometry()
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3))
    const trailMat  = new THREE.PointsMaterial({
      color:       col,
      size:        0.10,
      transparent: true,
      opacity:     0.5,
      sizeAttenuation: true,
    })
    const trail = new THREE.Points(trailGeo, trailMat)

    return { mesh, trail, trailPositions, trailIndex: 0 }
  }
}

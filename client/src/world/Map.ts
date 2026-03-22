// ─────────────────────────────────────────────────────────────
//  STICK ROYALE — WorldMap
//  Plataformas 3D, coberturas y animación de caída
// ─────────────────────────────────────────────────────────────

import * as THREE from 'three'
import type { PlatformState } from 'shared'

interface PlatformMesh {
  group:    THREE.Group
  platform: THREE.Mesh
  edges:    THREE.LineSegments
  warning:  boolean
  falling:  boolean
  fallVY:   number
}

// Paleta de colores para las plataformas
const PLATFORM_COLORS = [
  0x1a2535,  // azul oscuro (principal)
  0x1e2a20,  // verde oscuro
  0x251a2a,  // morado oscuro
  0x2a1e1a,  // marrón oscuro
  0x1a2528,  // teal oscuro
]

const EDGE_COLOR    = 0x3a5060
const WARNING_COLOR = 0x8b1a1a

export class WorldMap {
  private scene:     THREE.Scene
  private platforms  = new Map<string, PlatformMesh>()
  private covers:    THREE.Mesh[] = []
  private warnClock  = 0

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.buildVoid()
  }

  // ── Build ────────────────────────────────────────────────

  build(platformStates: PlatformState[]) {
    this.clear()
    platformStates.forEach((state, i) => {
      this.createPlatform(state, PLATFORM_COLORS[i % PLATFORM_COLORS.length])
    })
    this.buildCovers()
  }

  private buildVoid() {
    // Suelo del abismo (muy por abajo, casi invisible)
    const voidGeo = new THREE.PlaneGeometry(300, 300)
    const voidMat = new THREE.MeshBasicMaterial({
      color:       0x020305,
      transparent: true,
      opacity:     0.98,
    })
    const voidMesh = new THREE.Mesh(voidGeo, voidMat)
    voidMesh.rotation.x = -Math.PI / 2
    voidMesh.position.y = -12
    this.scene.add(voidMesh)

    // Partículas de "vacío" (puntos en el abismo)
    const count  = 400
    const pos    = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 120
      pos[i * 3 + 1] = -8 - Math.random() * 8
      pos[i * 3 + 2] = (Math.random() - 0.5) * 120
    }
    const voidParticleGeo = new THREE.BufferGeometry()
    voidParticleGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const voidParticleMat = new THREE.PointsMaterial({
      color:   0x334466,
      size:    0.15,
      opacity: 0.4,
      transparent: true,
    })
    this.scene.add(new THREE.Points(voidParticleGeo, voidParticleMat))
  }

  private createPlatform(state: PlatformState, color: number) {
    const group = new THREE.Group()
    group.position.set(state.x, 0, state.z)

    // Grosor y geometría de la plataforma
    const thickness = 0.55
    const geo  = new THREE.BoxGeometry(state.width, thickness, state.depth)

    // Material con toon shading
    const mat  = new THREE.MeshToonMaterial({ color })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.y  = -(thickness / 2)
    mesh.castShadow  = true
    mesh.receiveShadow = true

    // Líneas de borde (wireframe solo en aristas de la cara superior)
    const edgeGeo = new THREE.EdgesGeometry(geo)
    const edgeMat = new THREE.LineBasicMaterial({
      color:       EDGE_COLOR,
      transparent: true,
      opacity:     0.4,
    })
    const edges = new THREE.LineSegments(edgeGeo, edgeMat)
    edges.position.y = -(thickness / 2)

    // Textura de cuadrícula en la superficie (líneas decorativas)
    const gridLines = this.buildGridLines(state.width, state.depth)
    gridLines.position.y = 0.01

    // Indicador de borde (peligro de caer)
    const rimGeo = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(state.width + 0.1, 0.05, state.depth + 0.1)
    )
    const rimMat = new THREE.LineBasicMaterial({ color: 0x3a5566, transparent: true, opacity: 0.6 })
    const rim    = new THREE.LineSegments(rimGeo, rimMat)
    rim.position.y = 0.02

    group.add(mesh, edges, gridLines, rim)
    this.scene.add(group)
    this.platforms.set(state.id, { group, platform: mesh, edges, warning: false, falling: false, fallVY: 0 })
  }

  private buildGridLines(width: number, depth: number): THREE.Group {
    const g   = new THREE.Group()
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.04 })
    const spacing = 3

    // Líneas paralelas al eje X
    for (let z = -depth / 2; z <= depth / 2; z += spacing) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-width / 2, 0, z),
        new THREE.Vector3( width / 2, 0, z),
      ])
      g.add(new THREE.Line(geo, mat))
    }
    // Líneas paralelas al eje Z
    for (let x = -width / 2; x <= width / 2; x += spacing) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0, -depth / 2),
        new THREE.Vector3(x, 0,  depth / 2),
      ])
      g.add(new THREE.Line(geo, mat))
    }
    return g
  }

  private buildCovers() {
    // Coberturas predefinidas en posiciones estratégicas
    const coverDefs = [
      // [x, z, width, depth, height]
      [  0,    0,   0.8, 5.0, 1.8 ],  // pared central vertical
      [  6,    4,   5.0, 0.8, 1.8 ],  // pared horizontal derecha
      [ -6,    4,   5.0, 0.8, 1.8 ],  // pared horizontal izquierda
      [  8,   -6,   0.8, 4.0, 1.6 ],  // esquina derecha
      [ -8,   -6,   0.8, 4.0, 1.6 ],  // esquina izquierda
      [  4,  -10,   3.5, 0.8, 1.6 ],
      [ -4,  -10,   3.5, 0.8, 1.6 ],
      [  0,   12,   0.8, 3.0, 1.8 ],  // cobertura sur
    ]

    for (const [x, z, w, d, h] of coverDefs) {
      const mat  = new THREE.MeshToonMaterial({ color: 0x2a3a4a })
      const geo  = new THREE.BoxGeometry(w, h, d)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(x, h / 2, z)
      mesh.castShadow    = true
      mesh.receiveShadow = true

      // Tope luminoso
      const capGeo = new THREE.BoxGeometry(w + 0.05, 0.06, d + 0.05)
      const capMat = new THREE.MeshBasicMaterial({ color: 0x4a6070, transparent: true, opacity: 0.7 })
      const cap    = new THREE.Mesh(capGeo, capMat)
      cap.position.y = h / 2 + 0.03

      const group = new THREE.Group()
      group.add(mesh, cap)
      this.scene.add(group)
      this.covers.push(mesh)
    }
  }

  // ── Platform events ──────────────────────────────────────

  warnPlatform(id: string) {
    const pm = this.platforms.get(id)
    if (!pm) return
    pm.warning = true
    // El material cambia en el update loop
  }

  dropPlatform(id: string) {
    const pm = this.platforms.get(id)
    if (!pm) return
    pm.falling = true
    pm.fallVY  = 0
  }

  // ── Update loop ──────────────────────────────────────────

  update(dt: number) {
    this.warnClock += dt

    for (const [, pm] of this.platforms) {
      if (pm.falling) {
        // Caída con gravedad
        pm.fallVY -= 9.8 * dt
        pm.group.position.y += pm.fallVY * dt
        pm.group.rotation.x += dt * 0.3
        pm.group.rotation.z += dt * 0.15

        // Desvanecer
        const mat = pm.platform.material as THREE.MeshToonMaterial
        mat.transparent = true
        mat.opacity     = Math.max(0, mat.opacity - dt * 0.8)

        // Eliminar cuando sale del viewport
        if (pm.group.position.y < -25) {
          this.scene.remove(pm.group)
          const key = [...this.platforms.entries()].find(([, v]) => v === pm)?.[0]
          if (key) this.platforms.delete(key)
        }
        continue
      }

      if (pm.warning) {
        // Parpadeo rojo
        const flash = Math.sin(this.warnClock * 8) > 0
        const mat   = pm.platform.material as THREE.MeshToonMaterial
        mat.color.setHex(flash ? WARNING_COLOR : 0x1a0808)
        const edgeMat = pm.edges.material as THREE.LineBasicMaterial
        edgeMat.color.setHex(flash ? 0xff3020 : 0x551010)
      }
    }
  }

  clear() {
    for (const [, pm] of this.platforms) this.scene.remove(pm.group)
    for (const c of this.covers) this.scene.remove(c.parent ?? c)
    this.platforms.clear()
    this.covers = []
  }
}

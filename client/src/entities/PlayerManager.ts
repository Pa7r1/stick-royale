// ─────────────────────────────────────────────────────────────
//  STICK ROYALE — PlayerManager
// ─────────────────────────────────────────────────────────────

import * as THREE from 'three'
import { PlayerMesh } from './Player'
import type { PlayerState } from 'shared'

export class PlayerManager {
  private scene:   THREE.Scene
  private meshes = new Map<string, PlayerMesh>()

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  reconcile(players: PlayerState[], localId: string | null, _lerpFactor: number) {
    const seen = new Set<string>()

    for (const state of players) {
      seen.add(state.id)
      let pm = this.meshes.get(state.id)

      if (!pm) {
        pm = new PlayerMesh(state, state.id === localId)
        this.meshes.set(state.id, pm)
        this.scene.add(pm.group)
      }

      pm.applyState(state)
    }

    // Eliminar jugadores que ya no están en el estado
    for (const [id, pm] of this.meshes) {
      if (!seen.has(id)) {
        this.scene.remove(pm.group)
        this.meshes.delete(id)
      }
    }
  }

  update(dt: number) {
    for (const [, pm] of this.meshes) {
      pm.updateAnimations(dt)
    }
  }

  getLocalMesh(localId: string | null): THREE.Group | null {
    if (!localId) return null
    return this.meshes.get(localId)?.group ?? null
  }

  clear() {
    for (const [, pm] of this.meshes) {
      this.scene.remove(pm.group)
    }
    this.meshes.clear()
  }
}

// ─────────────────────────────────────────────────────────────
//  STICK ROYALE — Camera System
//  Vista 3/4 top-down inclinada, como PUBG mobile
// ─────────────────────────────────────────────────────────────

import * as THREE from 'three'

const CAM_HEIGHT   = 22   // altura sobre el jugador
const CAM_DISTANCE = 14   // distancia hacia atrás
const CAM_TILT     = 0.72 // inclinación (radianes, ~41°)
const LERP_SPEED   = 0.1  // suavidad del seguimiento

export class CameraSystem {
  readonly instance: THREE.PerspectiveCamera
  private target = new THREE.Vector3()

  constructor() {
    this.instance = new THREE.PerspectiveCamera(
      60,                                          // FOV
      window.innerWidth / window.innerHeight,      // aspect
      0.1,                                         // near
      200,                                         // far
    )

    // Posición inicial
    this.instance.position.set(0, CAM_HEIGHT, CAM_DISTANCE)
    this.instance.lookAt(0, 0, 0)
  }

  follow(position: THREE.Vector3) {
    this.target.lerp(position, LERP_SPEED)

    this.instance.position.x = this.target.x
    this.instance.position.y = this.target.y + CAM_HEIGHT
    this.instance.position.z = this.target.z + CAM_DISTANCE

    this.instance.lookAt(
      this.target.x,
      this.target.y,
      this.target.z,
    )
  }

  updateAspect(aspect: number) {
    this.instance.aspect = aspect
    this.instance.updateProjectionMatrix()
  }
}

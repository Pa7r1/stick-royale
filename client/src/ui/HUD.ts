// ─────────────────────────────────────────────────────────────
//  STICK ROYALE — HUD
//  Overlay HTML de la partida: vida, arma, balas, fase
// ─────────────────────────────────────────────────────────────

import type { PlayerState } from 'shared'

export class HUD {
  private root:        HTMLElement
  private healthBar!:  HTMLElement
  private ammoNum!:    HTMLElement
  private wpnName!:    HTMLElement
  private wpnSub!:     HTMLElement
  private aliveNum!:   HTMLElement
  private phaseBanner!: HTMLElement
  private pickupHint!: HTMLElement

  constructor(root: HTMLElement) {
    this.root = root
    this.build()
  }

  // ── Build HTML ───────────────────────────────────────────

  private build() {
    this.root.innerHTML = /* html */`
    <style>
      #hud { pointer-events: none; }

      .hud-alive {
        position: fixed;
        top: 16px; right: 20px;
        text-align: right;
      }
      .hud-alive-num {
        font-family: 'Bebas Neue', cursive;
        font-size: 38px; color: #fff;
        line-height: 1;
        text-shadow: 0 2px 12px rgba(0,0,0,.8);
      }
      .hud-alive-lbl {
        font-size: 9px; letter-spacing: 3px; color: #4a4e66;
      }

      .hud-phase {
        position: fixed;
        top: 18px; left: 50%; transform: translateX(-50%);
        font-family: 'Bebas Neue', cursive;
        font-size: 16px; letter-spacing: 4px;
        color: #ff4040;
        text-shadow: 0 0 20px rgba(255,64,64,.7);
        display: none;
        animation: hudBlink 1s ease infinite;
        white-space: nowrap;
      }
      @keyframes hudBlink { 0%,100%{opacity:1} 50%{opacity:.35} }

      .hud-health-wrap {
        position: fixed;
        bottom: 200px; left: 50%; transform: translateX(-50%);
        display: flex; flex-direction: column; align-items: center; gap: 5px;
      }
      .hud-health-lbl { font-size: 8px; letter-spacing: 4px; color: #4a4e66; }
      .hud-health-bg {
        width: min(210px, 36vw); height: 7px;
        background: #0e1018; border-radius: 4px;
        border: 1px solid #1c2030; overflow: hidden;
      }
      .hud-health-bar {
        height: 100%; width: 100%;
        background: #3ddc84; border-radius: 4px;
        transition: width .25s, background .3s;
      }

      .hud-weapon {
        position: fixed;
        bottom: 196px; left: min(140px, 22vw);
      }
      .hud-weapon-name {
        font-family: 'Bebas Neue', cursive;
        font-size: 20px; color: #fff; letter-spacing: 2px;
      }
      .hud-weapon-sub { font-size: 8px; letter-spacing: 2px; color: #4a4e66; }

      .hud-ammo {
        position: fixed;
        bottom: 196px; right: min(140px, 22vw);
        text-align: right;
      }
      .hud-ammo-num {
        font-family: 'Bebas Neue', cursive;
        font-size: 46px; color: #fff; line-height: 1;
        text-shadow: 0 2px 12px rgba(0,0,0,.8);
      }
      .hud-ammo-lbl { font-size: 8px; letter-spacing: 3px; color: #4a4e66; }

      .hud-pickup {
        position: fixed;
        top: 50%; left: 50%;
        transform: translate(-50%, 70px);
        background: rgba(0,0,0,.72);
        border: 1px solid #ffc940;
        color: #ffc940;
        font-size: 9px; letter-spacing: 3px;
        padding: 7px 16px; border-radius: 4px;
        display: none;
        animation: hudBlink 1.2s ease infinite;
        pointer-events: all; cursor: pointer;
      }

      /* Crosshair desktop */
      .hud-crosshair {
        position: fixed;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 20px; height: 20px;
        pointer-events: none;
      }
      .hud-crosshair::before,
      .hud-crosshair::after {
        content: '';
        position: absolute;
        background: rgba(255,255,255,.55);
      }
      .hud-crosshair::before { left:50%; top:0; width:1px; height:100%; transform:translateX(-50%); }
      .hud-crosshair::after  { top:50%; left:0; height:1px; width:100%; transform:translateY(-50%); }
    </style>

    <div class="hud-alive">
      <div class="hud-alive-num" id="hud-alive">5</div>
      <div class="hud-alive-lbl">VIVOS</div>
    </div>

    <div class="hud-phase" id="hud-phase">⚠ CUERPO A CUERPO</div>

    <div class="hud-health-wrap">
      <div class="hud-health-lbl">VIDA</div>
      <div class="hud-health-bg">
        <div class="hud-health-bar" id="hud-health"></div>
      </div>
    </div>

    <div class="hud-weapon" id="hud-weapon-wrap">
      <div class="hud-weapon-name" id="hud-wpn-name">SIN ARMA</div>
      <div class="hud-weapon-sub"  id="hud-wpn-sub">acércate a un arma</div>
    </div>

    <div class="hud-ammo">
      <div class="hud-ammo-num" id="hud-ammo">—</div>
      <div class="hud-ammo-lbl">BALAS</div>
    </div>

    <div class="hud-pickup" id="hud-pickup">[ E ] RECOGER ARMA</div>
    <div class="hud-crosshair"></div>
    `

    this.healthBar   = this.root.querySelector('#hud-health')!
    this.ammoNum     = this.root.querySelector('#hud-ammo')!
    this.wpnName     = this.root.querySelector('#hud-wpn-name')!
    this.wpnSub      = this.root.querySelector('#hud-wpn-sub')!
    this.aliveNum    = this.root.querySelector('#hud-alive')!
    this.phaseBanner = this.root.querySelector('#hud-phase')!
    this.pickupHint  = this.root.querySelector('#hud-pickup')!

    // Pickup con teclado E
    this.pickupHint.addEventListener('click', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }))
    })
  }

  // ── Update ───────────────────────────────────────────────

  update(player: PlayerState, aliveCount: number, globalAmmo: number, phase: 1 | 2) {
    // Vida
    const hpPct = (player.health / 100) * 100
    this.healthBar.style.width      = `${hpPct}%`
    this.healthBar.style.background =
      hpPct > 50 ? '#3ddc84' : hpPct > 25 ? '#ffc940' : '#ff4040'

    // Arma y balas
    const names: Record<string, string> = { pistol: 'PISTOLA', rifle: 'RIFLE', shotgun: 'ESCOPETA' }
    if (player.weapon) {
      this.wpnName.textContent = names[player.weapon] ?? player.weapon.toUpperCase()
      this.wpnSub.textContent  = `${player.ammo} balas restantes`
      this.ammoNum.textContent = String(player.ammo)
    } else {
      this.wpnName.textContent = 'SIN ARMA'
      this.wpnSub.textContent  = 'acércate a un arma'
      this.ammoNum.textContent = '—'
    }

    // Jugadores vivos
    this.aliveNum.textContent = String(aliveCount)

    // Pickup proximity (simplificado, el WeaponManager lo maneja más fino)
    // aquí lo ocultamos si ya tiene arma
    if (player.weapon) this.pickupHint.style.display = 'none'
  }

  setPhase(phase: 1 | 2) {
    this.phaseBanner.style.display = phase === 2 ? 'block' : 'none'
  }

  showPickupHint(show: boolean) {
    this.pickupHint.style.display = show ? 'block' : 'none'
  }

  show() { this.root.style.display = 'block' }
  hide() { this.root.style.display = 'none'  }
}

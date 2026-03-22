// ─────────────────────────────────────────────────────────────
//  STICK ROYALE — LobbyScreen
// ─────────────────────────────────────────────────────────────

import type { LobbyState } from 'shared'

const COLORS = [
  { hex: '#ff4040', label: 'Rojo'    },
  { hex: '#40b4ff', label: 'Azul'    },
  { hex: '#3ddc84', label: 'Verde'   },
  { hex: '#ffc940', label: 'Dorado'  },
  { hex: '#c040ff', label: 'Violeta' },
]

export class LobbyScreen {
  private root:      HTMLElement
  private onJoin:    (name: string, color: string) => void
  private myColor    = COLORS[0].hex
  private joined     = false

  // DOM refs
  private nameInput!:    HTMLInputElement
  private joinBtn!:      HTMLButtonElement
  private statusText!:   HTMLElement
  private dotsWrap!:     HTMLElement
  private playerList!:   HTMLElement
  private countdownEl!:  HTMLElement

  constructor(root: HTMLElement, onJoin: (name: string, color: string) => void) {
    this.root   = root
    this.onJoin = onJoin
    this.build()
  }

  // ── Build ────────────────────────────────────────────────

  private build() {
    this.root.innerHTML = /* html */`
    <style>
      .lobby-wrap {
        position: fixed; inset: 0;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 0;
        background: #08090f;
        z-index: 50;
      }

      /* Fondo animado */
      .lobby-rings {
        position: absolute; inset: 0;
        overflow: hidden; pointer-events: none;
      }
      .lobby-ring {
        position: absolute; border-radius: 50%;
        border: 1px solid rgba(255,64,64,0.06);
        top: 50%; left: 50%;
        transform: translate(-50%,-50%);
        animation: lring 5s ease-in-out infinite;
      }
      @keyframes lring {
        0%,100%{ opacity:.4; transform:translate(-50%,-50%) scale(1);    }
        50%    { opacity:.08; transform:translate(-50%,-50%) scale(1.04); }
      }

      .lobby-title {
        font-family: 'Bebas Neue', cursive;
        font-size: clamp(68px,14vw,100px);
        color: #fff;
        letter-spacing: 10px;
        line-height: .88;
        text-align: center;
        position: relative;
        text-shadow: 0 0 60px rgba(255,64,64,.45);
      }
      .lobby-tagline {
        font-size: 9px; letter-spacing: 6px; color: #333;
        text-transform: uppercase;
        margin-top: 6px; margin-bottom: 38px;
        position: relative;
      }

      .lobby-form {
        display: flex; flex-direction: column;
        align-items: center; gap: 14px;
        width: min(280px, 85vw);
        position: relative;
      }

      .lobby-colors {
        display: flex; gap: 10px;
      }
      .lobby-color {
        width: 34px; height: 34px; border-radius: 50%;
        cursor: pointer;
        border: 3px solid transparent;
        transition: transform .15s, border-color .15s;
        box-shadow: 0 2px 8px rgba(0,0,0,.5);
      }
      .lobby-color:hover   { transform: scale(1.15); }
      .lobby-color.sel     { border-color: #fff; transform: scale(1.18); }

      .lobby-input {
        width: 100%;
        background: #0d1018; border: 1px solid #1c2030;
        color: #e8e8f0; font-family: 'DM Mono', monospace;
        font-size: 13px; padding: 13px 18px;
        border-radius: 6px; text-align: center;
        outline: none; letter-spacing: 3px;
        transition: border-color .15s;
      }
      .lobby-input:focus    { border-color: #ff4040; }
      .lobby-input::placeholder { color: #2a2e40; }

      .lobby-btn {
        width: 100%;
        background: #ff4040; color: #fff;
        font-family: 'Bebas Neue', cursive; font-size: 26px;
        letter-spacing: 5px; border: none;
        padding: 14px; border-radius: 6px;
        cursor: pointer; transition: background .15s, transform .1s;
      }
      .lobby-btn:hover   { background: #ff2020; }
      .lobby-btn:active  { transform: scale(.97); }
      .lobby-btn:disabled { background: #2a2a3a; cursor: not-allowed; }

      .lobby-status {
        margin-top: 20px; color: #333;
        font-size: 9px; letter-spacing: 3px;
        position: relative;
      }

      .lobby-dots {
        display: flex; gap: 8px;
        margin-top: 12px; justify-content: center;
      }
      .lobby-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: #1c2030; transition: background .4s, box-shadow .4s;
      }
      .lobby-dot.on {
        background: #ff4040;
        box-shadow: 0 0 8px rgba(255,64,64,.7);
      }

      .lobby-players {
        margin-top: 20px; display: flex; flex-direction: column;
        gap: 6px; min-height: 30px; position: relative;
      }
      .lobby-player-row {
        display: flex; align-items: center; gap: 8px;
        font-size: 10px; letter-spacing: 2px; color: #555;
        animation: rowIn .2s ease;
      }
      @keyframes rowIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
      .lobby-player-dot {
        width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
      }

      .lobby-countdown {
        position: absolute; top: 0; left: 50%;
        transform: translateX(-50%);
        font-family: 'Bebas Neue', cursive;
        font-size: 22px; letter-spacing: 4px;
        color: #ff4040; display: none;
        animation: lring 1s ease infinite;
      }
    </style>

    <div class="lobby-wrap" id="lobby-wrap">
      <div class="lobby-rings">
        <div class="lobby-ring" style="width:200px;height:200px;animation-delay:0s"></div>
        <div class="lobby-ring" style="width:380px;height:380px;animation-delay:.9s"></div>
        <div class="lobby-ring" style="width:560px;height:560px;animation-delay:1.8s"></div>
        <div class="lobby-ring" style="width:740px;height:740px;animation-delay:2.7s"></div>
      </div>

      <div class="lobby-title">STICK<br>ROYALE</div>
      <div class="lobby-tagline">último en pie gana</div>

      <div class="lobby-form">
        <div class="lobby-colors" id="lobby-colors"></div>
        <input class="lobby-input" id="lobby-name" type="text"
          placeholder="TU NOMBRE" maxlength="10"
          autocomplete="off" spellcheck="false"/>
        <button class="lobby-btn" id="lobby-join">ENTRAR</button>
      </div>

      <div class="lobby-status" id="lobby-status">ESPERANDO JUGADORES — 0 / 5</div>
      <div class="lobby-dots"   id="lobby-dots"></div>
      <div class="lobby-players" id="lobby-players">
        <div class="lobby-countdown" id="lobby-countdown"></div>
      </div>
    </div>
    `

    // Refs
    this.nameInput   = this.root.querySelector('#lobby-name')!
    this.joinBtn     = this.root.querySelector('#lobby-join')!
    this.statusText  = this.root.querySelector('#lobby-status')!
    this.dotsWrap    = this.root.querySelector('#lobby-dots')!
    this.playerList  = this.root.querySelector('#lobby-players')!
    this.countdownEl = this.root.querySelector('#lobby-countdown')!

    // Color picker
    const colorsWrap = this.root.querySelector('#lobby-colors')!
    COLORS.forEach((c, i) => {
      const el = document.createElement('div')
      el.className = `lobby-color${i === 0 ? ' sel' : ''}`
      el.style.background = c.hex
      el.title = c.label
      el.addEventListener('click', () => {
        colorsWrap.querySelectorAll('.lobby-color').forEach(x => x.classList.remove('sel'))
        el.classList.add('sel')
        this.myColor = c.hex
      })
      colorsWrap.appendChild(el)
    })

    // Dots (5 slots)
    for (let i = 0; i < 5; i++) {
      const d = document.createElement('div')
      d.className = 'lobby-dot'
      d.id        = `ldot-${i}`
      this.dotsWrap.appendChild(d)
    }

    // Join button
    this.joinBtn.addEventListener('click', () => this.handleJoin())
    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleJoin()
    })
  }

  private handleJoin() {
    if (this.joined) return
    const name = this.nameInput.value.trim().toUpperCase() || 'JUGADOR'
    this.joined = true
    this.joinBtn.disabled = true
    this.joinBtn.textContent = 'CONECTANDO...'
    this.onJoin(name, this.myColor)
  }

  // ── Update from server ───────────────────────────────────

  update(state: LobbyState) {
    const count = state.players.length
    this.statusText.textContent = `ESPERANDO JUGADORES — ${count} / 5`

    // Dots
    for (let i = 0; i < 5; i++) {
      const dot = document.getElementById(`ldot-${i}`)
      if (dot) dot.classList.toggle('on', i < count)
    }

    // Lista de jugadores
    const rows = this.playerList.querySelectorAll('.lobby-player-row')
    rows.forEach(r => r.remove())

    state.players.forEach(p => {
      const row = document.createElement('div')
      row.className = 'lobby-player-row'
      row.innerHTML = `
        <div class="lobby-player-dot" style="background:${p.color}"></div>
        <span>${p.name}</span>
      `
      this.playerList.appendChild(row)
    })

    // Countdown
    if (state.countdown !== null) {
      this.countdownEl.style.display  = 'block'
      this.countdownEl.textContent = `INICIANDO EN ${state.countdown}...`
    } else {
      this.countdownEl.style.display  = 'none'
    }
  }

  show() { this.root.style.display = 'block'; this.joined = false; this.joinBtn.disabled = false; this.joinBtn.textContent = 'ENTRAR' }
  hide() { this.root.style.display = 'none'  }
}

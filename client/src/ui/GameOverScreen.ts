// ─────────────────────────────────────────────────────────────
//  STICK ROYALE — GameOverScreen
// ─────────────────────────────────────────────────────────────

export class GameOverScreen {
  private root:     HTMLElement
  private onReplay: () => void

  constructor(root: HTMLElement, onReplay: () => void) {
    this.root     = root
    this.onReplay = onReplay
    this.build()
  }

  private build() {
    this.root.innerHTML = /* html */`
    <style>
      .go-wrap {
        position: fixed; inset: 0;
        background: rgba(0,0,0,.88);
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        z-index: 200; gap: 8px;
        animation: goFadeIn .5s ease;
      }
      @keyframes goFadeIn { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:none} }

      .go-title {
        font-family: 'Bebas Neue', cursive;
        font-size: clamp(64px, 14vw, 92px);
        letter-spacing: 6px; line-height: 1;
      }
      .go-sub {
        font-size: 11px; letter-spacing: 4px;
        color: #3a3e55; margin-bottom: 36px;
      }
      .go-btn {
        background: transparent; color: #e8e8f0;
        font-family: 'Bebas Neue', cursive; font-size: 20px;
        letter-spacing: 4px; border: 1px solid #1c2030;
        padding: 12px 44px; border-radius: 6px;
        cursor: pointer; transition: border-color .15s, color .15s;
        pointer-events: all;
      }
      .go-btn:hover { border-color: #ff4040; color: #ff4040; }
    </style>

    <div class="go-wrap" id="go-wrap" style="display:none">
      <div class="go-title" id="go-title">WINNER</div>
      <div class="go-sub"   id="go-sub">jugador gana</div>
      <button class="go-btn" id="go-btn">VOLVER AL LOBBY</button>
    </div>
    `

    this.root.querySelector('#go-btn')!.addEventListener('click', () => {
      this.hide()
      this.onReplay()
    })
  }

  show(winnerName: string | null, isLocalWinner: boolean) {
    const wrap  = this.root.querySelector('#go-wrap')  as HTMLElement
    const title = this.root.querySelector('#go-title') as HTMLElement
    const sub   = this.root.querySelector('#go-sub')   as HTMLElement

    if (winnerName) {
      title.textContent = isLocalWinner ? '¡GANASTE!' : 'DERROTA'
      title.style.color = isLocalWinner ? '#3ddc84'   : '#ff4040'
      sub.textContent   = `${winnerName} wins`
    } else {
      title.textContent = 'EMPATE'
      title.style.color = '#ffc940'
      sub.textContent   = 'todos caídos'
    }

    wrap.style.display = 'flex'
  }

  hide() {
    const wrap = this.root.querySelector('#go-wrap') as HTMLElement
    wrap.style.display = 'none'
  }
}

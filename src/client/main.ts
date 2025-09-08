import { HexaWordGame } from '../web-view/HexaWordGame';
import { gsap } from 'gsap';
import { Physics2DPlugin } from 'gsap/Physics2DPlugin';
gsap.registerPlugin(Physics2DPlugin);
import { fetchGameDataWithFallback } from './services/api';

console.log('HexaWord Crossword Generator v4.0 - Modular Architecture');

/**
 * Main entry point for the HexaWord game
 */
class App {
  private game: HexaWordGame | null = null;
  private currentLevel = 1;
  private mainMenuEl: HTMLDivElement | null = null;
  private fadeEl: HTMLDivElement | null = null;
  
  constructor() {
    this.initialize();
  }
  
  private async initialize(): Promise<void> {
    try {
      // Initialize the game when DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.startGame());
      } else {
        await this.startGame();
      }
    } catch (error) {
      console.error('Failed to initialize app:', error);
    }
  }
  
  private async startGame(): Promise<void> {
    console.log('Starting HexaWord game...');
    // Apply neutral theme background (no hardcoded dark)
    try {
      const isLight = localStorage.getItem('hexaword_theme') === 'light';
      const bg = isLight ? '#F5F7FB' : '#0F1115';
      document.documentElement.style.setProperty('background-color', bg, 'important');
      document.body.style.setProperty('background-color', bg, 'important');
      document.body.style.setProperty('background', bg, 'important');
      const container = document.getElementById('hex-grid-container');
      if (container) {
        (container as HTMLElement).style.setProperty('background-color', bg, 'important');
        (container as HTMLElement).style.setProperty('background', bg, 'important');
      }
    } catch {}
    
    // Show Main Menu (do not create game until Play)
    this.ensureMainMenu();
    this.showMainMenu();
  }

  // Create a floating menu with core actions
  private buildMenu(): void {
    const btn = document.createElement('button');
    btn.id = 'hw-menu-btn';
    btn.textContent = '⚙️';
    btn.style.cssText = `
      position: fixed; top: 12px; right: 12px; z-index: 10001;
      width: 36px; height: 36px; border-radius: 18px; border: none;
      background: rgba(255,255,255,0.12); color: #fff; backdrop-filter: blur(6px);
      cursor: pointer; font-size: 18px; line-height: 36px; text-align: center;
    `;
    const panel = document.createElement('div');
    panel.id = 'hw-menu-panel';
    panel.style.cssText = `
      position: fixed; top: 56px; right: 12px; z-index: 10000;
      min-width: 220px; padding: 12px; border-radius: 12px;
      background: rgba(20,21,20,0.9); color: #fff; backdrop-filter: blur(8px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
      font-family: 'Lilita One', Arial, sans-serif; display: none;
    `;
    const mkItem = (label: string) => {
      const el = document.createElement('button');
      el.textContent = label;
      el.style.cssText = `
        display: block; width: 100%; text-align: left; margin: 6px 0; padding: 10px 12px;
        background: rgba(255,255,255,0.06); color: #fff; border: none; border-radius: 8px; cursor: pointer;
      `;
      el.onmouseenter = () => (el.style.background = 'rgba(255,255,255,0.12)');
      el.onmouseleave = () => (el.style.background = 'rgba(255,255,255,0.06)');
      return el;
    };
    const restart = mkItem('Restart Level');
    restart.onclick = async () => { await this.game?.reset(); };

    const replayIntro = mkItem('Replay Intro');
    replayIntro.onclick = async () => { await (this.game as any)?.replayIntro?.(); };

    const theme = mkItem('Toggle Theme');
    theme.onclick = async () => { await this.game?.toggleTheme(); };

    const reduceMotion = mkItem('Toggle Reduced Motion');
    reduceMotion.onclick = () => {
      const current = localStorage.getItem('hexaword_reduce_motion') === 'true';
      const svc = (window as any).hwAnimSvc as any;
      if (svc?.setReducedMotion) svc.setReducedMotion(!current);
    };

    panel.append(restart, theme, reduceMotion);
    document.body.append(btn, panel);

    btn.onclick = () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    };

    // Expose animation service to menu for reduced motion toggle
    (window as any).hwAnimSvc = (this.game as any)?.animationService || (window as any).hwAnimSvc;
  }

  // ===== Main Menu Scene =====
  private ensureMainMenu(): void {
    if (this.mainMenuEl) return;
    const el = document.createElement('div');
    el.id = 'hw-main-menu';
    el.style.cssText = `
      position: fixed; inset: 0; z-index: 10002; display: none;
      background: radial-gradient(1200px 800px at 50% -10%, rgba(0,0,0,0.55), rgba(0,0,0,0.92));
      backdrop-filter: blur(10px);
      color: #fff; font-family: 'Lilita One', Arial, sans-serif;
      align-items: center; justify-content: center;
    `;
    const panel = document.createElement('div');
    panel.style.cssText = `
      width: min(92vw, 560px); padding: 24px; border-radius: 16px;
      background: rgba(20,21,20,0.75); box-shadow: 0 16px 48px rgba(0,0,0,0.45);
      backdrop-filter: blur(8px);
    `;
    panel.innerHTML = `
      <div style="text-align:center; margin-bottom: 12px;">
        <div style="font-size: 28px; letter-spacing: 1px;">HexaWord</div>
        <div style="opacity:.85; font-size:14px; margin-top:4px;">Main Menu</div>
      </div>
      <div style="display:flex; flex-direction:column; gap:10px; margin: 12px 0;">
        <button id=\"hw-play\" style=\"padding:12px 16px; border:none; border-radius:12px; background:#2d7cff; color:#fff; cursor:pointer;\">Play</button>
        <button disabled style=\"padding:12px 16px; border:none; border-radius:12px; background:rgba(255,255,255,0.12); color:#fff; cursor:not-allowed;\">Daily Challenge (soon)</button>
        <button disabled style=\"padding:12px 16px; border:none; border-radius:12px; background:rgba(255,255,255,0.12); color:#fff; cursor:not-allowed;\">Make Your Level (soon)</button>
        <button disabled style=\"padding:12px 16px; border:none; border-radius:12px; background:rgba(255,255,255,0.12); color:#fff; cursor:not-allowed;\">Leaderboard (soon)</button>
      </div>
      <div style=\"margin-top:12px; border-top:1px solid rgba(255,255,255,0.1); padding-top:12px;\">
        <div style=\"font-size:16px; opacity:.9; margin-bottom:8px;\">Settings</div>
        <div style=\"display:flex; gap:8px; flex-wrap:wrap;\">
          <button id=\"hw-theme\" style=\"padding:8px 12px; border:none; border-radius:10px; background:rgba(255,255,255,0.12); color:#fff; cursor:pointer;\">Theme: dark</button>
          <button id=\"hw-howto\" style=\"padding:8px 12px; border:none; border-radius:10px; background:rgba(255,255,255,0.12); color:#fff; cursor:pointer;\">How to Play</button>
          <button id=\"hw-motion\" style=\"padding:8px 12px; border:none; border-radius:10px; background:rgba(255,255,255,0.12); color:#fff; cursor:pointer;\">Reduced Motion: Off</button>
        </div>
      </div>
    `;
    el.appendChild(panel);
    document.body.appendChild(el);
    this.mainMenuEl = el;

    // Wire buttons
    const playBtn = panel.querySelector('#hw-play') as HTMLButtonElement;
    const themeBtn = panel.querySelector('#hw-theme') as HTMLButtonElement;
    const motionBtn = panel.querySelector('#hw-motion') as HTMLButtonElement;
    const howBtn = panel.querySelector('#hw-howto') as HTMLButtonElement;

    playBtn.onclick = async () => {
      this.currentLevel = 1;
      await this.fadeTransition(async () => {
        await this.loadLevelFromServer(this.currentLevel);
        this.hideMainMenu();
      });
    };
    // Initialize button labels from stored prefs
    const storedTheme = (localStorage.getItem('hexaword_theme') as 'dark' | 'light') || 'dark';
    themeBtn.textContent = `Theme: ${storedTheme}`;
    motionBtn.textContent = `Reduced Motion: ${localStorage.getItem('hexaword_reduce_motion') === 'true' ? 'On' : 'Off'}`;

    themeBtn.onclick = async () => {
      const current = localStorage.getItem('hexaword_theme') as 'dark' | 'light' | null;
      const next = current === 'light' ? 'dark' : 'light';
      localStorage.setItem('hexaword_theme', next || 'dark');
      themeBtn.textContent = `Theme: ${next || 'dark'}`;
      if (this.game) await this.game.toggleTheme();
    };
    motionBtn.onclick = () => {
      const current = localStorage.getItem('hexaword_reduce_motion') === 'true';
      const next = !current;
      localStorage.setItem('hexaword_reduce_motion', String(next));
      motionBtn.textContent = `Reduced Motion: ${next ? 'On' : 'Off'}`;
      const svc = (window as any).hwAnimSvc as any;
      if (svc?.setReducedMotion) svc.setReducedMotion(next);
    };
    howBtn.onclick = () => this.showHowTo();
  }

  private async loadLevelFromServer(level: number): Promise<void> {
    const d = await fetchGameDataWithFallback(level);
    const words = d.words.slice(0, Math.min(6, d.words.length));
    if (!this.game) {
      // Create the game instance now
      this.game = new HexaWordGame({
        containerId: 'hex-grid-container',
        words,
        clue: d.clue || 'RANDOM MIX',
        seed: d.seed,
        gridRadius: 10,
        level: d.level || level,
        theme: (localStorage.getItem('hexaword_theme') as 'dark' | 'light') || 'dark',
        onReady: () => {
          this.setupUI();
          // Build gear menu after game exists
          this.buildMenu();
        },
        onLevelComplete: async (lvl) => {
          this.showLevelCompleteOverlay(lvl);
        },
        onError: (error) => {
          console.error('Game error:', error);
          this.showError(error.message);
        }
      });
      (window as any).hwAnimSvc = (this.game as any)?.animationService || (window as any).hwAnimSvc;
      return;
    }
    await this.game.loadLevel({ words, seed: d.seed, clue: d.clue, level: d.level });
  }

  // Show level completion overlay with blur, details, and actions
  private showLevelCompleteOverlay(level: number): void {
    const overlay = document.createElement('div');
    overlay.id = 'hw-complete-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 10004; display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.35); backdrop-filter: blur(8px);
    `;
    const panel = document.createElement('div');
    panel.style.cssText = `
      width: min(92vw, 560px); border-radius: 16px; padding: 20px;
      background: rgba(20,21,20,0.92); color: #fff; box-shadow: 0 16px 48px rgba(0,0,0,0.45);
      font-family: 'Lilita One', Arial, sans-serif;
    `;
    const clue = this.game?.getClue() || '';
    const words = (this.game?.getPlacedWords() || []).map(w => w.word);
    panel.innerHTML = `
      <div style="text-align:center; margin-bottom: 10px;">
        <div style="font-size: 24px; letter-spacing: .5px;">Level ${level} Complete!</div>
        <div style="opacity:.9; font-size: 16px; margin-top:6px;">${clue}</div>
      </div>
      <div style="max-height: 180px; overflow:auto; padding: 8px; background: rgba(255,255,255,0.06); border-radius: 10px; font-family: Arial, sans-serif; font-size: 14px; line-height:1.6; text-align:center;">
        ${words.join(' • ')}
      </div>
      <div style="display:flex; flex-direction:row; align-items:center; justify-content:center; gap:10px; margin-top: 14px;">
        <button id="hw-menu" style="padding:10px 16px; border:none; border-radius:10px; background:rgba(255,255,255,0.12); color:#fff; cursor:pointer; box-shadow: 0 4px 0 rgba(0,0,0,0.35);">Main Menu</button>
        <button id="hw-next" style="padding:12px 18px; border:none; border-radius:12px; background:#2d7cff; color:#fff; cursor:pointer; box-shadow: 0 5px 0 #1b55d1;">Next Level</button>
      </div>
    `;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Confetti animation from top-left and top-right
    this.launchConfetti();

    const nextBtn = panel.querySelector('#hw-next') as HTMLButtonElement;
    const menuBtn = panel.querySelector('#hw-menu') as HTMLButtonElement;
    // Hover/press interactions (simple)
    const addHover = (b: HTMLButtonElement) => {
      b.onmouseenter = () => { b.style.transform = 'translateY(-1px)'; };
      b.onmouseleave = () => { b.style.transform = 'translateY(0)'; };
      b.onmousedown = () => { b.style.transform = 'translateY(1px)'; };
      b.onmouseup = () => { b.style.transform = 'translateY(-1px)'; };
    };
    addHover(nextBtn);
    addHover(menuBtn);

    nextBtn.onclick = async () => {
      overlay.remove();
      this.currentLevel = level + 1;
      await this.fadeTransition(async () => {
        await this.loadLevelFromServer(this.currentLevel);
      });
    };
    menuBtn.onclick = async () => {
      overlay.remove();
      await this.fadeTransition(async () => {
        this.showMainMenu();
      });
    };
  }

  // Simple confetti using DOM elements + GSAP
  private launchConfetti(): void {
    // BLAST style: emit many pieces nearly simultaneously with high initial velocity
    const colors = ['#1FB6FF', '#E9458D', '#FF7A45', '#B7F36B', '#6C8CFF', '#FFFFFF'];
    const total = 140;
    const yStart = Math.round(window.innerHeight * 0.25);
    const createPiece = (fromLeft: boolean) => {
      const size = 6 + Math.random() * 8;
      const el = document.createElement('div');
      el.style.cssText = `position:fixed; top:${yStart}px; ${fromLeft ? 'left:-10px' : 'right:-10px'}; width:${size}px; height:${size*1.2}px; border-radius:2px; z-index:10006; will-change: transform, opacity;`;
      el.style.background = colors[(Math.random() * colors.length) | 0];
      document.body.appendChild(el);
      // Upward blast: left -> up-right, right -> up-left, with wider spread for explosive feel
      const baseAngle = fromLeft ? -60 : -120;
      const angle = baseAngle + (Math.random() * 40 - 20); // +/-20° spread
      const velocity = 420 + Math.random() * 320; // stronger initial speed
      const gravity = 1100 + Math.random() * 500; // pulls down after blast
      const rot = (Math.random() * 1080 - 540); // more spin
      const life = 1.4 + Math.random() * 0.6; // shorter life for blast
      gsap.to(el, {
        duration: life,
        rotation: rot,
        physics2D: { velocity, angle, gravity },
        onComplete: () => el.remove()
      });
      gsap.to(el, { opacity: 0, duration: 0.35, ease: 'power1.out', delay: life - 0.35 });
    };
    // Fire most pieces within first 200ms to feel like a blast
    for (let i = 0; i < total; i++) {
      const fromLeft = i % 2 === 0;
      const jitter = Math.random() * 200; // 0–200ms
      setTimeout(() => createPiece(fromLeft), jitter);
    }
  }

  // ===== Fade Transition Helpers =====
  private ensureFadeOverlay(): HTMLDivElement {
    if (this.fadeEl) return this.fadeEl;
    const el = document.createElement('div');
    el.id = 'hw-fade';
    el.style.cssText = 'position:fixed;inset:0;z-index:10010;background:#000;opacity:0;pointer-events:none;';
    document.body.appendChild(el);
    this.fadeEl = el;
    return el;
  }

  private async fadeTransition(task: () => Promise<void> | void, durIn = 0.18, durOut = 0.22): Promise<void> {
    const el = this.ensureFadeOverlay();
    el.style.display = 'block';
    el.style.pointerEvents = 'auto';
    await gsap.to(el, { opacity: 1, duration: durIn, ease: 'power2.out' });
    try {
      await task();
    } finally {
      await gsap.to(el, { opacity: 0, duration: durOut, ease: 'power2.in' });
      el.style.pointerEvents = 'none';
      el.style.display = 'block';
    }
  }

  private showMainMenu(): void {
    this.ensureMainMenu();
    if (!this.mainMenuEl) return;
    this.mainMenuEl.style.display = 'flex';
  }

  private hideMainMenu(): void {
    if (!this.mainMenuEl) return;
    this.mainMenuEl.style.display = 'none';
  }
  
  /**
   * Shows a non-blocking toast notification
   */
  private showToast(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'error' ? '#ff4444' : type === 'warning' ? '#ff8800' : '#4444ff'};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 9999;
      animation: slideUp 0.3s ease-out;
    `;
    toast.textContent = message;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideUp {
        from { transform: translateX(-50%) translateY(100%); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(toast);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideUp 0.3s ease-out reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
  
  /**
   * Sets up UI controls
   */
  private setupUI(): void {
    // Add debug controls if in development
    if (this.isDevelopment()) {
      this.addDebugControls();
    }
    
    // Add keyboard shortcuts
    this.setupKeyboardShortcuts();
  }
  
  /**
   * Adds debug controls
   */
  private addDebugControls(): void {
    const debugPanel = document.createElement('div');
    debugPanel.id = 'debug-panel';
    debugPanel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 12px;
      z-index: 1000;
    `;
    
    debugPanel.innerHTML = `
      <div style="margin-bottom: 10px;">Debug Controls</div>
      <button id="btn-regenerate" style="margin-right: 5px;">Regenerate</button>
      <button id="btn-toggle-debug">Toggle Debug</button>
      <div style="margin-top: 10px;">
        <label>Level: </label>
        <select id="level-select" style="margin-right: 10px;">
          <option value="1">Level 1 - Blue</option>
          <option value="2">Level 2 - Purple</option>
          <option value="3">Level 3 - Teal</option>
          <option value="4">Level 4 - Green</option>
          <option value="5">Level 5 - Red</option>
        </select>
        <button id="btn-toggle-theme">Toggle Theme</button>
      </div>
      <div id="debug-info" style="margin-top: 10px;"></div>
    `;
    
    document.body.appendChild(debugPanel);
    
    // Add event listeners
    document.getElementById('btn-regenerate')?.addEventListener('click', () => {
      this.game?.reset();
    });
    
    document.getElementById('btn-toggle-debug')?.addEventListener('click', () => {
      const currentDebug = localStorage.getItem('hexaword_debug') === 'true';
      localStorage.setItem('hexaword_debug', (!currentDebug).toString());
      window.location.reload();
    });
    
    // Level selection
    document.getElementById('level-select')?.addEventListener('change', async (e) => {
      const level = parseInt((e.target as HTMLSelectElement).value);
      await this.game?.setLevel(level);
    });
    
    // Theme toggle
    document.getElementById('btn-toggle-theme')?.addEventListener('click', async () => {
      await this.game?.toggleTheme();
    });
    
    // Update debug info
    this.updateDebugInfo();
  }
  
  /**
   * Updates debug information
   */
  private updateDebugInfo(): void {
    const debugInfo = document.getElementById('debug-info');
    if (!debugInfo || !this.game) return;
    
    const words = this.game.getPlacedWords();
    const board = this.game.getBoard();
    
    debugInfo.innerHTML = `
      Words: ${words.length}<br>
      Cells: ${board.size}<br>
      FPS: ${this.calculateFPS()}
    `;
    
    // Update every second
    setTimeout(() => this.updateDebugInfo(), 1000);
  }
  
  /**
   * Calculates current FPS
   */
  private calculateFPS(): number {
    // Simplified FPS calculation
    return 60; // Placeholder
  }
  
  /**
   * Sets up keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + R: Regenerate
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        this.game?.reset();
      }
      
      // Ctrl/Cmd + D: Toggle debug
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        const currentDebug = localStorage.getItem('hexaword_debug') === 'true';
        localStorage.setItem('hexaword_debug', (!currentDebug).toString());
        window.location.reload();
      }
    });
  }
  
  /**
   * Shows an error message
   */
  private showError(message: string): void {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ff4444;
      color: white;
      padding: 20px;
      border-radius: 10px;
      font-family: Arial, sans-serif;
      z-index: 10000;
    `;
    errorDiv.textContent = `Error: ${message}`;
    document.body.appendChild(errorDiv);
    
    // Remove after 5 seconds
    setTimeout(() => errorDiv.remove(), 5000);
  }
  
  /**
   * Checks if running in development mode
   */
  private isDevelopment(): boolean {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1';
  }
  
  /**
   * Mulberry32 seeded random number generator
   */
  private mulberry32(seed: number): () => number {
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
}

// Initialize the app
new App();

// Export for potential use in other modules
export { App };

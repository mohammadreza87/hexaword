import { HexaWordGame } from '../web-view/HexaWordGame';
import { gsap } from 'gsap';
import { Physics2DPlugin } from 'gsap/Physics2DPlugin';
gsap.registerPlugin(Physics2DPlugin);
import { fetchGameDataWithFallback } from './services/api';
import './styles/tokens.css';
import './styles/tailwind.css';

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
    // Apply dark theme background
    try {
      const bg = '#0F1115';
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
    btn.className = 'fixed top-3 right-3 z-fixed w-9 h-9 rounded-full text-hw-text-primary backdrop-blur-md border transition-all duration-base text-lg flex items-center justify-center';
    btn.style.cssText = 'background: rgba(42, 52, 70, 0.6); border-color: rgba(59, 71, 96, 0.2);';
    btn.onmouseenter = () => { btn.style.background = 'rgba(59, 71, 96, 0.6)'; };
    btn.onmouseleave = () => { btn.style.background = 'rgba(42, 52, 70, 0.6)'; };
    
    const panel = document.createElement('div');
    panel.id = 'hw-menu-panel';
    panel.className = 'fixed top-14 right-3 z-dropdown hidden min-w-[220px] p-3 rounded-xl backdrop-blur-lg border shadow-2xl font-display';
    panel.style.cssText = 'background: rgba(26, 31, 43, 0.9); border-color: rgba(255, 255, 255, 0.08);';
    
    const mkItem = (label: string) => {
      const el = document.createElement('button');
      el.textContent = label;
      el.className = 'menu-item';
      return el;
    };
    const restart = mkItem('Restart Level');
    restart.onclick = async () => { await this.game?.reset(); };

    const replayIntro = mkItem('Replay Intro');
    replayIntro.onclick = async () => { await (this.game as any)?.replayIntro?.(); };

    const reduceMotion = mkItem('Toggle Reduced Motion');
    reduceMotion.onclick = () => {
      const current = localStorage.getItem('hexaword_reduce_motion') === 'true';
      const svc = (window as any).hwAnimSvc as any;
      if (svc?.setReducedMotion) svc.setReducedMotion(!current);
    };

    panel.append(restart, reduceMotion);
    document.body.append(btn, panel);

    btn.onclick = () => {
      panel.classList.toggle('hidden');
    };

    // Expose animation service to menu for reduced motion toggle
    (window as any).hwAnimSvc = (this.game as any)?.animationService || (window as any).hwAnimSvc;
  }

  // ===== Main Menu Scene =====
  private ensureMainMenu(): void {
    if (this.mainMenuEl) return;
    const el = document.createElement('div');
    el.id = 'hw-main-menu';
    el.className = 'modal-overlay hidden';
    
    const panel = document.createElement('div');
    panel.className = 'modal-content max-w-lg';
    panel.innerHTML = `
      <div class="text-center mb-4">
        <div class="text-3xl tracking-wide text-gradient">HexaWord</div>
        <div class="text-sm text-hw-text-secondary mt-1">Main Menu</div>
      </div>
      <div class="flex flex-col gap-3 my-4">
        <button id="hw-play" class="btn-glass-primary py-3 text-lg">Play</button>
        <button disabled class="btn-glass opacity-50 cursor-not-allowed py-3">Daily Challenge (soon)</button>
        <button disabled class="btn-glass opacity-50 cursor-not-allowed py-3">Make Your Level (soon)</button>
        <button disabled class="btn-glass opacity-50 cursor-not-allowed py-3">Leaderboard (soon)</button>
      </div>
      <div class="mt-4 pt-4 border-t border-hw-surface-tertiary/20">
        <div class="text-base text-hw-text-secondary mb-2">Settings</div>
        <div class="flex gap-2 flex-wrap">
          <button id="hw-howto" class="btn-glass text-sm">How to Play</button>
          <button id="hw-motion" class="btn-glass text-sm">Reduced Motion: Off</button>
        </div>
      </div>
    `;
    el.appendChild(panel);
    document.body.appendChild(el);
    this.mainMenuEl = el;

    // Wire buttons
    const playBtn = panel.querySelector('#hw-play') as HTMLButtonElement;
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
    motionBtn.textContent = `Reduced Motion: ${localStorage.getItem('hexaword_reduce_motion') === 'true' ? 'On' : 'Off'}`;
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
  
  private showHowTo(): void {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    const content = document.createElement('div');
    content.className = 'modal-content';
    content.innerHTML = `
      <div class="text-center mb-4">
        <div class="text-2xl font-display text-hw-text-primary">How to Play</div>
      </div>
      <div class="space-y-3 text-hw-text-secondary">
        <p>🎯 Find all hidden words in the grid</p>
        <p>💡 Words relate to the clue shown</p>
        <p>🖱️ Click/tap letters to spell words</p>
        <p>⌨️ Or type with your keyboard</p>
        <p>↩️ Tap last letter again to undo</p>
        <p>✨ Words auto-submit when complete</p>
      </div>
      <div class="mt-6 text-center">
        <button class="btn-glass-primary px-6 py-2">Got it!</button>
      </div>
    `;
    
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    
    const closeBtn = content.querySelector('button');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        overlay.remove();
      });
    }
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  private async loadLevelFromServer(level: number): Promise<void> {
    const d = await fetchGameDataWithFallback(level, (error) => {
      this.showToast(error.message, 'warning');
    });
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
        theme: 'dark',
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
    this.mainMenuEl.classList.remove('hidden');
    this.mainMenuEl.classList.add('flex');
  }

  private hideMainMenu(): void {
    if (!this.mainMenuEl) return;
    this.mainMenuEl.classList.add('hidden');
    this.mainMenuEl.classList.remove('flex');
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

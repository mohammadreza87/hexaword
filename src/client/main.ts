import { HexaWordGame } from '../web-view/HexaWordGame';
import { gsap } from 'gsap';
import { Physics2DPlugin } from 'gsap/Physics2DPlugin';
gsap.registerPlugin(Physics2DPlugin);
import { fetchGameDataWithFallback } from './services/api';
import './styles/tokens.css';
import './styles/tailwind.css';
import './styles/layers.css';
import { blurGameContainer, animateGameBlur } from './utils/ui';
import { blurTransition } from './services/BlurTransitionService';
import { loadLocalProgress, saveLocalProgress, fetchRemoteProgress, saveRemoteProgress, mergeProgress, Progress as HWProgress } from './services/progress';
import { GameUI } from './components/GameUI';
import { ShareService } from './services/ShareService';
import { WheelOfFortune } from './components/WheelOfFortune';
import { DailyRewardService } from './services/DailyRewardService';
import { CoinStorageService } from './services/CoinStorageService';
import { HintStorageService } from './services/HintStorageService';
import { ColorPaletteService } from '../web-view/services/ColorPaletteService';
import { getPaletteForLevel } from '../web-view/config/ColorPalettes';

console.log('HexaWord Crossword Generator v4.0 - Modular Architecture');

/**
 * Main entry point for the HexaWord game
 */
class App {
  private game: HexaWordGame | null = null;
  private gameUI: GameUI | null = null;
  private currentLevel = 1;
  private mainMenuEl: HTMLDivElement | null = null;
  private fadeEl: HTMLDivElement | null = null;
  private shareService: ShareService;
  private colorPaletteService = ColorPaletteService.getInstance();
  private menuBusy = false;
  
  constructor() {
    this.shareService = ShareService.getInstance();
    this.initialize();
  }

  // Update the single menu button label to reflect current level
  private updateMenuProgress(p: HWProgress): void {
    const el = document.getElementById('hw-main-menu');
    if (!el) return;
    const levelBtn = el.querySelector('#hw-level') as HTMLButtonElement | null;
    if (levelBtn) {
      const lvl = Math.max(1, p?.level ?? this.currentLevel ?? 1);
      levelBtn.textContent = `Level ${lvl}`;
    }
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
    
    // Show Main Menu (do not create game until Play)
    this.ensureMainMenu();
    // Hydrate progress (remote + local) for Continue button and theme
    try {
      const localP = loadLocalProgress();
      const remoteP = await fetchRemoteProgress();
      const merged = mergeProgress(localP, remoteP);
      if (merged) {
        saveLocalProgress(merged);
        this.currentLevel = Math.max(1, merged.level);
        this.updateMenuProgress(merged);
        // Apply theme colors based on current level immediately for the menu
        await this.applyMenuTheme(this.currentLevel);
      } else {
        // Default theme for level 1 if no progress found
        await this.applyMenuTheme(1);
      }
    } catch {}
    this.showMainMenu();
    
    // Check for daily wheel on second launch
    await this.checkDailyWheel();
  }

  // Apply palette/theme for the menu using the player's current level
  private async applyMenuTheme(level: number): Promise<void> {
    try {
      await this.colorPaletteService.setLevel(level);
      const scheme = await this.colorPaletteService.getCurrentScheme();
      // Update top-level backgrounds to match theme
      document.documentElement.style.setProperty('background-color', scheme.background, 'important');
      document.body.style.setProperty('background-color', scheme.background, 'important');
      document.body.style.setProperty('background', scheme.background, 'important');
      const container = document.getElementById('hex-grid-container');
      if (container) {
        (container as HTMLElement).style.setProperty('background-color', scheme.background, 'important');
        (container as HTMLElement).style.setProperty('background', scheme.background, 'important');
      }
      
      // Apply clue-like effects to the HEXA WORDS title
      this.applyTitleEffects(level).catch(() => {});
    } catch (e) {
      // Fallback to previous behavior if palette fails
      const bg = '#0F1115';
      document.documentElement.style.setProperty('background-color', bg, 'important');
      document.body.style.setProperty('background-color', bg, 'important');
      document.body.style.setProperty('background', bg, 'important');
    }
  }
  
  /**
   * Apply clue-like gradient and glow effects to the HEXA WORDS title
   */
  private async applyTitleEffects(level: number): Promise<void> {
    const titleEl = document.getElementById('hexaword-title');
    if (!titleEl) return;
    
    // Get theme colors based on level - same as clue
    const palette = getPaletteForLevel(level);
    const accentColor = palette.colors[0];  // Primary accent color
    const secondaryColor = palette.colors[1];  // Secondary color for gradient
    
    // Create gradient background
    titleEl.style.background = `linear-gradient(90deg, ${accentColor}, ${secondaryColor}, ${accentColor})`;
    titleEl.style.backgroundSize = '200% 100%';
    titleEl.style.webkitBackgroundClip = 'text';
    titleEl.style.webkitTextFillColor = 'transparent';
    titleEl.style.backgroundClip = 'text';
    
    // Add animation for gradient shift
    titleEl.style.animation = 'gradientShift 3s ease infinite';
    
    // Add multiple glow layers using filter
    titleEl.style.filter = `
      drop-shadow(0 0 20px ${accentColor}33)
      drop-shadow(0 0 10px ${accentColor}66)
      drop-shadow(0 0 5px ${accentColor}99)
      drop-shadow(0 1px 2px rgba(0,0,0,0.6))
    `;
    
    // Add the gradient animation if not already present
    if (!document.getElementById('hexaword-gradient-animation')) {
      const style = document.createElement('style');
      style.id = 'hexaword-gradient-animation';
      style.textContent = `
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  /**
   * Checks and shows daily wheel if applicable
   */
  private async checkDailyWheel(): Promise<void> {
    const dailyService = DailyRewardService.getInstance();
    
    // Check if user has spin tokens available
    const tokens = await dailyService.getSpinTokens();
    if (tokens <= 0) {
      return; // No tokens, don't show wheel
    }
    
    // Check if it's the second launch of the day
    if (!dailyService.isSecondLaunch()) {
      return;
    }

    // Check cooldown state to configure the wheel display
    const { canClaim, lastClaimTime } = await dailyService.canClaimDaily();
    
    // Show wheel with token count
    const wheel = new WheelOfFortune();
    wheel.setTokens(tokens);
    wheel.onComplete(async (prize, spinId) => {
      // Claim the reward
      const success = await dailyService.claimReward(prize, spinId);
      
      if (success) {
        // Add a small delay to ensure server has finished updating
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Update UI based on prize type
        if (prize.type === 'coins' || prize.type === 'jackpot') {
          // Force reload coin balance (clear cache first)
          const coinService = CoinStorageService.getInstance();
          coinService.clearCache();
          const newData = await coinService.loadCoins();
          
          if ((window as any).gameUI) {
            (window as any).gameUI.updateCoins(newData.balance);
          }
          
          // Also update the game UI if available
          if (this.gameUI) {
            this.gameUI.updateCoins(newData.balance);
          }
        } else if (prize.type === 'hints') {
          // Force reload hint inventory, then sync in-game HintService
          const hintService = HintStorageService.getInstance();
          hintService.clearCache();
          await hintService.loadHints();
          if (this.game && (this.game as any).syncHintInventory) {
            await (this.game as any).syncHintInventory();
          }
        } else if (prize.type === 'bundle') {
          // Bundle includes only hints (x2 reveal + x2 target) - no coins
          const hintService = HintStorageService.getInstance();
          hintService.clearCache();
          await hintService.loadHints();
          if (this.game && (this.game as any).syncHintInventory) {
            await (this.game as any).syncHintInventory();
          }
        }
        
        // Show success message
        this.showToast(`🎉 ${prize.name} added to your account!`, 'success');
      }
    });
    // Show with proper cooldown handling
    await wheel.show(canClaim, lastClaimTime);
  }

  // Initialize the game UI overlay
  private initializeGameUI(): void {
    // Clean up existing UI if any
    if (this.gameUI) {
      this.gameUI.destroy();
    }
    
    // Create new UI
    this.gameUI = new GameUI();
    
    // Expose to window for game to access
    (window as any).gameUI = this.gameUI;
    
    // Set up UI callbacks
    this.gameUI.onRestartLevel(async () => {
      await this.game?.reset();
    });
    
    this.gameUI.onToggleMotion(() => {
      const current = localStorage.getItem('hexaword_reduce_motion') === 'true';
      localStorage.setItem('hexaword_reduce_motion', String(!current));
      const svc = (window as any).hwAnimSvc as any;
      if (svc?.setReducedMotion) svc.setReducedMotion(!current);
    });
    
    this.gameUI.onShuffle(() => {
      if (this.game) {
        this.game.shuffleInputGrid();
      }
    });
    
    this.gameUI.onReveal(() => {
      if (this.game) {
        this.game.revealRandomLetter();
      }
    });
    
    this.gameUI.onTargetHint(() => {
      if (this.game) {
        this.game.startTargetHint();
      }
    });
    
    this.gameUI.onShare(() => {
      if (this.game) {
        this.handleShare();
      }
    });
    
    this.gameUI.onHowToPlay(() => {
      this.showHowTo();
    });
    
    this.gameUI.onMainMenu(async () => {
      // Save progress before going to main menu using game's helper
      if (this.game && (this.game as any).saveProgressNow) {
        try {
          await (this.game as any).saveProgressNow();
        } catch {}
      }
      this.showMainMenu();
    });
    
    // Update initial values
    if (this.game) {
      this.gameUI.updateLevel(this.currentLevel);
      // The word count will be updated from the game's render loop
      
      // Update hint badges with actual inventory
      (this.game as any).updateHintDisplay();
      
      // Update coin display with actual balance
      (this.game as any).updateCoinDisplay();
    }
    
    // Expose animation service for reduced motion toggle
    (window as any).hwAnimSvc = (this.game as any)?.animationService || (window as any).hwAnimSvc;
  }

  /**
   * Handles share button click
   */
  private handleShare(): void {
    if (!this.game) return;
    
    // Get game state
    const gameData = {
      level: this.currentLevel,
      clue: this.game.getClue(),
      letters: this.game.getInputLetters(),
      foundWords: this.game.getFoundCount(),
      totalWords: this.game.getTotalWords(),
      canvas: document.querySelector('canvas') as HTMLCanvasElement
    };
    
    // Open share modal
    this.shareService.openShareModal(gameData);
  }
  
  // ===== Main Menu Scene =====
  private ensureMainMenu(): void {
    if (this.mainMenuEl) return;
    const el = document.createElement('div');
    el.id = 'hw-main-menu';
    el.className = 'modal-overlay hidden';
    
    const panel = document.createElement('div');
    panel.className = 'modal-content max-w-lg panel-hex';
    panel.innerHTML = `
      <div class="text-center mb-4">
        <div id="hexaword-title" class="text-3xl tracking-wide" style="
          font-weight: 900;
          font-family: 'Inter', Arial, sans-serif;
          text-transform: uppercase;
          position: relative;
        ">HEXA WORDS</div>
        <div class="text-sm text-hw-text-secondary mt-1">Main Menu</div>
      </div>
      <div class="flex flex-col gap-3 my-4">
        <button id="hw-level" class="btn-glass-primary py-3 text-lg">Level 1</button>
        <button disabled class="btn-glass opacity-50 cursor-not-allowed py-3">Daily Challenge (soon)</button>
        <button disabled class="btn-glass opacity-50 cursor-not-allowed py-3">Make Your Level (soon)</button>
        <button disabled class="btn-glass opacity-50 cursor-not-allowed py-3">Leaderboard (soon)</button>
        <button id="hw-test-wheel" class="btn-glass py-3">🎰 Test Wheel (Dev)</button>
        <button id="hw-reset" class="btn-glass py-3">🧹 Reset Progress (Dev)</button>
      </div>
      <div class="mt-4 pt-4 border-t border-hw-surface-tertiary/20">
        <div class="text-base text-hw-text-secondary mb-3">Settings</div>
        <div class="toggle-option">
          <label class="toggle-option-label">
            <span class="toggle-option-icon">🎬</span>
            <span>Reduce Motion</span>
          </label>
          <label class="toggle-switch">
            <input type="checkbox" id="hw-motion-toggle">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <button id="hw-howto" class="btn-glass w-full mt-2 text-sm">📖 How to Play</button>
      </div>
    `;
    el.appendChild(panel);
    document.body.appendChild(el);
    this.mainMenuEl = el;

    // Wire buttons
    const levelBtn = panel.querySelector('#hw-level') as HTMLButtonElement;
    const motionToggle = panel.querySelector('#hw-motion-toggle') as HTMLInputElement;
    const howBtn = panel.querySelector('#hw-howto') as HTMLButtonElement;
    const resetBtn = panel.querySelector('#hw-reset') as HTMLButtonElement;

    levelBtn.onclick = async () => {
      if (this.menuBusy) return;
      this.menuBusy = true;
      // Immediately disable all interactive controls in the menu to prevent double clicks
      try {
        const disableAll = () => {
          // Disable all buttons within the panel
          panel.querySelectorAll('button').forEach((b) => {
            const btn = b as HTMLButtonElement;
            btn.disabled = true;
            btn.style.pointerEvents = 'none';
            btn.classList.add('opacity-50', 'cursor-not-allowed');
          });
          // Disable toggle
          const mt = panel.querySelector('#hw-motion-toggle') as HTMLInputElement | null;
          if (mt) {
            mt.disabled = true;
          }
        };
        disableAll();
      } catch {}
      // Apply layered blur for depth effect during transition
      blurTransition.applyLayeredBlur([
        { elementId: 'hw-main-menu', level: 'xl', delay: 0 },
        { elementId: 'hex-grid-container', level: 'lg', delay: 50 }
      ]);
      
      await this.fadeTransition(async () => {
        await this.loadLevelFromServer(this.currentLevel);
        this.hideMainMenu();
        this.menuBusy = false; // clear busy once menu is hidden
      });
    };
    // Initialize toggle from stored prefs
    const currentMotionPref = localStorage.getItem('hexaword_reduce_motion') === 'true';
    motionToggle.checked = currentMotionPref;
    
    motionToggle.onchange = () => {
      const isEnabled = motionToggle.checked;
      localStorage.setItem('hexaword_reduce_motion', String(isEnabled));
      const svc = (window as any).hwAnimSvc as any;
      if (svc?.setReducedMotion) svc.setReducedMotion(isEnabled);
    };
    howBtn.onclick = async () => {
      // Focus effect: blur everything except the how-to modal
      await blurTransition.focusOn('hw-howto-modal', {
        blurLevel: 'md',
        duration: 300
      });
      this.showHowTo();
    };
    
    // Test wheel button handler
    const testWheelBtn = el.querySelector('#hw-test-wheel') as HTMLButtonElement;
    testWheelBtn.onclick = async () => {
      if (this.menuBusy) return;
      // Keep menu responsive for test wheel, but prevent double opens
      this.menuBusy = true;
      const wheel = new WheelOfFortune();
      wheel.setTokens(999); // Show unlimited tokens for testing
      wheel.onComplete(async (prize, spinId) => {
        // Grant a test token right before claiming (so server has token to consume)
        await fetch('/api/daily-reward/grant-test-token', { method: 'POST' });
        
        const dailyService = DailyRewardService.getInstance();
        const success = await dailyService.claimReward(prize, spinId);
        
        if (success) {
          // Update UI based on prize
          if (prize.type === 'coins' || prize.type === 'jackpot') {
            const coinService = CoinStorageService.getInstance();
            await coinService.loadCoins();
          } else if (prize.type === 'hints') {
            const hintService = HintStorageService.getInstance();
            await hintService.loadHints();
            if (this.game && (this.game as any).syncHintInventory) {
              await (this.game as any).syncHintInventory();
            }
          } else if (prize.type === 'bundle') {
            // Bundle only gives hints now (x2 reveal + x2 target)
            const hintService = HintStorageService.getInstance();
            await hintService.loadHints();
            if (this.game && (this.game as any).syncHintInventory) {
              await (this.game as any).syncHintInventory();
            }
          }
        } else {
          console.log('Failed to claim reward - likely no tokens');
        }
        // Re-enable menu after wheel completes
        this.menuBusy = false;
      });
      await wheel.show(true);
    };

    // Reset Progress (Dev) handler
    resetBtn.onclick = async () => {
      if (this.menuBusy) return;
      const ok = await this.confirmModal('Reset all progress, coins, hints, and level saves? This cannot be undone.', { confirmText: 'Reset', cancelText: 'Cancel' });
      if (!ok) return;
      this.menuBusy = true;
      try {
        // 1) Reset overall progression to Level 1 (server)
        await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level: 1, completedLevels: [], seed: undefined })
        });

        // 2) Delete saved per-level progress (fetch list, fallback to first 50)
        try {
          const listRes = await fetch('/api/level-progress');
          if (listRes.ok) {
            const { levels } = await listRes.json();
            if (Array.isArray(levels)) {
              await Promise.all(levels.map((lvl: number) => fetch(`/api/level-progress/${lvl}`, { method: 'DELETE' })));
            }
          } else {
            const tasks: Promise<Response>[] = [];
            for (let i = 1; i <= 50; i++) tasks.push(fetch(`/api/level-progress/${i}`, { method: 'DELETE' }));
            await Promise.all(tasks);
          }
        } catch {}

        // 3) Reset hints
        await fetch('/api/hints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset' })
        });

        // 4) Reset coins to default
        await fetch('/api/coins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set', balance: 100, totalEarned: 100, totalSpent: 0 })
        });

        // 5) Clear local caches
        try { localStorage.removeItem('hexaword_progress_v1'); } catch {}
        try { CoinStorageService.getInstance().clearCache(); } catch {}
        try { HintStorageService.getInstance().clearCache(); } catch {}

        // 6) Update in-memory state + theme
        this.currentLevel = 1;
        this.updateMenuProgress({ level: 1, completedLevels: [], updatedAt: Date.now() } as HWProgress);
        await this.applyMenuTheme(1);
        this.showToast('Progress reset. Starting from Level 1.', 'info');
      } catch (e) {
        console.error('Reset failed', e);
        this.showToast('Failed to reset progress', 'error');
      } finally {
        this.menuBusy = false;
      }
    };
  }
  
  private showHowTo(): void {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'hw-howto-modal';
    
    const content = document.createElement('div');
    content.className = 'modal-content panel-hex';
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
      closeBtn.addEventListener('click', async () => {
        // Clear focus effect with smooth transition
        await blurTransition.clearFocus(300);
        overlay.remove();
      });
    }
    
    // Close on overlay click
    overlay.addEventListener('click', async (e) => {
      if (e.target === overlay) {
        await blurTransition.clearFocus(300);
        overlay.remove();
      }
    });
  }

  // Non-blocking, sandbox-safe confirm modal
  private confirmModal(message: string, opts?: { confirmText?: string; cancelText?: string }): Promise<boolean> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      const panel = document.createElement('div');
      panel.className = 'modal-content panel-hex max-w-md';
      panel.innerHTML = `
        <div class="text-center mb-3">
          <div class="text-lg text-hw-text-primary font-bold">Confirm</div>
        </div>
        <div class="text-hw-text-secondary mb-4">${message}</n></div>
        <div class="flex justify-end gap-2">
          <button id="hw-confirm-cancel" class="btn-glass px-4 py-2">${opts?.cancelText || 'Cancel'}</button>
          <button id="hw-confirm-ok" class="btn-glass-primary px-4 py-2">${opts?.confirmText || 'Confirm'}</button>
        </div>
      `;
      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      const cleanup = (value: boolean) => {
        overlay.remove();
        resolve(value);
      };
      (panel.querySelector('#hw-confirm-cancel') as HTMLButtonElement)?.addEventListener('click', () => cleanup(false));
      (panel.querySelector('#hw-confirm-ok') as HTMLButtonElement)?.addEventListener('click', () => cleanup(true));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
    });
  }

  private async loadLevelFromServer(level: number): Promise<void> {
    const d = await fetchGameDataWithFallback(level, (error) => {
      this.showToast(error.message, 'warning');
    });
    const words = d.words.slice(0, Math.min(6, d.words.length));
    if (!this.game) {
      // Create the game instance and wait for onReady before resolving
      await new Promise<void>((resolve, reject) => {
        this.game = new HexaWordGame({
          containerId: 'hex-grid-container',
          words,
          clue: d.clue || 'RANDOM MIX',
          seed: d.seed,
          gridRadius: 10,
          level: d.level || level,
          theme: 'dark',
          onReady: () => {
            try {
              this.setupUI();
              this.initializeGameUI();
              // Track initial activity when game starts
              this.trackUserActivity(level);
            } finally {
              resolve();
            }
          },
          onWordFound: () => {
            // Track progress whenever a word is found
            this.trackUserActivity(level);
          },
          onLevelComplete: async (lvl) => {
            this.showLevelCompleteOverlay(lvl);
            // Track final progress
            this.trackUserActivity(lvl);
          },
          onError: (error) => {
            console.error('Game error:', error);
            this.showError(error.message);
            reject(error);
          }
        });
        (window as any).hwAnimSvc = (this.game as any)?.animationService || (window as any).hwAnimSvc;
      });
      return;
    }
    await this.game.loadLevel({ words, seed: d.seed, clue: d.clue, level: d.level });
  }

  // Show level completion overlay with blur, details, and actions
  private showLevelCompleteOverlay(level: number): void {
    const overlay = document.createElement('div');
    overlay.id = 'hw-complete-overlay';
    overlay.className = 'modal-overlay';
    const panel = document.createElement('div');
    panel.className = 'modal-content panel-hex max-w-xl';
    const clue = this.game?.getClue() || '';
    const words = (this.game?.getPlacedWords() || []).map(w => w.word);
    
    // Get score and coin data from the game
    const scoreData = (this.game as any)?.scoreService?.getState() || { levelScore: 0, currentScore: 0 };
    const coinService = (this.game as any)?.coinService;
    const coinState = coinService?.getState() || { levelEarnings: 0 };
    // Calculate total coins earned this level (base + word rewards)
    const hintsUsed = scoreData.hintsUsed || 0;
    const coinReward = coinService ? 
      coinService.calculateLevelReward(level, words.length, Date.now() - (scoreData.timeStarted || Date.now()), hintsUsed) : 
      coinState.levelEarnings;
    
    panel.innerHTML = `
      <div class="text-center mb-3">
        <div class="text-2xl tracking-wide text-hw-text-primary">Level ${level} Complete!</div>
        <div class="text-lg text-clue-gradient mt-2 uppercase">${clue}</div>
      </div>
      <div class="max-h-40 overflow-auto p-3 rounded-lg border border-hw-surface-tertiary/30 bg-white/5 text-center font-sans text-sm leading-6">
        ${words.join(' • ')}
      </div>
      <div class="flex justify-center gap-8 my-4">
        <div class="text-center">
          <div class="text-xs text-hw-text-secondary uppercase">Score</div>
          <div class="text-xl font-bold">${scoreData.levelScore.toLocaleString()}</div>
        </div>
        <div class="text-center">
          <div class="text-xs text-hw-text-secondary uppercase">High Score</div>
          <div class="text-xl font-bold">${scoreData.currentScore.toLocaleString()}</div>
        </div>
      </div>
      <div class="flex items-center justify-center gap-3 mt-4">
        <button id="hw-menu" class="btn-glass px-4 py-2">Main Menu</button>
        <button id="hw-next" class="btn-glass-primary px-5 py-2">Next Level</button>
      </div>
    `;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Confetti animation from top-left and top-right
    this.launchConfetti();

    // Save progress locally and remotely (best effort)
    const nextProgress: HWProgress = {
      level: level + 1,
      completedLevels: [level],
      updatedAt: Date.now(),
    };
    try {
      saveLocalProgress(nextProgress);
      // sync remote in background
      saveRemoteProgress(nextProgress).then(() => void 0).catch(() => void 0);
      this.updateMenuProgress(nextProgress);
      // Keep in-memory state updated for immediate menu display
      this.currentLevel = Math.max(this.currentLevel, nextProgress.level);
    } catch {}

    const nextBtn = panel.querySelector('#hw-next') as HTMLButtonElement;
    const menuBtn = panel.querySelector('#hw-menu') as HTMLButtonElement;
    // Hover/press interactions (simple)
    // Progressive blur background while overlay is open
    blurGameContainer('lg');

    nextBtn.onclick = async () => {
      overlay.remove();
      this.currentLevel = Math.max(this.currentLevel, level + 1);
      // Use blur transition for smooth level progression
      await blurTransition.transitionWithBlur(async () => {
        await this.loadLevelFromServer(this.currentLevel);
      }, {
        blurIntensity: 'xl',
        inDuration: 250,
        outDuration: 300
      });
    };
    menuBtn.onclick = async () => {
      overlay.remove();
      // Update in-memory level when going back to menu
      this.currentLevel = Math.max(this.currentLevel, level + 1);
      // Transition back to main menu with blur
      await blurTransition.transitionWithBlur(async () => {
        this.showMainMenu();
      }, {
        blurIntensity: 'lg',
        inDuration: 200,
        outDuration: 250
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
    // Retained for compatibility, but not used now that we removed black fades
    if (this.fadeEl) return this.fadeEl;
    const el = document.createElement('div');
    el.id = 'hw-fade';
    el.style.cssText = 'position:fixed;inset:0;z-index:10010;background:transparent;opacity:0;pointer-events:none;display:none;';
    document.body.appendChild(el);
    this.fadeEl = el;
    return el;
  }

  // Track user activity for daily reminders
  private async trackUserActivity(level: number): Promise<void> {
    try {
      // Get game progress if available
      let solvedWords: string[] = [];
      let solvedCells: string[] = [];
      let totalWords = 6;
      
      if (this.game) {
        // Get the actual game state
        const foundWords = (this.game as any).foundWords;
        const placedWords = (this.game as any).placedWords;
        const solvedCellsSet = (this.game as any).solvedCells;
        
        if (foundWords) {
          solvedWords = Array.from(foundWords);
        }
        if (solvedCellsSet) {
          solvedCells = Array.from(solvedCellsSet);
        }
        if (placedWords) {
          totalWords = placedWords.length;
        }
      }
      
      await fetch('/api/track-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          level,
          solvedWords,
          solvedCells,
          totalWords
        })
      });
    } catch (error) {
      console.log('Failed to track activity:', error);
    }
  }

  // Screen transition using progressive blur service
  private async fadeTransition(task: () => Promise<void> | void, durIn = 0.18, durOut = 0.22): Promise<void> {
    // Use the blur transition service for smoother transitions
    await blurTransition.transitionWithBlur(task, {
      targetElement: 'hex-grid-container',
      blurIntensity: 'lg',
      inDuration: Math.max(180, Math.round(durIn * 1000)),
      outDuration: Math.max(220, Math.round(durOut * 1000))
    });
    
    // If transitioning to game view (main menu is hidden), refresh the UI with latest data
    if (this.gameUI && this.mainMenuEl && this.mainMenuEl.classList.contains('hidden')) {
      await this.gameUI.refreshUI();
    }
  }

  private showMainMenu(): void {
    this.ensureMainMenu();
    if (!this.mainMenuEl) return;
    
    // Re-enable all menu buttons and controls
    const panel = this.mainMenuEl.querySelector('.panel-hex');
    if (panel) {
      // Re-enable all buttons
      panel.querySelectorAll('button').forEach((btn) => {
        btn.disabled = false;
        btn.style.pointerEvents = '';
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
      });
      
      // Re-enable the motion toggle
      const motionToggle = panel.querySelector('#hw-motion-toggle') as HTMLInputElement | null;
      if (motionToggle) {
        motionToggle.disabled = false;
      }
    }
    
    // Clear the busy flag
    this.menuBusy = false;
    
    // Apply theme for current level so menu colors are correct
    this.applyMenuTheme(this.currentLevel).catch(() => void 0);
    this.mainMenuEl.classList.remove('hidden');
    this.mainMenuEl.classList.add('flex');
    
    // Apply title effects after menu is visible
    setTimeout(() => {
      this.applyTitleEffects(this.currentLevel).catch(() => {});
    }, 50);
    // Refresh from local progress to ensure latest level is reflected
    try {
      const p = loadLocalProgress();
      if (p?.level) this.currentLevel = Math.max(this.currentLevel, p.level);
    } catch {}
    // Refresh button labels to reflect current level
    try {
      this.updateMenuProgress({ level: this.currentLevel, completedLevels: [], updatedAt: Date.now() } as HWProgress);
    } catch {}
    // Ensure no residual blur remains on menu or game container
    blurTransition.applyLayeredBlur([
      { elementId: 'hw-main-menu', level: 'none', delay: 0 },
      { elementId: 'hex-grid-container', level: 'none', delay: 0 }
    ]);
  }

  private async hideMainMenu(): Promise<void> {
    if (!this.mainMenuEl) return;
    this.mainMenuEl.classList.add('hidden');
    this.mainMenuEl.classList.remove('flex');
    
    // Refresh GameUI when showing the game after closing main menu
    if (this.gameUI) {
      setTimeout(async () => {
        await this.gameUI!.refreshUI();
      }, 300); // Small delay to ensure UI is visible
    }
    
    // Clear any blur from both container and menu overlay
    blurTransition.applyLayeredBlur([
      { elementId: 'hex-grid-container', level: 'none', delay: 0 },
      { elementId: 'hw-main-menu', level: 'none', delay: 0 }
    ]);
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

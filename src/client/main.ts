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
import { loadingOverlay } from './utils/LoadingOverlay';
import { CoinStorageService } from './services/CoinStorageService';
import { HintStorageService } from './services/HintStorageService';
import { ColorPaletteService } from '../web-view/services/ColorPaletteService';
import { getPaletteForLevel } from '../web-view/config/ColorPalettes';

interface SharedLevelPreview {
  id: string;
  name?: string;
  clue?: string;
  author?: string;
  words: string[];
  shares: number;
  createdAt?: string;
  uniqueLetters: string[];
  letterBank?: string[];
}

// HexaWord Crossword Generator v4.0 - Modular Architecture

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
  private sharedLevelHandled = false;
  
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
      const levelText = levelBtn.querySelector('.text-xs');
      if (levelText) {
        levelText.textContent = `Level ${lvl}`;
      }
    }
  }
  
  private async updateMenuCoinDisplay(): Promise<void> {
    const el = document.getElementById('hw-main-menu');
    if (!el) return;
    const coinAmount = el.querySelector('#menu-coin-amount');
    if (coinAmount) {
      try {
        const response = await fetch('/api/coins');
        if (response.ok) {
          const data = await response.json();
          coinAmount.textContent = (data.balance || 0).toLocaleString();
        }
      } catch (error) {
        console.error('Failed to fetch coin balance:', error);
        coinAmount.textContent = '0';
      }
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
    // Starting HexaWord game...
    
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

    // Handle shared level links (e.g. ?level=ID)
    await this.handleSharedLevelLaunch();
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
    
    // Only show on second launch if we have tokens
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

    this.gameUI.onExploreLevels(async () => {
      await this.openLevelExplorer();
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
    el.className = 'fixed inset-0 bg-gradient-to-br from-hw-surface-primary to-hw-surface-secondary hidden z-50';
    
    el.innerHTML = `
      <!-- Top Bar -->
      <div class="absolute top-0 left-0 right-0 flex justify-between items-center p-4">
        <!-- Coins Display (left) -->
        <div class="flex items-center gap-2 bg-black/20 backdrop-blur-sm rounded-full px-3 py-1.5">
          <span class="text-lg">🪙</span>
          <span id="menu-coin-amount" class="text-hw-text-primary font-bold">0</span>
        </div>
        
        <!-- Settings and Explore Buttons (right) -->
        <div class="flex items-center gap-2">
          <!-- Explore Button -->
          <button id="hw-explore-btn" class="bg-black/20 backdrop-blur-sm rounded-full p-2 hover:bg-black/30 transition-colors">
            <span class="text-xl">🔍</span>
          </button>
          <!-- Settings Button -->
          <button id="hw-settings-btn" class="bg-black/20 backdrop-blur-sm rounded-full p-2 hover:bg-black/30 transition-colors">
            <span class="text-xl">⚙️</span>
          </button>
        </div>
      </div>
      
      <!-- Main Content Area -->
      <div class="relative h-full">
        <!-- Title - Close to top HUD -->
        <div class="absolute top-20 left-0 right-0 text-center">
          <div id="hexaword-title" class="text-4xl font-black tracking-wide uppercase font-['Inter'] bg-gradient-to-br from-amber-500 to-red-500 bg-clip-text text-transparent">HEXA WORDS</div>
        </div>
        
        <!-- Daily and My Levels - Centered vertically in middle -->
        <div class="absolute top-1/2 left-0 right-0 -translate-y-1/2 px-4">
          <div class="flex justify-between w-full max-w-sm mx-auto px-2 sm:px-4">
            <!-- My Levels (left) -->
            <button id="hw-create" class="bg-gradient-to-br from-purple-600 to-purple-700 backdrop-blur-sm rounded-xl w-24 h-24 flex flex-col items-center justify-center hover:scale-105 transition-transform shadow-lg border border-purple-500/30">
              <div class="text-2xl mb-1">📝</div>
              <div class="text-xs text-white font-semibold uppercase tracking-wide">My Levels</div>
            </button>
            
            <!-- Daily Challenge (right) -->
            <button id="hw-daily-challenge" class="bg-gradient-to-br from-amber-500 to-orange-500 backdrop-blur-sm rounded-xl w-24 h-24 flex flex-col items-center justify-center hover:scale-105 transition-transform shadow-lg border border-amber-400/30 relative">
              <div class="text-2xl mb-1">☀️</div>
              <div class="text-xs text-white font-semibold uppercase tracking-wide">Daily</div>
              <span id="dc-streak-badge" class="hidden absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold"></span>
            </button>
          </div>
        </div>
        
        <!-- Play Button - Bottom position -->
        <div class="absolute bottom-24 left-0 right-0 px-4">
          <div class="flex justify-center">
            <button id="hw-level" class="bg-gradient-to-br from-green-500 to-green-600 backdrop-blur-sm rounded-xl w-24 h-24 flex flex-col items-center justify-center hover:scale-105 transition-transform shadow-xl border border-green-400/30">
              <div class="text-2xl mb-1">▶️</div>
              <div class="text-xs text-white font-bold uppercase tracking-wide">PLAY</div>
              <div class="text-[10px] text-green-100 opacity-90">Level 1</div>
            </button>
          </div>
        </div>
      </div>
      
      <!-- Bottom Navigation Tabs -->
      <div class="absolute bottom-0 left-0 right-0 bg-black/30 backdrop-blur-md border-t border-white/10">
        <div class="flex">
          <!-- Shop Tab (disabled) -->
          <button class="flex-1 flex flex-col items-center justify-center py-3 gap-1 opacity-30 cursor-not-allowed pointer-events-none bg-black/20" disabled tabindex="-1">
            <span class="text-xl opacity-60">🛍️</span>
            <span class="text-xs text-gray-600">Shop</span>
          </button>
          
          <!-- Home Tab (active) - with theme color highlight -->
          <button id="hw-home-tab" class="flex-1 flex flex-col items-center justify-center py-3 gap-1 bg-hw-accent-primary/10 border-t-2 border-hw-accent-primary relative">
            <span class="text-xl">🏠</span>
            <span class="text-xs text-hw-accent-primary font-semibold">Home</span>
            <!-- Active indicator -->
            <div class="absolute inset-x-0 bottom-0 h-0.5 bg-hw-accent-primary"></div>
          </button>
          
          <!-- Leaderboard Tab -->
          <button id="hw-leaderboard" class="flex-1 flex flex-col items-center justify-center py-3 gap-1 hover:bg-white/5 transition-colors">
            <span class="text-xl">🏆</span>
            <span class="text-xs text-hw-text-secondary hover:text-hw-text-primary">Leaderboard</span>
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(el);
    this.mainMenuEl = el;
    
    // Update coin display
    this.updateMenuCoinDisplay();

    // Wire buttons with proper null checks
    const levelBtn = el.querySelector('#hw-level') as HTMLButtonElement;
    const settingsButton = el.querySelector('#hw-settings-btn') as HTMLButtonElement;
    const exploreButton = el.querySelector('#hw-explore-btn') as HTMLButtonElement;
    const createBtn = el.querySelector('#hw-create') as HTMLButtonElement;

    // Debug to check if buttons are found
    console.log('Menu buttons found:', {
      level: !!levelBtn,
      settings: !!settingsButton,
      explore: !!exploreButton,
      create: !!createBtn
    });

    if (levelBtn) {
      levelBtn.addEventListener('click', async () => {
        console.log('Play button clicked');
        if (this.menuBusy) return;
        this.menuBusy = true;
        // Immediately disable all interactive controls in the menu to prevent double clicks
        try {
          const disableAll = () => {
            // Disable all buttons within the menu
            el.querySelectorAll('button').forEach((b) => {
              const btn = b as HTMLButtonElement;
              btn.disabled = true;
              btn.style.pointerEvents = 'none';
              btn.classList.add('opacity-50', 'cursor-not-allowed');
            });
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
      });
    }

    // Settings button handler
    if (settingsButton) {
      settingsButton.addEventListener('click', () => {
        console.log('Settings button clicked');
        this.showSettingsPanel();
      });
      // Also ensure the button has proper z-index
      settingsButton.style.position = 'relative';
      settingsButton.style.zIndex = '100';
    } else {
      console.error('Settings button not found!');
    }

    // Explore button handler
    if (exploreButton) {
      exploreButton.addEventListener('click', async () => {
        console.log('Explore button clicked');
        if (this.menuBusy) return;
        await this.showExploreLevelsView();
      });
      // Also ensure the button has proper z-index
      exploreButton.style.position = 'relative';
      exploreButton.style.zIndex = '100';
    } else {
      console.error('Explore button not found!');
    }

    // My Levels flow (shows inline like leaderboard)
    if (createBtn) {
      createBtn.addEventListener('click', async () => {
        console.log('My Levels button clicked');
        if (this.menuBusy) return;
        await this.showMyLevelsView();
      });
    }
    
    // Daily Challenge button handler
    const dailyChallengeBtn = el.querySelector('#hw-daily-challenge') as HTMLButtonElement;
    dailyChallengeBtn.onclick = async () => {
      if (this.menuBusy) return;
      
      try {
        const { DailyChallenge } = await import('./features/DailyChallenge');
        const dailyChallenge = new DailyChallenge();
        const result = await dailyChallenge.show();
        
        if (result?.action === 'play' && result.challengeData) {
          // Start the daily challenge game
          await this.startDailyChallenge(result.challengeData);
        }
      } catch (error) {
        console.error('Failed to show daily challenge:', error);
        this.showToast('Failed to load daily challenge', 'error');
      }
    };
    
    // Check for active streak and show badge
    this.updateStreakBadge();
    
    // Leaderboard button handler
    const leaderboardBtn = el.querySelector('#hw-leaderboard') as HTMLButtonElement;
    leaderboardBtn.onclick = async () => {
      if (this.menuBusy) return;
      await this.showLeaderboardView();
    };
    
    // Home tab handler - use addEventListener to prevent overwriting
    const homeTab = el.querySelector('#hw-home-tab') as HTMLButtonElement;
    homeTab.addEventListener('click', () => {
      this.activateTab('home');
    });
    
    // Listen for play-user-level events from LevelManager
    window.addEventListener('play-user-level', async (event: Event) => {
      const customEvent = event as CustomEvent;
      const levelId = customEvent.detail?.levelId;
      if (levelId) {
        await blurTransition.transitionWithBlur(async () => {
          await this.playUserLevel(levelId);
          this.hideMainMenu();
        }, { blurIntensity: 'lg', inDuration: 200, outDuration: 250 });
      }
    });
  }
  
  private async showExploreLevelsView(): Promise<void> {
    // Remove any existing views
    const existingView = document.getElementById('explore-levels-view');
    if (existingView) existingView.remove();

    // Create Explore Levels container
    const exploreLevelsContainer = document.createElement('div');
    exploreLevelsContainer.id = 'explore-levels-view';
    exploreLevelsContainer.className = 'absolute inset-0 z-10 pointer-events-none';

    // Build full Explore Levels UI
    exploreLevelsContainer.innerHTML = `
      <div class="absolute inset-0 top-16 bottom-16 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden pointer-events-auto">
        <!-- Header with gradient background -->
        <div class="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 shadow-xl">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-bold text-white flex items-center gap-1">
                <span class="text-base">🔍</span>
                <span>Explore Levels</span>
              </h2>
              <p class="text-indigo-200 text-[10px] mt-0.5">Discover amazing levels created by the community</p>
            </div>
            <button id="explore-back" class="text-white/80 hover:text-white transition-all transform hover:scale-110 p-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Search Bar -->
        <div class="bg-black/40 backdrop-blur-md border-b border-white/10 p-2">
          <div class="max-w-2xl mx-auto">
            <div class="relative">
              <input
                id="explore-search-input"
                type="text"
                placeholder="Search by username, level name, clue, or code..."
                class="w-full px-6 py-1.5 text-xs bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-purple-400 focus:bg-white/15 transition-all"
              />
              <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
              <button id="explore-search-btn" class="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white text-[10px] font-semibold rounded-md transition-all transform hover:scale-105">
                Search
              </button>
            </div>

            <!-- Filter Tabs -->
            <div class="flex gap-1 mt-2">
              <button class="explore-filter-tab active px-2 py-0.5 text-[10px] font-medium text-white/90 bg-white/20 rounded-md transition-all" data-filter="latest">
                Latest
              </button>
              <button class="explore-filter-tab px-2 py-0.5 text-[10px] font-medium text-white/60 hover:text-white/90 hover:bg-white/10 rounded-md transition-all" data-filter="popular">
                Popular
              </button>
            </div>
          </div>
        </div>

        <!-- Content Area -->
        <div class="overflow-y-auto" style="height: calc(100% - 120px);">
          <div id="explore-levels-list" class="p-3">
            <!-- Loading state -->
            <div class="flex flex-col items-center justify-center py-16">
              <div class="relative">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                <span class="absolute inset-0 flex items-center justify-center text-base">🔍</span>
              </div>
              <div class="text-[10px] text-white/60 mt-3">Discovering amazing levels...</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add to main menu
    const mainMenu = document.getElementById('hw-main-menu');
    if (!mainMenu) return;

    // Hide main content
    const mainContent = mainMenu.querySelector('.relative.h-full');
    if (mainContent) {
      (mainContent as HTMLElement).style.display = 'none';
    }

    mainMenu.appendChild(exploreLevelsContainer);

    // Animate entrance with GSAP
    const timeline = gsap.timeline();
    timeline.fromTo(exploreLevelsContainer.querySelector('.bg-gradient-to-r'),
      { y: -100, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }
    );
    timeline.fromTo(exploreLevelsContainer.querySelector('.bg-black\\/40'),
      { y: -50, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, ease: "power3.out" },
      "-=0.3"
    );
    timeline.fromTo(exploreLevelsContainer.querySelector('#explore-levels-list'),
      { opacity: 0, scale: 0.95 },
      { opacity: 1, scale: 1, duration: 0.4, ease: "power3.out" },
      "-=0.2"
    );

    // Setup Explore Levels functionality
    await this.setupExploreLevels();

    // Setup back button
    const backBtn = exploreLevelsContainer.querySelector('#explore-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        // Animate exit
        gsap.to(exploreLevelsContainer, {
          opacity: 0,
          scale: 0.95,
          duration: 0.3,
          ease: "power2.in",
          onComplete: () => {
            this.activateTab('home');
          }
        });
      });
    }
  }

  private async showMyLevelsView(): Promise<void> {
    // Remove any existing views
    const existingView = document.getElementById('my-levels-view');
    if (existingView) existingView.remove();
    
    // Create My Levels container that fits between HUD and tabs
    const myLevelsContainer = document.createElement('div');
    myLevelsContainer.id = 'my-levels-view';
    myLevelsContainer.className = 'absolute inset-0 z-10 pointer-events-none';
    
    // Build full My Levels UI inline (not modal)
    myLevelsContainer.innerHTML = `
      <div class="absolute inset-0 top-16 bottom-16 bg-gradient-to-br from-hw-surface-primary to-hw-surface-secondary overflow-hidden pointer-events-auto">
        <!-- Header -->
        <div class="bg-gradient-to-r from-purple-600 to-purple-800 px-6 py-3">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-xl font-bold text-white">📝 My Levels</h2>
              <p class="text-purple-200 text-xs mt-0.5">Create and manage your custom levels</p>
            </div>
            <button id="ml-back" class="text-white/80 hover:text-white transition-colors">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 10H4M10 15l-6-6 6-6"/>
              </svg>
            </button>
          </div>
        </div>
        
        <!-- Create Button -->
        <div class="bg-black/30 backdrop-blur-sm border-b border-white/10 p-3">
          <button id="ml-create" class="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold py-2.5 rounded-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2 text-sm">
            <span class="text-lg">+</span>
            <span>Create New Level</span>
          </button>
        </div>
        
        <!-- Content Area -->
        <div class="overflow-y-auto" style="height: calc(100% - 160px);">
          <div id="ml-list" class="p-4 space-y-3">
            <!-- Loading state -->
            <div class="flex items-center justify-center py-10">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
              <div class="text-xs text-hw-text-secondary ml-2">Loading your levels...</div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add to main menu
    const mainMenu = document.getElementById('hw-main-menu');
    if (!mainMenu) return;
    
    // Hide main content
    const mainContent = mainMenu.querySelector('.flex.flex-col.items-center.justify-center.h-full');
    if (mainContent) {
      (mainContent as HTMLElement).style.display = 'none';
    }
    
    mainMenu.appendChild(myLevelsContainer);
    
    // Setup My Levels functionality
    await this.setupInlineMyLevels();
    
    // Setup back button
    const backBtn = myLevelsContainer.querySelector('#ml-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.activateTab('home');
      });
    }
  }
  
  private async setupInlineMyLevels(): Promise<void> {
    try {
      // Import LevelManager to get the data handling
      const { LevelManager } = await import('./features/LevelManager');
      
      // Fetch user levels
      console.log('Fetching user levels from /api/user-levels/mine');
      const response = await fetch('/api/user-levels/mine', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('My Levels API response status:', response.status);
      let levels: any[] = [];
      if (response.ok) {
        const data = await response.json();
        console.log('My Levels API data:', data);
        levels = data.levels || [];
      } else {
        const errorData = await response.json();
        console.error('My Levels API Error:', errorData);
      }
      
      // Render levels
      const listContainer = document.getElementById('ml-list');
      if (!listContainer) return;
      
      if (levels.length === 0) {
        listContainer.innerHTML = `
          <div class="text-center py-10">
            <div class="text-4xl mb-3 opacity-30">🎮</div>
            <div class="text-base text-hw-text-primary mb-1.5">No levels yet</div>
            <div class="text-xs text-hw-text-secondary">Create your first custom level to get started!</div>
          </div>
        `;
      } else {
        listContainer.innerHTML = levels.map(level => `
          <div class="level-card p-3 rounded-lg bg-hw-surface-tertiary/30 hover:bg-hw-surface-tertiary/50 border border-white/10 hover:border-purple-500/30 transition-all duration-200 cursor-pointer group" data-level-id="${level.id}">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-1.5 mb-1.5">
                  ${level.name ? `<div class="font-bold text-sm text-white">${level.name}</div>` : ''}
                  <div class="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                    ${level.words.length} words
                  </div>
                </div>
                <div class="text-xs text-purple-200 mb-1.5">${level.clue}</div>
                <div class="flex flex-wrap gap-1 mb-2">
                  ${level.words.map((word: string) => `
                    <span class="px-1.5 py-0.5 rounded bg-black/20 text-white text-[10px] font-mono uppercase">
                      ${word}
                    </span>
                  `).join('')}
                </div>
                <div class="flex items-center justify-between mt-2 text-[10px] text-gray-400">
                  <span class="flex items-center gap-0.5">
                    <span class="text-xs">🎮</span>
                    <span>${level.playCount || 0}</span>
                  </span>
                  <span class="flex items-center gap-0.5">
                    <span class="text-xs">👍</span>
                    <span>${level.upvotes || 0}</span>
                  </span>
                  <span class="flex items-center gap-0.5">
                    <span class="text-xs">👎</span>
                    <span>${level.downvotes || 0}</span>
                  </span>
                  <span class="flex items-center gap-0.5">
                    <span class="text-xs">📤</span>
                    <span>${level.shares || 0}</span>
                  </span>
                </div>
                <div class="text-[10px] text-gray-500 mt-1.5">
                  Created ${this.formatRelativeTime(level.createdAt)}
                </div>
              </div>
              <div class="flex flex-col gap-1.5 ml-2">
                <button class="ml-play-btn px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold text-xs transition-all transform hover:scale-105" data-level-id="${level.id}">
                  Play
                </button>
                <button class="ml-share-btn px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold text-xs transition-all transform hover:scale-105 flex items-center justify-center gap-1" data-level-id="${level.id}" data-level-name="${level.name || 'Custom Level'}" data-level-clue="${level.clue}">
                  <span class="text-xs">📤</span>
                  <span>Share</span>
                </button>
                <button class="ml-delete-btn px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-xs opacity-0 group-hover:opacity-100" data-level-id="${level.id}">
                  Delete
                </button>
              </div>
            </div>
          </div>
        `).join('');
        
        // Setup play buttons
        listContainer.querySelectorAll('.ml-play-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const levelId = (e.currentTarget as HTMLElement).dataset.levelId;
            if (levelId) {
              await blurTransition.transitionWithBlur(async () => {
                await this.playUserLevel(levelId);
                this.hideMainMenu();
              }, { blurIntensity: 'lg', inDuration: 200, outDuration: 250 });
            }
          });
        });
        
        // Setup share buttons
        listContainer.querySelectorAll('.ml-share-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const levelId = (e.currentTarget as HTMLElement).dataset.levelId;
            const levelName = (e.currentTarget as HTMLElement).dataset.levelName || 'Custom Level';
            const levelClue = (e.currentTarget as HTMLElement).dataset.levelClue || '';
            
            if (levelId) {
              await this.shareLevelInline(levelId, levelName, levelClue);
            }
          });
        });
        
        // Setup delete buttons
        listContainer.querySelectorAll('.ml-delete-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const levelId = (e.currentTarget as HTMLElement).dataset.levelId;
            if (levelId && confirm('Are you sure you want to delete this level?')) {
              try {
                const response = await fetch(`/api/user-levels/${levelId}`, {
                  method: 'DELETE',
                  headers: {
                    'Content-Type': 'application/json'
                  }
                });
                
                if (response.ok) {
                  // Refresh the view
                  await this.setupInlineMyLevels();
                  this.showToast('Level deleted successfully', 'success');
                } else {
                  this.showToast('Failed to delete level', 'error');
                }
              } catch (error) {
                console.error('Error deleting level:', error);
                this.showToast('Failed to delete level', 'error');
              }
            }
          });
        });
      }
      
      // Setup create button
      const createBtn = document.getElementById('ml-create');
      if (createBtn) {
        createBtn.addEventListener('click', async () => {
          try {
            console.log('Create button clicked, importing LevelCreator...');
            const { LevelCreator } = await import('./features/LevelCreator');
            console.log('Creating LevelCreator instance...');
            const creator = new LevelCreator();
            console.log('Showing LevelCreator...');
            const result = await creator.show();
            console.log('LevelCreator result:', result);
            
            if (result?.action === 'save') {
              // Refresh the levels list
              await this.setupInlineMyLevels();
              this.showToast('Level created successfully!', 'success');
            }
          } catch (error) {
            console.error('Error creating level:', error);
            this.showToast('Failed to open level creator', 'error');
          }
        });
      }
      
    } catch (error) {
      console.error('Failed to setup My Levels:', error);
      const listContainer = document.getElementById('ml-list');
      if (listContainer) {
        listContainer.innerHTML = `
          <div class="text-center py-10">
            <div class="text-red-500 text-sm mb-1.5">Failed to load levels</div>
            <div class="text-hw-text-secondary text-xs">Please try again later</div>
          </div>
        `;
      }
    }
  }

  private async openLevelExplorer(): Promise<void> {
    try {
      const { LevelManager } = await import('./features/LevelManager');
      const manager = new LevelManager();
      const result = await manager.show();

      if (result?.action === 'play' && result.levelId) {
        await this.playUserLevel(result.levelId);
      }
    } catch (error) {
      console.error('Failed to open level explorer:', error);
      this.showToast('Failed to open level explorer', 'error');
    }
  }

  private async setupExploreLevels(): Promise<void> {
    let currentFilter = 'latest';
    let searchQuery = '';

    const loadLevels = async (filter: string = 'latest', search: string = '') => {
      const listContainer = document.getElementById('explore-levels-list');
      if (!listContainer) return;

      // Show loading state
      listContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12">
          <div class="relative">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            <span class="absolute inset-0 flex items-center justify-center text-base">🔍</span>
          </div>
          <div class="text-[10px] text-white/60 mt-3">Searching for levels...</div>
        </div>
      `;

      try {
        // Construct query params
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        params.append('filter', filter);

        console.log('Fetching explore levels with params:', params.toString());
        const response = await fetch(`/api/user-levels/explore?${params}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        console.log('Explore API response status:', response.status);
        if (!response.ok) {
          const errorData = await response.json();
          console.error('API Error:', errorData);
          throw new Error(errorData?.error?.message || 'Failed to fetch levels');
        }

        const data = await response.json();
        console.log('Explore API data:', data);
        const levels = data.levels || [];

        if (levels.length === 0) {
          listContainer.innerHTML = `
            <div class="text-center py-12">
              <div class="text-4xl mb-3 opacity-30">🔍</div>
              <div class="text-sm text-white/80 mb-1">No levels found</div>
              <div class="text-[10px] text-white/50">
                ${search ? 'Try adjusting your search terms' : 'Be the first to create a level!'}
              </div>
            </div>
          `;
        } else {
          // Create level cards with enhanced styling
          listContainer.innerHTML = `
            <div class="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              ${levels.map((level: any) => `
                <div class="level-explore-card group relative overflow-hidden rounded-lg bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 hover:border-purple-400/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/10">
                  <div class="p-2">
                    <!-- Header -->
                    <div class="flex items-start justify-between mb-1.5">
                      <div class="flex-1">
                        <h3 class="font-semibold text-white text-[10px] mb-0.5 truncate">${level.name || 'Untitled Level'}</h3>
                        <div class="flex items-center gap-1 text-[9px] text-white/60">
                          <span>by ${level.author || 'Anonymous'}</span>
                          <span>•</span>
                          <span>${this.formatRelativeTime(level.createdAt)}</span>
                        </div>
                      </div>
                      ${level.difficulty ? `
                        <span class="px-1 py-0.5 rounded-full text-[9px] font-semibold ${
                          level.difficulty === 'easy' ? 'bg-green-500/20 text-green-300' :
                          level.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-red-500/20 text-red-300'
                        }">
                          ${level.difficulty}
                        </span>
                      ` : ''}
                    </div>

                    <!-- Clue -->
                    <div class="mb-1.5 p-1.5 rounded bg-black/20 border border-white/5">
                      <div class="text-[9px] text-purple-300">Clue:</div>
                      <div class="text-[10px] text-white/90">${level.clue}</div>
                    </div>

                    <!-- Words preview -->
                    <div class="mb-1.5">
                      <div class="flex flex-wrap gap-0.5">
                        ${level.words.slice(0, 3).map((word: string) => `
                          <span class="px-1 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] font-mono uppercase">
                            ${word}
                          </span>
                        `).join('')}
                        ${level.words.length > 3 ? `
                          <span class="px-1 py-0.5 rounded bg-white/10 text-white/50 text-[9px]">
                            +${level.words.length - 3}
                          </span>
                        ` : ''}
                      </div>
                    </div>

                    <!-- Stats -->
                    <div class="flex items-center justify-between text-[9px] text-white/50 mb-1.5">
                      <div class="flex items-center gap-2">
                        <span class="flex items-center gap-0.5">
                          <span class="text-[8px]">🎮</span>
                          <span>${level.playCount || 0}</span>
                        </span>
                        <span class="flex items-center gap-0.5">
                          <span class="text-[8px]">👍</span>
                          <span>${level.upvotes || 0}</span>
                        </span>
                        <span class="flex items-center gap-0.5">
                          <span class="text-[8px]">✅</span>
                          <span>${level.completions || 0}</span>
                        </span>
                      </div>
                      ${level.code ? `
                        <span class="px-1 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[8px]">
                          #${level.code}
                        </span>
                      ` : ''}
                    </div>

                    <!-- Action buttons -->
                    <div class="flex gap-1">
                      <button class="explore-play-btn flex-1 px-1.5 py-0.5 rounded bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold text-[9px] transition-all transform hover:scale-105 flex items-center justify-center gap-0.5" data-level-id="${level.id}">
                        <span class="text-[10px]">▶️</span>
                        <span>Play</span>
                      </button>
                      <button class="explore-share-btn px-1.5 py-0.5 rounded bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold text-[9px] transition-all transform hover:scale-105" data-level-id="${level.id}" data-level-name="${level.name || 'Custom Level'}" data-level-clue="${level.clue}">
                        <span class="text-[10px]">📤</span>
                      </button>
                    </div>
                  </div>

                  <!-- Decorative gradient overlay -->
                  <div class="absolute inset-0 bg-gradient-to-t from-purple-500/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
              `).join('')}
            </div>
          `;

          // Animate cards entrance with GSAP
          const cards = listContainer.querySelectorAll('.level-explore-card');
          gsap.fromTo(cards,
            { opacity: 0, y: 20, scale: 0.95 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.4,
              stagger: 0.05,
              ease: "power2.out"
            }
          );

          // Wire up play buttons
          listContainer.querySelectorAll('.explore-play-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              e.stopPropagation();
              const levelId = (btn as HTMLElement).dataset.levelId;
              if (!levelId) return;

              // Animate button click
              gsap.to(btn, {
                scale: 0.95,
                duration: 0.1,
                yoyo: true,
                repeat: 1
              });

              // Close explore view and start level
              await this.playUserLevel(levelId);
              this.hideMainMenu();
            });
          });

          // Wire up share buttons
          listContainer.querySelectorAll('.explore-share-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              e.stopPropagation();
              const levelId = (btn as HTMLElement).dataset.levelId;
              const levelName = (btn as HTMLElement).dataset.levelName;
              const levelClue = (btn as HTMLElement).dataset.levelClue;

              if (!levelId || !levelName || !levelClue) return;

              await this.shareLevelInline(levelId, levelName, levelClue);
            });
          });
        }
      } catch (error) {
        console.error('Failed to load levels:', error);
        listContainer.innerHTML = `
          <div class="text-center py-12">
            <div class="text-3xl mb-3 opacity-30">❌</div>
            <div class="text-sm text-red-400 mb-1">Failed to load levels</div>
            <div class="text-[10px] text-white/50">Please try again later</div>
          </div>
        `;
      }
    };

    // Initial load
    await loadLevels(currentFilter, searchQuery);

    // Setup filter tabs
    const filterTabs = document.querySelectorAll('.explore-filter-tab');
    filterTabs.forEach(tab => {
      tab.addEventListener('click', async () => {
        const filter = (tab as HTMLElement).dataset.filter || 'latest';

        // Update active state
        filterTabs.forEach(t => {
          t.classList.remove('active', 'bg-white/20', 'text-white/90');
          t.classList.add('text-white/60', 'hover:text-white/90', 'hover:bg-white/10');
        });
        tab.classList.add('active', 'bg-white/20', 'text-white/90');
        tab.classList.remove('text-white/60', 'hover:text-white/90', 'hover:bg-white/10');

        currentFilter = filter;
        await loadLevels(currentFilter, searchQuery);
      });
    });

    // Setup search
    const searchInput = document.getElementById('explore-search-input') as HTMLInputElement;
    const searchBtn = document.getElementById('explore-search-btn');

    const performSearch = async () => {
      searchQuery = searchInput.value.trim();
      await loadLevels(currentFilter, searchQuery);
    };

    searchBtn?.addEventListener('click', performSearch);
    searchInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        performSearch();
      }
    });

    // Clear search on input clear
    searchInput?.addEventListener('input', () => {
      if (searchInput.value === '' && searchQuery !== '') {
        searchQuery = '';
        loadLevels(currentFilter, searchQuery);
      }
    });
  }

  private formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString();
  }

  private async handleSharedLevelLaunch(): Promise<void> {
    if (this.sharedLevelHandled) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const levelId = params.get('level');
    if (!levelId) {
      return;
    }

    this.sharedLevelHandled = true;

    try {
      const response = await fetch(`/api/user-levels/${encodeURIComponent(levelId)}/preview`);
      if (!response.ok) {
        console.error('Failed to fetch shared level preview:', response.status);
        this.showToast('Shared level is unavailable', 'error');
        this.clearSharedLevelQuery();
        return;
      }

      const data = await response.json();
      if (!data?.level) {
        this.clearSharedLevelQuery();
        return;
      }

      this.renderSharedLevelSplash(levelId, data.level as SharedLevelPreview);
    } catch (error) {
      console.error('Failed to load shared level preview:', error);
      this.showToast('Failed to open shared level', 'error');
      this.clearSharedLevelQuery();
    }
  }

  private renderSharedLevelSplash(levelId: string, preview: SharedLevelPreview): void {
    const displayName = preview.name?.trim() || 'Shared HexaWord Puzzle';
    const clue = preview.clue?.trim() || 'Solve this custom HexaWord challenge';
    const author = preview.author ? `@${preview.author}` : 'a HexaWord creator';
    const wordsCount = preview.words?.length ?? 0;
    const createdAgo = preview.createdAt ? this.formatRelativeTime(preview.createdAt) : undefined;
    const letterSource = (preview.letterBank && preview.letterBank.length > 0) ? preview.letterBank : preview.uniqueLetters;
    const letterBadges = letterSource.length > 0
      ? letterSource.map(letter => {
          const rendered = this.escapeHtml((letter || '').toUpperCase());
          return `<span class="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-lg font-semibold tracking-wide text-white shadow-lg shadow-purple-500/10">${rendered}</span>`;
        }).join('')
      : '<span class="text-white/60">No letters available</span>';
    const stats: string[] = [];
    if (wordsCount > 0) {
      stats.push(`${wordsCount} hidden word${wordsCount === 1 ? '' : 's'}`);
    }
    if (preview.shares > 0) {
      stats.push(`${preview.shares} share${preview.shares === 1 ? '' : 's'}`);
    }
    if (createdAgo) {
      stats.push(`Created ${createdAgo}`);
    }

    const overlay = document.createElement('div');
    overlay.id = 'shared-level-splash';
    overlay.className = 'fixed inset-0 z-[10002] flex items-center justify-center px-4 py-10';
    overlay.innerHTML = `
      <div class="absolute inset-0 bg-gradient-to-br from-[#1c0f3c]/95 via-[#0b101f]/92 to-black/95 backdrop-blur-2xl"></div>
      <div class="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_25px_120px_rgba(96,76,255,0.45)]">
        <div class="absolute -top-40 -right-24 h-80 w-80 rounded-full bg-purple-500/30 blur-3xl"></div>
        <div class="absolute -bottom-52 -left-36 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl"></div>
        <div class="relative space-y-8 p-8 md:p-10 text-white">
          <div class="space-y-3 text-center">
            <span class="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
              <span>Shared Level</span>
            </span>
            <h2 class="text-3xl font-bold leading-tight md:text-4xl">${this.escapeHtml(displayName)}</h2>
            <p class="text-base text-white/80 md:text-lg">“${this.escapeHtml(clue)}”</p>
            <p class="text-sm text-white/60">Created by <span class="text-white/80">${this.escapeHtml(author)}</span></p>
          </div>

          <div class="rounded-2xl border border-white/10 bg-black/30 p-6 shadow-inner shadow-purple-900/20">
            <div class="mb-3 flex items-center justify-between text-sm uppercase tracking-wide text-white/60">
              <span>Letter Bank</span>
              <span>${letterSource.length} tiles</span>
            </div>
            <div class="flex flex-wrap justify-center gap-2 text-lg font-semibold">
              ${letterBadges}
            </div>
          </div>

          <div class="rounded-2xl border border-white/5 bg-white/5 p-5 text-sm text-white/70">
            <div class="font-semibold text-white/90">What to expect</div>
            <div class="mt-2 flex flex-wrap gap-3">
              ${stats.length > 0 ? stats.map(item => `<span class=\"rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/70\">${this.escapeHtml(item)}</span>`).join('') : '<span class="text-white/60">Fresh puzzle data incoming</span>'}
            </div>
          </div>

          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-center">
            <button id="shared-level-play" class="flex-1 rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-indigo-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-purple-500/30 transition-transform duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-purple-200/70 md:flex-none md:px-10">
              Start Playing
            </button>
            <button id="shared-level-dismiss" class="rounded-full border border-white/20 px-6 py-3 text-base font-semibold text-white/80 transition-colors duration-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40">
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    `;

    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 220ms ease-out';
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
    });

    const closeSplash = () => {
      overlay.style.opacity = '0';
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
      this.clearSharedLevelQuery();
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeSplash();
      }
    });

    const dismissBtn = overlay.querySelector<HTMLButtonElement>('#shared-level-dismiss');
    dismissBtn?.addEventListener('click', () => {
      closeSplash();
    });

    const playBtn = overlay.querySelector<HTMLButtonElement>('#shared-level-play');
    playBtn?.addEventListener('click', async () => {
      if (!playBtn || playBtn.disabled) {
        return;
      }

      playBtn.disabled = true;
      playBtn.textContent = 'Loading…';

      try {
        await blurTransition.transitionWithBlur(async () => {
          await this.playUserLevel(levelId);
          this.hideMainMenu();
        }, { blurIntensity: 'lg', inDuration: 200, outDuration: 250 });

        closeSplash();
      } catch (error) {
        console.error('Failed to start shared level:', error);
        this.showToast('Failed to load shared level', 'error');
        playBtn.disabled = false;
        playBtn.textContent = 'Start Playing';
      }
    });
  }

  private clearSharedLevelQuery(): void {
    const url = new URL(window.location.href);
    if (url.searchParams.has('level')) {
      url.searchParams.delete('level');
      window.history.replaceState({}, '', url.toString());
    }
  }

  private escapeHtml(value?: string): string {
    if (!value) {
      return '';
    }

    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  private async shareLevelInline(levelId: string, levelName: string, levelClue: string): Promise<void> {
    // Generate the shareable URL for the level
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}?level=${encodeURIComponent(levelId)}`;
    
    // Create the Reddit share content
    const title = `Check out my HexaWords puzzle: "${levelName}"`;
    
    // Show share dialog
    const dialog = document.createElement('div');
    dialog.className = 'fixed inset-0 flex items-center justify-center z-[10001]';
    dialog.innerHTML = `
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" id="share-backdrop"></div>
      <div class="relative bg-hw-surface-primary border border-hw-surface-tertiary/30 rounded-lg p-6 max-w-md mx-4">
        <h3 class="text-lg font-bold text-hw-text-primary mb-4">Share Your Level</h3>
        
        <div class="space-y-3">
          <!-- Share to Reddit -->
          <button id="share-reddit" class="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold transition-all transform hover:scale-105 flex items-center justify-center gap-2">
            <span class="text-xl">🔗</span>
            <span>Share to Reddit</span>
          </button>
          
          <!-- Copy Link -->
          <button id="share-copy" class="w-full px-4 py-3 rounded-lg bg-hw-surface-secondary hover:bg-hw-surface-tertiary text-hw-text-primary font-semibold transition-colors flex items-center justify-center gap-2">
            <span class="text-xl">📋</span>
            <span>Copy Link</span>
          </button>
          
          <!-- Share URL Display -->
          <div class="p-3 rounded-lg bg-black/20 border border-white/10">
            <div class="text-xs text-hw-text-secondary mb-1">Share URL:</div>
            <div class="text-sm text-hw-text-primary font-mono break-all">${shareUrl}</div>
          </div>
        </div>
        
        <div class="flex justify-end mt-6">
          <button id="share-close" class="px-4 py-2 rounded-lg bg-hw-surface-secondary text-hw-text-primary hover:bg-hw-surface-tertiary transition-colors">
            Close
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Handle Reddit share
    dialog.querySelector('#share-reddit')?.addEventListener('click', async () => {
      // Track the share
      try {
        await fetch(`/api/user-levels/${encodeURIComponent(levelId)}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Failed to track share:', error);
      }
      
      // Reddit submission URL
      const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(title)}`;
      window.open(redditUrl, '_blank', 'width=600,height=600');
      
      this.showToast('Opening Reddit to share your level!', 'success');
    });
    
    // Handle copy link
    dialog.querySelector('#share-copy')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        this.showToast('Link copied to clipboard!', 'success');
      } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        this.showToast('Link copied to clipboard!', 'success');
      }
    });
    
    // Handle close
    const closeDialog = () => dialog.remove();
    dialog.querySelector('#share-close')?.addEventListener('click', closeDialog);
    dialog.querySelector('#share-backdrop')?.addEventListener('click', closeDialog);
  }

  private async showLeaderboardView(): Promise<void> {
    // Remove any existing leaderboard view first
    const existingView = document.getElementById('leaderboard-view');
    if (existingView) existingView.remove();
    
    // Create leaderboard container that fits between HUD and tabs
    const leaderboardContainer = document.createElement('div');
    leaderboardContainer.id = 'leaderboard-view';
    leaderboardContainer.className = 'absolute inset-0 z-10 pointer-events-none';
    
    // Build full leaderboard UI inline (not modal)
    leaderboardContainer.innerHTML = `
      <div class="absolute inset-0 top-16 bottom-16 bg-gradient-to-br from-hw-surface-primary to-hw-surface-secondary overflow-hidden pointer-events-auto">
        <!-- Header -->
        <div class="bg-gradient-to-r from-purple-600 to-purple-800 px-6 py-4">
          <h2 class="text-2xl font-bold text-white">🏆 Leaderboard</h2>
          <p class="text-purple-200 text-sm mt-1">Compete with players worldwide</p>
        </div>
        
        <!-- Main Tabs -->
        <div class="flex border-b-2 border-hw-surface-tertiary/50 bg-gradient-to-b from-hw-surface-primary to-hw-surface-secondary">
          <button data-main-tab="levels" class="lb-main-tab flex-1 px-3 py-3 text-sm font-semibold transition-all relative text-purple-400">
            <span class="relative z-10">🎮 Levels</span>
            <div class="lb-main-tab-indicator absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500"></div>
          </button>
          <button data-main-tab="creators" class="lb-main-tab flex-1 px-3 py-3 text-sm font-semibold transition-all relative text-hw-text-secondary">
            <span class="relative z-10">🎨 Creators</span>
            <div class="lb-main-tab-indicator absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 scale-x-0"></div>
          </button>
          <button data-main-tab="dailychallenge" class="lb-main-tab flex-1 px-3 py-3 text-sm font-semibold transition-all relative text-hw-text-secondary">
            <span class="relative z-10">🏆 Daily</span>
            <div class="lb-main-tab-indicator absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 scale-x-0"></div>
          </button>
        </div>
        
        <!-- Sub Tabs Container with different background -->
        <div class="bg-black/30 backdrop-blur-sm border-b border-white/10">
          <!-- Sub Tabs (for Levels) -->
          <div id="lb-level-sub-tabs" class="flex justify-around px-2">
            <button data-level-sub-tab="global" class="lb-level-sub-tab flex-1 max-w-[120px] py-2 text-xs font-medium transition-all relative text-purple-400 bg-white/5">
              <span class="relative z-10 flex items-center justify-center gap-1">
                <span class="text-sm">🌍</span>
                <span class="hidden sm:inline">Global</span>
              </span>
              <div class="lb-level-sub-tab-indicator absolute bottom-0 left-2 right-2 h-0.5 bg-purple-400 transition-transform"></div>
            </button>
            <button data-level-sub-tab="weekly" class="lb-level-sub-tab flex-1 max-w-[120px] py-2 text-xs font-medium transition-all relative text-hw-text-secondary hover:bg-white/5">
              <span class="relative z-10 flex items-center justify-center gap-1">
                <span class="text-sm">📅</span>
                <span class="hidden sm:inline">Weekly</span>
              </span>
              <div class="lb-level-sub-tab-indicator absolute bottom-0 left-2 right-2 h-0.5 bg-purple-400 transition-transform scale-x-0"></div>
            </button>
            <button data-level-sub-tab="daily" class="lb-level-sub-tab flex-1 max-w-[120px] py-2 text-xs font-medium transition-all relative text-hw-text-secondary hover:bg-white/5">
              <span class="relative z-10 flex items-center justify-center gap-1">
                <span class="text-sm">☀️</span>
                <span class="hidden sm:inline">Daily</span>
              </span>
              <div class="lb-level-sub-tab-indicator absolute bottom-0 left-2 right-2 h-0.5 bg-purple-400 transition-transform scale-x-0"></div>
            </button>
          </div>
          
          <!-- Sub Tabs (for Creators) - hidden initially -->
          <div id="lb-creator-sub-tabs" class="hidden flex justify-around px-2">
            <button data-creator-sub-tab="overall" class="lb-creator-sub-tab flex-1 max-w-[100px] py-2 text-xs font-medium transition-all relative text-purple-400 bg-white/5">
              <span class="relative z-10 flex items-center justify-center gap-1">
                <span class="text-sm">⭐</span>
                <span class="hidden lg:inline">Overall</span>
              </span>
              <div class="lb-creator-sub-tab-indicator absolute bottom-0 left-2 right-2 h-0.5 bg-purple-400 transition-transform"></div>
            </button>
            <button data-creator-sub-tab="plays" class="lb-creator-sub-tab flex-1 max-w-[100px] py-2 text-xs font-medium transition-all relative text-hw-text-secondary hover:bg-white/5">
              <span class="relative z-10 flex items-center justify-center gap-1">
                <span class="text-sm">🎮</span>
                <span class="hidden lg:inline">Plays</span>
              </span>
              <div class="lb-creator-sub-tab-indicator absolute bottom-0 left-2 right-2 h-0.5 bg-purple-400 transition-transform scale-x-0"></div>
            </button>
            <button data-creator-sub-tab="upvotes" class="lb-creator-sub-tab flex-1 max-w-[100px] py-2 text-xs font-medium transition-all relative text-hw-text-secondary hover:bg-white/5">
              <span class="relative z-10 flex items-center justify-center gap-1">
                <span class="text-sm">👍</span>
                <span class="hidden lg:inline">Liked</span>
              </span>
              <div class="lb-creator-sub-tab-indicator absolute bottom-0 left-2 right-2 h-0.5 bg-purple-400 transition-transform scale-x-0"></div>
            </button>
            <button data-creator-sub-tab="shares" class="lb-creator-sub-tab flex-1 max-w-[100px] py-2 text-xs font-medium transition-all relative text-hw-text-secondary hover:bg-white/5">
              <span class="relative z-10 flex items-center justify-center gap-1">
                <span class="text-sm">📤</span>
                <span class="hidden lg:inline">Shared</span>
              </span>
              <div class="lb-creator-sub-tab-indicator absolute bottom-0 left-2 right-2 h-0.5 bg-purple-400 transition-transform scale-x-0"></div>
            </button>
          </div>
        </div>
        
        <!-- Content Area -->
        <div class="overflow-y-auto" style="height: calc(100% - 180px);">
          <div id="lb-list" class="p-4 space-y-2">
            <!-- Loading state -->
            <div class="flex items-center justify-center py-12">
              <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
              <div class="text-sm text-hw-text-secondary ml-3">Loading rankings...</div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add to main menu
    const mainMenu = document.getElementById('hw-main-menu');
    if (!mainMenu) return;
    
    // Hide main content, show leaderboard
    const mainContent = mainMenu.querySelector('.flex.flex-col.items-center.justify-center.h-full');
    if (mainContent) {
      (mainContent as HTMLElement).style.display = 'none';
    }
    
    mainMenu.appendChild(leaderboardContainer);
    
    // Update tab activation
    this.activateTab('leaderboard');
    
    // Setup inline leaderboard functionality
    await this.setupInlineLeaderboard();
  }
  
  private async setupInlineLeaderboard(): Promise<void> {
    try {
      // Import and create leaderboard instance
      const { Leaderboard } = await import('./features/Leaderboard');
      const leaderboard = new Leaderboard();
      
      // Load data
      const data = await leaderboard.fetchData();
      
      // Store current tab states
      let currentMainTab: 'levels' | 'creators' | 'dailychallenge' = 'levels';
      let currentLevelSubTab: 'global' | 'weekly' | 'daily' = 'global';
      let currentCreatorSubTab: 'overall' | 'plays' | 'upvotes' | 'shares' = 'overall';
      
      // Function to render leaderboard content
      const renderLeaderboard = () => {
        const listContainer = document.getElementById('lb-list');
        if (!listContainer) return;
        
        let entries: any[] = [];
        
        if (currentMainTab === 'levels') {
          entries = currentLevelSubTab === 'global' ? data.global :
                   currentLevelSubTab === 'weekly' ? data.weekly :
                   data.daily;
        } else if (currentMainTab === 'creators') {
          entries = currentCreatorSubTab === 'overall' ? data.creators :
                   currentCreatorSubTab === 'plays' ? data.creatorsByPlays :
                   currentCreatorSubTab === 'upvotes' ? data.creatorsByUpvotes :
                   data.creatorsByShares || [];
        } else if (currentMainTab === 'dailychallenge') {
          entries = data.dailyChallenge || [];
        }
        
        if (!entries || entries.length === 0) {
          listContainer.innerHTML = `
            <div class="text-center py-12">
              <div class="text-4xl mb-3 opacity-30">🏆</div>
              <div class="text-sm text-hw-text-primary">No rankings yet</div>
              <div class="text-xs text-hw-text-secondary mt-1">Be the first to claim the top spot!</div>
            </div>
          `;
          return;
        }
        
        // Render entries based on type
        if (currentMainTab === 'dailychallenge') {
          // Daily challenge entries
          listContainer.innerHTML = entries.map((entry: any) => {
            const isTopThree = entry.rank <= 3;
            const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '';
            
            return `
              <div class="flex items-center gap-3 p-3 rounded-lg bg-hw-surface-secondary/50 hover:bg-hw-surface-secondary/70 transition-all ${isTopThree ? 'border border-purple-500/30' : ''}">
                <div class="w-10 text-center">
                  ${medal || `<span class="text-hw-text-secondary text-sm font-medium">#${entry.rank}</span>`}
                </div>
                <div class="flex-1 font-medium text-hw-text-primary">${entry.username}</div>
                <div class="text-lg font-bold ${isTopThree ? 'text-purple-400' : 'text-hw-text-primary'}">${entry.displayTime}</div>
              </div>
            `;
          }).join('');
        } else if (currentMainTab === 'creators') {
          // Creator entries
          listContainer.innerHTML = entries.map((entry: any) => {
            const isTopThree = entry.rank <= 3;
            const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '';
            
            return `
              <div class="flex items-center gap-3 p-3 rounded-lg bg-hw-surface-secondary/50 hover:bg-hw-surface-secondary/70 transition-all ${isTopThree ? 'border border-purple-500/30' : ''}">
                <div class="w-10 text-center">
                  ${medal || `<span class="text-hw-text-secondary text-sm font-medium">#${entry.rank}</span>`}
                </div>
                <div class="flex-1">
                  <div class="font-medium text-hw-text-primary">${entry.username}</div>
                  <div class="text-xs text-hw-text-secondary">📝 ${entry.levelCount} levels · 🎮 ${entry.totalPlays} plays</div>
                </div>
                <div class="text-right">
                  <div class="text-lg font-bold ${isTopThree ? 'text-purple-400' : 'text-hw-text-primary'}">${entry.score.toLocaleString()}</div>
                  <div class="text-xs text-hw-text-secondary">creator score</div>
                </div>
              </div>
            `;
          }).join('');
        } else {
          // Level entries
          listContainer.innerHTML = entries.map((entry: any) => {
            const isTopThree = entry.rank <= 3;
            const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '';
            
            return `
              <div class="flex items-center gap-3 p-3 rounded-lg bg-hw-surface-secondary/50 hover:bg-hw-surface-secondary/70 transition-all ${isTopThree ? 'border border-purple-500/30' : ''}">
                <div class="w-10 text-center">
                  ${medal || `<span class="text-hw-text-secondary text-sm font-medium">#${entry.rank}</span>`}
                </div>
                <div class="flex-1">
                  <div class="font-medium text-hw-text-primary">${entry.username}</div>
                  <div class="text-xs text-hw-text-secondary">Level ${entry.level} · 🪙 ${entry.coins}</div>
                </div>
                <div class="text-right">
                  <div class="text-lg font-bold ${isTopThree ? 'text-purple-400' : 'text-hw-text-primary'}">${entry.score.toLocaleString()}</div>
                  <div class="text-xs text-hw-text-secondary">points</div>
                </div>
              </div>
            `;
          }).join('');
        }
      };
      
      // Setup main tab handlers
      const mainTabs = document.querySelectorAll('.lb-main-tab');
      mainTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const tabName = (tab as HTMLElement).dataset.mainTab as 'levels' | 'creators' | 'dailychallenge';
          if (tabName && tabName !== currentMainTab) {
            currentMainTab = tabName;
            
            // Update tab styles
            mainTabs.forEach(t => {
              const indicator = t.querySelector('.lb-main-tab-indicator') as HTMLElement;
              if ((t as HTMLElement).dataset.mainTab === tabName) {
                t.classList.add('text-purple-400');
                t.classList.remove('text-hw-text-secondary');
                if (indicator) indicator.style.transform = 'scaleX(1)';
              } else {
                t.classList.remove('text-purple-400');
                t.classList.add('text-hw-text-secondary');
                if (indicator) indicator.style.transform = 'scaleX(0)';
              }
            });
            
            // Show/hide sub tabs
            const levelSubTabs = document.getElementById('lb-level-sub-tabs');
            const creatorSubTabs = document.getElementById('lb-creator-sub-tabs');
            
            if (tabName === 'creators') {
              levelSubTabs?.classList.add('hidden');
              creatorSubTabs?.classList.remove('hidden');
            } else if (tabName === 'dailychallenge') {
              levelSubTabs?.classList.add('hidden');
              creatorSubTabs?.classList.add('hidden');
            } else {
              levelSubTabs?.classList.remove('hidden');
              creatorSubTabs?.classList.add('hidden');
            }
            
            renderLeaderboard();
          }
        });
      });
      
      // Setup level sub tab handlers
      const levelSubTabs = document.querySelectorAll('.lb-level-sub-tab');
      levelSubTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const tabName = (tab as HTMLElement).dataset.levelSubTab as 'global' | 'weekly' | 'daily';
          if (tabName && tabName !== currentLevelSubTab) {
            currentLevelSubTab = tabName;
            
            // Update tab styles
            levelSubTabs.forEach(t => {
              const indicator = t.querySelector('.lb-level-sub-tab-indicator') as HTMLElement;
              if ((t as HTMLElement).dataset.levelSubTab === tabName) {
                t.classList.add('text-purple-400', 'bg-white/5');
                t.classList.remove('text-hw-text-secondary', 'hover:bg-white/5');
                if (indicator) indicator.style.transform = 'scaleX(1)';
              } else {
                t.classList.remove('text-purple-400', 'bg-white/5');
                t.classList.add('text-hw-text-secondary', 'hover:bg-white/5');
                if (indicator) indicator.style.transform = 'scaleX(0)';
              }
            });
            
            renderLeaderboard();
          }
        });
      });
      
      // Setup creator sub tab handlers
      const creatorSubTabs = document.querySelectorAll('.lb-creator-sub-tab');
      creatorSubTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const tabName = (tab as HTMLElement).dataset.creatorSubTab as 'overall' | 'plays' | 'upvotes' | 'shares';
          if (tabName && tabName !== currentCreatorSubTab) {
            currentCreatorSubTab = tabName;
            
            // Update tab styles
            creatorSubTabs.forEach(t => {
              const indicator = t.querySelector('.lb-creator-sub-tab-indicator') as HTMLElement;
              if ((t as HTMLElement).dataset.creatorSubTab === tabName) {
                t.classList.add('text-purple-400', 'bg-white/5');
                t.classList.remove('text-hw-text-secondary', 'hover:bg-white/5');
                if (indicator) indicator.style.transform = 'scaleX(1)';
              } else {
                t.classList.remove('text-purple-400', 'bg-white/5');
                t.classList.add('text-hw-text-secondary', 'hover:bg-white/5');
                if (indicator) indicator.style.transform = 'scaleX(0)';
              }
            });
            
            renderLeaderboard();
          }
        });
      });
      
      // Initial render
      renderLeaderboard();
      
    } catch (error) {
      console.error('Failed to setup inline leaderboard:', error);
      const listContainer = document.getElementById('lb-list');
      if (listContainer) {
        listContainer.innerHTML = `
          <div class="text-center py-12">
            <div class="text-red-500 text-lg mb-2">Failed to load leaderboard</div>
            <div class="text-hw-text-secondary text-sm">Please try again later</div>
          </div>
        `;
      }
    }
  }
  
  private activateTab(tabName: 'home' | 'leaderboard'): void {
    const mainMenu = document.getElementById('hw-main-menu');
    if (!mainMenu) return;
    
    // Reset all tabs
    const homeTab = mainMenu.querySelector('#hw-home-tab') as HTMLElement;
    const leaderboardTab = mainMenu.querySelector('#hw-leaderboard') as HTMLElement;
    
    // Remove existing active indicators
    homeTab?.querySelector('.absolute.inset-x-0.bottom-0')?.remove();
    leaderboardTab?.querySelector('.absolute.inset-x-0.bottom-0')?.remove();
    
    if (tabName === 'home') {
      // Show main content
      const mainContent = mainMenu.querySelector('.relative.h-full') as HTMLElement;
      if (mainContent) mainContent.style.display = '';
      
      // Remove any inline views
      const leaderboardView = document.getElementById('leaderboard-view');
      if (leaderboardView) leaderboardView.remove();

      const myLevelsView = document.getElementById('my-levels-view');
      if (myLevelsView) myLevelsView.remove();

      const exploreLevelsView = document.getElementById('explore-levels-view');
      if (exploreLevelsView) exploreLevelsView.remove();
      
      // Update tab styles
      if (homeTab) {
        homeTab.className = 'flex-1 flex flex-col items-center justify-center py-3 gap-1 bg-hw-accent-primary/10 border-t-2 border-hw-accent-primary relative';
        // Add active indicator
        const indicator = document.createElement('div');
        indicator.className = 'absolute inset-x-0 bottom-0 h-0.5 bg-hw-accent-primary';
        homeTab.appendChild(indicator);
        // Update text color
        const textSpan = homeTab.querySelector('span:last-child');
        if (textSpan) {
          textSpan.className = 'text-xs text-hw-accent-primary font-semibold';
        }
      }
      if (leaderboardTab) {
        leaderboardTab.className = 'flex-1 flex flex-col items-center justify-center py-3 gap-1 hover:bg-white/5 transition-colors';
        const textSpan = leaderboardTab.querySelector('span:last-child');
        if (textSpan) {
          textSpan.className = 'text-xs text-hw-text-secondary hover:text-hw-text-primary';
        }
      }
    } else if (tabName === 'leaderboard') {
      // Update tab styles
      if (leaderboardTab) {
        leaderboardTab.className = 'flex-1 flex flex-col items-center justify-center py-3 gap-1 bg-hw-accent-primary/10 border-t-2 border-hw-accent-primary relative';
        // Add active indicator
        const indicator = document.createElement('div');
        indicator.className = 'absolute inset-x-0 bottom-0 h-0.5 bg-hw-accent-primary';
        leaderboardTab.appendChild(indicator);
        // Update text color
        const textSpan = leaderboardTab.querySelector('span:last-child');
        if (textSpan) {
          textSpan.className = 'text-xs text-hw-accent-primary font-semibold';
        }
      }
      if (homeTab) {
        homeTab.className = 'flex-1 flex flex-col items-center justify-center py-3 gap-1 hover:bg-white/5 transition-colors';
        const textSpan = homeTab.querySelector('span:last-child');
        if (textSpan) {
          textSpan.className = 'text-xs text-hw-text-secondary hover:text-hw-text-primary';
        }
      }
    }
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

  // Show user level completion overlay with voting and sharing
  private async showUserLevelCompleteOverlay(): Promise<void> {
    const { UserLevelCompletion } = await import('../web-view/components/UserLevelCompletion');
    
    const config = (this.game as any).config;
    const scoreData = (this.game as any)?.scoreService?.getState() || { levelScore: 0, currentScore: 0 };
    const coinService = (this.game as any)?.coinService;
    const coinStorageService = (this.game as any)?.coinStorageService;
    
    // Calculate coins earned
    const hintsUsed = scoreData.hintsUsed || 0;
    const words = (this.game?.getPlacedWords() || []).map(w => w.word);
    const coinReward = coinService ? 
      coinService.calculateLevelReward(1, words.length, Date.now() - (scoreData.timeStarted || Date.now()), hintsUsed) : 
      0;
    
    // Add coins to server
    if (coinReward > 0 && coinStorageService) {
      await coinStorageService.addCoins(coinReward);
      if (this.game && (this.game as any).updateCoinDisplay) {
        (this.game as any).updateCoinDisplay();
      }
    }
    
    // Get current coin balance for leaderboard
    const totalCoins = coinStorageService?.getCachedBalance() || 0;
    
    // Update leaderboard for user level completion - use currentScore (total accumulated score)
    this.updateLeaderboard(scoreData.currentScore || scoreData.levelScore || 0, 1, totalCoins);
    
    const completion = new UserLevelCompletion({
      levelName: config.levelName,
      levelId: config.levelId,
      author: config.levelAuthor,
      clue: config.clue,
      score: scoreData.levelScore,
      coins: coinReward,
      onUpvote: async () => {
        try {
          const response = await fetch(`/api/user-levels/${config.levelId}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'up' })
          });
          if (response.ok) {
            const data = await response.json();
            // Upvoted level successfully
          }
        } catch (error) {
          console.error('Failed to upvote:', error);
        }
      },
      onDownvote: async () => {
        try {
          const response = await fetch(`/api/user-levels/${config.levelId}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'down' })
          });
          if (response.ok) {
            const data = await response.json();
            // Downvoted level successfully
          }
        } catch (error) {
          console.error('Failed to downvote:', error);
        }
      },
      onShare: async () => {
        try {
          // Track the share
          const response = await fetch(`/api/user-levels/${config.levelId}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          if (response.ok) {
            const data = await response.json();
            // Shared level successfully
          }
          
          // Open share dialog (this would be platform-specific)
          // For now, just show a success message
          this.showToast('Level shared to community!', 'info');
        } catch (error) {
          console.error('Failed to share:', error);
        }
      },
      onNextLevel: async () => {
        // Load another random user level or go back to menu
        this.showMainMenu();
      },
      onMainMenu: () => {
        this.showMainMenu();
      }
    });
    
    completion.show();
  }

  // Show settings panel similar to in-game settings
  private showSettingsPanel(): void {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center';
    
    // Create panel
    const panel = document.createElement('div');
    panel.className = 'bg-hw-surface-primary border border-hw-surface-tertiary/30 rounded-xl p-4 max-w-sm w-[90%]';
    panel.style.transform = 'scale(0.85)';
    
    panel.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold text-hw-text-primary">Settings</h2>
        <button id="settings-close" class="text-hw-text-secondary hover:text-hw-text-primary transition-colors">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 5L5 15M5 5l10 10"/>
          </svg>
        </button>
      </div>
      
      <div class="space-y-3">
        <!-- Reduce Motion Toggle -->
        <div class="flex items-center justify-between p-3 rounded-lg bg-hw-surface-secondary/50">
          <div class="flex items-center gap-2">
            <span class="text-base">🎬</span>
            <span class="text-sm text-hw-text-primary">Reduce Motion</span>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="settings-motion-toggle" class="sr-only peer">
            <div class="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hw-accent-primary"></div>
          </label>
        </div>
        
        <!-- How to Play Button -->
        <button id="settings-howto" class="w-full p-3 rounded-lg bg-hw-surface-secondary/50 text-sm text-hw-text-primary hover:bg-hw-surface-secondary/70 transition-colors flex items-center gap-2">
          <span class="text-base">📖</span>
          <span>How to Play</span>
        </button>
        
        <!-- Restart Level Button -->
        <button id="settings-restart" class="w-full p-3 rounded-lg bg-hw-surface-secondary/50 text-sm text-hw-text-primary hover:bg-hw-surface-secondary/70 transition-colors flex items-center gap-2">
          <span class="text-base">🔄</span>
          <span>Restart Current Level</span>
        </button>
        
        <!-- Main Menu Button -->
        <button id="settings-mainmenu" class="w-full p-3 rounded-lg bg-hw-surface-secondary/50 text-sm text-hw-text-primary hover:bg-hw-surface-secondary/70 transition-colors flex items-center gap-2">
          <span class="text-base">🏠</span>
          <span>Back to Main Menu</span>
        </button>
      </div>
    `;
    
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    
    // Initialize motion toggle state
    const motionToggle = panel.querySelector('#settings-motion-toggle') as HTMLInputElement;
    const currentMotionPref = localStorage.getItem('hexaword_reduce_motion') === 'true';
    motionToggle.checked = currentMotionPref;
    
    // Wire up event handlers
    motionToggle.onchange = () => {
      const isEnabled = motionToggle.checked;
      localStorage.setItem('hexaword_reduce_motion', String(isEnabled));
      const svc = (window as any).hwAnimSvc as any;
      if (svc?.setReducedMotion) svc.setReducedMotion(isEnabled);
    };
    
    // Close button
    panel.querySelector('#settings-close')?.addEventListener('click', () => {
      overlay.remove();
    });
    
    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
    
    // How to Play button
    panel.querySelector('#settings-howto')?.addEventListener('click', async () => {
      overlay.remove();
      await blurTransition.focusOn('hw-howto-modal', {
        blurLevel: 'md',
        duration: 300
      });
      this.showHowTo();
    });
    
    // Restart button (only visible if game is active)
    const restartBtn = panel.querySelector('#settings-restart') as HTMLButtonElement;
    if (restartBtn) {
      if (!this.game) {
        restartBtn.style.display = 'none';
      } else {
        restartBtn.addEventListener('click', () => {
          overlay.remove();
          if (this.game) {
            // Restart current level
            this.loadLevelFromServer(this.currentLevel);
          }
        });
      }
    }
    
    // Main Menu button
    panel.querySelector('#settings-mainmenu')?.addEventListener('click', () => {
      overlay.remove();
      // Already in main menu, do nothing
    });
  }

  // Show level completion overlay with blur, details, and actions
  private async showLevelCompleteOverlay(level: number): Promise<void> {
    // Check if this is a user level and show custom completion
    if (this.game && (this.game as any).config?.isUserLevel) {
      await this.showUserLevelCompleteOverlay();
      return;
    }
    
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
    const coinStorageService = (this.game as any)?.coinStorageService;
    // Calculate total coins earned this level
    const hintsUsed = scoreData.hintsUsed || 0;
    const coinReward = coinService ? 
      coinService.calculateLevelReward(level, words.length, Date.now() - (scoreData.timeStarted || Date.now()), hintsUsed) : 
      0;
    
    // Get current coin balance BEFORE reward
    const coinsBeforeReward = coinStorageService?.getCachedBalance() || 0;
    // Calculate total coins AFTER adding the level reward
    const totalCoinsAfterReward = coinsBeforeReward + coinReward;
    
    // IMPORTANT: Actually add the coin reward to the server!
    if (coinReward > 0 && coinStorageService) {
      coinStorageService.addCoins(coinReward).then(() => {
        // Added coin reward for completing level
        // Update the display
        if ((window as any).gameUI) {
          (window as any).gameUI.updateCoins(totalCoinsAfterReward);
        }
      }).catch(err => {
        console.error('Failed to add coin reward:', err);
      });
    }
    
    // Update leaderboard with score
    this.updateLeaderboard(scoreData.currentScore || scoreData.levelScore, level, totalCoinsAfterReward);
    
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
          <div class="text-xs text-hw-text-secondary uppercase">Coins</div>
          <div class="text-xl font-bold text-hw-accent-yellow">
            <span class="text-lg">🪙</span> ${totalCoinsAfterReward.toLocaleString()}
          </div>
          ${coinReward > 0 ? `<div class="text-xs text-hw-accent-success mt-1">+${coinReward} earned</div>` : ''}
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
      // Add the coin reward to server when proceeding
      if (coinReward > 0 && coinStorageService) {
        await coinStorageService.addCoins(coinReward);
        // Update the coin display if game is available
        if (this.game && (this.game as any).updateCoinDisplay) {
          (this.game as any).updateCoinDisplay();
        }
      }
      
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
      // Add the coin reward to server when going to menu
      if (coinReward > 0 && coinStorageService) {
        await coinStorageService.addCoins(coinReward);
        // Update the coin display if game is available
        if (this.game && (this.game as any).updateCoinDisplay) {
          (this.game as any).updateCoinDisplay();
        }
      }
      
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
      // Failed to track activity
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
    this.mainMenuEl.querySelectorAll('button').forEach((btn) => {
      btn.disabled = false;
      btn.style.pointerEvents = '';
      btn.classList.remove('opacity-50', 'cursor-not-allowed');
    });
    
    // Clear the busy flag
    this.menuBusy = false;
    
    // Apply theme for current level so menu colors are correct
    this.applyMenuTheme(this.currentLevel).catch(() => void 0);
    this.mainMenuEl.classList.remove('hidden');
    
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
    
    // Update coin display
    this.updateMenuCoinDisplay();
    
    // Ensure no residual blur remains on menu or game container
    blurTransition.applyLayeredBlur([
      { elementId: 'hw-main-menu', level: 'none', delay: 0 },
      { elementId: 'hex-grid-container', level: 'none', delay: 0 }
    ]);
  }

  private async hideMainMenu(): Promise<void> {
    if (!this.mainMenuEl) return;
    this.mainMenuEl.classList.add('hidden');
    
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

  // Load and play a specific user-created level by id
  private async playUserLevel(id: string): Promise<void> {
    loadingOverlay.show('Loading level...');
    
    try {
      const res = await fetch(`/api/user-levels/${encodeURIComponent(id)}/init`);
      if (!res.ok) {
        loadingOverlay.hide();
        throw new Error('Failed to init user level');
      }
      const d = await res.json();
      const words: string[] = d.words?.slice?.(0, Math.min(6, d.words.length)) ?? [];
      
      // Extract user level metadata
      const levelName = d.name || d.clue;
      const levelAuthor = d.author || 'anonymous';
      
      // Update UI to show level name instead of number
      if (this.gameUI) {
        this.gameUI.updateLevel(levelName);
      }
      
      if (!this.game) {
        await new Promise<void>((resolve, reject) => {
          this.game = new HexaWordGame({
            containerId: 'hex-grid-container',
            words,
            clue: d.clue || 'CUSTOM',
            seed: d.seed,
            gridRadius: 10,
            level: 1,
            theme: 'dark',
            // Add user level specific properties
            isUserLevel: true,
            levelName,
            levelId: id,
            levelAuthor,
            onReady: () => { try { this.setupUI(); this.initializeGameUI(); } finally { resolve(); } },
            onError: (err) => { console.error(err); reject(err); },
            onLevelComplete: async (lvl) => {
              this.showLevelCompleteOverlay(lvl);
            }
          });
        });
        loadingOverlay.hide();
        return;
      }
      // Update the game config with user level metadata
      (this.game as any).config.isUserLevel = true;
      (this.game as any).config.levelName = levelName;
      (this.game as any).config.levelId = id;
      (this.game as any).config.levelAuthor = levelAuthor;
      
      await this.game.loadLevel({ words, seed: d.seed, clue: d.clue, level: 1 });
      loadingOverlay.hide();
    } catch (e) {
      loadingOverlay.hide();
      this.showToast('Failed to load user level', 'error');
    }
  }
  
  /**
   * Update streak badge on daily challenge button
   */
  private async updateStreakBadge(): Promise<void> {
    try {
      const response = await fetch('/api/daily-challenge');
      if (response.ok) {
        const data = await response.json();
        if (data.userStreak && data.userStreak.currentStreak > 0) {
          const badge = document.querySelector('#dc-streak-badge') as HTMLElement;
          if (badge) {
            badge.textContent = `${data.userStreak.currentStreak}🔥`;
            badge.classList.remove('hidden');
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch streak:', error);
    }
  }
  
  /**
   * Start daily challenge game
   */
  private async startDailyChallenge(challengeData: any): Promise<void> {
    // Show loading indicator
    loadingOverlay.show('Loading daily challenge...');
    
    const startTime = Date.now();
    let hintsUsed = 0;
    
    // Track hint usage
    const originalGame = this.game;
    
    await this.fadeTransition(async () => {
      if (!this.game) {
        await new Promise<void>((resolve, reject) => {
          this.game = new HexaWordGame({
            containerId: 'hex-grid-container',
            words: challengeData.words,
            clue: challengeData.clue,
            seed: challengeData.seed,
            gridRadius: 10,
            level: 1,
            theme: 'dark',
            isDailyChallenge: true,
            onReady: () => {
              try {
                this.setupUI();
                this.initializeGameUI();
                // Hide loading overlay once game is ready
                loadingOverlay.hide();
              } finally {
                resolve();
              }
            },
            onError: (err) => {
              console.error(err);
              loadingOverlay.hide();
              reject(err);
            },
            onLevelComplete: async () => {
              const completionTime = Math.round((Date.now() - startTime) / 1000);
              await this.completeDailyChallenge(completionTime, hintsUsed);
            },
            onHintUsed: () => {
              hintsUsed++;
            }
          });
        });
      } else {
        await this.game.loadLevel({
          words: challengeData.words,
          seed: challengeData.seed,
          clue: challengeData.clue,
          level: 1
        });
        
        // Set up completion handler
        (this.game as any).config.isDailyChallenge = true;
        (this.game as any).config.onLevelComplete = async () => {
          const completionTime = Math.round((Date.now() - startTime) / 1000);
          await this.completeDailyChallenge(completionTime, hintsUsed);
        };
      }
      
      this.hideMainMenu();
    });
  }
  
  /**
   * Complete daily challenge and submit results
   */
  private async completeDailyChallenge(completionTime: number, hintsUsed: number): Promise<void> {
    loadingOverlay.show('Submitting results...');
    
    try {
      const response = await fetch('/api/daily-challenge/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completionTime, hintsUsed })
      });
      
      if (response.ok) {
        const data = await response.json();
        loadingOverlay.hide();
        
        // Show completion screen
        await this.showDailyChallengeComplete(data);
      } else {
        loadingOverlay.hide();
        const error = await response.json();
        if (error.error === 'Already completed today\'s challenge') {
          this.showToast('Already completed today\'s challenge', 'warning');
        } else {
          this.showToast('Failed to submit results', 'error');
        }
      }
    } catch (error) {
      loadingOverlay.hide();
      console.error('Failed to complete daily challenge:', error);
      this.showToast('Failed to submit results', 'error');
    }
  }
  
  /**
   * Show daily challenge completion screen
   */
  private async showDailyChallengeComplete(data: any): Promise<void> {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center';
    
    const panel = document.createElement('div');
    panel.className = 'bg-gradient-to-br from-hw-surface-primary to-hw-surface-secondary rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6';
    panel.style.transform = 'scale(0.85)';
    
    const { completion, streak, coins, streakBonus, stats } = data;
    
    panel.innerHTML = `
      <div class="text-center mb-4">
        <div class="text-3xl mb-2">🎆</div>
        <h2 class="text-2xl font-bold text-hw-text-primary">Daily Challenge Complete!</h2>
      </div>
      
      <div class="space-y-3">
        <!-- Time and Hints -->
        <div class="bg-hw-surface-tertiary/30 rounded-lg p-3">
          <div class="flex justify-between items-center">
            <span class="text-sm text-hw-text-secondary">Time</span>
            <span class="text-lg font-bold text-hw-text-primary">${this.formatTime(completion.completionTime)}</span>
          </div>
          <div class="flex justify-between items-center mt-2">
            <span class="text-sm text-hw-text-secondary">Hints Used</span>
            <span class="text-lg font-bold text-hw-text-primary">${completion.hintsUsed}</span>
          </div>
        </div>
        
        <!-- Streak Info -->
        ${streak ? `
          <div class="bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-lg p-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-2xl">🔥</span>
                <div>
                  <div class="text-sm font-semibold text-orange-400">${streak.currentStreak} Day Streak!</div>
                  ${streakBonus > 0 ? `<div class="text-xs text-hw-text-secondary">Bonus: +${streakBonus} coins</div>` : ''}
                </div>
              </div>
            </div>
          </div>
        ` : ''}
        
        <!-- Rewards -->
        <div class="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 rounded-lg p-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-hw-text-secondary">Total Coins Earned</span>
            <span class="text-xl font-bold text-yellow-400">🪙 ${coins}</span>
          </div>
        </div>
        
        <!-- Global Stats -->
        <div class="text-center text-xs text-hw-text-secondary mt-3">
          ${stats.fastestTime && completion.completionTime === stats.fastestTime ? 
            '<div class="text-purple-400 font-bold mb-1">🏆 NEW RECORD! You have the fastest time!</div>' : 
            `<div>Fastest: ${this.formatTime(stats.fastestTime)} by ${stats.fastestPlayer}</div>`
          }
          <div>${stats.totalPlayers} players completed today</div>
        </div>
      </div>
      
      <div class="flex gap-2 mt-6">
        <button id="dc-share" class="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold py-2.5 rounded-lg transition-all">
          Share Results
        </button>
        <button id="dc-done" class="flex-1 bg-hw-surface-tertiary/50 hover:bg-hw-surface-tertiary/70 text-hw-text-primary font-semibold py-2.5 rounded-lg transition-colors">
          Done
        </button>
      </div>
    `;
    
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    
    // Button handlers
    const shareBtn = panel.querySelector('#dc-share');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        this.shareDailyChallengeResults(completion, streak);
      });
    }
    
    const doneBtn = panel.querySelector('#dc-done');
    if (doneBtn) {
      doneBtn.addEventListener('click', () => {
        overlay.remove();
        this.showMainMenu();
      });
    }
  }
  
  /**
   * Share daily challenge results
   */
  private shareDailyChallengeResults(completion: any, streak: any): void {
    const time = this.formatTime(completion.completionTime);
    const hints = completion.hintsUsed;
    const streakText = streak ? `🔥 ${streak.currentStreak} day streak` : '';
    
    const text = `Hexaword Daily Challenge #${new Date().toISOString().split('T')[0]}\n⏱️ ${time} | 💡 ${hints} hints\n${streakText}\n\nPlay at hexaword.reddit.com`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(text).then(() => {
      this.showToast('Results copied to clipboard!', 'info');
    }).catch(() => {
      this.showToast('Failed to copy results', 'error');
    });
  }
  
  /**
   * Format time helper
   */
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  /**
   * Update leaderboard with current score
   */
  private async updateLeaderboard(score: number, level: number, coins: number): Promise<void> {
    try {
      // Get current streak from storage
      const progress = loadLocalProgress();
      const streak = progress?.streak || 0;
      
      const response = await fetch('/api/leaderboard/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, level, coins, streak })
      });
      
      if (!response.ok) {
        console.error('Failed to update leaderboard');
      }
    } catch (error) {
      console.error('Error updating leaderboard:', error);
    }
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

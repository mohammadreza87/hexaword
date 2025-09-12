import { loadingOverlay } from '../utils/LoadingOverlay';

interface LeaderboardEntry {
  rank: number;
  username: string;
  score: number;
  level: number;
  coins: number;
  streak?: number;
  avatar?: string;
}

interface CreatorEntry {
  rank: number;
  username: string;
  totalPlays: number;
  totalUpvotes: number;
  totalDownvotes: number;
  totalShares: number;
  levelCount: number;
  score: number; // Combined score for ranking
}

interface LeaderboardData {
  global: LeaderboardEntry[];
  weekly: LeaderboardEntry[];
  daily: LeaderboardEntry[];
  creators: CreatorEntry[];
  userRank?: {
    global: number;
    weekly: number;
    daily: number;
    creator?: number;
  };
}

export class Leaderboard {
  private overlay!: HTMLDivElement;
  private panel!: HTMLDivElement;
  private currentMainTab: 'levels' | 'creators' = 'levels';
  private currentSubTab: 'global' | 'weekly' | 'daily' = 'global';
  private data: LeaderboardData | null = null;

  async show(): Promise<void> {
    this.buildUI();
    document.body.appendChild(this.overlay);
    
    // Load leaderboard data
    await this.loadLeaderboardData();
    
    return new Promise((resolve) => {
      const closeBtn = this.panel.querySelector('#lb-close') as HTMLButtonElement;
      if (closeBtn) {
        closeBtn.onclick = () => {
          this.overlay.remove();
          resolve();
        };
      }
    });
  }

  private buildUI(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center';
    
    this.panel = document.createElement('div');
    this.panel.className = 'bg-gradient-to-br from-hw-surface-primary to-hw-surface-secondary rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden';
    this.panel.style.transform = 'scale(0.85)';
    
    this.panel.innerHTML = `
      <div class="bg-gradient-to-r from-purple-600 to-purple-800 px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-bold text-white">🏆 Leaderboard</h2>
            <p class="text-purple-200 text-sm mt-1">Compete with players worldwide</p>
          </div>
          <button id="lb-close" class="text-white/80 hover:text-white transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Main Tabs -->
      <div class="flex border-b-2 border-hw-surface-tertiary/50 bg-gradient-to-b from-hw-surface-primary to-hw-surface-secondary">
        <button data-main-tab="levels" class="lb-main-tab flex-1 px-4 py-3 text-sm font-semibold transition-all relative">
          <span class="relative z-10">🎮 Levels</span>
          <div class="lb-main-tab-indicator absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 transform transition-transform"></div>
        </button>
        <button data-main-tab="creators" class="lb-main-tab flex-1 px-4 py-3 text-sm font-semibold transition-all relative">
          <span class="relative z-10">🎨 Level Creators</span>
          <div class="lb-main-tab-indicator absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 transform scale-x-0 transition-transform"></div>
        </button>
      </div>
      
      <!-- Sub Tabs (for Levels) -->
      <div id="lb-sub-tabs" class="flex border-b border-hw-surface-tertiary/30 bg-hw-surface-primary/50">
        <button data-sub-tab="global" class="lb-sub-tab flex-1 px-4 py-2.5 text-xs font-medium transition-all relative">
          <span class="relative z-10">🌍 Global</span>
          <div class="lb-sub-tab-indicator absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400 transform scale-x-0 transition-transform"></div>
        </button>
        <button data-sub-tab="weekly" class="lb-sub-tab flex-1 px-4 py-2.5 text-xs font-medium transition-all relative">
          <span class="relative z-10">📅 Weekly</span>
          <div class="lb-sub-tab-indicator absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400 transform scale-x-0 transition-transform"></div>
        </button>
        <button data-sub-tab="daily" class="lb-sub-tab flex-1 px-4 py-2.5 text-xs font-medium transition-all relative">
          <span class="relative z-10">☀️ Daily</span>
          <div class="lb-sub-tab-indicator absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400 transform scale-x-0 transition-transform"></div>
        </button>
      </div>
      
      <!-- User Stats Card -->
      <div id="lb-user-stats" class="hidden mx-4 mt-4 p-3 bg-gradient-to-r from-purple-600/20 to-purple-800/20 rounded-lg border border-purple-500/30">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold">
              <span id="lb-user-avatar">?</span>
            </div>
            <div>
              <div class="text-sm font-semibold text-hw-text-primary" id="lb-user-name">You</div>
              <div class="text-xs text-hw-text-secondary">Your Rank: <span class="text-purple-400 font-bold" id="lb-user-rank">#--</span></div>
            </div>
          </div>
          <div class="text-right">
            <div class="text-lg font-bold text-purple-400" id="lb-user-score">0</div>
            <div class="text-xs text-hw-text-secondary">points</div>
          </div>
        </div>
      </div>
      
      <!-- Leaderboard List -->
      <div class="overflow-y-auto" style="max-height: calc(80vh - 240px);">
        <div id="lb-list" class="p-4 space-y-2">
          <!-- Entries will be rendered here -->
        </div>
        
        <div id="lb-loading" class="flex flex-col items-center justify-center py-12">
          <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
          <div class="text-sm text-hw-text-secondary mt-3">Loading rankings...</div>
        </div>
        
        <div id="lb-empty" class="hidden text-center py-12">
          <div class="text-4xl mb-3 opacity-30">🏆</div>
          <div class="text-sm text-hw-text-primary">No rankings yet</div>
          <div class="text-xs text-hw-text-secondary mt-1">Be the first to claim the top spot!</div>
        </div>
      </div>
    `;
    
    this.overlay.appendChild(this.panel);
    this.setupTabs();
  }

  private setupTabs(): void {
    // Main tabs (Levels vs Creators)
    const mainTabs = this.panel.querySelectorAll('.lb-main-tab');
    mainTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = (tab as HTMLElement).dataset.mainTab as 'levels' | 'creators';
        if (tabName && tabName !== this.currentMainTab) {
          this.currentMainTab = tabName;
          this.updateTabStyles();
          this.renderLeaderboard();
        }
      });
    });
    
    // Sub tabs (Global/Weekly/Daily)
    const subTabs = this.panel.querySelectorAll('.lb-sub-tab');
    subTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = (tab as HTMLElement).dataset.subTab as 'global' | 'weekly' | 'daily';
        if (tabName && tabName !== this.currentSubTab) {
          this.currentSubTab = tabName;
          this.updateTabStyles();
          this.renderLeaderboard();
        }
      });
    });
    
    // Set initial active tabs
    this.updateTabStyles();
  }

  private updateTabStyles(): void {
    // Update main tabs
    const mainTabs = this.panel.querySelectorAll('.lb-main-tab');
    mainTabs.forEach(tab => {
      const tabName = (tab as HTMLElement).dataset.mainTab;
      const indicator = tab.querySelector('.lb-main-tab-indicator') as HTMLElement;
      
      if (tabName === this.currentMainTab) {
        tab.classList.add('text-purple-400');
        tab.classList.remove('text-hw-text-secondary');
        if (indicator) {
          indicator.style.transform = 'scaleX(1)';
        }
      } else {
        tab.classList.remove('text-purple-400');
        tab.classList.add('text-hw-text-secondary');
        if (indicator) {
          indicator.style.transform = 'scaleX(0)';
        }
      }
    });
    
    // Show/hide sub tabs based on main tab
    const subTabsContainer = this.panel.querySelector('#lb-sub-tabs') as HTMLElement;
    if (this.currentMainTab === 'creators') {
      subTabsContainer.classList.add('hidden');
    } else {
      subTabsContainer.classList.remove('hidden');
      
      // Update sub tabs
      const subTabs = this.panel.querySelectorAll('.lb-sub-tab');
      subTabs.forEach(tab => {
        const tabName = (tab as HTMLElement).dataset.subTab;
        const indicator = tab.querySelector('.lb-sub-tab-indicator') as HTMLElement;
        
        if (tabName === this.currentSubTab) {
          tab.classList.add('text-purple-400');
          tab.classList.remove('text-hw-text-secondary');
          if (indicator) {
            indicator.style.transform = 'scaleX(1)';
          }
        } else {
          tab.classList.remove('text-purple-400');
          tab.classList.add('text-hw-text-secondary');
          if (indicator) {
            indicator.style.transform = 'scaleX(0)';
          }
        }
      });
    }
  }

  private async loadLeaderboardData(): Promise<void> {
    try {
      const response = await fetch('/api/leaderboard');
      
      if (response.ok) {
        this.data = await response.json();
        
        // If creators list is empty, try to migrate existing levels
        if (!this.data.creators || this.data.creators.length === 0) {
          console.log('No creators found, attempting migration...');
          await this.migrateCreatorStats();
          // Reload data after migration
          const retryResponse = await fetch('/api/leaderboard');
          if (retryResponse.ok) {
            this.data = await retryResponse.json();
          }
        }
        
        this.renderLeaderboard();
      } else {
        console.error('Failed to load leaderboard');
        this.showEmpty();
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      this.showEmpty();
    }
  }
  
  private async migrateCreatorStats(): Promise<void> {
    try {
      const response = await fetch('/api/migrate-my-levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Migration complete:', result);
      } else {
        console.error('Migration failed:', response.status);
      }
    } catch (error) {
      console.error('Failed to migrate creator stats:', error);
    }
  }

  private renderLeaderboard(): void {
    const listContainer = this.panel.querySelector('#lb-list') as HTMLDivElement;
    const loadingEl = this.panel.querySelector('#lb-loading') as HTMLDivElement;
    const emptyEl = this.panel.querySelector('#lb-empty') as HTMLDivElement;
    const userStatsEl = this.panel.querySelector('#lb-user-stats') as HTMLDivElement;
    
    if (!this.data) {
      this.showEmpty();
      return;
    }
    
    // Hide loading
    loadingEl.classList.add('hidden');
    
    if (this.currentMainTab === 'creators') {
      this.renderCreatorLeaderboard();
    } else {
      this.renderLevelLeaderboard();
    }
  }
  
  private renderLevelLeaderboard(): void {
    const listContainer = this.panel.querySelector('#lb-list') as HTMLDivElement;
    const emptyEl = this.panel.querySelector('#lb-empty') as HTMLDivElement;
    const userStatsEl = this.panel.querySelector('#lb-user-stats') as HTMLDivElement;
    
    const entries = this.data![this.currentSubTab];
    
    if (!entries || entries.length === 0) {
      listContainer.innerHTML = '';
      emptyEl.classList.remove('hidden');
      userStatsEl.classList.add('hidden');
      return;
    }
    
    emptyEl.classList.add('hidden');
    
    // Update user stats if available
    if (this.data!.userRank) {
      userStatsEl.classList.remove('hidden');
      const userRankEl = userStatsEl.querySelector('#lb-user-rank');
      if (userRankEl) {
        userRankEl.textContent = `#${this.data!.userRank[this.currentSubTab] || '--'}`;
      }
    }
    
    // Render entries
    listContainer.innerHTML = entries.map((entry) => {
      const isTopThree = entry.rank <= 3;
      const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '';
      
      return `
        <div class="flex items-center gap-3 p-3 rounded-lg bg-hw-surface-secondary/50 hover:bg-hw-surface-secondary/70 transition-all ${isTopThree ? 'border border-purple-500/30' : ''}">
          <div class="w-10 text-center">
            ${medal || `<span class="text-hw-text-secondary text-sm font-medium">#${entry.rank}</span>`}
          </div>
          
          <div class="flex-1 flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white text-xs font-bold">
              ${entry.username.charAt(0).toUpperCase()}
            </div>
            <div class="flex-1">
              <div class="text-sm font-medium text-hw-text-primary">${this.escapeHtml(entry.username)}</div>
              <div class="text-xs text-hw-text-secondary">
                Level ${entry.level} · 🪙 ${entry.coins}
                ${entry.streak ? ` · 🔥 ${entry.streak}` : ''}
              </div>
            </div>
          </div>
          
          <div class="text-right">
            <div class="text-lg font-bold ${isTopThree ? 'text-purple-400' : 'text-hw-text-primary'}">${entry.score.toLocaleString()}</div>
            <div class="text-xs text-hw-text-secondary">points</div>
          </div>
        </div>
      `;
    }).join('');
  }
  
  private renderCreatorLeaderboard(): void {
    const listContainer = this.panel.querySelector('#lb-list') as HTMLDivElement;
    const emptyEl = this.panel.querySelector('#lb-empty') as HTMLDivElement;
    const userStatsEl = this.panel.querySelector('#lb-user-stats') as HTMLDivElement;
    
    const entries = this.data!.creators;
    
    if (!entries || entries.length === 0) {
      listContainer.innerHTML = '';
      emptyEl.classList.remove('hidden');
      userStatsEl.classList.add('hidden');
      return;
    }
    
    emptyEl.classList.add('hidden');
    
    // Update user stats if available for creators
    if (this.data!.userRank?.creator) {
      userStatsEl.classList.remove('hidden');
      const userRankEl = userStatsEl.querySelector('#lb-user-rank');
      if (userRankEl) {
        userRankEl.textContent = `#${this.data!.userRank.creator}`;
      }
    } else {
      userStatsEl.classList.add('hidden');
    }
    
    // Render creator entries
    listContainer.innerHTML = entries.map((entry) => {
      const isTopThree = entry.rank <= 3;
      const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '';
      const netVotes = entry.totalUpvotes - entry.totalDownvotes;
      
      return `
        <div class="flex items-center gap-3 p-3 rounded-lg bg-hw-surface-secondary/50 hover:bg-hw-surface-secondary/70 transition-all ${isTopThree ? 'border border-purple-500/30' : ''}">
          <div class="w-10 text-center">
            ${medal || `<span class="text-hw-text-secondary text-sm font-medium">#${entry.rank}</span>`}
          </div>
          
          <div class="flex-1 flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white text-xs font-bold">
              ${entry.username.charAt(0).toUpperCase()}
            </div>
            <div class="flex-1">
              <div class="text-sm font-medium text-hw-text-primary">${this.escapeHtml(entry.username)}</div>
              <div class="text-xs text-hw-text-secondary">
                📝 ${entry.levelCount} levels · 🎮 ${entry.totalPlays} plays
              </div>
              <div class="text-xs text-hw-text-secondary mt-0.5">
                👍 ${entry.totalUpvotes} · 👎 ${entry.totalDownvotes} · 📤 ${entry.totalShares}
              </div>
            </div>
          </div>
          
          <div class="text-right">
            <div class="text-lg font-bold ${isTopThree ? 'text-purple-400' : 'text-hw-text-primary'}">${entry.score.toLocaleString()}</div>
            <div class="text-xs text-hw-text-secondary">creator score</div>
          </div>
        </div>
      `;
    }).join('');
  }

  private showEmpty(): void {
    const listContainer = this.panel.querySelector('#lb-list') as HTMLDivElement;
    const loadingEl = this.panel.querySelector('#lb-loading') as HTMLDivElement;
    const emptyEl = this.panel.querySelector('#lb-empty') as HTMLDivElement;
    
    listContainer.innerHTML = '';
    loadingEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
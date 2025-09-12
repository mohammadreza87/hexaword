import { loadingOverlay } from '../utils/LoadingOverlay';

interface DailyChallengeData {
  challenge: {
    id: number;
    date: string;
    words: string[];
    seed: string;
    theme?: string;
    clue: string;
    difficulty: 'easy' | 'medium' | 'hard';
    dayType: string;
  };
  userCompletion: any;
  userStreak: {
    currentStreak: number;
    longestStreak: number;
    totalDaysPlayed: number;
  } | null;
  stats: {
    totalPlayers: number;
    averageTime: number;
    averageHints: number;
    fastestTime: number | null;
    fastestPlayer: string | null;
  };
}

export class DailyChallenge {
  private overlay!: HTMLDivElement;
  private panel!: HTMLDivElement;
  private data: DailyChallengeData | null = null;

  async show(): Promise<{ action: 'play' | 'close'; challengeData?: any } | null> {
    loadingOverlay.show('Loading daily challenge...');
    
    try {
      // Fetch daily challenge data
      const response = await fetch('/api/daily-challenge');
      if (!response.ok) {
        throw new Error('Failed to load daily challenge');
      }
      
      this.data = await response.json();
      loadingOverlay.hide();
      
      this.buildUI();
      document.body.appendChild(this.overlay);
      
      return new Promise((resolve) => {
        const closeBtn = this.panel.querySelector('#dc-close') as HTMLButtonElement;
        if (closeBtn) {
          closeBtn.onclick = () => {
            this.overlay.remove();
            resolve(null);
          };
        }
        
        const playBtn = this.panel.querySelector('#dc-play') as HTMLButtonElement;
        if (playBtn) {
          playBtn.onclick = () => {
            this.overlay.remove();
            resolve({ 
              action: 'play', 
              challengeData: this.data?.challenge 
            });
          };
        }
        
        const leaderboardBtn = this.panel.querySelector('#dc-leaderboard') as HTMLButtonElement;
        if (leaderboardBtn) {
          leaderboardBtn.onclick = async () => {
            await this.showLeaderboard();
          };
        }
      });
      
    } catch (error) {
      loadingOverlay.hide();
      console.error('Failed to load daily challenge:', error);
      this.showError();
      return null;
    }
  }

  private buildUI(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center';
    
    this.panel = document.createElement('div');
    this.panel.className = 'bg-gradient-to-br from-hw-surface-primary to-hw-surface-secondary rounded-2xl shadow-2xl max-w-sm w-full mx-4';
    this.panel.style.transform = 'scale(0.68)';
    
    if (!this.data) {
      this.panel.innerHTML = `<div class="p-6 text-center text-white">Loading...</div>`;
      this.overlay.appendChild(this.panel);
      return;
    }
    
    const { challenge, userCompletion, userStreak, stats } = this.data;
    const isCompleted = !!userCompletion;
    
    // Calculate cycle day
    const cycleStartDate = new Date('2024-01-01');
    const today = new Date(challenge.date);
    const daysSinceStart = Math.floor((today.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24));
    const cycleDay = ((daysSinceStart % 60) + 1);
    
    // Get day name and emoji
    const dayEmojis: Record<string, string> = {
      minimal: '😌',
      themed: '🎨',
      wildcard: '🎲',
      throwback: '⏮️',
      frenzy: '🔥',
      social: '👥',
      supreme: '👑'
    };
    
    const difficultyColors: Record<string, string> = {
      easy: 'text-green-400',
      medium: 'text-yellow-400',
      hard: 'text-red-400'
    };
    
    this.panel.innerHTML = `
      <div class="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 rounded-t-2xl">
        <div class="flex items-center justify-between">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-2xl">${dayEmojis[challenge.dayType] || '📅'}</span>
              <h2 class="text-xl font-bold text-white">Daily Challenge #${challenge.id}</h2>
            </div>
            <p class="text-indigo-200 text-sm mt-1">
              ${new Date(challenge.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              <span class="text-xs opacity-75"> • Day ${cycleDay}/60</span>
            </p>
          </div>
          <button id="dc-close" class="text-white/80 hover:text-white transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="p-5 space-y-3">
        <!-- Challenge Info -->
        <div class="bg-hw-surface-tertiary/30 rounded-lg p-4">
          <div class="flex items-center justify-between mb-2">
            <div class="text-lg font-semibold text-hw-text-primary">${challenge.clue}</div>
            <div class="text-sm ${difficultyColors[challenge.difficulty]} font-medium">
              ${challenge.difficulty.toUpperCase()}
            </div>
          </div>
          ${challenge.theme ? `<div class="text-sm text-hw-text-secondary">Theme: ${challenge.theme}</div>` : ''}
        </div>
        
        <!-- Streak Info -->
        ${userStreak ? `
          <div class="flex justify-between items-center bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-lg p-3">
            <div class="flex items-center gap-3">
              <span class="text-2xl">🔥</span>
              <div>
                <div class="text-sm font-semibold text-orange-400">${userStreak.currentStreak} Day Streak!</div>
                <div class="text-xs text-hw-text-secondary">Best: ${userStreak.longestStreak} days</div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-xs text-hw-text-secondary">Total Played</div>
              <div class="text-sm font-bold text-hw-text-primary">${userStreak.totalDaysPlayed}</div>
            </div>
          </div>
        ` : ''}
        
        <!-- Completion Status -->
        ${isCompleted ? `
          <div class="bg-green-500/20 border border-green-500/30 rounded-lg p-3">
            <div class="flex items-center gap-2 text-green-400">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
              <span class="font-semibold">Completed!</span>
            </div>
            <div class="mt-2 text-sm text-hw-text-secondary">
              Time: ${this.formatTime(userCompletion.completionTime)} · Hints: ${userCompletion.hintsUsed}
            </div>
          </div>
        ` : ''}
        
        <!-- Global Stats -->
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-hw-surface-tertiary/20 rounded-lg p-3 text-center">
            <div class="text-2xl mb-1">👥</div>
            <div class="text-lg font-bold text-hw-text-primary">${stats.totalPlayers}</div>
            <div class="text-xs text-hw-text-secondary">Players Today</div>
          </div>
          <div class="bg-hw-surface-tertiary/20 rounded-lg p-3 text-center">
            <div class="text-2xl mb-1">⚡</div>
            <div class="text-lg font-bold text-hw-text-primary">
              ${stats.fastestTime ? this.formatTime(stats.fastestTime) : '--:--'}
            </div>
            <div class="text-xs text-hw-text-secondary">
              ${stats.fastestPlayer ? `by ${stats.fastestPlayer}` : 'Fastest Time'}
            </div>
          </div>
        </div>
        
        <!-- Reward Preview -->
        ${!isCompleted ? `
          <div class="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 rounded-lg p-3">
            <div class="text-sm font-semibold text-yellow-400 mb-2">🏆 Rewards</div>
            <div class="space-y-1 text-xs text-hw-text-secondary">
              <div>• Complete: 50-100 coins</div>
              <div>• Speed bonus: Up to +100 coins</div>
              ${userStreak && userStreak.currentStreak === 6 ? '<div class="text-yellow-400">• 7-day streak tomorrow: +200 coins!</div>' : ''}
            </div>
          </div>
        ` : ''}
        
        <!-- Action Buttons -->
        <div class="space-y-2">
          ${!isCompleted ? `
            <button id="dc-play" class="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold py-3 rounded-lg transition-all transform hover:scale-105">
              Play Daily Challenge
            </button>
          ` : `
            <button id="dc-play" disabled class="w-full bg-gray-600/50 text-gray-400 font-semibold py-3 rounded-lg cursor-not-allowed">
              Already Completed
            </button>
          `}
          
          <button id="dc-leaderboard" class="w-full bg-hw-surface-tertiary/30 hover:bg-hw-surface-tertiary/50 text-hw-text-primary font-semibold py-2.5 rounded-lg transition-colors">
            View Leaderboard
          </button>
        </div>
      </div>
    `;
    
    this.overlay.appendChild(this.panel);
  }

  private async showLeaderboard(): Promise<void> {
    loadingOverlay.show('Loading leaderboard...');
    
    try {
      const response = await fetch('/api/daily-challenge/leaderboard');
      if (!response.ok) {
        throw new Error('Failed to load leaderboard');
      }
      
      const data = await response.json();
      loadingOverlay.hide();
      
      // Create leaderboard modal
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[10001] flex items-center justify-center';
      
      const content = document.createElement('div');
      content.className = 'bg-gradient-to-br from-hw-surface-primary to-hw-surface-secondary rounded-xl max-w-md w-full mx-4 max-h-[70vh] overflow-hidden';
      content.style.transform = 'scale(0.85)';
      
      content.innerHTML = `
        <div class="bg-gradient-to-r from-yellow-600 to-amber-600 px-4 py-3">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-bold text-white">🏆 Today's Leaderboard</h3>
            <button id="lb-close" class="text-white/80 hover:text-white">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 6L6 14M6 6l8 8"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="overflow-y-auto" style="max-height: calc(70vh - 60px);">
          <div class="p-4 space-y-2">
            ${data.leaderboard.map((entry: any) => {
              const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '';
              const isUser = data.userRank === entry.rank;
              
              return `
                <div class="flex items-center gap-3 p-2.5 rounded-lg ${isUser ? 'bg-purple-500/20 border border-purple-500/30' : 'bg-hw-surface-tertiary/20'}">
                  <div class="w-8 text-center">
                    ${medal || `<span class="text-xs text-hw-text-secondary">#${entry.rank}</span>`}
                  </div>
                  <div class="flex-1 text-sm font-medium text-hw-text-primary">
                    ${entry.username}${isUser ? ' (You)' : ''}
                  </div>
                  <div class="text-sm font-bold text-purple-400">
                    ${entry.displayTime}
                  </div>
                </div>
              `;
            }).join('')}
            
            ${data.leaderboard.length === 0 ? `
              <div class="text-center py-8 text-hw-text-secondary">
                <div class="text-3xl mb-2">🏁</div>
                <div>No completions yet</div>
                <div class="text-xs mt-1">Be the first!</div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
      
      modal.appendChild(content);
      document.body.appendChild(modal);
      
      // Close button handler
      const closeBtn = content.querySelector('#lb-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          modal.remove();
        });
      }
      
      // Click outside to close
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
      
    } catch (error) {
      loadingOverlay.hide();
      console.error('Failed to load leaderboard:', error);
    }
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private showError(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center';
    
    this.panel = document.createElement('div');
    this.panel.className = 'bg-gradient-to-br from-hw-surface-primary to-hw-surface-secondary rounded-xl p-6 max-w-sm w-full mx-4';
    
    this.panel.innerHTML = `
      <div class="text-center">
        <div class="text-4xl mb-3">😔</div>
        <div class="text-lg font-semibold text-hw-text-primary mb-2">Failed to Load</div>
        <div class="text-sm text-hw-text-secondary mb-4">Could not load today's challenge. Please try again.</div>
        <button id="dc-close" class="px-4 py-2 bg-hw-surface-tertiary/50 hover:bg-hw-surface-tertiary/70 rounded-lg text-hw-text-primary transition-colors">
          Close
        </button>
      </div>
    `;
    
    this.overlay.appendChild(this.panel);
    document.body.appendChild(this.overlay);
    
    const closeBtn = this.panel.querySelector('#dc-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.overlay.remove();
      });
    }
  }
}
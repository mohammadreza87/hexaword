import { LevelCreator } from './LevelCreator';

interface UserLevel {
  id: string;
  author: string;
  name?: string;
  clue: string;
  words: string[];
  seed: string;
  createdAt: string;
  visibility: 'private' | 'public';
  status: 'active' | 'pending' | 'rejected';
  // Stats
  playCount?: number;
  upvotes?: number;
  downvotes?: number;
  shares?: number;
}

export class LevelManager {
  private overlay!: HTMLDivElement;
  private panel!: HTMLDivElement;
  private levels: UserLevel[] = [];
  private isLoading: boolean = false;
  private currentView: 'list' | 'create' = 'list';

  async show(): Promise<{ action: 'play' | 'close'; levelId?: string } | null> {
    this.buildUI();
    document.body.appendChild(this.overlay);
    
    // Load user levels
    await this.loadUserLevels();
    
    return new Promise((resolve) => {
      const onClose = () => {
        this.overlay.remove();
        resolve(null);
      };

      // Close button handler
      const closeBtn = this.panel.querySelector('#lm-close') as HTMLButtonElement;
      if (closeBtn) {
        closeBtn.onclick = onClose;
      }

      // Create new level button
      const createBtn = this.panel.querySelector('#lm-create') as HTMLButtonElement;
      if (createBtn) {
        createBtn.onclick = async () => {
          // Show the level creator
          const creator = new LevelCreator();
          const result = await creator.show();
          
          if (result?.playNowId) {
            // User created a level and wants to play it
            this.overlay.remove();
            resolve({ action: 'play', levelId: result.playNowId });
          } else {
            // User cancelled or just saved, refresh the list
            await this.loadUserLevels();
            this.renderLevelsList();
          }
        };
      }
    });
  }

  private buildUI(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    
    this.panel = document.createElement('div');
    this.panel.className = 'modal-content panel-hex max-w-2xl';
    this.panel.style.maxHeight = '70vh';
    this.panel.style.overflowY = 'auto';
    this.panel.style.transform = 'scale(0.85)';
    
    this.panel.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <div>
          <div class="text-xl font-bold text-hw-text-primary">My Levels</div>
          <div class="text-xs text-hw-text-secondary mt-0.5">Create and manage your custom levels</div>
        </div>
        <button id="lm-close" class="text-hw-text-secondary hover:text-hw-text-primary transition-colors">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 5L5 15M5 5l10 10"/>
          </svg>
        </button>
      </div>
      
      <div class="mb-3">
        <button id="lm-create" class="btn-glass-primary w-full flex items-center justify-center gap-1.5 py-2">
          <span style="font-size: 16px;">+</span>
          <span class="font-semibold text-sm">Create New Level</span>
        </button>
      </div>
      
      <div class="border-t border-hw-surface-tertiary/30 pt-3">
        <div id="lm-levels-list" class="grid gap-2">
          <!-- Levels will be rendered here -->
        </div>
        
        <div id="lm-loading" class="hidden text-center py-6">
          <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-hw-accent-primary"></div>
          <div class="text-xs text-hw-text-secondary mt-1.5">Loading levels...</div>
        </div>
        
        <div id="lm-empty" class="hidden text-center py-8">
          <div class="text-4xl mb-3 opacity-20">🎮</div>
          <div class="text-sm text-hw-text-primary mb-1.5">No levels yet</div>
          <div class="text-xs text-hw-text-secondary">Create your first custom level to get started!</div>
        </div>
      </div>
    `;
    
    this.overlay.appendChild(this.panel);
  }

  private async loadUserLevels(): Promise<void> {
    this.showLoading(true);
    
    try {
      const response = await fetch('/api/user-levels/mine', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        this.levels = data.levels || [];
      } else {
        console.error('Failed to load user levels');
        this.levels = [];
      }
    } catch (error) {
      console.error('Error loading user levels:', error);
      this.levels = [];
    }
    
    this.showLoading(false);
    this.renderLevelsList();
  }

  private renderLevelsList(): void {
    const listContainer = this.panel.querySelector('#lm-levels-list') as HTMLDivElement;
    const emptyState = this.panel.querySelector('#lm-empty') as HTMLDivElement;
    
    if (!listContainer || !emptyState) return;
    
    if (this.levels.length === 0) {
      listContainer.innerHTML = '';
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      
      listContainer.innerHTML = this.levels.map(level => `
        <div class="level-card p-3 rounded-lg border border-hw-surface-tertiary/50 hover:border-hw-accent-primary/30 transition-all duration-200 cursor-pointer group" data-level-id="${level.id}">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-1.5 mb-1">
                ${level.name ? `<div class="font-semibold text-sm text-hw-text-primary">${this.escapeHtml(level.name)}</div>` : ''}
                <div class="text-xs px-1.5 py-0.5 rounded-full bg-hw-surface-tertiary/50 text-hw-text-secondary" style="font-size: 10px;">
                  ${level.words.length} words
                </div>
              </div>
              <div class="text-xs text-hw-text-secondary mb-1.5">${this.escapeHtml(level.clue)}</div>
              <div class="flex flex-wrap gap-1">
                ${level.words.map(word => `
                  <span class="px-1.5 py-0.5 rounded bg-hw-surface-secondary/50 text-hw-text-primary/70 font-mono" style="font-size: 10px;">
                    ${this.escapeHtml(word)}
                  </span>
                `).join('')}
              </div>
              <div class="flex items-center justify-between mt-2 mb-1.5 text-hw-text-secondary" style="font-size: 10px;">
                <span class="flex items-center gap-0.5">
                  <span style="font-size: 12px;">🎮</span>
                  <span>${level.playCount || 0}</span>
                </span>
                <span class="flex items-center gap-0.5">
                  <span style="font-size: 12px;">👍</span>
                  <span>${level.upvotes || 0}</span>
                </span>
                <span class="flex items-center gap-0.5">
                  <span style="font-size: 12px;">👎</span>
                  <span>${level.downvotes || 0}</span>
                </span>
                <span class="flex items-center gap-0.5">
                  <span style="font-size: 12px;">📤</span>
                  <span>${level.shares || 0}</span>
                </span>
              </div>
              <div class="text-hw-text-secondary/50" style="font-size: 10px;">
                Created ${this.formatDate(level.createdAt)}
              </div>
            </div>
            <div class="flex flex-col gap-1.5 ml-3">
              <button class="lm-play-btn px-2 py-1 rounded-lg bg-hw-accent-primary/20 text-hw-accent-primary hover:bg-hw-accent-primary/30 transition-colors" data-level-id="${level.id}" style="font-size: 11px;">
                Play
              </button>
              <button class="lm-delete-btn px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors opacity-0 group-hover:opacity-100" data-level-id="${level.id}" style="font-size: 11px;">
                Delete
              </button>
            </div>
          </div>
        </div>
      `).join('');
      
      // Add event handlers for play and delete buttons
      listContainer.querySelectorAll('.lm-play-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const levelId = (btn as HTMLElement).dataset.levelId;
          if (levelId) {
            this.playLevel(levelId);
          }
        });
      });
      
      listContainer.querySelectorAll('.lm-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const levelId = (btn as HTMLElement).dataset.levelId;
          if (levelId) {
            this.deleteLevel(levelId);
          }
        });
      });
      
      // Add click handler for the entire card to play
      listContainer.querySelectorAll('.level-card').forEach(card => {
        card.addEventListener('click', () => {
          const levelId = (card as HTMLElement).dataset.levelId;
          if (levelId) {
            this.playLevel(levelId);
          }
        });
      });
    }
  }

  private playLevel(levelId: string): void {
    // Close the modal and trigger play action
    this.overlay.remove();
    // This will be handled by the parent component
    window.dispatchEvent(new CustomEvent('play-user-level', { detail: { levelId } }));
  }

  private async deleteLevel(levelId: string): Promise<void> {
    // Create custom confirmation dialog since confirm() is blocked in sandbox
    const confirmed = await this.showDeleteConfirmation();
    if (!confirmed) {
      return;
    }
    
    try {
      // Call the delete API
      const response = await fetch(`/api/user-levels/${encodeURIComponent(levelId)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to delete level:', error);
        // Show error message
        this.showError(error.error?.message || 'Failed to delete level');
        return;
      }
      
      // Remove from local list after successful deletion
      this.levels = this.levels.filter(l => l.id !== levelId);
      this.renderLevelsList();
      
      // Show success message
      this.showSuccess('Level deleted successfully');
    } catch (error) {
      console.error('Error deleting level:', error);
      this.showError('Failed to delete level. Please try again.');
    }
  }

  private showDeleteConfirmation(): Promise<boolean> {
    return new Promise((resolve) => {
      // Create confirmation dialog
      const dialog = document.createElement('div');
      dialog.className = 'fixed inset-0 flex items-center justify-center z-[10001]';
      dialog.innerHTML = `
        <div class="absolute inset-0 bg-black/50" id="delete-backdrop"></div>
        <div class="relative bg-hw-surface-primary border border-hw-surface-tertiary/30 rounded-lg p-6 max-w-sm mx-4">
          <h3 class="text-lg font-bold text-hw-text-primary mb-3">Delete Level?</h3>
          <p class="text-sm text-hw-text-secondary mb-6">Are you sure you want to delete this level? This action cannot be undone.</p>
          <div class="flex gap-3 justify-end">
            <button id="delete-cancel" class="px-4 py-2 rounded-lg bg-hw-surface-secondary text-hw-text-primary hover:bg-hw-surface-tertiary transition-colors">
              Cancel
            </button>
            <button id="delete-confirm" class="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">
              Delete
            </button>
          </div>
        </div>
      `;
      
      document.body.appendChild(dialog);
      
      const cleanup = () => {
        dialog.remove();
      };
      
      // Handle cancel
      dialog.querySelector('#delete-cancel')?.addEventListener('click', () => {
        cleanup();
        resolve(false);
      });
      
      // Handle backdrop click
      dialog.querySelector('#delete-backdrop')?.addEventListener('click', () => {
        cleanup();
        resolve(false);
      });
      
      // Handle confirm
      dialog.querySelector('#delete-confirm')?.addEventListener('click', () => {
        cleanup();
        resolve(true);
      });
    });
  }

  private showLoading(show: boolean): void {
    const loadingEl = this.panel.querySelector('#lm-loading') as HTMLDivElement;
    const listContainer = this.panel.querySelector('#lm-levels-list') as HTMLDivElement;
    
    if (loadingEl) {
      if (show) {
        loadingEl.classList.remove('hidden');
        if (listContainer) listContainer.innerHTML = '';
      } else {
        loadingEl.classList.add('hidden');
      }
    }
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes <= 1 ? 'just now' : `${minutes} minutes ago`;
      }
      return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    } else if (days === 1) {
      return 'yesterday';
    } else if (days < 30) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private showError(message: string): void {
    this.showToast(message, 'error');
  }

  private showSuccess(message: string): void {
    this.showToast(message, 'success');
  }

  private showToast(message: string, type: 'success' | 'error' = 'success'): void {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-white text-sm font-medium z-[10002] transition-all duration-300';
    toast.style.background = type === 'success' 
      ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' 
      : 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)';
    toast.textContent = message;
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-20px)';
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-20px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}
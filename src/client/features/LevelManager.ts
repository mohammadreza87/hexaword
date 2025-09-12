import { LevelCreator } from './LevelCreator';
import { loadingOverlay } from '../utils/LoadingOverlay';

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
    this.overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center';
    
    this.panel = document.createElement('div');
    this.panel.className = 'bg-gradient-to-br from-hw-surface-primary to-hw-surface-secondary rounded-2xl shadow-2xl max-w-2xl w-full mx-4';
    this.panel.style.maxHeight = '70vh';
    this.panel.style.overflowY = 'auto';
    this.panel.style.transform = 'scale(0.85)';
    
    this.panel.innerHTML = `
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <div class="text-2xl font-bold text-white">My Levels</div>
            <div class="text-sm text-purple-200 mt-1">Create and manage your custom levels</div>
          </div>
          <button id="lm-close" class="text-white/60 hover:text-white transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <div class="mb-4">
          <button id="lm-create" class="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold py-3 rounded-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2">
            <span class="text-xl">+</span>
            <span>Create New Level</span>
          </button>
        </div>
        
        <div class="border-t border-white/10 pt-4">
          <div id="lm-levels-list" class="grid gap-3">
            <!-- Levels will be rendered here -->
          </div>
          
          <div id="lm-loading" class="hidden text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            <div class="text-sm text-hw-text-secondary mt-2">Loading levels...</div>
          </div>
          
          <div id="lm-empty" class="hidden text-center py-12">
            <div class="text-5xl mb-4 opacity-30">🎮</div>
            <div class="text-lg text-hw-text-primary mb-2">No levels yet</div>
            <div class="text-sm text-hw-text-secondary">Create your first custom level to get started!</div>
          </div>
        </div>
      </div>
    `;
    
    this.overlay.appendChild(this.panel);
  }

  private async loadUserLevels(): Promise<void> {
    // Use the new loading overlay instead of built-in loading
    loadingOverlay.show('Loading your levels...');
    
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
    } finally {
      // Always hide the loading overlay, even if there's an error
      loadingOverlay.hide();
    }
    
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
        <div class="level-card p-4 rounded-lg bg-hw-surface-tertiary/30 hover:bg-hw-surface-tertiary/50 border border-white/10 hover:border-purple-500/30 transition-all duration-200 cursor-pointer group" data-level-id="${level.id}">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-2">
                ${level.name ? `<div class="font-bold text-lg text-white">${this.escapeHtml(level.name)}</div>` : ''}
                <div class="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                  ${level.words.length} words
                </div>
              </div>
              <div class="text-sm text-purple-200 mb-2">${this.escapeHtml(level.clue)}</div>
              <div class="flex flex-wrap gap-1 mb-3">
                ${level.words.map(word => `
                  <span class="px-2 py-1 rounded bg-black/20 text-white text-xs font-mono uppercase">
                    ${this.escapeHtml(word)}
                  </span>
                `).join('')}
              </div>
              <div class="flex items-center justify-between mt-3 text-xs text-gray-400">
                <span class="flex items-center gap-1">
                  <span>🎮</span>
                  <span>${level.playCount || 0}</span>
                </span>
                <span class="flex items-center gap-1">
                  <span>👍</span>
                  <span>${level.upvotes || 0}</span>
                </span>
                <span class="flex items-center gap-1">
                  <span>👎</span>
                  <span>${level.downvotes || 0}</span>
                </span>
                <span class="flex items-center gap-1">
                  <span>📤</span>
                  <span>${level.shares || 0}</span>
                </span>
              </div>
              <div class="text-xs text-gray-500 mt-2">
                Created ${this.formatDate(level.createdAt)}
              </div>
            </div>
            <div class="flex flex-col gap-2 ml-3">
              <button class="lm-play-btn px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold text-sm transition-all transform hover:scale-105" data-level-id="${level.id}">
                Play
              </button>
              <button class="lm-share-btn px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold text-sm transition-all transform hover:scale-105 flex items-center justify-center gap-1" data-level-id="${level.id}" data-level-name="${this.escapeHtml(level.name || 'Custom Level')}" data-level-clue="${this.escapeHtml(level.clue)}">
                <span>📤</span>
                <span>Share</span>
              </button>
              <button class="lm-delete-btn px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors opacity-0 group-hover:opacity-100" data-level-id="${level.id}" style="font-size: 11px;">
                Delete
              </button>
            </div>
          </div>
        </div>
      `).join('');
      
      // Add event handlers for play, share, and delete buttons
      listContainer.querySelectorAll('.lm-play-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const levelId = (btn as HTMLElement).dataset.levelId;
          if (levelId) {
            this.playLevel(levelId);
          }
        });
      });
      
      listContainer.querySelectorAll('.lm-share-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const levelId = (btn as HTMLElement).dataset.levelId;
          const levelName = (btn as HTMLElement).dataset.levelName || 'Custom Level';
          const levelClue = (btn as HTMLElement).dataset.levelClue || '';
          if (levelId) {
            this.shareLevel(levelId, levelName, levelClue);
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

  private async shareLevel(levelId: string, levelName: string, levelClue: string): Promise<void> {
    // Generate the shareable URL for the level
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}?level=${encodeURIComponent(levelId)}`;
    
    // Create the Reddit share content
    const title = `Check out my HexaWords puzzle: "${levelName}"`;
    const text = `Clue: ${levelClue}\n\nPlay it here: ${shareUrl}`;
    
    // Show share options dialog
    const dialog = await this.showShareDialog(title, text, shareUrl, levelId);
  }
  
  private async showShareDialog(title: string, text: string, shareUrl: string, levelId: string): Promise<void> {
    // Create share dialog
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
      await this.trackShare(levelId);
      
      // Reddit submission URL (best practice is to use submit.reddit.com)
      const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(title)}`;
      window.open(redditUrl, '_blank', 'width=600,height=600');
      
      // Show success message
      this.showSuccess('Opening Reddit to share your level!');
    });
    
    // Handle copy link
    dialog.querySelector('#share-copy')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        this.showSuccess('Link copied to clipboard!');
      } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        this.showSuccess('Link copied to clipboard!');
      }
    });
    
    // Handle close
    const closeDialog = () => dialog.remove();
    dialog.querySelector('#share-close')?.addEventListener('click', closeDialog);
    dialog.querySelector('#share-backdrop')?.addEventListener('click', closeDialog);
  }
  
  private async trackShare(levelId: string): Promise<void> {
    try {
      // Call the backend to track the share
      await fetch(`/api/user-levels/${encodeURIComponent(levelId)}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // Update local share count
      const level = this.levels.find(l => l.id === levelId);
      if (level) {
        level.shares = (level.shares || 0) + 1;
        this.renderLevelsList();
      }
    } catch (error) {
      console.error('Failed to track share:', error);
    }
  }

  private async deleteLevel(levelId: string): Promise<void> {
    // Create custom confirmation dialog since confirm() is blocked in sandbox
    const confirmed = await this.showDeleteConfirmation();
    if (!confirmed) {
      return;
    }
    
    loadingOverlay.show('Deleting level...');
    
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
    } finally {
      loadingOverlay.hide();
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
export class ShareDialog {
  private overlay!: HTMLDivElement;
  private panel!: HTMLDivElement;
  private levelId: string;
  private levelName?: string;
  private clue: string;

  constructor(levelId: string, levelName: string | undefined, clue: string) {
    this.levelId = levelId;
    this.levelName = levelName;
    this.clue = clue;
  }

  async show(): Promise<{ action: 'play' | 'close' | 'share' }> {
    this.buildUI();
    document.body.appendChild(this.overlay);
    
    // Animate in
    setTimeout(() => {
      this.overlay.style.opacity = '1';
      this.panel.style.transform = 'translateY(0)';
    }, 10);

    return new Promise((resolve) => {
      // Play Now button
      const playBtn = this.panel.querySelector('#sd-play') as HTMLButtonElement;
      if (playBtn) {
        playBtn.onclick = () => {
          this.close();
          resolve({ action: 'play' });
        };
      }

      // Share buttons
      const shareRedditBtn = this.panel.querySelector('#sd-share-reddit') as HTMLButtonElement;
      if (shareRedditBtn) {
        shareRedditBtn.onclick = () => {
          this.shareToReddit();
          // Don't close the dialog, let user continue sharing
        };
      }

      const shareTwitterBtn = this.panel.querySelector('#sd-share-twitter') as HTMLButtonElement;
      if (shareTwitterBtn) {
        shareTwitterBtn.onclick = () => {
          this.shareToTwitter();
        };
      }

      const shareCopyBtn = this.panel.querySelector('#sd-share-copy') as HTMLButtonElement;
      if (shareCopyBtn) {
        shareCopyBtn.onclick = () => {
          this.copyShareLink();
        };
      }

      // Back to Levels button
      const backBtn = this.panel.querySelector('#sd-back') as HTMLButtonElement;
      if (backBtn) {
        backBtn.onclick = () => {
          this.close();
          resolve({ action: 'close' });
        };
      }

      // Close button
      const closeBtn = this.panel.querySelector('#sd-close') as HTMLButtonElement;
      if (closeBtn) {
        closeBtn.onclick = () => {
          this.close();
          resolve({ action: 'close' });
        };
      }
    });
  }

  private buildUI(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    this.overlay.style.opacity = '0';
    this.overlay.style.transition = 'opacity 0.3s ease';
    
    this.panel = document.createElement('div');
    this.panel.className = 'modal-content panel-hex max-w-md';
    this.panel.style.transform = 'translateY(20px)';
    this.panel.style.transition = 'transform 0.3s ease';
    
    const levelTitle = this.levelName || this.clue;
    
    this.panel.innerHTML = `
      <div class="text-center">
        <!-- Success Icon -->
        <div class="mb-4">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-hw-accent-success/20 animate-pulse">
            <svg class="w-8 h-8 text-hw-accent-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
        </div>
        
        <!-- Success Message -->
        <div class="text-2xl font-bold text-hw-text-primary mb-2">Level Saved!</div>
        <div class="text-sm text-hw-text-secondary mb-6">
          "${this.escapeHtml(levelTitle)}" has been created successfully
        </div>
        
        <!-- Share Section -->
        <div class="border-t border-hw-surface-tertiary/30 pt-4 mb-4">
          <div class="text-sm text-hw-text-secondary mb-3">Share your creation with friends!</div>
          
          <div class="grid grid-cols-3 gap-2 mb-4">
            <!-- Reddit Share -->
            <button id="sd-share-reddit" class="share-btn flex flex-col items-center gap-1 p-3 rounded-lg bg-hw-surface-secondary/50 hover:bg-hw-surface-secondary/70 transition-all">
              <svg class="w-6 h-6 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
              </svg>
              <span class="text-xs">Reddit</span>
            </button>
            
            <!-- Twitter Share -->
            <button id="sd-share-twitter" class="share-btn flex flex-col items-center gap-1 p-3 rounded-lg bg-hw-surface-secondary/50 hover:bg-hw-surface-secondary/70 transition-all">
              <svg class="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
              </svg>
              <span class="text-xs">Twitter</span>
            </button>
            
            <!-- Copy Link -->
            <button id="sd-share-copy" class="share-btn flex flex-col items-center gap-1 p-3 rounded-lg bg-hw-surface-secondary/50 hover:bg-hw-surface-secondary/70 transition-all">
              <svg class="w-6 h-6 text-hw-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
              <span class="text-xs">Copy Link</span>
            </button>
          </div>
          
          <!-- Share Message Preview -->
          <div class="text-xs text-hw-text-secondary/60 p-2 rounded bg-hw-surface-secondary/30">
            <div id="sd-copy-feedback" class="hidden text-hw-accent-success mb-2">✓ Link copied to clipboard!</div>
            <div class="italic">Share preview: "Check out my HexaWord puzzle: ${this.escapeHtml(this.clue)}! Can you solve it?"</div>
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex gap-2">
          <button id="sd-play" class="btn-glass-primary flex-1 py-2">
            🎮 Play Now
          </button>
          <button id="sd-back" class="btn-glass flex-1 py-2">
            Back to Levels
          </button>
        </div>
        
        <!-- Close button -->
        <button id="sd-close" class="absolute top-4 right-4 text-hw-text-secondary hover:text-hw-text-primary transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `;
    
    this.overlay.appendChild(this.panel);
  }

  private shareToReddit(): void {
    const title = `I created a HexaWord puzzle: "${this.clue}"`;
    const text = `Check out my custom HexaWord puzzle! Can you solve it?\n\nClue: ${this.clue}\n\nPlay it here: ${this.getShareUrl()}`;
    
    // Reddit share URL
    const redditUrl = `https://www.reddit.com/submit?title=${encodeURIComponent(title)}&text=${encodeURIComponent(text)}`;
    window.open(redditUrl, '_blank', 'width=600,height=600');
  }

  private shareToTwitter(): void {
    const text = `🎮 I created a HexaWord puzzle: "${this.clue}"! Can you solve it? Play here: ${this.getShareUrl()} #HexaWord #PuzzleGame`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank', 'width=600,height=400');
  }

  private async copyShareLink(): Promise<void> {
    const shareUrl = this.getShareUrl();
    const shareText = `Check out my HexaWord puzzle: "${this.clue}"! ${shareUrl}`;
    
    try {
      await navigator.clipboard.writeText(shareText);
      
      // Show feedback
      const feedback = this.panel.querySelector('#sd-copy-feedback') as HTMLDivElement;
      if (feedback) {
        feedback.classList.remove('hidden');
        setTimeout(() => {
          feedback.classList.add('hidden');
        }, 3000);
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback: select and copy manually
      const tempInput = document.createElement('textarea');
      tempInput.value = shareText;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
      
      // Show feedback
      const feedback = this.panel.querySelector('#sd-copy-feedback') as HTMLDivElement;
      if (feedback) {
        feedback.classList.remove('hidden');
        setTimeout(() => {
          feedback.classList.add('hidden');
        }, 3000);
      }
    }
  }

  private getShareUrl(): string {
    // This should be replaced with your actual game URL structure
    const baseUrl = window.location.origin;
    return `${baseUrl}?level=${this.levelId}`;
  }

  private close(): void {
    this.overlay.style.opacity = '0';
    this.panel.style.transform = 'translateY(20px)';
    setTimeout(() => {
      this.overlay.remove();
    }, 300);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
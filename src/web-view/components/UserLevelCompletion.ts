export interface UserLevelCompletionOptions {
  levelName?: string;
  levelId: string;
  author: string;
  clue: string;
  score: number;
  coins: number;
  onUpvote: () => void;
  onDownvote: () => void;
  onShare: () => void;
  onNextLevel: () => void;
  onMainMenu: () => void;
}

export class UserLevelCompletion {
  private overlay: HTMLDivElement;
  private panel: HTMLDivElement;
  private hasVoted: boolean = false;
  private voteType: 'up' | 'down' | null = null;

  constructor(private options: UserLevelCompletionOptions) {
    this.overlay = this.createOverlay();
    this.panel = this.createPanel();
    this.overlay.appendChild(this.panel);
  }

  private createOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.3s ease-out;
    `;
    return overlay;
  }

  private createPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    const levelTitle = this.options.levelName || this.options.clue;
    
    panel.style.cssText = `
      background: linear-gradient(135deg, #1a1f2b 0%, #2a3142 100%);
      border-radius: 16px;
      padding: 20px;
      max-width: 380px;
      width: 90%;
      color: white;
      text-align: center;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
      border: 2px solid rgba(139, 92, 246, 0.3);
      animation: slideUp 0.4s ease-out;
      transform: scale(0.85);
    `;

    panel.innerHTML = `
      <div style="margin-bottom: 16px;">
        <div style="font-size: 24px; font-weight: bold; margin-bottom: 6px;">
          🎉 Level Complete! 🎉
        </div>
        <div style="font-size: 16px; color: #A78BFA; margin-bottom: 3px;">
          "${this.escapeHtml(levelTitle)}"
        </div>
        <div style="font-size: 12px; color: rgba(255, 255, 255, 0.6);">
          Created by ${this.escapeHtml(this.options.author)}
        </div>
      </div>

      <div style="display: flex; justify-content: center; gap: 12px; margin-bottom: 16px;">
        <div style="background: rgba(139, 92, 246, 0.2); padding: 8px 16px; border-radius: 10px;">
          <div style="font-size: 11px; color: rgba(255, 255, 255, 0.7); margin-bottom: 2px;">Score</div>
          <div style="font-size: 18px; font-weight: bold; color: #A78BFA;">
            ${this.options.score.toLocaleString()}
          </div>
        </div>
        <div style="background: rgba(251, 191, 36, 0.2); padding: 8px 16px; border-radius: 10px;">
          <div style="font-size: 11px; color: rgba(255, 255, 255, 0.7); margin-bottom: 2px;">Coins</div>
          <div style="font-size: 18px; font-weight: bold; color: #FBB736;">
            +${this.options.coins}
          </div>
        </div>
      </div>

      <!-- Vote Section -->
      <div style="margin-bottom: 16px;">
        <div style="font-size: 12px; color: rgba(255, 255, 255, 0.7); margin-bottom: 8px;">
          Rate this level
        </div>
        <div style="display: flex; justify-content: center; gap: 12px;">
          <button id="ulc-upvote" style="
            background: rgba(34, 197, 94, 0.2);
            border: 1px solid rgba(34, 197, 94, 0.4);
            color: #22C55E;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
          ">
            <span style="font-size: 16px;">👍</span>
            <span>Upvote</span>
          </button>
          <button id="ulc-downvote" style="
            background: rgba(239, 68, 68, 0.2);
            border: 1px solid rgba(239, 68, 68, 0.4);
            color: #EF4444;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
          ">
            <span style="font-size: 16px;">👎</span>
            <span>Downvote</span>
          </button>
        </div>
        <div id="ulc-vote-feedback" style="
          margin-top: 6px;
          font-size: 11px;
          color: #22C55E;
          opacity: 0;
          transition: opacity 0.3s;
        ">
          Thanks for your feedback!
        </div>
      </div>

      <!-- Share Section -->
      <div style="margin-bottom: 16px;">
        <button id="ulc-share" style="
          width: 100%;
          background: linear-gradient(135deg, #1976D2 0%, #42A5F5 100%);
          border: none;
          color: white;
          padding: 10px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        ">
          <span style="font-size: 14px;">📤</span>
          <span>Share to Community</span>
        </button>
      </div>

      <!-- Action Buttons -->
      <div style="display: flex; gap: 8px;">
        <button id="ulc-play-another" style="
          flex: 1;
          background: linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%);
          border: none;
          color: white;
          padding: 10px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        ">
          Play Another
        </button>
        <button id="ulc-main-menu" style="
          flex: 1;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          padding: 10px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        ">
          Main Menu
        </button>
      </div>
    `;

    // Add animation styles
    this.addAnimationStyles();

    // Bind events after panel is created
    this.bindEvents(panel);

    return panel;
  }

  private bindEvents(panel: HTMLDivElement): void {
    // Upvote button
    const upvoteBtn = panel.querySelector('#ulc-upvote') as HTMLButtonElement;
    if (upvoteBtn) {
      upvoteBtn.addEventListener('click', () => {
        // Allow changing vote or new vote
        if (this.voteType !== 'up') {
          this.handleVote('up');
          this.options.onUpvote();
        }
      });
    }

    // Downvote button
    const downvoteBtn = panel.querySelector('#ulc-downvote') as HTMLButtonElement;
    if (downvoteBtn) {
      downvoteBtn.addEventListener('click', () => {
        // Allow changing vote or new vote
        if (this.voteType !== 'down') {
          this.handleVote('down');
          this.options.onDownvote();
        }
      });
    }

    // Share button
    const shareBtn = panel.querySelector('#ulc-share') as HTMLButtonElement;
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        this.options.onShare();
      });
    }

    // Play Another button
    const playAnotherBtn = panel.querySelector('#ulc-play-another') as HTMLButtonElement;
    if (playAnotherBtn) {
      playAnotherBtn.addEventListener('click', () => {
        this.close();
        this.options.onNextLevel();
      });
    }

    // Main Menu button
    const mainMenuBtn = panel.querySelector('#ulc-main-menu') as HTMLButtonElement;
    if (mainMenuBtn) {
      mainMenuBtn.addEventListener('click', () => {
        this.close();
        this.options.onMainMenu();
      });
    }
  }

  private handleVote(type: 'up' | 'down'): void {
    // Allow changing vote
    const upvoteBtn = this.panel.querySelector('#ulc-upvote') as HTMLButtonElement;
    const downvoteBtn = this.panel.querySelector('#ulc-downvote') as HTMLButtonElement;
    const feedback = this.panel.querySelector('#ulc-vote-feedback') as HTMLDivElement;

    // If clicking the same vote type, ignore
    if (this.voteType === type) {
      return;
    }

    // Reset styles first if changing vote
    if (this.hasVoted) {
      upvoteBtn.style.background = 'rgba(34, 197, 94, 0.2)';
      upvoteBtn.style.borderColor = 'rgba(34, 197, 94, 0.4)';
      upvoteBtn.style.opacity = '1';
      upvoteBtn.disabled = false;
      
      downvoteBtn.style.background = 'rgba(239, 68, 68, 0.2)';
      downvoteBtn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      downvoteBtn.style.opacity = '1';
      downvoteBtn.disabled = false;
    }

    this.hasVoted = true;
    this.voteType = type;

    // Apply new vote styling
    if (type === 'up') {
      upvoteBtn.style.background = 'rgba(34, 197, 94, 0.4)';
      upvoteBtn.style.borderColor = '#22C55E';
      downvoteBtn.style.opacity = '0.5';
    } else {
      downvoteBtn.style.background = 'rgba(239, 68, 68, 0.4)';
      downvoteBtn.style.borderColor = '#EF4444';
      upvoteBtn.style.opacity = '0.5';
    }

    // Show feedback
    if (feedback) {
      feedback.textContent = type === 'up' ? 'Thanks for upvoting!' : 'Thanks for your feedback!';
      feedback.style.color = type === 'up' ? '#22C55E' : '#EF4444';
      feedback.style.opacity = '1';
      setTimeout(() => {
        feedback.style.opacity = '0';
      }, 2000);
    }
  }

  private addAnimationStyles(): void {
    if (!document.getElementById('ulc-animation-styles')) {
      const style = document.createElement('style');
      style.id = 'ulc-animation-styles';
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        #ulc-upvote:hover:not(:disabled) {
          background: rgba(34, 197, 94, 0.3) !important;
          transform: translateY(-2px);
        }
        #ulc-downvote:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.3) !important;
          transform: translateY(-2px);
        }
        #ulc-share:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(25, 118, 210, 0.3);
        }
        #ulc-play-another:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(139, 92, 246, 0.3);
        }
        #ulc-main-menu:hover {
          background: rgba(255, 255, 255, 0.15) !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  public show(): void {
    document.body.appendChild(this.overlay);
  }

  public close(): void {
    this.overlay.style.opacity = '0';
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
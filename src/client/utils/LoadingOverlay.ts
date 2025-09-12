export class LoadingOverlay {
  private static instance: LoadingOverlay;
  private overlay: HTMLDivElement | null = null;
  private activeCount = 0;

  private constructor() {}

  public static getInstance(): LoadingOverlay {
    if (!LoadingOverlay.instance) {
      LoadingOverlay.instance = new LoadingOverlay();
    }
    return LoadingOverlay.instance;
  }

  public show(message?: string): void {
    this.activeCount++;
    
    if (!this.overlay) {
      this.overlay = this.createOverlay(message);
      document.body.appendChild(this.overlay);
      
      // Add animation after a small delay to trigger transition
      setTimeout(() => {
        if (this.overlay) {
          this.overlay.style.opacity = '1';
        }
      }, 10);
    } else if (message) {
      // Update message if provided
      const messageEl = this.overlay.querySelector('.loading-message');
      if (messageEl) {
        messageEl.textContent = message;
      }
    }
  }

  public hide(): void {
    this.activeCount = Math.max(0, this.activeCount - 1);
    
    if (this.activeCount === 0 && this.overlay) {
      this.overlay.style.opacity = '0';
      setTimeout(() => {
        if (this.overlay && this.activeCount === 0) {
          this.overlay.remove();
          this.overlay = null;
        }
      }, 300);
    }
  }

  public forceHide(): void {
    this.activeCount = 0;
    if (this.overlay) {
      this.overlay.style.opacity = '0';
      setTimeout(() => {
        if (this.overlay) {
          this.overlay.remove();
          this.overlay = null;
        }
      }, 300);
    }
  }

  private createOverlay(message?: string): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    const container = document.createElement('div');
    container.style.cssText = `
      text-align: center;
    `;

    // Create hexagon loader
    const hexagon = document.createElement('div');
    hexagon.className = 'hexagon-loader';
    hexagon.style.cssText = `
      width: 60px;
      height: 60px;
      margin: 0 auto 16px;
      position: relative;
      animation: hexagonRotate 1.5s linear infinite;
    `;

    // Create hexagon shape using CSS
    hexagon.innerHTML = `
      <svg width="60" height="60" viewBox="0 0 60 60" style="filter: drop-shadow(0 0 10px rgba(139, 92, 246, 0.5));">
        <path d="M30 5 L50 17.5 L50 42.5 L30 55 L10 42.5 L10 17.5 Z" 
              fill="none" 
              stroke="url(#hexGradient)" 
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-dasharray="120"
              stroke-dashoffset="0"
              style="animation: hexagonDash 2s linear infinite;">
        </path>
        <defs>
          <linearGradient id="hexGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#8B5CF6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#A78BFA;stop-opacity:1" />
          </linearGradient>
        </defs>
      </svg>
    `;

    container.appendChild(hexagon);

    // Add message if provided
    if (message) {
      const messageEl = document.createElement('div');
      messageEl.className = 'loading-message';
      messageEl.style.cssText = `
        color: white;
        font-size: 14px;
        font-weight: 500;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      `;
      messageEl.textContent = message;
      container.appendChild(messageEl);
    }

    overlay.appendChild(container);

    // Add styles for animations
    if (!document.getElementById('loading-overlay-styles')) {
      const style = document.createElement('style');
      style.id = 'loading-overlay-styles';
      style.textContent = `
        @keyframes hexagonRotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        @keyframes hexagonDash {
          0% {
            stroke-dashoffset: 0;
          }
          50% {
            stroke-dashoffset: 120;
          }
          100% {
            stroke-dashoffset: 240;
          }
        }
      `;
      document.head.appendChild(style);
    }

    return overlay;
  }
}

// Export singleton instance for convenience
export const loadingOverlay = LoadingOverlay.getInstance();
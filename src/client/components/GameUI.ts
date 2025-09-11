/**
 * GameUI - Manages the UI overlay for the game
 * Handles all UI elements that sit above the game canvas
 */
export class GameUI {
  private container: HTMLElement;
  private levelEl: HTMLElement;
  private wordCountEl: HTMLElement;
  private coinEl: HTMLElement;
  private settingsBtn: HTMLButtonElement;
  private menuPanel: HTMLElement;
  private shuffleBtn: HTMLButtonElement;
  private revealBtn: HTMLButtonElement;
  private targetBtn: HTMLButtonElement;
  private shareBtn: HTMLButtonElement;
  
  constructor() {
    this.container = this.createUIContainer();
    this.levelEl = this.createLevelIndicator();
    this.wordCountEl = this.createWordCounter();
    this.coinEl = this.createCoinDisplay();
    this.settingsBtn = this.createSettingsButton();
    this.menuPanel = this.createMenuPanel();
    this.shuffleBtn = this.createShuffleButton();
    this.revealBtn = this.createRevealButton();
    this.targetBtn = this.createTargetButton();
    this.shareBtn = this.createShareButton();
    
    this.setupEventListeners();
    this.appendElements();
  }
  
  private createUIContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'game-ui-overlay';
    container.className = 'fixed inset-0 pointer-events-none z-50';
    return container;
  }
  
  private createLevelIndicator(): HTMLElement {
    const levelEl = document.createElement('div');
    levelEl.id = 'hw-level-indicator';
    levelEl.className = 'absolute top-1 left-1 h-6 px-2 rounded-lg text-hw-text-secondary backdrop-blur-md border transition-all duration-base text-xs font-bold flex items-center justify-center pointer-events-auto';
    levelEl.style.cssText = 'background: rgba(26, 31, 43, 0.6); border-color: rgba(255, 255, 255, 0.08);';
    levelEl.textContent = 'LEVEL 1';
    return levelEl;
  }
  
  private createWordCounter(): HTMLElement {
    const wordCountEl = document.createElement('div');
    wordCountEl.id = 'hw-word-count';
    wordCountEl.className = 'absolute top-1 right-1 h-6 px-3 rounded-lg text-hw-text-primary backdrop-blur-md border transition-all duration-base text-xs font-bold flex items-center justify-center pointer-events-auto';
    wordCountEl.style.cssText = 'background: rgba(26, 31, 43, 0.6); border-color: rgba(255, 255, 255, 0.08); margin-right: 35px;';
    wordCountEl.textContent = '0 / 0';
    return wordCountEl;
  }
  
  private createCoinDisplay(): HTMLElement {
    const coinEl = document.createElement('div');
    coinEl.id = 'hw-coins';
    coinEl.className = 'absolute top-1 left-1/2 -translate-x-1/2 h-6 px-2 rounded-lg text-hw-text-primary backdrop-blur-md border transition-all duration-base text-xs font-bold flex items-center gap-1 justify-center pointer-events-auto';
    coinEl.style.cssText = 'background: rgba(26, 31, 43, 0.6); border-color: rgba(255, 255, 255, 0.08);';
    coinEl.innerHTML = '<span style="font-size: 14px;">🪙</span><span>0</span>';
    return coinEl;
  }
  
  private createSettingsButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.id = 'hw-settings-btn';
    btn.textContent = '⚙️';
    btn.className = 'absolute top-1 right-1 w-6 h-6 rounded-full text-hw-text-primary backdrop-blur-md border transition-all duration-base text-sm flex items-center justify-center pointer-events-auto';
    btn.style.cssText = 'background: rgba(42, 52, 70, 0.6); border-color: rgba(59, 71, 96, 0.2);';
    return btn;
  }
  
  private createMenuPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'hw-menu-panel';
    panel.className = 'absolute top-8 right-1 hidden min-w-[200px] p-2 rounded-xl backdrop-blur-lg border shadow-2xl font-display pointer-events-auto';
    panel.style.cssText = 'background: rgba(26, 31, 43, 0.9); border-color: rgba(255, 255, 255, 0.08);';
    
    // Restart button
    const restartBtn = document.createElement('button');
    restartBtn.id = 'restart-level';
    restartBtn.textContent = '🔄 Restart Level';
    restartBtn.className = 'block w-full text-left px-3 py-2 text-sm text-hw-text-primary hover:bg-hw-surface-secondary rounded-lg transition-colors mb-2';
    panel.appendChild(restartBtn);
    
    // How to Play button
    const howToBtn = document.createElement('button');
    howToBtn.id = 'how-to-play';
    howToBtn.textContent = '📖 How to Play';
    howToBtn.className = 'block w-full text-left px-3 py-2 text-sm text-hw-text-primary hover:bg-hw-surface-secondary rounded-lg transition-colors mb-2';
    panel.appendChild(howToBtn);
    
    // Main Menu button
    const mainMenuBtn = document.createElement('button');
    mainMenuBtn.id = 'main-menu';
    mainMenuBtn.textContent = '🏠 Main Menu';
    mainMenuBtn.className = 'block w-full text-left px-3 py-2 text-sm text-hw-text-primary hover:bg-hw-surface-secondary rounded-lg transition-colors mb-2';
    panel.appendChild(mainMenuBtn);
    
    // Divider
    const divider = document.createElement('div');
    divider.className = 'border-t border-hw-surface-tertiary/20 my-2';
    panel.appendChild(divider);
    
    // Reduce Motion toggle
    const motionDiv = document.createElement('div');
    motionDiv.className = 'toggle-option';
    motionDiv.style.cssText = 'margin: 0; background: transparent; padding: 8px 12px;';
    motionDiv.innerHTML = `
      <label class="toggle-option-label" style="font-size: 13px;">
        <span class="toggle-option-icon" style="font-size: 16px;">🎬</span>
        <span>Reduce Motion</span>
      </label>
      <label class="toggle-switch" style="transform: scale(0.85);">
        <input type="checkbox" id="in-game-motion-toggle">
        <span class="toggle-slider"></span>
      </label>
    `;
    panel.appendChild(motionDiv);
    
    // Initialize toggle state
    const toggle = motionDiv.querySelector('#in-game-motion-toggle') as HTMLInputElement;
    if (toggle) {
      toggle.checked = localStorage.getItem('hexaword_reduce_motion') === 'true';
    }
    
    return panel;
  }
  
  private createShuffleButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.id = 'hw-shuffle-btn';
    btn.className = 'fixed left-2 w-10 h-10 rounded-full text-hw-text-primary backdrop-blur-md border transition-all duration-base flex items-center justify-center pointer-events-auto z-50';
    btn.style.cssText = 'bottom: 120px; background: rgba(42, 52, 70, 0.8); border-color: rgba(59, 71, 96, 0.3);';
    
    // Just the shuffle emoji
    btn.textContent = '🔀';
    btn.style.fontSize = '16px';
    
    return btn;
  }
  
  private createRevealButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.id = 'hw-reveal-btn';
    btn.className = 'fixed left-2 w-10 h-10 rounded-full text-hw-text-primary backdrop-blur-md border transition-all duration-base flex items-center justify-center pointer-events-auto z-50';
    btn.style.cssText = 'bottom: 180px; background: rgba(42, 52, 70, 0.8); border-color: rgba(59, 71, 96, 0.3); position: fixed;';
    
    // Container for icon and badge
    btn.innerHTML = `
      <span style="font-size: 16px;">💡</span>
      <span id="hw-reveal-badge" class="hint-badge" style="
        position: absolute;
        top: -4px;
        right: -4px;
        background: rgba(139, 92, 246, 0.9);
        color: white;
        font-size: 10px;
        font-weight: bold;
        padding: 2px 4px;
        border-radius: 8px;
        min-width: 16px;
        text-align: center;
        display: none;
      ">0</span>
    `;
    
    return btn;
  }
  
  private createTargetButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.id = 'hw-target-btn';
    btn.className = 'fixed right-2 w-10 h-10 rounded-full text-hw-text-primary backdrop-blur-md border transition-all duration-base flex items-center justify-center pointer-events-auto z-50';
    btn.style.cssText = 'bottom: 180px; background: rgba(42, 52, 70, 0.8); border-color: rgba(59, 71, 96, 0.3); position: fixed;';
    
    // Container for icon and badge
    btn.innerHTML = `
      <span style="font-size: 16px;">🎯</span>
      <span id="hw-target-badge" class="hint-badge" style="
        position: absolute;
        top: -4px;
        right: -4px;
        background: rgba(139, 92, 246, 0.9);
        color: white;
        font-size: 10px;
        font-weight: bold;
        padding: 2px 4px;
        border-radius: 8px;
        min-width: 16px;
        text-align: center;
        display: none;
      ">0</span>
    `;
    
    return btn;
  }
  
  private createShareButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.id = 'hw-share-btn';
    btn.className = 'fixed right-2 w-10 h-10 rounded-full text-hw-text-primary backdrop-blur-md border transition-all duration-base flex items-center justify-center pointer-events-auto z-50';
    btn.style.cssText = 'bottom: 120px; background: rgba(42, 52, 70, 0.8); border-color: rgba(59, 71, 96, 0.3);';
    
    // Share emoji
    btn.textContent = '📤';
    btn.style.fontSize = '16px';
    
    return btn;
  }
  
  
  private setupEventListeners(): void {
    // Settings button toggle
    this.settingsBtn.addEventListener('click', () => {
      this.menuPanel.classList.toggle('hidden');
    });
    
    // Hover effects
    this.settingsBtn.addEventListener('mouseenter', () => {
      this.settingsBtn.style.background = 'rgba(59, 71, 96, 0.6)';
    });
    
    this.settingsBtn.addEventListener('mouseleave', () => {
      this.settingsBtn.style.background = 'rgba(42, 52, 70, 0.6)';
    });
    
    // Shuffle button hover effect
    this.shuffleBtn.addEventListener('mouseenter', () => {
      this.shuffleBtn.style.background = 'rgba(59, 71, 96, 0.9)';
      this.shuffleBtn.style.transform = 'scale(1.1)';
    });
    
    this.shuffleBtn.addEventListener('mouseleave', () => {
      this.shuffleBtn.style.background = 'rgba(42, 52, 70, 0.8)';
      this.shuffleBtn.style.transform = 'scale(1)';
    });
    
    // Reveal button hover effect
    this.revealBtn.addEventListener('mouseenter', () => {
      this.revealBtn.style.background = 'rgba(59, 71, 96, 0.9)';
      this.revealBtn.style.transform = 'scale(1.1)';
    });
    
    this.revealBtn.addEventListener('mouseleave', () => {
      this.revealBtn.style.background = 'rgba(42, 52, 70, 0.8)';
      this.revealBtn.style.transform = 'scale(1)';
    });
    
    // Target button hover effect
    this.targetBtn.addEventListener('mouseenter', () => {
      this.targetBtn.style.background = 'rgba(59, 71, 96, 0.9)';
      this.targetBtn.style.transform = 'scale(1.1)';
    });
    
    this.targetBtn.addEventListener('mouseleave', () => {
      this.targetBtn.style.background = 'rgba(42, 52, 70, 0.8)';
      this.targetBtn.style.transform = 'scale(1)';
    });
    
    // Share button hover effect
    this.shareBtn.addEventListener('mouseenter', () => {
      this.shareBtn.style.background = 'rgba(59, 71, 96, 0.9)';
      this.shareBtn.style.transform = 'scale(1.1)';
    });
    
    this.shareBtn.addEventListener('mouseleave', () => {
      this.shareBtn.style.background = 'rgba(42, 52, 70, 0.8)';
      this.shareBtn.style.transform = 'scale(1)';
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.settingsBtn.contains(e.target as Node) && 
          !this.menuPanel.contains(e.target as Node)) {
        this.menuPanel.classList.add('hidden');
      }
    });
  }
  
  private appendElements(): void {
    this.container.appendChild(this.levelEl);
    this.container.appendChild(this.wordCountEl);
    this.container.appendChild(this.coinEl);
    this.container.appendChild(this.settingsBtn);
    this.container.appendChild(this.menuPanel);
    this.container.appendChild(this.shuffleBtn);
    this.container.appendChild(this.revealBtn);
    this.container.appendChild(this.targetBtn);
    this.container.appendChild(this.shareBtn);
    document.body.appendChild(this.container);
  }
  
  public updateLevel(level: number): void {
    this.levelEl.textContent = `LEVEL ${level}`;
  }
  
  public updateWordCount(found: number, total: number): void {
    const progressText = `${found} / ${total}`;
    if (found === total && total > 0) {
      this.wordCountEl.textContent = '⭐ ' + progressText;
      this.wordCountEl.style.color = 'var(--hw-accent-success)';
    } else {
      this.wordCountEl.textContent = progressText;
      this.wordCountEl.style.color = 'var(--hw-text-primary)';
    }
  }
  
  public onRestartLevel(callback: () => void): void {
    const restartBtn = this.menuPanel.querySelector('#restart-level');
    restartBtn?.addEventListener('click', () => {
      callback();
      this.menuPanel.classList.add('hidden');
    });
  }
  
  public onToggleMotion(callback: () => void): void {
    const motionToggle = this.menuPanel.querySelector('#in-game-motion-toggle') as HTMLInputElement;
    motionToggle?.addEventListener('change', () => {
      callback();
    });
  }
  
  public onShuffle(callback: () => void): void {
    this.shuffleBtn.addEventListener('click', () => {
      callback();
    });
  }
  
  public onReveal(callback: () => void): void {
    this.revealBtn.addEventListener('click', () => {
      callback();
    });
  }
  
  public onTargetHint(callback: () => void): void {
    this.targetBtn.addEventListener('click', () => {
      callback();
    });
  }
  
  public onShare(callback: () => void): void {
    this.shareBtn.addEventListener('click', () => {
      callback();
    });
  }
  
  public onHowToPlay(callback: () => void): void {
    const howToBtn = this.menuPanel.querySelector('#how-to-play');
    howToBtn?.addEventListener('click', () => {
      callback();
      this.menuPanel.classList.add('hidden');
    });
  }
  
  public onMainMenu(callback: () => void): void {
    const mainMenuBtn = this.menuPanel.querySelector('#main-menu');
    mainMenuBtn?.addEventListener('click', () => {
      callback();
      this.menuPanel.classList.add('hidden');
    });
  }
  
  public updateCoins(coins: number): void {
    const coinSpan = this.coinEl.querySelector('span:last-child');
    if (coinSpan) {
      // Format large numbers
      if (coins >= 1000000) {
        coinSpan.textContent = `${(coins / 1000000).toFixed(1)}M`;
      } else if (coins >= 1000) {
        coinSpan.textContent = `${(coins / 1000).toFixed(1)}K`;
      } else {
        coinSpan.textContent = coins.toString();
      }
    }
  }
  
  /**
   * Refresh all UI elements with latest data
   */
  public async refreshUI(): Promise<void> {
    // Import services dynamically to avoid circular dependencies
    const { CoinStorageService } = await import('../services/CoinStorageService');
    const { HintStorageService } = await import('../services/HintStorageService');
    
    // Reload coins
    const coinService = CoinStorageService.getInstance();
    const coinData = await coinService.loadCoins();
    this.updateCoins(coinData.balance);
    
    // Update hint buttons if needed
    const hintService = HintStorageService.getInstance();
    const hints = await hintService.loadHints();
    
    // Update hint button badges
    const revealBadge = this.revealBtn.querySelector('.hint-badge');
    const targetBadge = this.targetBtn.querySelector('.hint-badge');
    
    if (revealBadge) {
      revealBadge.textContent = hints.revealHints.toString();
    }
    if (targetBadge) {
      targetBadge.textContent = hints.targetHints.toString();
    }
  }
  
  public updateHintBadges(revealCount: number, targetCount: number): void {
    const revealBadge = document.getElementById('hw-reveal-badge');
    const targetBadge = document.getElementById('hw-target-badge');
    
    if (revealBadge) {
      if (revealCount > 0) {
        revealBadge.textContent = revealCount.toString();
        revealBadge.style.background = 'rgba(139, 92, 246, 0.9)';
      } else {
        revealBadge.textContent = '+';
        revealBadge.style.background = 'rgba(59, 71, 96, 0.8)';
      }
      revealBadge.style.display = 'block';
    }
    
    if (targetBadge) {
      if (targetCount > 0) {
        targetBadge.textContent = targetCount.toString();
        targetBadge.style.background = 'rgba(139, 92, 246, 0.9)';
      } else {
        targetBadge.textContent = '+';
        targetBadge.style.background = 'rgba(59, 71, 96, 0.8)';
      }
      targetBadge.style.display = 'block';
    }
  }
  
  public destroy(): void {
    this.container.remove();
  }
}
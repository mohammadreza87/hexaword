/**
 * HintPurchaseUI - Manages the hint purchase interface
 */

export interface PurchaseOptions {
  type: 'reveal' | 'target';
  icon: string;
  name: string;
  description: string;
  cost: number;
  currentBalance: number;
  onPurchase: (quantity: number) => Promise<boolean>;
  onClose?: () => void;
}

export class HintPurchaseUI {
  private overlay: HTMLElement | null = null;
  private panel: HTMLElement | null = null;
  private quantity: number = 1;
  private options: PurchaseOptions | null = null;
  
  /**
   * Shows the purchase panel
   */
  public show(options: PurchaseOptions): void {
    this.options = options;
    this.quantity = 1;
    this.createOverlay();
    this.createPanel();
    
    // Animate in
    requestAnimationFrame(() => {
      if (this.overlay) {
        this.overlay.style.opacity = '1';
      }
      if (this.panel) {
        this.panel.style.transform = 'translate(-50%, -50%) scale(1)';
        this.panel.style.opacity = '1';
      }
    });
  }
  
  /**
   * Creates the blur overlay
   */
  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'hint-purchase-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(20px);
      z-index: 2000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    
    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });
    
    document.body.appendChild(this.overlay);
  }
  
  /**
   * Creates the purchase panel
   */
  private createPanel(): void {
    if (!this.options) return;
    
    this.panel = document.createElement('div');
    this.panel.className = 'hint-purchase-panel';
    this.panel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.8);
      width: 320px;
      padding: 24px;
      background: rgba(26, 31, 43, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      z-index: 2001;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    
    this.updatePanelContent();
    
    if (this.overlay) {
      this.overlay.appendChild(this.panel);
    }
  }
  
  /**
   * Updates the panel content
   */
  private updatePanelContent(): void {
    if (!this.panel || !this.options) return;
    
    const totalCost = this.quantity * this.options.cost;
    const canAfford = this.options.currentBalance >= totalCost;
    
    this.panel.innerHTML = `
      <div style="text-align: center;">
        <!-- Icon -->
        <div style="font-size: 48px; margin-bottom: 16px;">
          ${this.options.icon}
        </div>
        
        <!-- Title -->
        <div style="color: var(--hw-text-primary); font-size: 20px; font-weight: 600; margin-bottom: 8px;">
          ${this.options.name}
        </div>
        
        <!-- Description -->
        <div style="color: var(--hw-text-secondary); font-size: 14px; margin-bottom: 24px; line-height: 1.5;">
          ${this.options.description}
        </div>
        
        <!-- Quantity Selector -->
        <div style="display: flex; align-items: center; justify-content: center; gap: 24px; margin-bottom: 24px;">
          <button id="hw-qty-minus" style="
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: rgba(59, 71, 96, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: var(--hw-text-primary);
            font-size: 20px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
          ">−</button>
          
          <div style="
            min-width: 60px;
            text-align: center;
            font-size: 28px;
            font-weight: 600;
            color: var(--hw-text-primary);
          ">${this.quantity}</div>
          
          <button id="hw-qty-plus" style="
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: rgba(59, 71, 96, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: var(--hw-text-primary);
            font-size: 20px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
          ">+</button>
        </div>
        
        <!-- Cost Display -->
        <div style="
          padding: 12px;
          background: rgba(42, 52, 70, 0.5);
          border-radius: 12px;
          margin-bottom: 20px;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--hw-text-secondary); font-size: 14px;">Cost:</span>
            <span style="color: var(--hw-text-primary); font-size: 18px; font-weight: 600;">
              🪙 ${totalCost.toLocaleString()}
            </span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
            <span style="color: var(--hw-text-secondary); font-size: 14px;">Balance:</span>
            <span style="color: ${canAfford ? 'var(--hw-text-primary)' : 'var(--hw-accent-error)'}; font-size: 16px;">
              🪙 ${this.options.currentBalance.toLocaleString()}
            </span>
          </div>
        </div>
        
        <!-- Purchase Button -->
        <button id="hw-purchase-btn" style="
          width: 100%;
          padding: 12px;
          background: ${canAfford ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'rgba(59, 71, 96, 0.3)'};
          border: 1px solid ${canAfford ? 'rgba(102, 126, 234, 0.5)' : 'rgba(255, 255, 255, 0.05)'};
          border-radius: 12px;
          color: ${canAfford ? '#fff' : 'var(--hw-text-disabled)'};
          font-size: 16px;
          font-weight: 600;
          cursor: ${canAfford ? 'pointer' : 'not-allowed'};
          transition: all 0.2s;
        " ${!canAfford ? 'disabled' : ''}>
          ${canAfford ? `Purchase ${this.quantity} ${this.quantity === 1 ? 'Hint' : 'Hints'}` : 'Insufficient Coins'}
        </button>
      </div>
    `;
    
    // Attach event listeners
    const minusBtn = this.panel.querySelector('#hw-qty-minus') as HTMLButtonElement;
    const plusBtn = this.panel.querySelector('#hw-qty-plus') as HTMLButtonElement;
    const purchaseBtn = this.panel.querySelector('#hw-purchase-btn') as HTMLButtonElement;
    
    if (minusBtn) {
      minusBtn.addEventListener('click', () => {
        if (this.quantity > 1) {
          this.quantity--;
          this.updatePanelContent();
        }
      });
      
      // Disable if at minimum
      if (this.quantity <= 1) {
        minusBtn.style.opacity = '0.3';
        minusBtn.style.cursor = 'not-allowed';
      }
    }
    
    if (plusBtn) {
      plusBtn.addEventListener('click', () => {
        if (this.quantity < 99) {
          this.quantity++;
          this.updatePanelContent();
        }
      });
      
      // Disable if at maximum
      if (this.quantity >= 99) {
        plusBtn.style.opacity = '0.3';
        plusBtn.style.cursor = 'not-allowed';
      }
    }
    
    if (purchaseBtn && canAfford) {
      purchaseBtn.addEventListener('click', () => this.handlePurchase());
    }
  }
  
  /**
   * Handles the purchase
   */
  private async handlePurchase(): Promise<void> {
    if (!this.options) return;
    
    const purchaseBtn = this.panel?.querySelector('#hw-purchase-btn') as HTMLButtonElement;
    if (purchaseBtn) {
      purchaseBtn.disabled = true;
      purchaseBtn.textContent = 'Processing...';
    }
    
    // Call the purchase handler
    const success = await this.options.onPurchase(this.quantity);
    
    if (success) {
      // Animate the hints flying to the button
      await this.animatePurchase();
      this.close();
    } else {
      // Show error
      if (purchaseBtn) {
        purchaseBtn.textContent = 'Purchase Failed';
        setTimeout(() => {
          this.updatePanelContent();
        }, 1500);
      }
    }
  }
  
  /**
   * Animates hints flying to the button
   */
  private async animatePurchase(): Promise<void> {
    if (!this.panel || !this.options) return;
    
    // Get target button position
    const targetId = this.options.type === 'reveal' ? 'hw-reveal-btn' : 'hw-target-btn';
    const targetBtn = document.getElementById(targetId);
    if (!targetBtn) return;
    
    const targetRect = targetBtn.getBoundingClientRect();
    const panelRect = this.panel.getBoundingClientRect();
    
    // Create flying icons
    for (let i = 0; i < Math.min(this.quantity, 3); i++) {
      setTimeout(() => {
        const flyingIcon = document.createElement('div');
        flyingIcon.style.cssText = `
          position: fixed;
          top: ${panelRect.top + panelRect.height / 2}px;
          left: ${panelRect.left + panelRect.width / 2}px;
          font-size: 24px;
          z-index: 2002;
          pointer-events: none;
          transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        `;
        flyingIcon.textContent = this.options!.icon;
        document.body.appendChild(flyingIcon);
        
        // Animate to target
        requestAnimationFrame(() => {
          flyingIcon.style.top = `${targetRect.top + targetRect.height / 2}px`;
          flyingIcon.style.left = `${targetRect.left + targetRect.width / 2}px`;
          flyingIcon.style.transform = 'scale(0.5)';
          flyingIcon.style.opacity = '0';
        });
        
        // Remove after animation
        setTimeout(() => flyingIcon.remove(), 800);
      }, i * 100);
    }
    
    // Wait for animation to complete
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  
  /**
   * Closes the purchase panel
   */
  public close(): void {
    if (this.panel) {
      this.panel.style.transform = 'translate(-50%, -50%) scale(0.8)';
      this.panel.style.opacity = '0';
    }
    
    if (this.overlay) {
      this.overlay.style.opacity = '0';
    }
    
    setTimeout(() => {
      this.overlay?.remove();
      this.panel?.remove();
      this.overlay = null;
      this.panel = null;
      
      if (this.options?.onClose) {
        this.options.onClose();
      }
    }, 300);
  }
}
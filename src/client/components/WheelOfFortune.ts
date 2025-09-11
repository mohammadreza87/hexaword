/**
 * WheelOfFortune - Daily rewards spinner
 */

export interface WheelPrize {
  id: string;
  type: 'coins' | 'hints' | 'bundle' | 'jackpot';
  name: string;
  icon: string;
  value: number;
  color: string;
  weight: number; // Probability weight
}

export interface WheelSpinResult {
  prize: WheelPrize;
  onClaim: () => Promise<void>;
}

import { DailyRewardService } from '../services/DailyRewardService';

export class WheelOfFortune {
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private currentRotation: number = 0;
  private isSpinning: boolean = false;
  private spinVelocity: number = 0;
  private targetRotation: number = 0;
  private startRotation: number = 0;
  private onSpinComplete: ((prize: WheelPrize, spinId?: string) => void) | null = null;
  private reservedSpinId: string | null = null;
  private reservedPrizeId: string | null = null;
  private tokens: number = 0;
  
  private readonly prizes: WheelPrize[] = [
    { id: 'coins_50', type: 'coins', name: '50', icon: '🪙', value: 50, color: '#FFD700', weight: 30 },
    { id: 'coins_100', type: 'coins', name: '100', icon: '🪙', value: 100, color: '#FFA500', weight: 25 },
    { id: 'hints_reveal_2', type: 'hints', name: 'x2', icon: '💡', value: 2, color: '#9B59B6', weight: 15 },
    { id: 'coins_250', type: 'coins', name: '250', icon: '🪙', value: 250, color: '#FF8C00', weight: 12 },
    { id: 'hints_target_2', type: 'hints', name: 'x2', icon: '🎯', value: 2, color: '#8E44AD', weight: 8 },
    { id: 'bundle_premium', type: 'bundle', name: 'x3+x2', icon: '💎', value: 1, color: '#3498DB', weight: 6 },
    { id: 'coins_500', type: 'coins', name: '500', icon: '💰', value: 500, color: '#FFD700', weight: 3 },
    { id: 'jackpot', type: 'jackpot', name: '1000', icon: '🎰', value: 1000, color: '#E74C3C', weight: 1 }
  ];
  
  // Canvas dimensions - we draw at 2x for quality
  private readonly canvasSize = 600;
  private readonly displaySize = 300;
  private readonly scale = 2; // 2x resolution
  
  private readonly wheelRadius = 240; // Actual drawing radius
  private readonly centerX = 300; // Center of 600x600 canvas
  private readonly centerY = 300;
  
  /**
   * Sets the number of tokens available
   */
  public setTokens(tokens: number): void {
    this.tokens = tokens;
  }
  
  /**
   * Shows the wheel of fortune
   */
  public async show(canSpin: boolean, lastClaimTime?: number): Promise<void> {
    this.createContainer();
    this.createWheel();
    this.drawWheel();
    
    if (!canSpin && lastClaimTime) {
      this.showCooldownTimer(lastClaimTime);
    }
    
    // Update spin button with token count
    const spinBtn = document.getElementById('wheel-spin-btn') as HTMLButtonElement;
    if (spinBtn) {
      if (this.tokens === 999) {
        // Test mode - unlimited spins
        spinBtn.innerHTML = `SPIN<br><span style="font-size: 10px">TEST</span>`;
      } else if (this.tokens > 0) {
        spinBtn.innerHTML = `SPIN<br><span style="font-size: 10px">${this.tokens} left</span>`;
      } else {
        spinBtn.disabled = true;
        spinBtn.style.opacity = '0.5';
        spinBtn.innerHTML = 'No Tokens';
      }
    }
    
    // Animate in
    requestAnimationFrame(() => {
      if (this.container) {
        this.container.style.opacity = '1';
      }
    });
  }
  
  /**
   * Creates the container and overlay
   */
  private createContainer(): void {
    // Create overlay
    this.container = document.createElement('div');
    this.container.id = 'wheel-of-fortune';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      backdrop-filter: blur(20px);
      z-index: 3000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    
    // Create content wrapper
    const content = document.createElement('div');
    content.style.cssText = `
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 40px 20px 20px 20px;
    `;
    
    // Title
    const title = document.createElement('div');
    title.style.cssText = `
      font-size: 24px;
      font-weight: 700;
      color: #fff;
      text-align: center;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      padding: 0 20px;
    `;
    title.textContent = 'Daily Reward';
    content.appendChild(title);
    
    // Subtitle
    const subtitle = document.createElement('div');
    subtitle.style.cssText = `
      font-size: 14px;
      color: rgba(255, 255, 255, 0.7);
      text-align: center;
      margin-top: -8px;
      padding: 0 20px;
    `;
    subtitle.textContent = 'Spin to win!';
    content.appendChild(subtitle);
    
    // Wheel container
    const wheelContainer = document.createElement('div');
    wheelContainer.style.cssText = `
      position: relative;
      width: 300px;
      height: 300px;
    `;
    
    // Canvas for wheel - set higher resolution for quality
    this.canvas = document.createElement('canvas');
    this.canvas.width = 600; // Double resolution for retina displays
    this.canvas.height = 600;
    this.canvas.style.cssText = `
      width: 300px;
      height: 300px;
    `;
    wheelContainer.appendChild(this.canvas);
    
    // Pointer
    const pointer = document.createElement('div');
    pointer.style.cssText = `
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 12px solid transparent;
      border-right: 12px solid transparent;
      border-top: 24px solid #fff;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
      z-index: 10;
    `;
    wheelContainer.appendChild(pointer);
    
    // Center button
    const centerBtn = document.createElement('button');
    centerBtn.id = 'wheel-spin-btn';
    centerBtn.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: 3px solid #fff;
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      z-index: 10;
    `;
    centerBtn.textContent = 'SPIN';
    centerBtn.addEventListener('click', () => this.spin());
    wheelContainer.appendChild(centerBtn);
    
    content.appendChild(wheelContainer);
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #fff;
      font-size: 20px;
      cursor: pointer;
      transition: all 0.2s;
    `;
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.close());
    this.container.appendChild(closeBtn);
    
    this.container.appendChild(content);
    document.body.appendChild(this.container);
    
    this.ctx = this.canvas.getContext('2d');
  }
  
  /**
   * Creates and initializes the wheel
   */
  private createWheel(): void {
    // Initialize with random rotation
    this.currentRotation = Math.random() * Math.PI * 2;
  }
  
  /**
   * Draws the wheel
   */
  private drawWheel(): void {
    if (!this.ctx || !this.canvas) return;
    
    const ctx = this.ctx;
    const centerX = this.centerX;
    const centerY = this.centerY;
    const radius = this.wheelRadius;
    
    // Clear canvas
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
    
    // Calculate slice angle
    const sliceAngle = (Math.PI * 2) / this.prizes.length;
    
    // Draw slices
    this.prizes.forEach((prize, index) => {
      const startAngle = index * sliceAngle + this.currentRotation;
      const endAngle = startAngle + sliceAngle;
      
      // Draw slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      
      // Gradient fill
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, prize.color + 'FF');
      gradient.addColorStop(1, prize.color + 'CC');
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Draw border
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw text and icon
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + sliceAngle / 2);
      
      // Icon - larger for better quality
      ctx.font = '40px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(prize.icon, radius * 0.55, -10);
      
      // Text (number/multiplier) - larger for better quality
      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(prize.name, radius * 0.55, 24);
      
      ctx.restore();
    });
    
    // Draw center circle border - doubled for quality
    ctx.beginPath();
    ctx.arc(centerX, centerY, 64, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 6;
    ctx.stroke();
  }
  
  /**
   * Spins the wheel
   */
  private async spin(): Promise<void> {
    if (this.isSpinning) return;
    
    // Only check tokens if not in test mode (999 = test mode)
    if (this.tokens !== 999 && this.tokens <= 0) return; // No tokens, can't spin
    
    // Do not eagerly consume token on client; server decrements on claim
    
    const spinBtn = document.getElementById('wheel-spin-btn') as HTMLButtonElement;
    if (spinBtn) {
      spinBtn.disabled = true;
      spinBtn.style.opacity = '0.5';
    }
    
    this.isSpinning = true;

    // Try to reserve a server-authoritative prize
    try {
      const svc = DailyRewardService.getInstance();
      const spin = await svc.startSpin();
      this.reservedSpinId = spin.spinId;
      this.reservedPrizeId = spin.prizeId;
    } catch (e) {
      // Fallback to client side
      this.reservedSpinId = null;
      this.reservedPrizeId = null;
    }

    // Select prize (prefer server-provided)
    const prize = this.reservedPrizeId
      ? (this.prizes.find(p => p.id === this.reservedPrizeId!) || this.selectPrize())
      : this.selectPrize();
    const prizeIndex = this.prizes.indexOf(prize);
    
    // Calculate target rotation
    const sliceAngle = (Math.PI * 2) / this.prizes.length;
    const spins = 10 + Math.random() * 5; // 10-15 full rotations
    
    // Store starting position and normalize it
    this.startRotation = this.currentRotation % (Math.PI * 2);
    if (this.startRotation < 0) this.startRotation += Math.PI * 2;
    
    // The pointer is at the TOP (12 o'clock position = 270 degrees = 3π/2 radians)
    // When we draw, slice at index i starts at angle: i * sliceAngle + currentRotation
    // The center of slice i is at: i * sliceAngle + currentRotation + sliceAngle/2
    // 
    // We want the CENTER of our target slice to be at the TOP (270°)
    // So when currentRotation = targetRotation:
    // prizeIndex * sliceAngle + targetRotation + sliceAngle/2 ≡ 3π/2 (mod 2π)
    // Therefore: targetRotation = 3π/2 - prizeIndex * sliceAngle - sliceAngle/2
    
    // Calculate the angle where the wheel needs to stop
    const pointerAngle = 3 * Math.PI / 2; // 270 degrees (top position)
    
    // This is the rotation value where our prize will be at the top
    let targetAngleForPrize = pointerAngle - (prizeIndex * sliceAngle) - (sliceAngle / 2);
    
    // Normalize target angle to 0-2π range
    while (targetAngleForPrize < 0) targetAngleForPrize += Math.PI * 2;
    while (targetAngleForPrize >= Math.PI * 2) targetAngleForPrize -= Math.PI * 2;
    
    // Calculate rotation needed (always forward)
    let rotationNeeded = targetAngleForPrize - this.startRotation;
    if (rotationNeeded <= 0) {
      rotationNeeded += Math.PI * 2;
    }
    
    // Add the extra spins - the total rotation from start
    this.targetRotation = this.startRotation + rotationNeeded + (spins * Math.PI * 2);
    
    // Start animation
    this.animateSpin(prize);
  }
  
  /**
   * Selects a prize based on weights
   */
  private selectPrize(): WheelPrize {
    const totalWeight = this.prizes.reduce((sum, prize) => sum + prize.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const prize of this.prizes) {
      random -= prize.weight;
      if (random <= 0) {
        return prize;
      }
    }
    
    return this.prizes[0]; // Fallback
  }
  
  /**
   * Animates the wheel spin
   */
  private animateSpin(prize: WheelPrize, startTime?: number): void {
    if (!this.isSpinning) return;
    
    // Initialize start time
    if (!startTime) {
      startTime = Date.now();
    }
    
    // Calculate elapsed time
    const elapsed = Date.now() - startTime;
    const duration = 5000; // 5 seconds total spin time (nice and long!)
    
    if (elapsed >= duration) {
      // Spin complete - snap to final position and normalize
      this.isSpinning = false;
      this.currentRotation = this.targetRotation % (Math.PI * 2);
      if (this.currentRotation < 0) this.currentRotation += Math.PI * 2;
      this.drawWheel();

      // Determine which slice contains the top pointer angle
      const sliceAngle = (Math.PI * 2) / this.prizes.length;
      const topAngle = 3 * Math.PI / 2; // Top position (270 degrees)

      const angleDiff = (a: number, b: number) => {
        let d = a - b;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d <= -Math.PI) d += Math.PI * 2;
        return d;
      };

      let actualPrizeIndex = -1;
      // Prefer containment by arc; fallback to closest center for safety
      for (let i = 0; i < this.prizes.length; i++) {
        const start = (i * sliceAngle + this.currentRotation);
        const center = (start + sliceAngle / 2) % (Math.PI * 2);
        const half = sliceAngle / 2;
        const diff = Math.abs(angleDiff(topAngle, center));
        if (diff <= half + 1e-6) {
          actualPrizeIndex = i;
          break;
        }
      }
      if (actualPrizeIndex < 0) {
        // Fallback: closest center
        let min = Math.PI * 2;
        for (let i = 0; i < this.prizes.length; i++) {
          const start = (i * sliceAngle + this.currentRotation);
          const center = (start + sliceAngle / 2) % (Math.PI * 2);
          const diff = Math.abs(angleDiff(topAngle, center));
          if (diff < min) { min = diff; actualPrizeIndex = i; }
        }
      }

      const visualPrize = this.prizes[Math.max(0, actualPrizeIndex)];
      if (actualPrizeIndex !== this.prizes.indexOf(prize)) {
        console.warn('Spinner mismatch detected. Granting visual prize instead.');
      }
      // Show prize popup; actual granting happens on Claim
      this.showPrize(visualPrize);
      return;
    }
    
    // Calculate progress (0 to 1)
    const progress = elapsed / duration;
    
    // Use a custom easing function for realistic wheel spin
    // Starts very fast, maintains speed, then gradually slows down
    let easeValue;
    if (progress < 0.5) {
      // First half: maintain high speed with slight deceleration
      easeValue = progress * 2 * 0.9 + 0.1;
    } else {
      // Second half: stronger deceleration (cubic ease-out)
      const p = (progress - 0.5) * 2;
      easeValue = 1 - Math.pow(1 - p, 4) * 0.5;
    }
    
    // Calculate current rotation based on total distance
    const totalDistance = this.targetRotation - this.startRotation;
    this.currentRotation = this.startRotation + totalDistance * easeValue;
    
    // Redraw
    this.drawWheel();
    
    // Continue animation
    requestAnimationFrame(() => this.animateSpin(prize, startTime));
  }
  
  /**
   * Shows the prize won
   */
  private showPrize(prize: WheelPrize): void {
    // Create prize display
    const prizeDisplay = document.createElement('div');
    prizeDisplay.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 24px;
      border-radius: 16px;
      text-align: center;
      z-index: 3001;
      animation: prizePopup 0.5s ease forwards;
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
      min-width: 200px;
    `;
    
    // Format display text based on prize type
    let displayText = prize.name;
    if (prize.type === 'coins' || prize.type === 'jackpot') {
      displayText = `${prize.value} Coins`;
    } else if (prize.type === 'hints') {
      displayText = `${prize.value} ${prize.id.includes('target') ? 'Target Hint' : 'Reveal Hints'}`;
    } else if (prize.type === 'bundle') {
      displayText = 'x2 💡 + x2 🎯';
    }
    
    prizeDisplay.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 12px;">${prize.icon}</div>
      <div style="font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 6px;">You Won!</div>
      <div style="font-size: 16px; color: rgba(255, 255, 255, 0.9); margin-bottom: 20px;">${displayText}</div>
      <button id="claim-prize-btn" style="
        padding: 10px 24px;
        background: #fff;
        color: #764ba2;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
      ">Claim</button>
    `;
    
    document.body.appendChild(prizeDisplay);
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes prizePopup {
        0% { transform: translate(-50%, -50%) scale(0); }
        50% { transform: translate(-50%, -50%) scale(1.1); }
        100% { transform: translate(-50%, -50%) scale(1); }
      }
    `;
    document.head.appendChild(style);
    
    // Handle claim
    const claimBtn = document.getElementById('claim-prize-btn') as HTMLButtonElement | null;
    let claimed = false;
    claimBtn?.addEventListener('click', async () => {
      if (claimed) return;
      claimed = true;
      if (claimBtn) {
        claimBtn.disabled = true;
        claimBtn.style.opacity = '0.6';
      }
      await this.claimPrize(prize);
      prizeDisplay.remove();
      style.remove();
      this.close();
    });
  }
  
  /**
   * Claims the prize
   */
  private async claimPrize(prize: WheelPrize): Promise<void> {
    // This will be handled by the parent component
    if (this.onSpinComplete) {
      this.onSpinComplete(prize, this.reservedSpinId || undefined);
    }
  }
  
  /**
   * Shows cooldown timer
   */
  private showCooldownTimer(lastClaimTime: number): void {
    const nextClaimTime = lastClaimTime + (24 * 60 * 60 * 1000); // 24 hours
    const now = Date.now();
    const timeLeft = nextClaimTime - now;
    
    if (timeLeft <= 0) return;
    
    const hours = Math.floor(timeLeft / (60 * 60 * 1000));
    const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
    
    // Disable spin button
    const spinBtn = document.getElementById('wheel-spin-btn') as HTMLButtonElement;
    if (spinBtn) {
      spinBtn.disabled = true;
      spinBtn.style.opacity = '0.5';
      spinBtn.style.fontSize = '10px';
      spinBtn.innerHTML = `${hours}h ${minutes}m`;
    }
  }
  
  /**
   * Sets the spin complete callback
   */
  public onComplete(callback: (prize: WheelPrize, spinId?: string) => void): void {
    this.onSpinComplete = callback;
  }
  
  /**
   * Closes the wheel
   */
  public close(): void {
    if (this.container) {
      this.container.style.opacity = '0';
      setTimeout(() => {
        this.container?.remove();
        this.container = null;
      }, 300);
    }
  }
}

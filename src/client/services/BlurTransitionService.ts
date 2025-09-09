/**
 * Service for managing progressive blur transitions between screens
 */
export class BlurTransitionService {
  private static instance: BlurTransitionService;
  private currentBlurLevel: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' = 'none';
  private transitionQueue: Array<() => Promise<void>> = [];
  private isTransitioning = false;
  
  private constructor() {}
  
  static getInstance(): BlurTransitionService {
    if (!BlurTransitionService.instance) {
      BlurTransitionService.instance = new BlurTransitionService();
    }
    return BlurTransitionService.instance;
  }
  
  /**
   * Transition with progressive blur effect
   */
  async transitionWithBlur<T>(
    action: () => Promise<T> | T,
    options: {
      targetElement?: string;
      blurIntensity?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
      inDuration?: number;
      outDuration?: number;
      additionalElements?: string[];
    } = {}
  ): Promise<T> {
    const {
      targetElement = 'hex-grid-container',
      blurIntensity = 'lg',
      inDuration = 180,
      outDuration = 220,
      additionalElements = []
    } = options;
    
    return new Promise((resolve, reject) => {
      this.transitionQueue.push(async () => {
        try {
          // Blur in
          await this.animateBlur(targetElement, blurIntensity, inDuration);
          
          // Also blur additional elements if specified
          for (const elementId of additionalElements) {
            this.setBlur(elementId, blurIntensity);
          }
          
          // Execute the action
          const result = await action();
          
          // Blur out
          await this.animateBlur(targetElement, 'none', outDuration);
          
          // Clear blur from additional elements
          for (const elementId of additionalElements) {
            this.setBlur(elementId, 'none');
          }
          
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }
  
  /**
   * Apply multi-layer blur for depth effect
   */
  applyLayeredBlur(layers: Array<{
    elementId: string;
    level: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    delay?: number;
  }>): void {
    layers.forEach(({ elementId, level, delay = 0 }) => {
      setTimeout(() => {
        this.setBlur(elementId, level);
      }, delay);
    });
  }
  
  /**
   * Create a focus effect by blurring everything except the target
   */
  async focusOn(
    targetElementId: string,
    options: {
      blurLevel?: 'sm' | 'md' | 'lg';
      excludeElements?: string[];
      duration?: number;
    } = {}
  ): Promise<void> {
    const {
      blurLevel = 'md',
      excludeElements = [],
      duration = 300
    } = options;
    
    const allElements = document.querySelectorAll('.blurable, #hex-grid-container, .modal-content');
    const exclude = new Set([targetElementId, ...excludeElements]);
    
    const promises: Promise<void>[] = [];
    
    allElements.forEach((el) => {
      if (el.id && !exclude.has(el.id)) {
        promises.push(this.animateBlur(el.id, blurLevel, duration));
      }
    });
    
    await Promise.all(promises);
  }
  
  /**
   * Clear all focus effects
   */
  async clearFocus(duration = 300): Promise<void> {
    const blurredElements = document.querySelectorAll('[class*="hw-cblur-"]');
    const promises: Promise<void>[] = [];
    
    blurredElements.forEach((el) => {
      if (el.id) {
        promises.push(this.animateBlur(el.id, 'none', duration));
      }
    });
    
    await Promise.all(promises);
  }
  
  /**
   * Animate blur with promise resolution
   */
  private animateBlur(
    elementId: string,
    level: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl',
    duration: number
  ): Promise<void> {
    const el = document.getElementById(elementId);
    if (!el) return Promise.resolve();
    
    return new Promise((resolve) => {
      let resolved = false;
      
      const onTransitionEnd = (e: TransitionEvent) => {
        if (e.propertyName === 'filter' && e.target === el) {
          el.removeEventListener('transitionend', onTransitionEnd);
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }
      };
      
      el.addEventListener('transitionend', onTransitionEnd);
      this.setBlur(elementId, level);
      
      // Fallback timeout
      setTimeout(() => {
        if (!resolved) {
          el.removeEventListener('transitionend', onTransitionEnd);
          resolved = true;
          resolve();
        }
      }, duration + 50);
    });
  }
  
  /**
   * Set blur level on element
   */
  private setBlur(
    elementId: string,
    level: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  ): void {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    // Remove existing blur classes
    el.classList.remove(
      'hw-cblur-none', 'hw-cblur-sm', 'hw-cblur-md',
      'hw-cblur-lg', 'hw-cblur-xl', 'hw-cblur-2xl'
    );
    
    // Add new blur class
    el.classList.add(`hw-cblur-${level}`, 'hw-cblur-progressive');
  }
  
  /**
   * Process transition queue
   */
  private async processQueue(): Promise<void> {
    if (this.isTransitioning || this.transitionQueue.length === 0) return;
    
    this.isTransitioning = true;
    
    while (this.transitionQueue.length > 0) {
      const transition = this.transitionQueue.shift();
      if (transition) {
        await transition();
      }
    }
    
    this.isTransitioning = false;
  }
  
  /**
   * Create parallax blur effect on scroll
   */
  enableParallaxBlur(options: {
    containerId: string;
    layers: Array<{
      selector: string;
      maxBlur: 'sm' | 'md' | 'lg';
      speed: number;
    }>;
  }): () => void {
    const container = document.getElementById(options.containerId);
    if (!container) return () => {};
    
    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const maxScroll = container.scrollHeight - container.clientHeight;
      const scrollPercent = maxScroll > 0 ? scrollTop / maxScroll : 0;
      
      options.layers.forEach(({ selector, maxBlur, speed }) => {
        const elements = container.querySelectorAll(selector);
        elements.forEach((el) => {
          const blurAmount = scrollPercent * speed;
          const blurValue = this.calculateBlurValue(blurAmount, maxBlur);
          (el as HTMLElement).style.filter = `blur(${blurValue}px)`;
        });
      });
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    // Return cleanup function
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }
  
  /**
   * Calculate blur value based on level
   */
  private calculateBlurValue(
    amount: number,
    maxLevel: 'sm' | 'md' | 'lg'
  ): number {
    const maxValues = {
      sm: 4,
      md: 8,
      lg: 12
    };
    
    return Math.min(amount, maxValues[maxLevel]);
  }
  
  /**
   * Create a ripple blur effect from a point
   */
  async rippleBlur(options: {
    originX: number;
    originY: number;
    maxRadius?: number;
    duration?: number;
    blurIntensity?: 'sm' | 'md' | 'lg';
  }): Promise<void> {
    const {
      originX,
      originY,
      maxRadius = 500,
      duration = 600,
      blurIntensity = 'md'
    } = options;
    
    const ripple = document.createElement('div');
    ripple.className = 'blur-ripple';
    ripple.style.cssText = `
      position: fixed;
      left: ${originX}px;
      top: ${originY}px;
      width: 0;
      height: 0;
      border-radius: 50%;
      backdrop-filter: blur(0);
      pointer-events: none;
      z-index: 9999;
      transform: translate(-50%, -50%);
      transition: all ${duration}ms cubic-bezier(0.4, 0, 0.2, 1);
    `;
    
    document.body.appendChild(ripple);
    
    // Force reflow
    ripple.offsetHeight;
    
    // Animate
    ripple.style.width = `${maxRadius * 2}px`;
    ripple.style.height = `${maxRadius * 2}px`;
    ripple.style.backdropFilter = `blur(var(--hw-blur-${blurIntensity}))`;
    ripple.style.opacity = '0';
    
    return new Promise((resolve) => {
      setTimeout(() => {
        ripple.remove();
        resolve();
      }, duration);
    });
  }
}

export const blurTransition = BlurTransitionService.getInstance();
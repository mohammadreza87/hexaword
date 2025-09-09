/**
 * UI utility functions using Tailwind classes
 */

import { blurTransition } from '../services/BlurTransitionService';

export function createGlassPanel(content: string, className?: string): HTMLDivElement {
  const panel = document.createElement('div');
  panel.className = `panel-glass ${className || ''}`;
  panel.innerHTML = content;
  return panel;
}

export function createButton(text: string, variant: 'primary' | 'secondary' | 'glass' = 'glass'): HTMLButtonElement {
  const button = document.createElement('button');
  button.textContent = text;
  
  switch (variant) {
    case 'primary':
      button.className = 'btn-glass-primary';
      break;
    case 'secondary':
      button.className = 'btn-glass opacity-80';
      break;
    default:
      button.className = 'btn-glass';
  }
  
  return button;
}

export function createModal(content: string, onClose?: () => void): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = `modal-${Date.now()}`;
  
  const modal = document.createElement('div');
  modal.className = 'modal-content';
  modal.id = `modal-content-${Date.now()}`;
  modal.innerHTML = content;
  
  overlay.appendChild(modal);
  
  // Apply focus effect when modal opens
  requestAnimationFrame(() => {
    blurTransition.focusOn(overlay.id, {
      blurLevel: 'md',
      excludeElements: [modal.id],
      duration: 300
    });
  });
  
  if (onClose) {
    overlay.addEventListener('click', async (e) => {
      if (e.target === overlay) {
        await blurTransition.clearFocus(200);
        onClose();
        overlay.remove();
      }
    });
  }
  
  return overlay;
}

export function createToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', duration = 3000): void {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  // Add subtle blur animation on appearance
  toast.style.backdropFilter = 'blur(8px)';
  toast.style.webkitBackdropFilter = 'blur(8px)';
  toast.style.transition = 'all 0.3s ease-out';
  toast.style.transform = 'translateX(-50%) translateY(20px)';
  toast.style.opacity = '0';
  
  document.body.appendChild(toast);
  
  // Animate in
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(-50%) translateY(0)';
    toast.style.opacity = '1';
  });
  
  // Auto-remove after duration
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(20px)';
    toast.style.opacity = '0';
    toast.style.backdropFilter = 'blur(0px)';
    toast.style.webkitBackdropFilter = 'blur(0px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export function createHUDPanel(content: string): HTMLDivElement {
  const panel = document.createElement('div');
  panel.className = 'hud-panel';
  panel.innerHTML = content;
  return panel;
}

export function applyProgressiveBlur(element: HTMLElement, level: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' = 'md'): void {
  // Remove existing blur classes
  element.classList.remove('hw-blur-none', 'hw-blur-sm', 'hw-blur-md', 'hw-blur-lg', 'hw-blur-xl', 'hw-blur-2xl');
  
  // Add new blur class
  element.classList.add(`hw-blur-${level}`, 'hw-blur-progressive');
}

/**
 * Applies/removes content blur to an element (blurs its contents), progressively.
 */
export function setContentBlur(element: HTMLElement, level: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' = 'md'): void {
  element.classList.remove('hw-cblur-none', 'hw-cblur-sm', 'hw-cblur-md', 'hw-cblur-lg', 'hw-cblur-xl', 'hw-cblur-2xl');
  element.classList.add(`hw-cblur-${level}`, 'hw-cblur-progressive');
}

/**
 * Convenience to blur/unblur the main game container.
 */
export function blurGameContainer(level: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' = 'lg'): void {
  const el = document.getElementById('hex-grid-container');
  if (!el) return;
  setContentBlur(el, level);
}

/**
 * Animate blur on the game container and resolve when the CSS transition ends.
 * Falls back to a timeout if the transitionend event doesn't fire.
 * Enhanced with progressive blur stages for smoother transitions.
 */
export function animateGameBlur(
  level: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl',
  fallbackMs: number = 360
): Promise<void> {
  const el = document.getElementById('hex-grid-container');
  if (!el) return Promise.resolve();
  return new Promise((resolve) => {
    let resolved = false;
    const onEnd = (e: Event) => {
      const ev = e as TransitionEvent;
      if (ev.propertyName === 'filter') {
        el.removeEventListener('transitionend', onEnd);
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }
    };
    el.addEventListener('transitionend', onEnd);
    // Add smooth transition class if not present
    if (!el.classList.contains('hw-cblur-progressive')) {
      el.classList.add('hw-cblur-progressive');
    }
    // Kick off transition
    setContentBlur(el, level);
    // Safety timeout
    window.setTimeout(() => {
      if (!resolved) {
        el.removeEventListener('transitionend', onEnd);
        resolved = true;
        resolve();
      }
    }, fallbackMs);
  });
}

/**
 * Create a blur transition between two elements
 */
export async function crossfadeBlur(
  fromElementId: string,
  toElementId: string,
  duration: number = 400
): Promise<void> {
  const fromEl = document.getElementById(fromElementId);
  const toEl = document.getElementById(toElementId);
  
  if (!fromEl || !toEl) return;
  
  // Start with toEl hidden and unblurred
  toEl.style.opacity = '0';
  toEl.style.display = 'block';
  setContentBlur(toEl, 'xl');
  
  // Blur out fromEl
  setContentBlur(fromEl, 'xl');
  fromEl.style.opacity = '0';
  
  // Wait for blur
  await new Promise(resolve => setTimeout(resolve, duration / 2));
  
  // Hide fromEl, show toEl
  fromEl.style.display = 'none';
  toEl.style.opacity = '1';
  
  // Unblur toEl
  setContentBlur(toEl, 'none');
  
  // Reset fromEl for next time
  await new Promise(resolve => setTimeout(resolve, duration / 2));
  fromEl.style.opacity = '1';
  setContentBlur(fromEl, 'none');
}

/**
 * Apply a pulsing blur effect for emphasis
 */
export function pulseBlur(
  elementId: string,
  options: {
    minBlur?: 'none' | 'sm';
    maxBlur?: 'md' | 'lg';
    duration?: number;
    iterations?: number;
  } = {}
): void {
  const {
    minBlur = 'none',
    maxBlur = 'md',
    duration = 1000,
    iterations = 2
  } = options;
  
  const el = document.getElementById(elementId);
  if (!el) return;
  
  let count = 0;
  const pulse = () => {
    if (count >= iterations * 2) {
      setContentBlur(el, 'none');
      return;
    }
    
    const blur = count % 2 === 0 ? maxBlur : minBlur;
    setContentBlur(el, blur);
    count++;
    setTimeout(pulse, duration / (iterations * 2));
  };
  
  pulse();
}

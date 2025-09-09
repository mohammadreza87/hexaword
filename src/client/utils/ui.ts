/**
 * UI utility functions using Tailwind classes
 */

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
  
  const modal = document.createElement('div');
  modal.className = 'modal-content';
  modal.innerHTML = content;
  
  overlay.appendChild(modal);
  
  if (onClose) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
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
  
  document.body.appendChild(toast);
  
  // Auto-remove after duration
  setTimeout(() => {
    toast.classList.add('animate-fade-out');
    setTimeout(() => toast.remove(), 500);
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
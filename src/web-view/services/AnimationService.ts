import { gsap } from 'gsap';
import { getPaletteForLevel } from '../config/ColorPalettes';

/**
 * Service to handle all game animations using GSAP
 */
export class AnimationService {
  private static instance: AnimationService;
  private timeScale = 1;
  
  private constructor() {
    // Configure GSAP defaults
    gsap.defaults({
      ease: 'power2.out',
      duration: 0.3
    });

    // Respect persisted Reduce Motion preference
    const reduced = localStorage.getItem('hexaword_reduce_motion') === 'true';
    this.setReducedMotion(reduced);
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): AnimationService {
    if (!AnimationService.instance) {
      AnimationService.instance = new AnimationService();
    }
    return AnimationService.instance;
  }
  
  /**
   * Get current palette colors from window
   */
  private getCurrentColors(): any {
    const fallback = {
      accent: '#00d9ff',
      solved: '#00ff00',
      solvedColor: '#00ff00',
      text: '#FFFFFF'
    } as any;
    const cur = (window as any).__currentColors;
    if (cur) return cur;
    // Secondary fallback: read from CSS variables injected by palette service
    try {
      const root = getComputedStyle(document.documentElement);
      const accent = root.getPropertyValue('--hw-accent-primary')?.trim() || fallback.accent;
      const solvedColor = root.getPropertyValue('--hw-cell-solved')?.trim() || fallback.solvedColor;
      const text = root.getPropertyValue('--hw-text')?.trim() || fallback.text;
      return { accent, solvedColor, text };
    } catch {
      return fallback;
    }
  }

  /**
   * Enable/disable reduced motion by adjusting global timescale.
   */
  setReducedMotion(enabled: boolean): void {
    this.timeScale = enabled ? 0.6 : 1.0;
    gsap.globalTimeline.timeScale(this.timeScale);
    localStorage.setItem('hexaword_reduce_motion', String(enabled));
  }
  getReducedMotion(): boolean {
    return this.timeScale < 1;
  }
  
  /**
   * Animate a successful word match
   */
  animateWordFound(cells: Array<{q: number, r: number}>, onComplete?: () => void): void {
    // Validate cells array
    if (!cells || !Array.isArray(cells) || cells.length === 0) {
      console.warn('Invalid cells array for animateWordFound');
      onComplete?.();
      return;
    }
    
    // Create a timeline for the word reveal animation
    const tl = gsap.timeline({
      onComplete: onComplete
    });
    
    // Animate each cell with a stagger effect
    cells.forEach((cell, index) => {
      if (!cell || typeof cell.q !== 'number' || typeof cell.r !== 'number') {
        console.warn('Invalid cell in animateWordFound:', cell);
        return;
      }
      
      const cellKey = `${cell.q},${cell.r}`;
      const cellElement = { 
        scale: 0, 
        rotation: 0,
        opacity: 0 
      };
      
      // Store animation state for render interpolation
      (window as any).__cellAnimations = (window as any).__cellAnimations || {};
      (window as any).__cellAnimations[cellKey] = cellElement;
      
      tl.to(cellElement, {
        scale: 1,
        rotation: 360,
        opacity: 1,
        duration: 0.5,
        ease: 'back.out(1.7)',
        onUpdate: () => {
          // Trigger re-render
          (window as any).__requestRender?.();
        }
      }, index * 0.05); // Stagger each cell by 50ms
    });
    
    return;
  }
  
  /**
   * Animate input hex click
   */
  animateInputHexClick(q: number, r: number, isCorrect: boolean = true): void {
    const hexKey = `input_${q},${r}`;
    const hexElement = { scale: 1, glow: 0 };
    
    // Store animation state
    (window as any).__inputAnimations = (window as any).__inputAnimations || {};
    (window as any).__inputAnimations[hexKey] = hexElement;
    
    // Click feedback animation
    gsap.to(hexElement, {
      scale: 0.9,
      duration: 0.1,
      yoyo: true,
      repeat: 1,
      ease: 'power1.inOut',
      onUpdate: () => {
        (window as any).__requestRender?.();
      }
    });
    
    // Glow effect for feedback
    if (isCorrect) {
      gsap.to(hexElement, {
        glow: 1,
        duration: 0.3,
        onComplete: () => {
          gsap.to(hexElement, {
            glow: 0,
            duration: 0.2
          });
        }
      });
    }
  }
  
  /**
   * Animate typed word display
   */
  animateTypedWord(word: string): void {
    const wordElement = { 
      scale: 1,
      opacity: 1 
    };
    
    (window as any).__typedWordAnimation = wordElement;
    
    // Bounce in effect
    gsap.from(wordElement, {
      scale: 0.8,
      opacity: 0,
      duration: 0.2,
      ease: 'back.out(2)',
      onUpdate: () => {
        (window as any).__requestRender?.();
      }
    });
  }

  /**
   * Level intro: wave-pop all cells (scale/opacity) in a staggered order.
   * Expects caller to render per-frame using getCellAnimationState.
   */
  animateLevelWave(
    cellKeys: string[],
    opts?: { delayStep?: number; duration?: number },
    onComplete?: () => void
  ): void {
    const delayStep = opts?.delayStep ?? 0.05;
    const dur = opts?.duration ?? 0.3;

    (window as any).__cellAnimations = (window as any).__cellAnimations || {};
    if (delayStep === 0) {
      // Pop all together smoothly
      const states = cellKeys.map((key) => {
        const s = { scale: 0, opacity: 0, rotation: 0 };
        (window as any).__cellAnimations[key] = s;
        return s;
      });
      gsap.to(states, {
        scale: 1,
        opacity: 1,
        duration: dur,
        ease: 'back.out(1.5)',
        onUpdate: () => (window as any).__requestRender?.(),
        onComplete,
      });
    } else {
      const tl = gsap.timeline({ onComplete });
      cellKeys.forEach((key, i) => {
        const state = { scale: 0, opacity: 0, rotation: 0 };
        (window as any).__cellAnimations[key] = state;
        tl.to(state, {
          scale: 1,
          opacity: 1,
          duration: dur,
          ease: 'back.out(1.5)',
          onUpdate: () => (window as any).__requestRender?.(),
        }, i * delayStep);
      });
    }
  }

  /**
   * Wave-pop for input grid cells (keys must be like `input_q,r`).
   */
  animateInputGridWave(
    inputKeys: string[],
    opts?: { delayStep?: number; duration?: number },
    onComplete?: () => void
  ): void {
    const delayStep = opts?.delayStep ?? 0.04;
    const dur = opts?.duration ?? 0.22;

    (window as any).__inputAnimations = (window as any).__inputAnimations || {};
    if (delayStep === 0) {
      const states = inputKeys.map((key) => {
        const s = { scale: 0 };
        (window as any).__inputAnimations[key] = s;
        return s;
      });
      gsap.to(states, {
        scale: 1,
        duration: dur,
        ease: 'back.out(1.4)',
        onUpdate: () => (window as any).__requestRender?.(),
        onComplete,
      });
    } else {
      const tl = gsap.timeline({ onComplete });
      inputKeys.forEach((key, i) => {
        const state = { scale: 0 };
        (window as any).__inputAnimations[key] = state;
        tl.to(state, {
          scale: 1,
          duration: dur,
          ease: 'back.out(1.4)',
          onUpdate: () => (window as any).__requestRender?.(),
        }, i * delayStep);
      });
    }
  }

  /**
   * Level intro: show blur overlay and center clue, then move clue to its target and fade blur.
   * target should be in viewport/screen coordinates (absolute pixels).
   */
  animateClueOverlay(
    clueText: string,
    targetScreen: { x: number; y: number },
    options?: { fontSizePx?: number; overlayWidthPx?: number; holdMs?: number; level?: number },
    onComplete?: () => void
  ): Promise<void> {
    // Create overlay elements
    const existing = document.getElementById('level-intro-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'level-intro-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(0px); background: rgba(0,0,0,0);
      pointer-events: none; z-index: 9999; opacity: 0;
    `;
    // Get theme colors for gradient
    const level = options?.level ?? 1;
    const palette = getPaletteForLevel(level);
    const accentColor = palette.colors[0];
    const secondaryColor = palette.colors[1];
    
    const clue = document.createElement('div');
    clue.textContent = (clueText || '').toUpperCase();
    clue.style.cssText = `
      position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
      font-family: 'Inter', Arial, sans-serif; font-weight: 900;
      text-align: center; line-height: 1.1;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
      opacity: 0;
      background: linear-gradient(90deg, ${accentColor}, ${secondaryColor}, ${accentColor});
      background-size: 200% 100%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: gradientShift 3s ease infinite;
      filter: 
        drop-shadow(0 0 20px ${accentColor}33)
        drop-shadow(0 0 10px ${accentColor}66)
        drop-shadow(0 0 5px ${accentColor}99)
        drop-shadow(0 2px 4px rgba(0,0,0,0.6));
    `;
    
    // Add animation keyframes if not already present
    if (!document.getElementById('clue-gradient-animation')) {
      const style = document.createElement('style');
      style.id = 'clue-gradient-animation';
      style.textContent = `
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `;
      document.head.appendChild(style);
    }
    overlay.appendChild(clue);
    document.body.appendChild(overlay);

    return new Promise<void>((resolve) => {
      const tl = gsap.timeline({ onComplete: () => {
        overlay.remove();
        onComplete?.();
        resolve();
      }});

    // Apply exact font size and width to match gameplay view
    const fontSize = options?.fontSizePx ?? 32;
    const widthPx = options?.overlayWidthPx ?? Math.min(window.innerWidth * 0.9, 1000);
    const holdMs = options?.holdMs ?? 1000;
    clue.style.fontSize = `${fontSize}px`;
    clue.style.width = `${Math.floor(widthPx)}px`;

    // Fade/blur in
    tl.to(overlay, {
      opacity: 1,
      duration: 0.2,
      ease: 'power2.out',
      onUpdate: () => (window as any).__requestRender?.(),
    })
    .to(overlay, {
      backdropFilter: 'blur(6px)',
      background: 'rgba(0,0,0,0.35)',
      duration: 0.25,
      ease: 'power2.out'
    }, '<')
    // Pop clue in
    .fromTo(clue, {
      opacity: 0,
      scale: 0.85,
    }, {
      opacity: 1,
      scale: 1,
      duration: 0.3,
      ease: 'back.out(1.6)'
    })
    // Hold the centered clue visible for a beat
    .to(clue, { duration: holdMs / 1000 })
    // Move clue to its target position while fading blur out
    .to(clue, {
      x: targetScreen.x - window.innerWidth / 2,
      y: targetScreen.y - window.innerHeight / 2,
      scale: 1,
      duration: 0.45,
      ease: 'power3.inOut'
    })
    .to(overlay, {
      opacity: 0,
      backdropFilter: 'blur(0px)',
      background: 'rgba(0,0,0,0)',
      duration: 0.35,
      ease: 'power2.in'
    }, '<+0.05');
    });
  }
  /**
   * Animate removal of input hexes (scale to 0 with stagger), then callback.
   */
  animateInputHexRemove(
    positions: Array<{ q: number; r: number }>,
    onComplete?: () => void
  ): void {
    if (!positions || positions.length === 0) {
      onComplete?.();
      return;
    }

    (window as any).__inputAnimations = (window as any).__inputAnimations || {};
    const states = positions.map((pos) => {
      const key = `input_${pos.q},${pos.r}`;
      const state = { scale: 1 };
      (window as any).__inputAnimations[key] = state;
      return state;
    });

    gsap.to(states, {
      scale: 0,
      duration: 0.25,
      ease: 'power2.in',
      onUpdate: () => (window as any).__requestRender?.(),
      onComplete,
    });
  }

  /**
   * Animate a subtle reflow pulse on all input hexes after collapse.
   */
  animateInputGridReflow(keys: string[]): void {
    if (!keys || keys.length === 0) return;
    const tl = gsap.timeline();
    keys.forEach((key, i) => {
      const state = { scale: 0.9 };
      (window as any).__inputAnimations = (window as any).__inputAnimations || {};
      (window as any).__inputAnimations[key] = state;
      tl.to(state, {
        scale: 1,
        duration: 0.2,
        ease: 'power2.out',
        onUpdate: () => (window as any).__requestRender?.()
      }, i * 0.02);
    });
  }

  /**
   * Animate input grid relayout: move surviving hexes from old positions to new positions.
   * Each move item should contain the input key and initial deltas.
   */
  animateInputGridRelayout(
    moves: Array<{ key: string; dx0: number; dy0: number; distance?: number }>,
    onComplete?: () => void
  ): void {
    if (!moves || moves.length === 0) {
      onComplete?.();
      return;
    }

    (window as any).__inputPosAnimations = (window as any).__inputPosAnimations || {};
    const tl = gsap.timeline({ onComplete });

    // Sort by distance descending so farther ones start first (gravity to center feeling)
    const sorted = moves.slice().sort((a, b) => (b.distance || 0) - (a.distance || 0));
    const maxDist = Math.max(1, ...sorted.map(m => m.distance || 0));

    sorted.forEach((m, i) => {
      const state = { dx: m.dx0, dy: m.dy0 };
      (window as any).__inputPosAnimations[m.key] = state;
      // Duration scaled by distance; farther travel slightly longer
      const duration = 0.35 + 0.25 * ((m.distance || 0) / maxDist);
      tl.to(state, {
        dx: 0,
        dy: 0,
        duration,
        ease: 'power3.inOut',
        // slight overlap for natural flow
        onUpdate: () => (window as any).__requestRender?.()
      }, i * 0.02);
    });
  }

  /** Get current input position animation state for a given key. */
  getInputPositionState(hexKey: string): any {
    return (window as any).__inputPosAnimations?.[hexKey];
  }

  /**
   * Animate clear button press
   */
  animateClearButton(): void {
    const clearElement = { rotation: 0, scale: 1 };
    
    (window as any).__clearButtonAnimation = clearElement;
    
    // Spin and shrink effect
    gsap.to(clearElement, {
      rotation: 180,
      scale: 0.7,
      duration: 0.2,
      yoyo: true,
      repeat: 1,
      ease: 'power2.inOut',
      onUpdate: () => {
        (window as any).__requestRender?.();
      }
    });
  }
  
  /**
   * Animate letters for correct word - two phase animation with green cells
   */
  animateCorrectWord(
    letters: string[],
    sourcePos: { x: number; y: number } | Array<{ x: number; y: number }>,
    targetPositions: Array<{ x: number; y: number; q: number; r: number }>,
    inputHexPositions?: Array<{ q: number; r: number }>,
    onComplete?: () => void
  ): void {
    console.log('Animating correct word:', letters.join(''));
    
    // Clear any existing animations
    (window as any).__jumpingLetters = [];
    (window as any).__greenCells = {};
    (window as any).__greenInputHexes = {};
    
    const jumpLetters: any[] = [];
    
    // Animate input hexes to blink green in sequence
    if (inputHexPositions && inputHexPositions.length > 0) {
      console.log('Animating input hexes in order:', inputHexPositions.map((pos, i) => `${i}: (${pos.q},${pos.r})`));
      
      // Get current colors from palette
      const currentColors = this.getCurrentColors();
      
      inputHexPositions.forEach((pos, index) => {
        const hexKey = `${pos.q},${pos.r}`;
        const hexElement = { 
          green: 0, 
          scale: 1,
          color: (currentColors as any).solvedColor || (currentColors as any).solved || '#00ff00' // Palette solved color
        };
        
        (window as any).__greenInputHexes = (window as any).__greenInputHexes || {};
        (window as any).__greenInputHexes[hexKey] = hexElement;
        
        // Blink green effect with delay matching letter animation - sequential order
        gsap.to(hexElement, {
          green: 1,
          scale: 1.1,
          duration: 0.3,
          delay: index * 0.05, // Each hex blinks 50ms after the previous one
          ease: 'power2.out',
          onStart: () => {
            console.log(`Starting green animation for hex ${index} at (${pos.q},${pos.r})`);
          },
          onUpdate: () => {
            (window as any).__requestRender?.();
          }
        });
        
        // Fade back to normal
        gsap.to(hexElement, {
          green: 0,
          scale: 1,
          duration: 0.5,
          delay: index * 0.05 + 0.5, // Fade out after green animation
          ease: 'power2.inOut',
          onUpdate: () => {
            (window as any).__requestRender?.();
          },
          onComplete: () => {
            delete (window as any).__greenInputHexes[hexKey];
          }
        });
      });
    }
    
    // Create letter objects
    letters.forEach((letter, index) => {
      const start = Array.isArray(sourcePos) ? sourcePos[index] : sourcePos;
      // Get accent color from current palette
      const currentColors = this.getCurrentColors();
      const jumpLetter = {
        letter: letter,
        x: start.x,
        y: start.y,
        scale: 1,
        opacity: 1,
        rotation: 0,
        color: currentColors.accent // Use accent color from palette
      };
      jumpLetters.push(jumpLetter);
      (window as any).__jumpingLetters = (window as any).__jumpingLetters || [];
      (window as any).__jumpingLetters.push(jumpLetter);
    });
    
    const tl = gsap.timeline({
      onComplete: () => {
        delete (window as any).__jumpingLetters;
        // Don't delete green cells - they should stay green
        // The game will add them to solvedCells for permanent green state
        onComplete?.();
      }
    });
    
    // All letters jump from their own text position, then travel to target
    letters.forEach((letter, index) => {
      const jumpLetter = jumpLetters[index];
      const targetPos = targetPositions[index];
      if (!targetPos) return;
      const start = Array.isArray(sourcePos) ? sourcePos[index] : sourcePos as { x: number; y: number };
      // No vertical jump - stay at the same y position

      // Each letter's journey starts with just 50ms delay from previous
      const startTime = index * 0.05; // 50ms delay between each letter starting
      
      // Scale up in place at exact typing position
      tl.to(jumpLetter, {
        x: jumpLetter.x,
        y: start.y, // Keep at exact typing position
        scale: 1.3,
        duration: 0.3,
        ease: 'back.out(1.2)',
        onUpdate: () => {
          (window as any).__requestRender?.();
        }
      }, startTime)
      // Then travel to puzzle cell
      .to(jumpLetter, {
        x: targetPos.x,
        y: targetPos.y,
        scale: 1,
        duration: 0.5,
        ease: 'power2.inOut',
        onUpdate: () => {
          (window as any).__requestRender?.();
        },
        onComplete: () => {
          // Smoothly turn the destination cell green when letter arrives
          const cellKey = `${targetPos.q},${targetPos.r}`;
          const greenCell = { green: 0, glow: 0 };
          
          (window as any).__greenCells = (window as any).__greenCells || {};
          (window as any).__greenCells[cellKey] = greenCell;
          
          // Smoothly animate to green
          gsap.to(greenCell, {
            green: 1,
            glow: 1,
            duration: 0.5,
            ease: 'power2.out',
            onUpdate: () => {
              (window as any).__requestRender?.();
            },
            onComplete: () => {
              // Fade out glow but keep green
              gsap.to(greenCell, {
                glow: 0,
                duration: 0.3,
                ease: 'power2.out',
                onUpdate: () => {
                  (window as any).__requestRender?.();
                }
              });
            }
          });
        }
      }, `>+0.1`) // Small pause at top then go
      // Fade out at destination
      .to(jumpLetter, {
        opacity: 0,
        scale: 0.5,
        duration: 0.3,
        ease: 'power2.out',
        onUpdate: () => {
          (window as any).__requestRender?.();
        }
      }, `>-0.15`); // Overlap fade with landing
    });
  }
  
  /**
   * Animate game initialization
   */
  animateGameStart(onComplete?: () => void): void {
    const gameElement = { 
      opacity: 0,
      scale: 0.8
    };
    
    (window as any).__gameStartAnimation = gameElement;
    
    gsap.to(gameElement, {
      opacity: 1,
      scale: 1,
      duration: 0.8,
      ease: 'power3.out',
      onComplete: () => {
        onComplete?.();
        delete (window as any).__gameStartAnimation;
      },
      onUpdate: () => {
        (window as any).__requestRender?.();
      }
    });
  }
  
  /**
   * Animate error shake
   */
  animateError(elementId?: string): void {
    const errorElement = { x: 0 };
    
    (window as any).__errorAnimation = errorElement;
    
    gsap.to(errorElement, {
      x: 10,
      duration: 0.1,
      yoyo: true,
      repeat: 3,
      ease: 'power2.inOut',
      onUpdate: () => {
        (window as any).__requestRender?.();
      },
      onComplete: () => {
        delete (window as any).__errorAnimation;
      }
    });
  }
  
  /**
   * Get current animation value for a cell
   */
  getCellAnimationState(cellKey: string): any {
    return (window as any).__cellAnimations?.[cellKey];
  }
  
  /**
   * Get current animation value for input hex
   */
  getInputAnimationState(hexKey: string): any {
    return (window as any).__inputAnimations?.[hexKey];
  }
  
  /**
   * Trigger shuffle animation for input hex
   */
  triggerInputShuffleAnimation(hexKey: string, delay: number = 0): void {
    if (this.reducedMotion) return;
    
    (window as any).__inputAnimations = (window as any).__inputAnimations || {};
    const state = { scale: 1, rotation: 0, opacity: 1, blur: 0 };
    (window as any).__inputAnimations[hexKey] = state;
    
    // Create a smooth blur fade out, shuffle, blur fade in effect
    gsap.timeline()
      .to(state, {
        opacity: 0.3,
        scale: 0.85,
        blur: 8,
        duration: 0.3,
        delay: delay,
        ease: 'power2.in'
      })
      .to(state, {
        rotation: 180,
        duration: 0.1,
        ease: 'none'
      })
      .to(state, {
        opacity: 1,
        scale: 1,
        blur: 0,
        rotation: 360,
        duration: 0.3,
        ease: 'power2.out',
        onComplete: () => {
          state.rotation = 0;
          state.blur = 0;
          delete (window as any).__inputAnimations[hexKey];
        }
      });
    
    // Request render update continuously during animation
    const updateRender = () => {
      if ((window as any).__requestRender) {
        (window as any).__requestRender();
      }
      if ((window as any).__inputAnimations?.[hexKey]) {
        requestAnimationFrame(updateRender);
      }
    };
    updateRender();
  }
  
  /**
   * Clean up completed animations
   */
  cleanup(): void {
    gsap.killTweensOf((window as any).__cellAnimations);
    gsap.killTweensOf((window as any).__inputAnimations);
    gsap.killTweensOf((window as any).__typedWordAnimation);
    gsap.killTweensOf((window as any).__clearButtonAnimation);
    
    delete (window as any).__cellAnimations;
    delete (window as any).__inputAnimations;
    delete (window as any).__typedWordAnimation;
    delete (window as any).__clearButtonAnimation;
  }

  /**
   * Force-clear any input glow/scale animations (used when clearing the typed word).
   */
  clearInputGlows(keys?: string[]): void {
    const bag = (window as any).__inputAnimations;
    if (!bag) return;
    const entries = keys && keys.length
      ? keys.map(k => ({ k, s: bag[k] })).filter(e => e.s)
      : Object.entries<any>(bag).map(([k, s]) => ({ k, s }));
    entries.forEach(({ s }) => {
      try { gsap.killTweensOf(s); } catch {}
      if (s) {
        if (typeof s.glow === 'number') s.glow = 0;
        if (typeof s.opacity === 'number') s.opacity = 1;
        if (typeof s.scale === 'number') s.scale = 1;
      }
    });
  }
}

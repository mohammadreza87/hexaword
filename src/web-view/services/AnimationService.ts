import { gsap } from 'gsap';

/**
 * Service to handle all game animations using GSAP
 */
export class AnimationService {
  private static instance: AnimationService;
  
  private constructor() {
    // Configure GSAP defaults
    gsap.defaults({
      ease: 'power2.out',
      duration: 0.3
    });
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
    sourcePos: { x: number, y: number },
    targetPositions: Array<{ x: number, y: number, q: number, r: number }>,
    inputHexPositions?: Array<{ q: number, r: number }>,
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
      
      inputHexPositions.forEach((pos, index) => {
        const hexKey = `${pos.q},${pos.r}`;
        const hexElement = { green: 0, scale: 1 };
        
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
      const jumpLetter = {
        letter: letter,
        x: sourcePos.x,
        y: sourcePos.y,
        scale: 1,
        opacity: 1,
        rotation: 0,
        color: '#00d9ff'
      };
      jumpLetters.push(jumpLetter);
      (window as any).__jumpingLetters = (window as any).__jumpingLetters || [];
      (window as any).__jumpingLetters.push(jumpLetter);
    });
    
    const tl = gsap.timeline({
      onComplete: () => {
        delete (window as any).__jumpingLetters;
        setTimeout(() => {
          delete (window as any).__greenCells;
          (window as any).__requestRender?.();
        }, 2000);
        onComplete?.();
      }
    });
    
    // All letters jump and travel with minimal delay - creating a rapid wave
    letters.forEach((letter, index) => {
      const jumpLetter = jumpLetters[index];
      const targetPos = targetPositions[index];
      if (!targetPos) return;
      
      const upY = sourcePos.y - 60; // Jump height
      const spreadX = sourcePos.x + (index * 30) - (letters.length * 15); // Spread horizontally
      
      // Each letter's complete journey starts with just 50ms delay from previous
      const startTime = index * 0.05; // 50ms delay between each letter starting
      
      // Jump UP
      tl.to(jumpLetter, {
        x: spreadX,
        y: upY,
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
          // Turn the destination cell green exactly when letter arrives
          const cellKey = `${targetPos.q},${targetPos.r}`;
          (window as any).__greenCells = (window as any).__greenCells || {};
          (window as any).__greenCells[cellKey] = { green: 1 };
          (window as any).__requestRender?.();
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
}
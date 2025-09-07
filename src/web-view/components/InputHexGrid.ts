import { defineHex, Grid, rectangle, ring, Hex } from 'honeycomb-grid';
import { AnimationService } from '../services/AnimationService';
import { ColorPaletteService, ColorScheme } from '../services/ColorPaletteService';

interface InputCell {
  q: number;
  r: number;
  letter?: string;
}

export class InputHexGrid {
  private ctx: CanvasRenderingContext2D;
  private cells: InputCell[] = [];
  private hexSize: number = 25;
  private typedWord: string = '';  // Track typed letters
  private lastClickedHex: {q: number, r: number} | null = null;
  private animationService: AnimationService;
  private selectedPositions: Array<{q: number, r: number}> = [];
  private usedLetters: Set<string> = new Set(); // Track which letters have been used
  private colorPaletteService: ColorPaletteService;
  private currentColors: ColorScheme | null = null;
  private activeCell: { q: number; r: number } | null = null; // last selected cell for glow
  
  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    // Don't initialize cells yet - wait for setLetters to be called
    this.cells = [];
    this.animationService = AnimationService.getInstance();
    this.colorPaletteService = ColorPaletteService.getInstance();
    
    // Initialize colors
    this.initializeColors();
  }
  
  /**
   * Initialize colors from palette service
   */
  private async initializeColors(): Promise<void> {
    this.currentColors = await this.colorPaletteService.getCurrentScheme();
  }
  
  /**
   * Update level and refresh colors
   */
  async setLevel(level: number): Promise<void> {
    this.currentColors = await this.colorPaletteService.setLevel(level);
  }
  
  /**
   * Toggle theme
   */
  async toggleTheme(): Promise<void> {
    this.currentColors = await this.colorPaletteService.toggleTheme();
  }
  
  /**
   * Initializes the input grid with exact number of cells needed
   */
  private initializeCells(count: number): void {
    const MyHex = defineHex({
      dimensions: 30,
      orientation: 'pointy'
    });

    // Always start with center cell (0,0) for clear button
    const tempCells: InputCell[] = [{ q: 0, r: 0 }];
    
    // Define symmetrical placement patterns for different counts
    // Always maintain left-right and top-bottom symmetry
    let positions: InputCell[] = [];
    
    if (count === 1) {
      positions = [
        { q: 0, r: -1 },  // Top
      ];
    } else if (count === 2) {
      positions = [
        { q: -1, r: 0 },  // Left
        { q: 1, r: 0 },   // Right
      ];
    } else if (count === 3) {
      positions = [
        { q: 0, r: -1 },  // Top
        { q: -1, r: 1 },  // Bottom-Left
        { q: 1, r: 0 },   // Right
      ];
    } else if (count === 4) {
      positions = [
        { q: -1, r: 0 },  // Left
        { q: 1, r: 0 },   // Right
        { q: 0, r: -1 },  // Top
        { q: 0, r: 1 },   // Bottom
      ];
    } else if (count === 5) {
      positions = [
        { q: -1, r: 0 },  // Left
        { q: 1, r: 0 },   // Right
        { q: 0, r: -1 },  // Top
        { q: -1, r: 1 },  // Bottom-Left
        { q: 1, r: -1 },  // Top-Right
      ];
    } else if (count === 6) {
      positions = [
        { q: -1, r: 0 },  // Left
        { q: 1, r: 0 },   // Right
        { q: 0, r: -1 },  // Top
        { q: 0, r: 1 },   // Bottom
        { q: -1, r: 1 },  // Bottom-Left
        { q: 1, r: -1 },  // Top-Right
      ];
    } else {
      // For more than 6, start with full first ring
      positions = [
        { q: -1, r: 0 },  // Left
        { q: 1, r: 0 },   // Right
        { q: 0, r: -1 },  // Top
        { q: 0, r: 1 },   // Bottom
        { q: -1, r: 1 },  // Bottom-Left
        { q: 1, r: -1 },  // Top-Right
      ];
    }
    
    // Add the positions we defined
    for (let i = 0; i < Math.min(count, positions.length); i++) {
      tempCells.push(positions[i]);
    }
    
    // If we need more than 6 letters, add second ring symmetrically
    if (count > 6) {
      // Add second ring in symmetrical pairs
      const secondRing = [
        { q: -2, r: 0 },   // Far Left
        { q: 2, r: 0 },    // Far Right
        { q: 0, r: -2 },   // Far Top
        { q: 0, r: 2 },    // Far Bottom
        { q: -1, r: -1 },  // Top-Left
        { q: 1, r: 1 },    // Bottom-Right
        { q: 1, r: -2 },   // Top-Right-Right
        { q: -1, r: 2 },   // Bottom-Left-Left
        { q: 2, r: -2 },   // Far Top-Right
        { q: -2, r: 2 },   // Far Bottom-Left
        { q: 2, r: -1 },   // Right-Top
        { q: -2, r: 1 },   // Left-Bottom
      ];
      
      // Add second ring positions
      for (let i = 6; i < count && i - 6 < secondRing.length; i++) {
        tempCells.push(secondRing[i - 6]);
      }
    }
    
    // If we need more than 18 letters (6 + 12), add third ring (18 positions)
    if (count > 18) {
      const thirdRing = [
        { q: -3, r: 0 },   // Far Far Left
        { q: -3, r: 1 },   // 
        { q: -3, r: 2 },   // 
        { q: -2, r: -1 },  // 
        { q: -1, r: -2 },  // 
        { q: 0, r: -3 },   // Far Far Top
        { q: 1, r: -3 },   // 
        { q: 2, r: -3 },   // 
        { q: 3, r: -3 },   // 
        { q: 3, r: -2 },   // 
        { q: 3, r: -1 },   // 
        { q: 3, r: 0 },    // Far Far Right
        { q: 2, r: 1 },    // 
        { q: 1, r: 2 },    // 
        { q: 0, r: 3 },    // Far Far Bottom
        { q: -1, r: 3 },   // 
        { q: -2, r: 3 },   // 
        { q: -3, r: 3 },   // 
      ];
      
      // Add third ring positions
      for (let i = 18; i < count && i - 18 < thirdRing.length; i++) {
        tempCells.push(thirdRing[i - 18]);
      }
    }
    
    // Store cells - center is always at index 0
    this.cells = tempCells;
  }
  
  /**
   * Renders the input grid
   */
  public render(centerX: number, centerY: number, dynamicSize?: number, currentTypedWord?: string): number {
    // Don't render if no cells initialized
    if (this.cells.length === 0) {
      return centerY;
    }
    
    // Update typed word if provided
    if (currentTypedWord !== undefined) {
      this.typedWord = currentTypedWord;
    }
    
    const size = dynamicSize || this.hexSize;
    const Hex = defineHex({
      dimensions: size,
      orientation: 'pointy'
    });
    
    let maxY = -Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let minX = Infinity;
    
    // First pass: calculate bounds
    this.cells.forEach(cell => {
      const hex = new Hex([cell.q, cell.r]);
      const corners = hex.corners;
      corners.forEach(corner => {
        maxY = Math.max(maxY, corner.y);
        minY = Math.min(minY, corner.y);
        maxX = Math.max(maxX, corner.x);
        minX = Math.min(minX, corner.x);
      });
    });
    
    // Calculate offsets to center the grid horizontally and position bottom edge correctly
    const gridWidth = maxX - minX;
    const gridHeight = maxY - minY;
    const offsetX = centerX - (minX + maxX) / 2;  // Center horizontally
    const offsetY = centerY - maxY;  // Adjust so maxY aligns with centerY
    
    // Draw each cell
    this.cells.forEach((cell, index) => {
      const hex = new Hex([cell.q, cell.r]);
      const hexKey = `input_${cell.q},${cell.r}`;
      let x = hex.x + offsetX;
      let y = hex.y + offsetY;
      const posAnim = this.animationService.getInputPositionState(hexKey);
      if (posAnim) {
        x += posAnim.dx || 0;
        y += posAnim.dy || 0;
      }
      
      // Apply animation transforms if any
      const animState = this.animationService.getInputAnimationState(hexKey);
      if (animState) {
        this.ctx.save();
        
        // Apply scale transform
        this.ctx.translate(x, y);
        this.ctx.scale(animState.scale || 1, animState.scale || 1);
        this.ctx.translate(-x, -y);
      }
      
      // Get corners for drawing (already relative to hex center)
      const corners = hex.corners;
      
      // Draw hex with 2px spacing
      const spacing = 2;
      const scaleFactor = (size - spacing) / size;
      
      this.ctx.beginPath();
      corners.forEach((corner, i) => {
        // Apply spacing by scaling the corner positions
        const scaledCornerX = hex.x + (corner.x - hex.x) * scaleFactor;
        const scaledCornerY = hex.y + (corner.y - hex.y) * scaleFactor;
        
        // Position the scaled corners
        let finalX = scaledCornerX + offsetX;
        let finalY = scaledCornerY + offsetY;
        if (posAnim) {
          finalX += posAnim.dx || 0;
          finalY += posAnim.dy || 0;
        }
        
        if (i === 0) {
          this.ctx.moveTo(finalX, finalY);
        } else {
          this.ctx.lineTo(finalX, finalY);
        }
      });
      this.ctx.closePath();
      
      // Check if this is the center cell (clear button)
      const isCenterCell = cell.q === 0 && cell.r === 0;
      
      // Check for green input hex animation
      const greenInputState = (window as any).__greenInputHexes?.[`${cell.q},${cell.r}`];
      
      // Fill with appropriate color
      if (isCenterCell && this.typedWord.length > 0) {
        // Apply clear button animation if active
        const clearAnimState = (window as any).__clearButtonAnimation;
        if (clearAnimState) {
          this.ctx.save();
          this.ctx.translate(x, y);
          this.ctx.rotate((clearAnimState.rotation || 0) * Math.PI / 180);
          this.ctx.scale(clearAnimState.scale || 1, clearAnimState.scale || 1);
          this.ctx.translate(-x, -y);
        }
        
        // Only show clear button when there's typed text
        this.ctx.fillStyle = this.currentColors?.accent || '#ff4444'; // Clear button uses accent color
        this.ctx.fill();
        
        if (clearAnimState) {
          this.ctx.restore();
        }
      } else if (!isCenterCell) {
        // Check if this letter has been used
        const isUsed = this.usedLetters.has(`${cell.q},${cell.r}`);
        const isActive = !!this.activeCell && this.activeCell.q === cell.q && this.activeCell.r === cell.r;
        
        // Check for green input animation
        if (greenInputState && greenInputState.green > 0) {
          // Apply scale transform for bounce effect
          if (greenInputState.scale && greenInputState.scale !== 1) {
            this.ctx.save();
            this.ctx.translate(x, y);
            this.ctx.scale(greenInputState.scale, greenInputState.scale);
            this.ctx.translate(-x, -y);
          }
          
          // Blend between normal color and green
          const normalColor = this.currentColors?.inputCellFill || '#3a4558';
          const greenIntensity = greenInputState.green;
          
          // Draw with green blend
          this.ctx.fillStyle = this.blendColors(normalColor, '#00ff00', greenIntensity);
          this.ctx.fill();
          
          // Add green glow effect
          if (greenIntensity > 0) {
            this.ctx.save();
            this.ctx.shadowColor = '#00ff00';
            this.ctx.shadowBlur = 20 * greenIntensity;
            this.ctx.strokeStyle = this.currentColors?.solvedColor || '#00ff00';
            this.ctx.globalAlpha = greenIntensity * 0.5;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            this.ctx.restore();
          }
          
          if (greenInputState.scale && greenInputState.scale !== 1) {
            this.ctx.restore();
          }
        } else {
          // Normal cells with letters - add glow effect if animated
          if (animState?.glow) {
            this.ctx.shadowColor = '#00d9ff';
            this.ctx.shadowBlur = 10 * animState.glow;
          }
          
          // Different color for used letters
          if (isUsed && !isActive) {
            this.ctx.fillStyle = this.currentColors?.primary || '#1a1f2e'; // Darker color for used letters
            this.ctx.fill();
            // Add subtle disabled effect
            this.ctx.save();
            this.ctx.globalAlpha = 0.3;
            this.ctx.fillStyle = this.currentColors?.background || '#000000';
            this.ctx.fill();
            this.ctx.restore();
          } else {
            this.ctx.fillStyle = this.currentColors?.inputCellFill || '#3a4558';
            this.ctx.fill();
          }

          // Highlight active cell with glow outline
          if (isActive) {
            this.ctx.save();
            this.ctx.shadowColor = this.currentColors?.accent || '#00d9ff';
            this.ctx.shadowBlur = 14;
            this.ctx.strokeStyle = this.currentColors?.accent || '#00d9ff';
            this.ctx.lineWidth = 2.5;
            this.ctx.stroke();
            this.ctx.restore();
          }
          
          // Reset shadow
          if (animState?.glow) {
            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;
          }
        }
      }
      // Center cell is invisible when no typed text
      
      // No stroke for input cells (remove outline)
      // this.ctx.stroke(); // Removed
      
      // Add letter or X for center cell
      if (isCenterCell && this.typedWord.length > 0) {
        // Only show X when there's typed text
        this.ctx.fillStyle = this.currentColors?.text || '#ffffff';
        this.ctx.font = `${Math.floor(size * 0.9)}px 'Lilita One', Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('×', x, y); // Using × symbol for clear
      } else if (cell.letter && !isCenterCell) {
        // Draw letters only for non-center cells
        // Check if this letter has been used
        const isUsed = this.usedLetters.has(`${cell.q},${cell.r}`);
        const isActive = !!this.activeCell && this.activeCell.q === cell.q && this.activeCell.r === cell.r;
        // Dimmed text for used letters
        const dimmedColor = this.colorPaletteService.adjustForContrast('#666666', this.currentColors?.background || '#141514', 3.0);
        this.ctx.fillStyle = (isUsed && !isActive) ? dimmedColor : (this.currentColors?.text || '#ffffff');
        this.ctx.font = `${Math.floor(size * 0.8)}px 'Lilita One', Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(cell.letter.toUpperCase(), x, y);
      }
      
      // Restore context if animation was applied
      if (animState) {
        this.ctx.restore();
      }
    });
    
    // Frame removed - no longer drawing frame
    // this.drawFrame(minX + offsetX, maxX + offsetX, minY + offsetY, maxY + offsetY);
    
    return minY + offsetY;  // Return the top position of the grid for text placement
  }
  
  /**
   * Draws a frame around the input grid
   */
  private drawFrame(minX: number, maxX: number, minY: number, maxY: number): void {
    const padding = 15;
    const frameLeft = minX - padding;
    const frameRight = maxX + padding;
    const frameTop = minY - padding;
    const frameBottom = maxY + padding;
    const radius = 10;
    
    // Draw rounded rectangle frame
    this.ctx.strokeStyle = this.currentColors?.inputCellStroke || '#4a5568';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    
    // Start from top-left corner (after radius)
    this.ctx.moveTo(frameLeft + radius, frameTop);
    
    // Top edge
    this.ctx.lineTo(frameRight - radius, frameTop);
    // Top-right corner
    this.ctx.arcTo(frameRight, frameTop, frameRight, frameTop + radius, radius);
    
    // Right edge
    this.ctx.lineTo(frameRight, frameBottom - radius);
    // Bottom-right corner
    this.ctx.arcTo(frameRight, frameBottom, frameRight - radius, frameBottom, radius);
    
    // Bottom edge
    this.ctx.lineTo(frameLeft + radius, frameBottom);
    // Bottom-left corner
    this.ctx.arcTo(frameLeft, frameBottom, frameLeft, frameBottom - radius, radius);
    
    // Left edge
    this.ctx.lineTo(frameLeft, frameTop + radius);
    // Top-left corner
    this.ctx.arcTo(frameLeft, frameTop, frameLeft + radius, frameTop, radius);
    
    this.ctx.closePath();
    this.ctx.stroke();
  }
  
  /**
   * Sets a letter at the specified index
   */
  public setLetter(index: number, letter: string): void {
    if (index >= 0 && index < this.cells.length) {
      this.cells[index].letter = letter;
    }
  }
  
  /**
   * Gets the letter at the specified index
   */
  public getLetter(index: number): string | undefined {
    if (index >= 0 && index < this.cells.length) {
      return this.cells[index].letter;
    }
    return undefined;
  }
  
  /**
   * Gets all letters as a string
   */
  public getLetters(): string {
    return this.cells
      .map(cell => cell.letter || '')
      .join('');
  }
  
  /**
   * Handles click on input grid
   */
  public handleClick(x: number, y: number, centerX: number, centerY: number, dynamicSize?: number): string | null {
    const size = dynamicSize || this.hexSize;
    const Hex = defineHex({
      dimensions: size,
      orientation: 'pointy'
    });
    
    // Calculate grid offsets (same as render)
    let maxY = -Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let minX = Infinity;
    
    this.cells.forEach(cell => {
      const hex = new Hex([cell.q, cell.r]);
      const corners = hex.corners;
      corners.forEach(corner => {
        maxY = Math.max(maxY, corner.y);
        minY = Math.min(minY, corner.y);
        maxX = Math.max(maxX, corner.x);
        minX = Math.min(minX, corner.x);
      });
    });
    
    const offsetX = centerX - (minX + maxX) / 2;
    const offsetY = centerY - maxY;
    
    // Check each cell for click
    for (const cell of this.cells) {
      const hex = new Hex([cell.q, cell.r]);
      const hexX = hex.x + offsetX;
      const hexY = hex.y + offsetY;
      
      // Check if click is within this hex (simple distance check)
      const distance = Math.sqrt((x - hexX) ** 2 + (y - hexY) ** 2);
      if (distance <= size * 0.8) {  // Within hex radius
        // Store the clicked hex position
        this.lastClickedHex = {q: cell.q, r: cell.r};
        
        // Check if center cell (clear)
        if (cell.q === 0 && cell.r === 0) {
          this.typedWord = '';
          this.selectedPositions = [];
          this.usedLetters.clear(); // Clear all used letters
          return 'CLEAR';
        }
        // Backspace behavior: if this is the last selected cell, toggle it off
        const cellKey = `${cell.q},${cell.r}`;
        const last = this.selectedPositions[this.selectedPositions.length - 1];
        if (this.usedLetters.has(cellKey)) {
          if (last && last.q === cell.q && last.r === cell.r) {
            // Remove last typed character and unuse the cell
            this.usedLetters.delete(cellKey);
            this.selectedPositions.pop();
            this.typedWord = this.typedWord.slice(0, -1);
            // Update active cell to new last or clear
            const newLast = this.selectedPositions[this.selectedPositions.length - 1] || null;
            this.activeCell = newLast ? { q: newLast.q, r: newLast.r } : null;
            return 'BACKSPACE';
          }
          // If not last selected, ignore
          return null;
        }

        // Normal add behavior for unused letters
        if (cell.letter) {
          this.typedWord += cell.letter;
          this.selectedPositions.push({ q: cell.q, r: cell.r });
          this.usedLetters.add(cellKey); // Mark this cell as used
          this.activeCell = { q: cell.q, r: cell.r };
          return cell.letter;
        }
        return null;
      }
    }
    return null;
  }
  
  /**
   * Gets the current typed word
   */
  public getTypedWord(): string {
    return this.typedWord;
  }
  
  /**
   * Clears the typed word
   */
  public clearTypedWord(): void {
    this.typedWord = '';
    this.selectedPositions = [];
    this.usedLetters.clear(); // Clear all used letters when word is cleared
    this.activeCell = null;
  }
  
  /**
   * Clears all letters
   */
  public clearLetters(): void {
    this.cells.forEach(cell => {
      cell.letter = undefined;
    });
  }

  /**
   * Remove letters for cells matching a predicate, animate scale-to-zero, then reflow grid.
   */
  public removeLettersByPredicate(
    predicate: (cell: InputCell) => boolean,
    layout?: { centerX: number; centerY: number; size: number },
    onDone?: () => void
  ): void {
    // Identify targets (exclude center)
    const targets = this.cells.filter(c => !(c.q === 0 && c.r === 0) && c.letter && predicate(c));
    if (targets.length === 0) {
      onDone?.();
      return;
    }
    const positions = targets.map(t => ({ q: t.q, r: t.r }));
    
    // Animate removal, then rebuild
    this.animationService.animateInputHexRemove(positions, () => {
      // Build remaining letters array and capture old positions of survivors
      const remaining: string[] = [];
      const survivors: Array<{ letter: string; q: number; r: number; x: number; y: number }> = [];

      // Helper to compute current absolute center for a cell
      const computeCenter = (cell: InputCell): { x: number; y: number } => {
        const size = layout?.size ?? this.hexSize;
        const Hex = defineHex({ dimensions: size, orientation: 'pointy' });
        // compute bounds and offsets like render
        let maxY = -Infinity, minY = Infinity, maxX = -Infinity, minX = Infinity;
        this.cells.forEach(c => {
          const hex = new Hex([c.q, c.r]);
          hex.corners.forEach(corner => {
            maxY = Math.max(maxY, corner.y);
            minY = Math.min(minY, corner.y);
            maxX = Math.max(maxX, corner.x);
            minX = Math.min(minX, corner.x);
          });
        });
        const offsetX = (layout?.centerX ?? 0) - (minX + maxX) / 2;
        const offsetY = (layout?.centerY ?? 0) - maxY;
        const hex = new Hex([cell.q, cell.r]);
        return { x: hex.x + offsetX, y: hex.y + offsetY };
      };

      this.cells.forEach(c => {
        if (c.q === 0 && c.r === 0) return; // skip center
        if (!c.letter) return;
        const shouldRemove = targets.some(t => t.q === c.q && t.r === c.r);
        if (!shouldRemove) {
          remaining.push(c.letter);
          const { x, y } = computeCenter(c);
          survivors.push({ letter: c.letter!, q: c.q, r: c.r, x, y });
        }
      });

      // Reset selection state due to layout change
      this.clearTypedWord();

      // Rebuild cells to new size and set letters
      this.initializeCells(remaining.length);
      let i = 0;
      const moves: Array<{ key: string; dx0: number; dy0: number; distance: number }> = [];
      const centerX = layout?.centerX ?? 0;
      const centerY = layout?.centerY ?? 0;

      this.cells.forEach(c => {
        if (c.q === 0 && c.r === 0) return;
        const letter = remaining[i++] || undefined;
        c.letter = letter;
        if (!letter) return;
        // Compute new absolute center
        const size = layout?.size ?? this.hexSize;
        const Hex = defineHex({ dimensions: size, orientation: 'pointy' });
        // We recompute bounds for new layout
        let maxY = -Infinity, minY = Infinity, maxX = -Infinity, minX = Infinity;
        this.cells.forEach(cc => {
          const hx = new Hex([cc.q, cc.r]);
          hx.corners.forEach(corner => {
            maxY = Math.max(maxY, corner.y);
            minY = Math.min(minY, corner.y);
            maxX = Math.max(maxX, corner.x);
            minX = Math.min(minX, corner.x);
          });
        });
        const offsetX = (layout?.centerX ?? 0) - (minX + maxX) / 2;
        const offsetY = (layout?.centerY ?? 0) - maxY;
        const hex = new Hex([c.q, c.r]);
        const toX = hex.x + offsetX;
        const toY = hex.y + offsetY;

        // Match with survivor by order (stable packing)
        const survivor = survivors[moves.length];
        if (survivor) {
          const dx0 = survivor.x - toX;
          const dy0 = survivor.y - toY;
          const distance = Math.hypot(toX - centerX, toY - centerY);
          moves.push({ key: `input_${c.q},${c.r}`, dx0, dy0, distance });
        }
      });

      // Animate movement towards new centered positions
      this.animationService.animateInputGridRelayout(moves, () => {
        // Final polish pulse
        const keys = this.cells
          .filter(c => !(c.q === 0 && c.r === 0) && c.letter)
          .map(c => `input_${c.q},${c.r}`);
        this.animationService.animateInputGridReflow(keys);
        onDone?.();
      });
    });
  }

  /**
   * Remove all occurrences of letters in the provided set (excluding center).
   */
  public removeLettersBySet(
    letters: Set<string>,
    layout?: { centerX: number; centerY: number; size: number },
    onDone?: () => void
  ): void {
    this.removeLettersByPredicate(c => !!c.letter && letters.has(c.letter.toUpperCase()), layout, onDone);
  }

  /**
   * Compute absolute bounds of the input grid given the current cells and layout.
   */
  public getBounds(
    centerX: number,
    centerY: number,
    dynamicSize?: number
  ): { leftX: number; rightX: number; topY: number; bottomY: number } {
    const size = dynamicSize || this.hexSize;
    const Hex = defineHex({ dimensions: size, orientation: 'pointy' });
    let maxY = -Infinity, minY = Infinity, maxX = -Infinity, minX = Infinity;
    this.cells.forEach(cell => {
      const hex = new Hex([cell.q, cell.r]);
      const corners = hex.corners;
      corners.forEach(corner => {
        maxY = Math.max(maxY, corner.y);
        minY = Math.min(minY, corner.y);
        maxX = Math.max(maxX, corner.x);
        minX = Math.min(minX, corner.x);
      });
    });
    const offsetX = centerX - (minX + maxX) / 2;  // same centering as render
    const offsetY = centerY - maxY;               // bottom aligns with centerY
    return {
      leftX: minX + offsetX,
      rightX: maxX + offsetX,
      topY: minY + offsetY,
      bottomY: maxY + offsetY,
    };
  }

  /**
   * Get absolute center of a given input hex (q,r) for the provided layout.
   */
  public getCellCenterAbs(
    q: number,
    r: number,
    centerX: number,
    centerY: number,
    dynamicSize?: number
  ): { x: number; y: number } {
    const size = dynamicSize || this.hexSize;
    const Hex = defineHex({ dimensions: size, orientation: 'pointy' });
    // compute bounds for offsets
    let maxY = -Infinity, minY = Infinity, maxX = -Infinity, minX = Infinity;
    this.cells.forEach(cell => {
      const hex = new Hex([cell.q, cell.r]);
      hex.corners.forEach(corner => {
        maxY = Math.max(maxY, corner.y);
        minY = Math.min(minY, corner.y);
        maxX = Math.max(maxX, corner.x);
        minX = Math.min(minX, corner.x);
      });
    });
    const offsetX = centerX - (minX + maxX) / 2;
    const offsetY = centerY - maxY;
    const hex = new Hex([q, r]);
    return { x: hex.x + offsetX, y: hex.y + offsetY };
  }
  
  /**
   * Gets the last clicked hex position
   */
  public getLastClickedHex(): {q: number, r: number} | null {
    return this.lastClickedHex;
  }
  
  /**
   * Gets the positions of cells that contain the given letters
   */
  public getCellPositionsForLetters(
    letters: string[], 
    centerX: number, 
    centerY: number, 
    dynamicSize?: number
  ): Array<{x: number, y: number, q: number, r: number}> {
    const size = dynamicSize || this.hexSize;
    const Hex = defineHex({
      dimensions: size,
      orientation: 'pointy'
    });
    
    // Calculate grid offsets (same as render)
    let maxY = -Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let minX = Infinity;
    
    this.cells.forEach(cell => {
      const hex = new Hex([cell.q, cell.r]);
      const corners = hex.corners;
      corners.forEach(corner => {
        maxY = Math.max(maxY, corner.y);
        minY = Math.min(minY, corner.y);
        maxX = Math.max(maxX, corner.x);
        minX = Math.min(minX, corner.x);
      });
    });
    
    const offsetX = centerX - (minX + maxX) / 2;
    const offsetY = centerY - maxY;
    
    const positions: Array<{x: number, y: number, q: number, r: number}> = [];
    
    // Find cells that match each letter
    letters.forEach(letter => {
      const matchingCell = this.cells.find(cell => 
        cell.letter === letter.toUpperCase() && 
        !(cell.q === 0 && cell.r === 0) // Skip center clear button
      );
      
      if (matchingCell) {
        const hex = new Hex([matchingCell.q, matchingCell.r]);
        positions.push({
          x: hex.x + offsetX,
          y: hex.y + offsetY,
          q: matchingCell.q,
          r: matchingCell.r
        });
      }
    });
    
    return positions;
  }
  
  /**
   * Sets all letters at once
   */
  public setLetters(letters: string): void {
    const chars = letters.split('');
    // Rebuild cells to match letter count if needed
    if (chars.length !== this.cells.length - 1) {  // -1 because center is for clear
      this.initializeCells(chars.length);
    }
    // Skip center cell (index 0) and assign letters to other cells
    let charIndex = 0;
    this.cells.forEach((cell, index) => {
      if (!(cell.q === 0 && cell.r === 0)) {  // Skip center cell
        cell.letter = chars[charIndex] || undefined;
        charIndex++;
      }
    });
  }
  
  /**
   * Gets the positions of selected hexes
   */
  public getSelectedPositions(): Array<{q: number, r: number}> {
    return [...this.selectedPositions];
  }
  
  /**
   * Sets the positions of selected hexes
   */
  public setSelectedPositions(positions: Array<{q: number, r: number}>): void {
    this.selectedPositions = [...positions];
    const last = this.selectedPositions[this.selectedPositions.length - 1] || null;
    this.activeCell = last ? { q: last.q, r: last.r } : null;
  }
  
  /**
   * Find a cell by its letter
   */
  public findCellByLetter(letter: string): InputCell | null {
    // Find the first unused cell with this letter
    for (const cell of this.cells) {
      if (cell.letter === letter.toUpperCase()) {
        const cellKey = `${cell.q},${cell.r}`;
        if (!this.usedLetters.has(cellKey)) {
          return cell;
        }
      }
    }
    return null;
  }
  
  /**
   * Check if a letter at position is used
   */
  public isLetterUsed(q: number, r: number): boolean {
    return this.usedLetters.has(`${q},${r}`);
  }
  
  /**
   * Handle hex click programmatically (for keyboard)
   */
  public handleHexClick(q: number, r: number): void {
    const cell = this.cells.find(c => c.q === q && c.r === r);
    if (!cell) return;
    
    // Check if this is the center clear button
    if (q === 0 && r === 0) {
      this.clearTypedWord();
      return;
    }
    
    // Check if letter exists and is not already used
    if (cell.letter && !this.usedLetters.has(`${q},${r}`)) {
      // Add to typed word
      this.typedWord += cell.letter;
      
      // Mark as used
      this.usedLetters.add(`${q},${r}`);
      
      // Track position
      this.selectedPositions.push({q, r});
      this.activeCell = { q, r };
      
      // Update last clicked
      this.lastClickedHex = {q, r};
    }
  }
  
  /**
   * Mark a letter as unused
   */
  public markLetterUnused(q: number, r: number): void {
    this.usedLetters.delete(`${q},${r}`);
  }
  
  /**
   * Set the typed word directly
   */
  public setTypedWord(word: string): void {
    this.typedWord = word;
  }
  
  /**
   * Helper to blend two colors
   */
  private blendColors(color1: string, color2: string, amount: number): string {
    // Simple blend between two colors
    if (amount <= 0) return color1;
    if (amount >= 1) return color2;
    
    // For simplicity, just interpolate between the two
    const r1 = parseInt(color1.slice(1, 3), 16) || 0;
    const g1 = parseInt(color1.slice(3, 5), 16) || 0;
    const b1 = parseInt(color1.slice(5, 7), 16) || 0;
    
    const r2 = 0; // green is 00ff00
    const g2 = 255;
    const b2 = 0;
    
    const r = Math.round(r1 + (r2 - r1) * amount);
    const g = Math.round(g1 + (g2 - g1) * amount);
    const b = Math.round(b1 + (b2 - b1) * amount);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
}

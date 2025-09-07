import { defineHex, Grid, rectangle, ring, Hex } from 'honeycomb-grid';
import { AnimationService } from '../services/AnimationService';

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
  
  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    // Don't initialize cells yet - wait for setLetters to be called
    this.cells = [];
    this.animationService = AnimationService.getInstance();
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
      const x = hex.x + offsetX;
      const y = hex.y + offsetY;
      
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
        const finalX = scaledCornerX + offsetX;
        const finalY = scaledCornerY + offsetY;
        
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
        this.ctx.fillStyle = '#ff4444'; // Red for clear button
        this.ctx.fill();
        
        if (clearAnimState) {
          this.ctx.restore();
        }
      } else if (!isCenterCell) {
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
          const normalColor = cell.letter ? '#3a4558' : '#2d3748';
          const greenIntensity = greenInputState.green;
          
          // Draw with green blend
          this.ctx.fillStyle = this.blendColors(normalColor, '#00ff00', greenIntensity);
          this.ctx.fill();
          
          // Add green glow effect
          if (greenIntensity > 0) {
            this.ctx.save();
            this.ctx.shadowColor = '#00ff00';
            this.ctx.shadowBlur = 20 * greenIntensity;
            this.ctx.strokeStyle = '#00ff00';
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
          
          this.ctx.fillStyle = cell.letter ? '#3a4558' : '#2d3748';
          this.ctx.fill();
          
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
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `${Math.floor(size * 0.7)}px 'Lilita One', Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('×', x, y); // Using × symbol for clear
      } else if (cell.letter && !isCenterCell) {
        // Draw letters only for non-center cells
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `${Math.floor(size * 0.6)}px 'Lilita One', Arial`;
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
    this.ctx.strokeStyle = '#4a5568';
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
          return 'CLEAR';
        }
        // Return the letter if it exists
        if (cell.letter) {
          this.typedWord += cell.letter;
          this.selectedPositions.push({ q: cell.q, r: cell.r });
          return cell.letter;
        }
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

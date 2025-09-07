import { defineHex, Grid, rectangle, ring, Hex } from 'honeycomb-grid';

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
  
  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    // Don't initialize cells yet - wait for setLetters to be called
    this.cells = [];
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
      const x = hex.x + offsetX;
      const y = hex.y + offsetY;
      
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
      
      // Fill with appropriate color
      if (isCenterCell && this.typedWord.length > 0) {
        // Only show clear button when there's typed text
        this.ctx.fillStyle = '#ff4444'; // Red for clear button
        this.ctx.fill();
      } else if (!isCenterCell) {
        // Normal cells with letters
        this.ctx.fillStyle = cell.letter ? '#3a4558' : '#2d3748';
        this.ctx.fill();
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
        // Check if center cell (clear)
        if (cell.q === 0 && cell.r === 0) {
          this.typedWord = '';
          return 'CLEAR';
        }
        // Return the letter if it exists
        if (cell.letter) {
          this.typedWord += cell.letter;
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
}

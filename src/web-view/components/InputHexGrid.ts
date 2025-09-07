import { defineHex, Grid, rectangle } from 'honeycomb-grid';

interface InputCell {
  q: number;
  r: number;
  letter?: string;
}

export class InputHexGrid {
  private ctx: CanvasRenderingContext2D;
  private cells: InputCell[] = [];
  private hexSize: number = 25;
  
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

    // Create optimal grid layout based on letter count
    let width: number, height: number;
    
    // Special layouts for common counts
    if (count <= 3) {
      width = count;
      height = 1;
    } else if (count === 4) {
      width = 2;
      height = 2;
    } else if (count <= 6) {
      width = 3;
      height = 2;
    } else if (count <= 9) {
      width = 3;
      height = 3;
    } else if (count <= 12) {
      width = 4;
      height = 3;
    } else {
      // For larger counts, create a roughly square grid
      width = Math.ceil(Math.sqrt(count * 1.2)); // Slightly wider than tall
      height = Math.ceil(count / width);
    }

    const grid = new Grid(MyHex, rectangle({ width, height }));

    // Convert grid hexes to our cell format and center them
    this.cells = [];
    let totalQ = 0;
    let totalR = 0;
    const tempCells: InputCell[] = [];
    let cellCount = 0;

    // Only take the exact number of cells we need
    grid.forEach(hex => {
      if (cellCount < count) {
        tempCells.push({ q: hex.q, r: hex.r });
        totalQ += hex.q;
        totalR += hex.r;
        cellCount++;
      }
    });

    // Center the grid
    const avgQ = totalQ / tempCells.length;
    const avgR = totalR / tempCells.length;

    tempCells.forEach(cell => {
      this.cells.push({ q: cell.q - avgQ, r: cell.r - avgR });
    });
  }
  
  /**
   * Renders the input grid
   */
  public render(centerX: number, centerY: number, dynamicSize?: number): number {
    // Don't render if no cells initialized
    if (this.cells.length === 0) {
      return centerY;
    }
    
    const size = dynamicSize || this.hexSize;
    const Hex = defineHex({
      dimensions: size,
      orientation: 'pointy'
    });
    
    let maxY = -Infinity;
    let minY = Infinity;
    
    // First pass: calculate bounds
    this.cells.forEach(cell => {
      const hex = new Hex([cell.q, cell.r]);
      const corners = hex.corners;
      corners.forEach(corner => {
        maxY = Math.max(maxY, corner.y);
        minY = Math.min(minY, corner.y);
      });
    });
    
    // Calculate offset to position bottom edge correctly
    const gridHeight = maxY - minY;
    const offsetY = centerY - maxY;  // Adjust so maxY aligns with centerY
    
    // Draw each cell
    this.cells.forEach((cell, index) => {
      const hex = new Hex([cell.q, cell.r]);
      const x = hex.x + centerX;
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
        const finalX = scaledCornerX + centerX;
        const finalY = scaledCornerY + offsetY;
        
        if (i === 0) {
          this.ctx.moveTo(finalX, finalY);
        } else {
          this.ctx.lineTo(finalX, finalY);
        }
      });
      this.ctx.closePath();
      
      // Fill with slightly lighter theme for input cells
      this.ctx.fillStyle = cell.letter ? '#3a4558' : '#2d3748';
      this.ctx.fill();
      
      // Stroke with accent color when has letter
      this.ctx.strokeStyle = cell.letter ? '#00d9ff' : '#4a5568';
      this.ctx.lineWidth = cell.letter ? 2 : 1;
      this.ctx.stroke();
      
      // Add letter if exists
      if (cell.letter) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `bold ${Math.floor(size * 0.6)}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(cell.letter.toUpperCase(), x, y);
      }
    });
    
    return centerY;  // Return the actual bottom position
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
    if (chars.length !== this.cells.length) {
      this.initializeCells(chars.length);
    }
    this.cells.forEach((cell, index) => {
      cell.letter = chars[index] || undefined;
    });
  }
}

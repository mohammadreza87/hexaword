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
    this.initializeCells();
  }
  
  /**
   * Initializes the 8-cell input grid
   */
  private initializeCells(): void {
    const MyHex = defineHex({
      dimensions: 30,
      orientation: 'pointy'
    });
    
    // Create a 4x2 rectangle grid
    const grid = new Grid(MyHex, rectangle({ width: 4, height: 2 }));
    
    // Convert grid hexes to our cell format and center them
    this.cells = [];
    let totalQ = 0;
    let totalR = 0;
    const tempCells: InputCell[] = [];
    
    // First pass: collect cells and calculate center
    grid.forEach(hex => {
      tempCells.push({q: hex.q, r: hex.r});
      totalQ += hex.q;
      totalR += hex.r;
    });
    
    // Calculate offset to center the grid
    const avgQ = totalQ / tempCells.length;
    const avgR = totalR / tempCells.length;
    
    // Second pass: apply centering offset
    tempCells.forEach(cell => {
      this.cells.push({
        q: cell.q - avgQ,
        r: cell.r - avgR
      });
    });
  }
  
  /**
   * Renders the input grid
   */
  public render(centerX: number, centerY: number, dynamicSize?: number): number {
    const size = dynamicSize || this.hexSize;
    const Hex = defineHex({
      dimensions: size,
      orientation: 'pointy'
    });
    
    let maxY = -Infinity;
    
    // Draw each cell
    this.cells.forEach((cell, index) => {
      const hex = new Hex([cell.q, cell.r]);
      const x = hex.x + centerX;
      const y = hex.y + centerY;
      
      // Track maximum Y for spacing calculation
      const corners = hex.corners;
      corners.forEach(corner => {
        maxY = Math.max(maxY, corner.y + centerY);
      });
      
      // Draw hex
      this.ctx.beginPath();
      this.ctx.moveTo(corners[0].x + centerX, corners[0].y + centerY);
      for (let i = 1; i < corners.length; i++) {
        this.ctx.lineTo(corners[i].x + centerX, corners[i].y + centerY);
      }
      this.ctx.closePath();
      
      // Fill with dark theme
      this.ctx.fillStyle = '#2d3748';
      this.ctx.fill();
      
      // Stroke
      this.ctx.strokeStyle = '#4a5568';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
      
      // Add letter if exists
      if (cell.letter) {
        this.ctx.fillStyle = '#e2e8f0';
        this.ctx.font = `bold ${Math.floor(size * 0.5)}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(cell.letter, x, y);
      }
    });
    
    return maxY;
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
    chars.forEach((char, index) => {
      if (index < this.cells.length) {
        this.cells[index].letter = char;
      }
    });
  }
}
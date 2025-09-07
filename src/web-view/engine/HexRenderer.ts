import { defineHex, Grid, Hex } from 'honeycomb-grid';
import { HexCell, RenderConfig } from '../../shared/types/hexaword';

export class HexRenderer {
  private ctx: CanvasRenderingContext2D;
  private config: RenderConfig;
  private hexFactory: any;
  
  constructor(ctx: CanvasRenderingContext2D, config?: Partial<RenderConfig>) {
    this.ctx = ctx;
    this.config = {
      hexSize: 15,
      fillColor: '#1a1f2e',
      strokeColor: '#2d3748',
      intersectionColor: '#00d9ff',
      textColor: '#e2e8f0',
      fontFamily: 'Arial',
      ...config
    };
    
    this.hexFactory = defineHex({
      dimensions: this.config.hexSize,
      orientation: 'pointy'
    });
  }

  /**
   * Updates the render configuration
   */
  updateConfig(config: Partial<RenderConfig>): void {
    this.config = { ...this.config, ...config };
    this.hexFactory = defineHex({
      dimensions: this.config.hexSize,
      orientation: 'pointy'
    });
  }

  /**
   * Clears the canvas
   */
  clear(width: number, height: number): void {
    // Fill with dark background color
    this.ctx.fillStyle = '#141514';
    this.ctx.fillRect(0, 0, width, height);
  }

  /**
   * Renders the complete hexagonal grid
   */
  renderGrid(
    board: Map<string, HexCell>, 
    centerX: number, 
    centerY: number
  ): void {
    // Calculate bounds for centering
    const bounds = this.calculateBounds(board);
    const offset = this.calculateCenterOffset(bounds);
    
    // Render each cell
    board.forEach(cell => {
      if (!cell.letter) return;
      this.renderHexCell(cell, centerX + offset.x, centerY + offset.y);
    });
  }

  /**
   * Renders a single hexagonal cell
   */
  private renderHexCell(cell: HexCell, offsetX: number, offsetY: number): void {
    const hex = new this.hexFactory([cell.q, cell.r]);
    const x = hex.x + offsetX;
    const y = hex.y + offsetY;
    
    // Draw hexagon with spacing
    this.drawHexagon(hex, offsetX, offsetY, cell.wordIds.length > 1, true);
    
    // Draw letter
    this.drawLetter(cell.letter!, x, y);
  }

  /**
   * Draws the hexagon shape
   */
  private drawHexagon(
    hex: any, 
    offsetX: number, 
    offsetY: number, 
    isIntersection: boolean,
    addSpacing: boolean = false
  ): void {
    const corners = hex.corners;
    const spacing = addSpacing ? 2 : 0; // 2 pixel spacing
    
    // Calculate center for scaling
    const centerX = hex.x + offsetX;
    const centerY = hex.y + offsetY;
    
    this.ctx.beginPath();
    // Scale corners inward to create spacing
    const scaleFactor = spacing > 0 ? (this.config.hexSize - spacing) / this.config.hexSize : 1;
    
    corners.forEach((corner, i) => {
      // Scale corner position relative to hex center
      const scaledX = centerX + (corner.x - hex.x) * scaleFactor;
      const scaledY = centerY + (corner.y - hex.y) * scaleFactor;
      
      if (i === 0) {
        this.ctx.moveTo(scaledX, scaledY);
      } else {
        this.ctx.lineTo(scaledX, scaledY);
      }
    });
    this.ctx.closePath();
    
    // Fill
    this.ctx.fillStyle = this.config.fillColor;
    this.ctx.fill();
    
    // Stroke
    if (isIntersection) {
      this.ctx.strokeStyle = this.config.intersectionColor;
      this.ctx.lineWidth = 1.5; // Thinner line for intersections
    } else {
      this.ctx.strokeStyle = this.config.strokeColor;
      this.ctx.lineWidth = 1; // Thinner line for regular cells
    }
    this.ctx.stroke();
  }

  /**
   * Draws a letter in the center of a hex
   */
  private drawLetter(letter: string, x: number, y: number): void {
    this.ctx.fillStyle = this.config.textColor;
    this.ctx.font = `${Math.floor(this.config.hexSize * 0.5)}px 'Lilita One', ${this.config.fontFamily}`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(letter.toUpperCase(), x, y);
  }

  /**
   * Calculates the bounds of the board
   */
  private calculateBounds(board: Map<string, HexCell>): {
    minQ: number;
    maxQ: number;
    minR: number;
    maxR: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } {
    let minQ = Infinity, maxQ = -Infinity;
    let minR = Infinity, maxR = -Infinity;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    board.forEach(cell => {
      if (!cell.letter) return;
      
      minQ = Math.min(minQ, cell.q);
      maxQ = Math.max(maxQ, cell.q);
      minR = Math.min(minR, cell.r);
      maxR = Math.max(maxR, cell.r);
      
      const hex = new this.hexFactory([cell.q, cell.r]);
      const corners = hex.corners;
      corners.forEach(corner => {
        minX = Math.min(minX, corner.x);
        maxX = Math.max(maxX, corner.x);
        minY = Math.min(minY, corner.y);
        maxY = Math.max(maxY, corner.y);
      });
    });
    
    return { minQ, maxQ, minR, maxR, minX, maxX, minY, maxY };
  }

  /**
   * Calculates the offset to center the grid
   */
  private calculateCenterOffset(bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }): { x: number; y: number } {
    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;
    
    return {
      x: -(bounds.minX + bounds.maxX) / 2,
      y: -(bounds.minY + bounds.maxY) / 2
    };
  }

  /**
   * Calculates dynamic hex size based on available space
   */
  calculateDynamicHexSize(
    board: Map<string, HexCell>,
    availableWidth: number,
    availableHeight: number,
    minSize: number = 5,
    maxSize: number = 20
  ): number {
    const bounds = this.calculateBounds(board);
    
    const gridWidth = bounds.maxQ - bounds.minQ + 1;
    const gridHeight = bounds.maxR - bounds.minR + 1;
    
    // For pointy orientation
    const maxHexByWidth = availableWidth / (gridWidth * 1.5);
    const maxHexByHeight = availableHeight / (gridHeight * 1.732);
    
    return Math.max(minSize, Math.min(maxHexByWidth, maxHexByHeight, maxSize));
  }

  /**
   * Renders debug information
   */
  renderDebugInfo(
    board: Map<string, HexCell>,
    x: number,
    y: number
  ): void {
    const bounds = this.calculateBounds(board);
    const gridWidth = bounds.maxQ - bounds.minQ + 1;
    const gridHeight = bounds.maxR - bounds.minR + 1;
    
    this.ctx.fillStyle = '#666';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    
    const debugInfo = [
      `Cells: ${board.size}`,
      `Grid: ${gridWidth}x${gridHeight}`,
      `Hex size: ${this.config.hexSize.toFixed(1)}px`
    ];
    
    debugInfo.forEach((line, i) => {
      this.ctx.fillText(line, x, y + i * 15);
    });
  }
}
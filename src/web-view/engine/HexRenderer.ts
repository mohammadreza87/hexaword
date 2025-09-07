import { defineHex, Grid, Hex } from 'honeycomb-grid';
import { HexCell, RenderConfig } from '../../shared/types/hexaword';
import { AnimationService } from '../services/AnimationService';

export class HexRenderer {
  private ctx: CanvasRenderingContext2D;
  private config: RenderConfig;
  private hexFactory: any;
  private animationService: AnimationService;
  
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
    
    this.animationService = AnimationService.getInstance();
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
    centerY: number,
    solvedCells?: Set<string>
  ): void {
    // Calculate bounds for centering
    const bounds = this.calculateBounds(board);
    const offset = this.calculateCenterOffset(bounds);
    
    // Render each cell
    board.forEach(cell => {
      if (!cell.letter) return;
      const key = `${cell.q},${cell.r}`;
      const isSolved = solvedCells?.has(key) || false;
      this.renderHexCell(cell, centerX + offset.x, centerY + offset.y, isSolved);
    });
  }

  /**
   * Renders a single hexagonal cell
   */
  private renderHexCell(cell: HexCell, offsetX: number, offsetY: number, isSolved: boolean = false): void {
    const hex = new this.hexFactory([cell.q, cell.r]);
    const cellKey = `${cell.q},${cell.r}`;
    let x = hex.x + offsetX;
    let y = hex.y + offsetY;
    
    // Apply animation transforms if any
    const animState = this.animationService.getCellAnimationState(cellKey);
    if (animState) {
      this.ctx.save();
      
      // Apply scale and rotation transforms
      this.ctx.translate(x, y);
      this.ctx.scale(animState.scale || 1, animState.scale || 1);
      this.ctx.rotate((animState.rotation || 0) * Math.PI / 180);
      this.ctx.translate(-x, -y);
      
      // Apply opacity
      this.ctx.globalAlpha = animState.opacity !== undefined ? animState.opacity : 1;
    }
    
    // Draw hexagon with spacing
    this.drawHexagon(hex, offsetX, offsetY, cell.wordIds.length > 1, true, isSolved || animState);
    
    // Draw letter only if solved or animating
    if (isSolved || animState) {
      this.drawLetter(cell.letter!, x, y, isSolved || animState);
    }
    
    // Restore context if animation was applied
    if (animState) {
      this.ctx.restore();
    }
  }

  /**
   * Draws the hexagon shape
   */
  private drawHexagon(
    hex: any, 
    offsetX: number, 
    offsetY: number, 
    isIntersection: boolean,
    addSpacing: boolean = false,
    isSolved: boolean = false
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
    
    // Fill - green if solved
    this.ctx.fillStyle = isSolved ? '#2d5a2d' : this.config.fillColor;
    this.ctx.fill();
    
    // Stroke - green if solved
    if (isSolved) {
      this.ctx.strokeStyle = '#00ff00';
      this.ctx.lineWidth = 2;
    } else if (isIntersection) {
      this.ctx.strokeStyle = this.config.intersectionColor;
      this.ctx.lineWidth = 1.5;
    } else {
      this.ctx.strokeStyle = this.config.strokeColor;
      this.ctx.lineWidth = 1;
    }
    this.ctx.stroke();
  }

  /**
   * Draws a letter in the center of a hex
   */
  private drawLetter(letter: string, x: number, y: number, isSolved: boolean = false): void {
    this.ctx.fillStyle = isSolved ? '#00ff00' : this.config.textColor;
    this.ctx.font = `${Math.floor(this.config.hexSize * 0.5)}px 'Lilita One', ${this.config.fontFamily}`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(letter.toUpperCase(), x, y);
  }

  /**
   * Gets the position of a hex cell
   */
  getHexPosition(q: number, r: number): { x: number, y: number } {
    const hex = new this.hexFactory([q, r]);
    return { x: hex.x, y: hex.y };
  }

  /**
   * Calculates the bounds of the board
   */
  calculateBounds(board: Map<string, HexCell>): {
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
  calculateCenterOffset(bounds: {
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
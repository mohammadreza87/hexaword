import { defineHex, Grid, Hex } from 'honeycomb-grid';
import { HexCell, RenderConfig } from '../../shared/types/hexaword';
import { AnimationService } from '../services/AnimationService';
import { ColorPaletteService, ColorScheme } from '../services/ColorPaletteService';

export class HexRenderer {
  private ctx: CanvasRenderingContext2D;
  private config: RenderConfig;
  private hexFactory: any;
  private animationService: AnimationService;
  private colorPaletteService: ColorPaletteService;
  private currentColors: ColorScheme | null = null;
  
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
    this.colorPaletteService = ColorPaletteService.getInstance();
    
    // Initialize with default colors
    this.initializeColors();
  }
  
  /**
   * Initialize colors from palette service
   */
  private async initializeColors(): Promise<void> {
    this.currentColors = await this.colorPaletteService.getCurrentScheme();
    this.applyColorScheme();
  }
  
  /**
   * Apply color scheme to config
   */
  private applyColorScheme(): void {
    if (!this.currentColors) return;
    
    this.config.fillColor = this.currentColors.cellFill;
    this.config.strokeColor = this.currentColors.cellStroke;
    this.config.intersectionColor = this.currentColors.intersectionColor;
    this.config.textColor = this.currentColors.text;
  }
  
  /**
   * Update level and refresh colors
   */
  async setLevel(level: number): Promise<void> {
    this.currentColors = await this.colorPaletteService.setLevel(level);
    this.applyColorScheme();
  }
  
  /**
   * Toggle theme
   */
  async toggleTheme(): Promise<void> {
    this.currentColors = await this.colorPaletteService.toggleTheme();
    this.applyColorScheme();
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
    // Fill with background color from current palette
    this.ctx.fillStyle = this.currentColors?.background || '#141514';
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
    
    // Check if this cell should be green from animation
    const greenCellState = (window as any).__greenCells?.[cellKey];
    const greenAmount = greenCellState ? greenCellState.green : 0;
    const glowAmount = greenCellState ? greenCellState.glow || 0 : 0;
    const shouldBeGreen = isSolved || greenAmount > 0;
    
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
    
    // Draw hexagon with smooth green transition
    this.drawHexagon(hex, offsetX, offsetY, cell.wordIds.length > 1, true, isSolved ? 1 : greenAmount, glowAmount);
    
    // Draw letter only if solved, green, or animating
    if (shouldBeGreen || animState) {
      this.drawLetter(cell.letter!, x, y, shouldBeGreen);
    }
    
    // Restore context if animation was applied
    if (animState) {
      this.ctx.restore();
    }
  }

  /**
   * Draws the hexagon shape with smooth color transitions
   */
  private drawHexagon(
    hex: any, 
    offsetX: number, 
    offsetY: number, 
    isIntersection: boolean,
    addSpacing: boolean = false,
    greenAmount: number | boolean = false,
    glowAmount: number = 0
  ): void {
    const corners = hex.corners;
    const spacing = addSpacing ? 2 : 0; // 2 pixel spacing
    
    // Calculate center for scaling
    const centerX = hex.x + offsetX;
    const centerY = hex.y + offsetY;
    
    // Convert boolean to number for smooth transition
    const green = typeof greenAmount === 'boolean' ? (greenAmount ? 1 : 0) : greenAmount;
    
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
    
    // Apply glow effect if present
    if (glowAmount > 0) {
      this.ctx.save();
      this.ctx.shadowColor = '#00ff00';
      this.ctx.shadowBlur = 20 * glowAmount;
    }
    
    // Fill - blend between normal and green based on greenAmount
    if (green > 0) {
      // Interpolate colors
      const normalColor = this.config.fillColor;
      const greenColor = '#2d5a2d';
      this.ctx.fillStyle = this.blendColors(normalColor, greenColor, green);
    } else {
      this.ctx.fillStyle = this.config.fillColor;
    }
    this.ctx.fill();
    
    // Remove glow for stroke
    if (glowAmount > 0) {
      this.ctx.restore();
    }
    
    // Stroke - blend green based on greenAmount
    if (green > 0) {
      const normalStroke = isIntersection ? this.config.intersectionColor : this.config.strokeColor;
      this.ctx.strokeStyle = this.blendColors(normalStroke, '#00ff00', green);
      this.ctx.lineWidth = 1 + green; // Slightly thicker when green
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
    this.ctx.fillStyle = isSolved ? (this.currentColors?.solvedColor || '#00ff00') : this.config.textColor;
    this.ctx.font = `${Math.floor(this.config.hexSize * 0.8)}px 'Lilita One', ${this.config.fontFamily}`;
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
   * Helper to blend two colors based on amount (0-1)
   */
  private blendColors(color1: string, color2: string, amount: number): string {
    // Clamp amount between 0 and 1
    amount = Math.max(0, Math.min(1, amount));
    
    // Parse hex colors
    const c1 = color1.startsWith('#') ? color1.slice(1) : color1;
    const c2 = color2.startsWith('#') ? color2.slice(1) : color2;
    
    const r1 = parseInt(c1.slice(0, 2), 16) || 0;
    const g1 = parseInt(c1.slice(2, 4), 16) || 0;
    const b1 = parseInt(c1.slice(4, 6), 16) || 0;
    
    const r2 = parseInt(c2.slice(0, 2), 16) || 0;
    const g2 = parseInt(c2.slice(2, 4), 16) || 0;
    const b2 = parseInt(c2.slice(4, 6), 16) || 0;
    
    // Interpolate
    const r = Math.round(r1 + (r2 - r1) * amount);
    const g = Math.round(g1 + (g2 - g1) * amount);
    const b = Math.round(b1 + (b2 - b1) * amount);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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
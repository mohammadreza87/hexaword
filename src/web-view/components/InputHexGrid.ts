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
  private baseHexSize: number = 25;
  private useWideGrid: boolean = false;
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
   * Initialize cells with horizontal row pattern
   * Pattern: 9 cells (first row), 8, 7, 6, 5, 4, 3, 2
   * Clear button at true center (0,0), grid built symmetrically around it
   */
  private initializeCells(count: number): void {
    if (count === 0) {
      this.cells = [];
      return;
    }

    // Clear and rebuild cells array
    this.cells = [];
    
    // Check if we need to use the wider grid pattern (11-10-9-8) for many letters
    // 11 + 10 + 9 + 8 = 38 cells max (minus 1 for clear button = 37 letters)
    if (count > 24) {
      this.useWideGrid = true;
      this.hexSize = this.baseHexSize * 0.65; // Make cells 35% smaller to fit in viewport
      
      // First, add the clear button at true center (0,0)
      this.cells.push({ q: 0, r: 0 });
      
      let cellsAdded = 0;
      
      // Row 1 (r=0): 11 cells total, centered on (0,0)
      // Clear button is at q=0, so we have 5 cells on each side
      const row1Positions = [
        {q: -5, r: 0}, {q: -4, r: 0}, {q: -3, r: 0}, {q: -2, r: 0}, {q: -1, r: 0},
        {q: 1, r: 0}, {q: 2, r: 0}, {q: 3, r: 0}, {q: 4, r: 0}, {q: 5, r: 0}
      ];
      
      for (const pos of row1Positions) {
        if (cellsAdded < count) {
          this.cells.push(pos);
          cellsAdded++;
        }
      }
      
      // Row 2 (r=-1): 10 cells, offset by -1 from row 1 (starts at -4)
      for (let i = 0; i < 10 && cellsAdded < count; i++) {
        this.cells.push({q: -4 + i, r: -1});
        cellsAdded++;
      }
      
      // Row 3 (r=-2): 9 cells, offset by -1 from row 2 (starts at -3)
      for (let i = 0; i < 9 && cellsAdded < count; i++) {
        this.cells.push({q: -3 + i, r: -2});
        cellsAdded++;
      }
      
      // Row 4 (r=-3): 8 cells, offset by -1 from row 3 (starts at -3, shifted for even row)
      for (let i = 0; i < 8 && cellsAdded < count; i++) {
        this.cells.push({q: -3 + i, r: -3});
        cellsAdded++;
      }
    } else {
      // Use standard grid pattern (9-8-7-6-5-4-3-2) for 24 or fewer letters
      this.useWideGrid = false;
      this.hexSize = this.baseHexSize;
      
      // First, add the clear button at true center (0,0)
      this.cells.push({ q: 0, r: 0 });
      
      // Now add letter cells in the exact order we want them filled
      let cellsAdded = 0;
      
      // Row 1 (r=0): 9 cells total, centered on (0,0)
      // Clear button is at q=0, so we have 4 cells on each side
      const row1Positions = [
        {q: -4, r: 0}, {q: -3, r: 0}, {q: -2, r: 0}, {q: -1, r: 0},
        {q: 1, r: 0}, {q: 2, r: 0}, {q: 3, r: 0}, {q: 4, r: 0}
      ];
      
      for (const pos of row1Positions) {
        if (cellsAdded < count) {
          this.cells.push(pos);
          cellsAdded++;
        }
      }
      
      // Row 2 (r=-1): 8 cells, centered
      // With hexagonal grid rotation, we need to center properly
      // 8 cells: centered from -3 to 4 (shifted half cell right from row 1)
      for (let i = 0; i < 8 && cellsAdded < count; i++) {
        this.cells.push({q: -3 + i, r: -1});
        cellsAdded++;
      }
      
      // Row 3 (r=-2): 7 cells, centered
      // 7 cells: shift right for better visual centering (-2 to 4)
      for (let i = 0; i < 7 && cellsAdded < count; i++) {
        this.cells.push({q: -2 + i, r: -2});
        cellsAdded++;
      }
      
      // Row 4 (r=-3): 6 cells, centered
      // 6 cells: -2 to 3 (shifted half cell right like other even rows)
      for (let i = 0; i < 6 && cellsAdded < count; i++) {
        this.cells.push({q: -2 + i, r: -3});
        cellsAdded++;
      }
      
      // Row 5 (r=-4): 5 cells, centered
      // 5 cells: -2 to 2 (odd number, center at 0)
      for (let i = 0; i < 5 && cellsAdded < count; i++) {
        this.cells.push({q: -2 + i, r: -4});
        cellsAdded++;
      }
      
      // Row 6 (r=-5): 4 cells, centered
      // 4 cells: -1 to 2 (shifted half cell right like other even rows)
      for (let i = 0; i < 4 && cellsAdded < count; i++) {
        this.cells.push({q: -1 + i, r: -5});
        cellsAdded++;
      }
      
      // Row 7 (r=-6): 3 cells, centered
      // 3 cells: -1 to 1 (odd number, center at 0)
      for (let i = 0; i < 3 && cellsAdded < count; i++) {
        this.cells.push({q: -1 + i, r: -6});
        cellsAdded++;
      }
      
      // Row 8 (r=-7): 2 cells, centered
      // 2 cells: 0 to 1 (shifted half cell right like other even rows)
      for (let i = 0; i < 2 && cellsAdded < count; i++) {
        this.cells.push({q: 0 + i, r: -7});
        cellsAdded++;
      }
    }
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
    
    // Use the internal hexSize when in wide grid mode, otherwise use provided size
    const size = this.useWideGrid ? this.hexSize : (dynamicSize || this.hexSize);
    const Hex = defineHex({
      dimensions: size,
      orientation: 'pointy'
    });
    
    // Save context state before rotation
    this.ctx.save();
    
    // Apply -30 degree rotation to entire grid (rotate counterclockwise)
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate(-30 * Math.PI / 180);  // Rotate -30 degrees
    this.ctx.translate(-centerX, -centerY);
    
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
    
    // Calculate offsets to center the grid horizontally and position vertically
    const gridWidth = maxX - minX;
    const gridHeight = maxY - minY;
    // Center the grid with adjustment for rotation
    const offsetX = centerX - (minX + maxX) / 2 + 20;  // Small offset to center after rotation
    // Position grid with good spacing from bottom
    const offsetY = centerY - maxY + 50;  // Moderate offset for good positioning
    
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
        
        // Clear button - no fill, just show the X symbol
        // Don't fill the background unless it's being hovered/animated
        if (clearAnimState && clearAnimState.scale > 1) {
          // Only fill when animating (being clicked)
          this.ctx.fillStyle = `rgba(255, 255, 255, ${0.1 * (clearAnimState.scale - 1)})`;
          this.ctx.fill();
        }
        
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
          
          // Blend between normal color and solved color from palette
          const normalColor = this.currentColors?.inputCellFill || 'rgba(0, 0, 0, 0.2)';
          const solvedColor = greenInputState.color || this.currentColors?.solvedColor || '#00ff00';
          const greenIntensity = greenInputState.green;
          
          // Draw with solved color blend
          this.ctx.fillStyle = this.blendColors(normalColor, solvedColor, greenIntensity);
          this.ctx.fill();
          
          // Add solved glow effect using palette colors
          if (greenIntensity > 0) {
            this.ctx.save();
            this.ctx.shadowColor = solvedColor;
            this.ctx.shadowBlur = 20 * greenIntensity;
            this.ctx.strokeStyle = solvedColor;
            this.ctx.globalAlpha = greenIntensity * 0.5;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            this.ctx.restore();
          }
          
          if (greenInputState.scale && greenInputState.scale !== 1) {
            this.ctx.restore();
          }
        } else {
          // Fill cell based on state
          if (isActive) {
            // Active cell gets accent color fill with transparency
            const accentColor = this.currentColors?.accent || '#00d9ff';
            // Parse hex to RGB and add transparency
            const hex = accentColor.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.15)`;
            this.ctx.fill();
            
            // Add glow effect
            this.ctx.save();
            this.ctx.shadowColor = accentColor;
            this.ctx.shadowBlur = 15;
            this.ctx.strokeStyle = accentColor;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            this.ctx.restore();
            
          } else if (isUsed) {
            // Used letters have very subtle dark fill
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            this.ctx.fill();
            
            // Subtle stroke
            this.ctx.strokeStyle = this.currentColors?.inputCellStroke || 'rgba(255, 255, 255, 0.04)';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
            
          } else {
            // Normal input cells - darker fill
            this.ctx.fillStyle = this.currentColors?.inputCellFill || 'rgba(0, 0, 0, 0.2)';
            this.ctx.fill();
            
            // Subtle stroke
            this.ctx.strokeStyle = this.currentColors?.inputCellStroke || 'rgba(255, 255, 255, 0.06)';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
          }
          
          // Animation glow if present
          if (animState?.glow) {
            this.ctx.save();
            this.ctx.shadowColor = this.currentColors?.accent || '#00d9ff';
            this.ctx.shadowBlur = 15 * animState.glow;
            this.ctx.globalAlpha = animState.glow * 0.5;
            this.ctx.strokeStyle = this.currentColors?.accent || '#00d9ff';
            this.ctx.lineWidth = 1.5;
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
        // Counter-rotate text to keep it upright
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(30 * Math.PI / 180);  // Counter-rotate +30 degrees
        this.ctx.translate(-x, -y);
        
        this.ctx.fillStyle = '#FFFFFF'; // Pure white for clear button
        this.ctx.font = `900 ${Math.floor(size * 0.9)}px 'Inter', Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('×', x, y); // Using × symbol for clear
        
        this.ctx.restore();
      } else if (cell.letter && !isCenterCell) {
        // Draw letters only for non-center cells
        // Check if this letter has been used
        const isUsed = this.usedLetters.has(`${cell.q},${cell.r}`);
        const isActive = !!this.activeCell && this.activeCell.q === cell.q && this.activeCell.r === cell.r;
        
        // Add shadow for better readability
        this.ctx.save();
        
        // Counter-rotate text to keep it upright
        this.ctx.translate(x, y);
        this.ctx.rotate(30 * Math.PI / 180);  // Counter-rotate +30 degrees
        this.ctx.translate(-x, -y);
        
        this.ctx.shadowColor = 'rgba(0,0,0,0.4)';
        this.ctx.shadowBlur = 2;
        this.ctx.shadowOffsetY = 1;
        
        // Always use pure white for maximum contrast
        this.ctx.fillStyle = '#FFFFFF';
        if (isUsed && !isActive) {
          this.ctx.globalAlpha = 0.3; // Dimmed for used letters
        } else if (isActive) {
          this.ctx.globalAlpha = 1; // Full opacity for active
        }
        
        this.ctx.font = `900 ${Math.floor(size * 0.8)}px 'Inter', Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(cell.letter.toUpperCase(), x, y);
        
        this.ctx.restore();
      }
      
      // Restore context if animation was applied
      if (animState) {
        this.ctx.restore();
      }
    });
    
    // Frame removed - no longer drawing frame
    // this.drawFrame(minX + offsetX, maxX + offsetX, minY + offsetY, maxY + offsetY);
    
    // Restore context state after rotation
    this.ctx.restore();
    
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
    // Use the internal hexSize when in wide grid mode, otherwise use provided size
    const size = this.useWideGrid ? this.hexSize : (dynamicSize || this.hexSize);
    const Hex = defineHex({
      dimensions: size,
      orientation: 'pointy'
    });
    
    // First, reverse the rotation to get the click in grid coordinates
    // The grid is rotated -30 degrees, so we need to rotate the click +30 degrees
    const angle = 30 * Math.PI / 180;
    const dx = x - centerX;
    const dy = y - centerY;
    const rotatedX = centerX + dx * Math.cos(angle) - dy * Math.sin(angle);
    const rotatedY = centerY + dx * Math.sin(angle) + dy * Math.cos(angle);
    
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
    
    // Same offsets as render method
    const offsetX = centerX - (minX + maxX) / 2 + 20;
    const offsetY = centerY - maxY + 50;
    
    // Check each cell for click
    for (const cell of this.cells) {
      const hex = new Hex([cell.q, cell.r]);
      const hexX = hex.x + offsetX;
      const hexY = hex.y + offsetY;
      
      // Check if click is within this hex (simple distance check)
      // Use the rotated click coordinates
      const distance = Math.sqrt((rotatedX - hexX) ** 2 + (rotatedY - hexY) ** 2);
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
  ): { leftX: number; rightX: number; topY: number; bottomY: number; topmostCellY: number } {
    // Use the internal hexSize when in wide grid mode, otherwise use provided size
    const size = this.useWideGrid ? this.hexSize : (dynamicSize || this.hexSize);
    const Hex = defineHex({ dimensions: size, orientation: 'pointy' });
    let maxY = -Infinity, minY = Infinity, maxX = -Infinity, minX = Infinity;
    
    // Find the topmost row (smallest r value, since negative r is up)
    let topmostRow = 0;
    let topmostCellY = Infinity;
    this.cells.forEach(cell => {
      if (cell.q === 0 && cell.r === 0) return; // skip clear button
      if (cell.r < topmostRow) {
        topmostRow = cell.r;
      }
    });
    
    console.log('DEBUG: Finding topmost row:', {
      topmostRow,
      totalCells: this.cells.length,
      allRows: [...new Set(this.cells.map(c => c.r))].sort()
    });
    
    // Calculate bounds and find the Y position of topmost cell
    this.cells.forEach(cell => {
      const hex = new Hex([cell.q, cell.r]);
      const corners = hex.corners;
      corners.forEach(corner => {
        maxY = Math.max(maxY, corner.y);
        minY = Math.min(minY, corner.y);
        maxX = Math.max(maxX, corner.x);
        minX = Math.min(minX, corner.x);
      });
      // Get the center Y position of the topmost row cells
      if (cell.r === topmostRow) {
        topmostCellY = Math.min(topmostCellY, hex.y);
        console.log('DEBUG: Cell in topmost row:', { q: cell.q, r: cell.r, y: hex.y });
      }
    });
    
    const offsetX = centerX - (minX + maxX) / 2;  // same centering as render
    const offsetY = centerY - maxY;               // bottom aligns with centerY
    
    console.log('DEBUG: Final bounds calculation:', {
      topmostCellY_raw: topmostCellY,
      offsetY,
      topmostCellY_final: topmostCellY + offsetY,
      centerY
    });
    
    return {
      leftX: minX + offsetX,
      rightX: maxX + offsetX,
      topY: minY + offsetY,
      bottomY: maxY + offsetY,
      topmostCellY: topmostCellY + offsetY  // The Y position of topmost cell center
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
    // Same offsets as render method
    const offsetX = centerX - (minX + maxX) / 2 + 20;
    const offsetY = centerY - maxY + 50;
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
    
    // Same offsets as render method
    const offsetX = centerX - (minX + maxX) / 2 + 20;
    const offsetY = centerY - maxY + 50;
    
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
    
    // The cells array has center cell at index 0, then all letter positions
    // We need to assign letters to non-center cells in order
    // Since center is at index 0, we start from index 1
    for (let i = 1; i < this.cells.length && i - 1 < chars.length; i++) {
      this.cells[i].letter = chars[i - 1];
    }
  }
  
  /**
   * Gets the positions of selected hexes
   */
  public getSelectedPositions(): Array<{q: number, r: number}> {
    return [...this.selectedPositions];
  }

  /**
   * Public: return all input cell keys in drawing order (excluding center).
   */
  public getAllInputKeys(): string[] {
    // Sort by row then q for a simple wave
    const list = this.cells
      .filter(c => !(c.q === 0 && c.r === 0) && c.letter)
      .map(c => ({ key: `input_${c.q},${c.r}`, q: c.q, r: c.r }));
    list.sort((a, b) => (a.r !== b.r ? a.r - b.r : a.q - b.q));
    return list.map(i => i.key);
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
    // Clamp
    if (amount <= 0) return color1;
    if (amount >= 1) return color2;

    const toRGB = (c: string): { r: number; g: number; b: number } => {
      c = (c || '').trim();
      if (!c) return { r: 0, g: 0, b: 0 };
      if (c.startsWith('#')) {
        const hex = c.slice(1);
        const h = hex.length === 3
          ? hex.split('').map(ch => ch + ch).join('')
          : hex;
        const r = parseInt(h.slice(0, 2), 16) || 0;
        const g = parseInt(h.slice(2, 4), 16) || 0;
        const b = parseInt(h.slice(4, 6), 16) || 0;
        return { r, g, b };
      }
      // rgb/rgba
      const m = c.match(/rgba?\(([^)]+)\)/i);
      if (m) {
        const parts = m[1].split(',').map(v => parseFloat(v.trim()));
        return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0 };
      }
      // Fallback: try to let canvas parse named colors
      try {
        const tmp = document.createElement('canvas').getContext('2d');
        if (tmp) {
          tmp.fillStyle = c as any;
          const v = tmp.fillStyle as string;
          const m2 = v.match(/rgba?\(([^)]+)\)/i);
          if (m2) {
            const parts = m2[1].split(',').map(v => parseFloat(v.trim()));
            return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0 };
          }
        }
      } catch {}
      return { r: 0, g: 0, b: 0 };
    };

    const a = toRGB(color1);
    const b = toRGB(color2);
    const r = Math.round(a.r + (b.r - a.r) * amount);
    const g = Math.round(a.g + (b.g - a.g) * amount);
    const bl = Math.round(a.b + (b.b - a.b) * amount);
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
  }
}

import { defineHex, Grid, rectangle, Hex as HoneycombHex } from 'honeycomb-grid';
import { Tile } from '../../domain/entities/Tile';
import { SeededRNG } from '../../../utils/rng';

export interface GridConfig {
  width: number;
  height: number;
  hexSize: number;
}

export class GridService {
  private grid: Grid<HoneycombHex>;
  private config: GridConfig;
  private rng?: SeededRNG;

  constructor(config: GridConfig, rng?: SeededRNG) {
    this.config = config;
    this.rng = rng;
    this.initializeGrid();
  }

  private initializeGrid(): void {
    const HexClass = defineHex({ 
      dimensions: this.config.hexSize,
      origin: 'topLeft'
    });
    
    this.grid = new Grid(
      HexClass, 
      rectangle({ 
        width: this.config.width, 
        height: this.config.height 
      })
    );
  }

  generateTiles(): Map<string, Tile> {
    const tiles = new Map<string, Tile>();
    
    this.grid.forEach(hex => {
      const tile = new Tile(
        hex.q,
        hex.r,
        hex.s,
        this.generateRandomLetter()
      );
      tiles.set(tile.id, tile);
    });
    
    return tiles;
  }

  private generateRandomLetter(): string {
    const letterFrequencies = 'AAAAAAAAABBBCCCDDDDEEEEEEEEEEEFFGGGHHHHHIIIIIIIIIJKLLLLLMMMNNNNNNNOOOOOOOOPPQRRRRRRSSSSSSTTTTTTTTUUUUVWWXYYZ';
    
    // Use seeded RNG if provided, otherwise don't generate random letters
    // (This method should typically only be called for non-puzzle contexts)
    if (this.rng) {
      const index = this.rng.nextInt(0, letterFrequencies.length - 1);
      return letterFrequencies[index];
    }
    
    // Fallback: return a deterministic default if no RNG
    // This ensures puzzle generation doesn't get random letters
    return 'A';
  }

  getHexCenter(tile: Tile): { x: number; y: number } {
    const hex = this.grid.getHex({ q: tile.q, r: tile.r });
    if (!hex) return { x: 0, y: 0 };
    
    const point = hex.toPoint();
    return { x: point.x, y: point.y };
  }

  getHexCorners(tile: Tile): Array<{ x: number; y: number }> {
    const hex = this.grid.getHex({ q: tile.q, r: tile.r });
    if (!hex) return [];
    
    return hex.corners.map(corner => ({ 
      x: corner.x, 
      y: corner.y 
    }));
  }

  getNeighbors(tile: Tile): Tile[] {
    const hex = this.grid.getHex({ q: tile.q, r: tile.r });
    if (!hex) return [];
    
    return this.grid
      .neighborsOf(hex)
      .map(neighbor => new Tile(
        neighbor.q,
        neighbor.r,
        neighbor.s
      ));
  }

  getTileAt(x: number, y: number): Tile | null {
    const hex = this.grid.pointToHex({ x, y });
    if (!hex || !this.grid.getHex(hex)) return null;
    
    return new Tile(hex.q, hex.r, hex.s);
  }
}

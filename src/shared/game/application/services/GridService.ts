import { defineHex, Grid, rectangle, Hex as HoneycombHex } from 'honeycomb-grid';
import { Tile } from '../../domain/entities/Tile';

export interface GridConfig {
  width: number;
  height: number;
  hexSize: number;
}

export class GridService {
  private grid: Grid<HoneycombHex>;
  private config: GridConfig;

  constructor(config: GridConfig) {
    this.config = config;
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
    return letterFrequencies[Math.floor(Math.random() * letterFrequencies.length)];
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

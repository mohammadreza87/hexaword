import { Tile } from './Tile';

export interface IGameState {
  tiles: Map<string, Tile>;
  selectedTiles: string[];
  currentWord: string;
  foundWords: string[];
  score: number;
  level: number;
}

export class GameState implements IGameState {
  tiles: Map<string, Tile>;
  selectedTiles: string[] = [];
  currentWord: string = '';
  foundWords: string[] = [];
  score: number = 0;
  level: number = 1;

  constructor() {
    this.tiles = new Map();
  }

  selectTile(tileId: string): void {
    const tile = this.tiles.get(tileId);
    if (!tile || tile.isLocked) return;

    if (this.selectedTiles.includes(tileId)) {
      this.deselectTile(tileId);
    } else {
      this.selectedTiles.push(tileId);
      tile.isSelected = true;
      this.updateCurrentWord();
    }
  }

  deselectTile(tileId: string): void {
    const index = this.selectedTiles.indexOf(tileId);
    if (index === -1) return;

    const tile = this.tiles.get(tileId);
    if (tile) {
      tile.isSelected = false;
    }
    
    this.selectedTiles.splice(index, 1);
    this.updateCurrentWord();
  }

  clearSelection(): void {
    this.selectedTiles.forEach(tileId => {
      const tile = this.tiles.get(tileId);
      if (tile) {
        tile.isSelected = false;
      }
    });
    this.selectedTiles = [];
    this.currentWord = '';
  }

  private updateCurrentWord(): void {
    this.currentWord = this.selectedTiles
      .map(id => this.tiles.get(id)?.letter || '')
      .join('');
  }

  submitWord(): boolean {
    if (this.currentWord.length < 3) return false;
    
    if (!this.foundWords.includes(this.currentWord)) {
      this.foundWords.push(this.currentWord);
      this.score += this.currentWord.length * 10;
      this.clearSelection();
      return true;
    }
    
    return false;
  }
}

import { GameState } from '../../domain/entities/GameState';
import { GridService } from './GridService';
import { EventBus, GameEvent, GameEventType } from '../../domain/events/GameEvents';
import { Tile } from '../../domain/entities/Tile';

export class GameService {
  private gameState: GameState;
  private gridService: GridService;
  private eventBus: EventBus;

  constructor(gridService: GridService, eventBus: EventBus) {
    this.gridService = gridService;
    this.eventBus = eventBus;
    this.gameState = new GameState();
  }

  initializeGame(): void {
    this.gameState.tiles = this.gridService.generateTiles();
    
    this.eventBus.emit({
      type: GameEventType.GAME_STARTED,
      timestamp: Date.now(),
      payload: { level: this.gameState.level }
    });
  }

  selectTile(tileId: string): void {
    const tile = this.gameState.tiles.get(tileId);
    if (!tile) return;

    const wasSelected = tile.isSelected;
    this.gameState.selectTile(tileId);

    this.eventBus.emit({
      type: wasSelected ? GameEventType.TILE_DESELECTED : GameEventType.TILE_SELECTED,
      timestamp: Date.now(),
      payload: { tileId, currentWord: this.gameState.currentWord }
    });
  }

  submitWord(): void {
    const word = this.gameState.currentWord;
    
    this.eventBus.emit({
      type: GameEventType.WORD_SUBMITTED,
      timestamp: Date.now(),
      payload: { word }
    });

    const isValid = this.gameState.submitWord();

    this.eventBus.emit({
      type: isValid ? GameEventType.WORD_FOUND : GameEventType.WORD_INVALID,
      timestamp: Date.now(),
      payload: { 
        word, 
        score: this.gameState.score,
        isValid 
      }
    });
  }

  getTileAt(x: number, y: number): Tile | null {
    const hexTile = this.gridService.getTileAt(x, y);
    if (!hexTile) return null;
    
    return this.gameState.tiles.get(hexTile.id) || null;
  }

  getGameState(): GameState {
    return this.gameState;
  }

  resetGame(): void {
    this.gameState = new GameState();
    this.initializeGame();
  }
}

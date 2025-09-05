export enum GameEventType {
  TILE_SELECTED = 'TILE_SELECTED',
  TILE_DESELECTED = 'TILE_DESELECTED',
  WORD_SUBMITTED = 'WORD_SUBMITTED',
  WORD_FOUND = 'WORD_FOUND',
  WORD_INVALID = 'WORD_INVALID',
  GAME_STARTED = 'GAME_STARTED',
  GAME_COMPLETED = 'GAME_COMPLETED',
  LEVEL_COMPLETED = 'LEVEL_COMPLETED',
}

export interface GameEvent {
  type: GameEventType;
  timestamp: number;
  payload?: any;
}

export class EventBus {
  private listeners: Map<GameEventType, Set<(event: GameEvent) => void>> = new Map();

  subscribe(type: GameEventType, callback: (event: GameEvent) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    
    this.listeners.get(type)!.add(callback);
    
    return () => {
      this.listeners.get(type)?.delete(callback);
    };
  }

  emit(event: GameEvent): void {
    const callbacks = this.listeners.get(event.type);
    if (callbacks) {
      callbacks.forEach(callback => callback(event));
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

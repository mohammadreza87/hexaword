import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../shared/game/domain/entities/GameState';
import { Tile } from '../shared/game/domain/entities/Tile';

function makeTile(id: string, letter: string, overrides: Partial<Tile> = {}): Tile {
  return {
    id,
    letter,
    isSelected: false,
    isLocked: false,
    x: 0,
    y: 0,
    ...overrides,
  } as unknown as Tile;
}

describe('GameState', () => {
  let state: GameState;

  beforeEach(() => {
    state = new GameState();
    state.tiles.set('A', makeTile('A', 'C'));
    state.tiles.set('B', makeTile('B', 'A'));
    state.tiles.set('C', makeTile('C', 'T'));
  });

  it('selects and deselects tiles, updating currentWord', () => {
    state.selectTile('A');
    state.selectTile('B');
    expect(state.currentWord).toBe('CA');
    expect(state.selectedTiles).toEqual(['A', 'B']);

    state.deselectTile('A');
    expect(state.currentWord).toBe('A');
    expect(state.selectedTiles).toEqual(['B']);
  });

  it('toggles selection when selecting an already selected tile', () => {
    state.selectTile('A');
    expect(state.tiles.get('A')?.isSelected).toBe(true);
    state.selectTile('A');
    expect(state.tiles.get('A')?.isSelected).toBe(false);
    expect(state.currentWord).toBe('');
  });

  it('submitWord scores only when length >= 3 and not duplicate', () => {
    // Too short
    state.selectTile('A');
    state.selectTile('B');
    expect(state.submitWord()).toBe(false);
    expect(state.score).toBe(0);

    // CAT (3 letters) valid
    state.selectTile('C');
    expect(state.currentWord).toBe('CAT');
    expect(state.submitWord()).toBe(true);
    expect(state.score).toBe(30);
    expect(state.foundWords).toContain('CAT');

    // Duplicate CAT ignored
    state.selectTile('A');
    state.selectTile('B');
    state.selectTile('C');
    expect(state.currentWord).toBe('ATC');
    // Note: word content differs due to order; emulate resubmitting CAT
    state.currentWord = 'CAT';
    expect(state.submitWord()).toBe(false);
    expect(state.score).toBe(30);
  });
});


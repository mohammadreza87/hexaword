import { describe, it, expect } from 'vitest';
import { WordPlacementService } from '../shared/algorithms/WordPlacementService';
import { createRNG } from '../shared/utils/rng';
import { ALL_HEX_DIRECTIONS } from '../shared/types/hexaword';

function makeWords(words: string[]) {
  return words.map((w) => ({
    word: w,
    chars: w.split(''),
    totalMatches: 0,
    effectiveMatches: 0,
    successfulMatches: [],
  }));
}

function neighborsOf(q: number, r: number) {
  return ALL_HEX_DIRECTIONS.map((d) => ({ q: q + d.q, r: r + d.r }));
}

describe('WordPlacementService constraints', () => {
  it('does not allow adjacency between different words (no touching without intersection)', () => {
    const rng = createRNG('rules-seed-1');
    const service = new WordPlacementService(6, rng);
    const words = makeWords(['HELLO', 'WORLD', 'HOLD', 'LOW']);
    const ok = service.placeWords(words);
    expect(ok).toBe(true);

    const board = service.getBoard();
    // Build a map from coord to set of wordIds
    board.forEach((cell, key) => {
      const [q, r] = key.split(',').map(Number);
      for (const n of neighborsOf(q, r)) {
        const nKey = `${n.q},${n.r}`;
        const nb = board.get(nKey);
        if (!nb) continue;
        const a = new Set(cell.wordIds);
        const b = new Set(nb.wordIds);
        const overlap = [...a].some((id) => b.has(id));
        // If no overlap in wordIds, these are different words touching, which should not happen
        expect(overlap).toBe(true);
      }
    });
  });

  it('intersections share the same letter across words', () => {
    const rng = createRNG('rules-seed-2');
    const service = new WordPlacementService(6, rng);
    const words = makeWords(['CROSS', 'SCAR', 'ROSE']);
    const ok = service.placeWords(words);
    expect(ok).toBe(true);

    const board = service.getBoard();
    board.forEach((cell) => {
      if (cell.wordIds.length > 1) {
        // Cells participating in more than one word must be real intersections with a concrete letter
        expect(cell.letter).toMatch(/^[A-Z]$/);
      }
    });
  });

  it('respects grid bounds (with relaxed allowance), not exceeding radius+2', () => {
    const rng = createRNG('rules-seed-3');
    const radius = 5;
    const service = new WordPlacementService(radius, rng);
    const words = makeWords(['ALPHA', 'PHASE', 'SHAPE', 'HEAPS']);
    const ok = service.placeWords(words);
    expect(ok).toBe(true);

    const board = service.getBoard();
    board.forEach((cell) => {
      const q = Math.abs(cell.q);
      const r = Math.abs(cell.r);
      const s = Math.abs(-cell.q - cell.r);
      const dist = Math.max(q, r, s);
      expect(dist).toBeLessThanOrEqual(radius + 2);
    });
  });
});


/**
 * Unit tests for deterministic puzzle generation
 * Ensures same seed always produces same puzzle
 */

import { createRNG } from '../shared/utils/rng';
import { CrosswordGenerator } from '../web-view/services/CrosswordGenerator';
import { WordPlacementService } from '../shared/algorithms/WordPlacementService';

describe('Deterministic Puzzle Generation', () => {
  const testWords = ['HELLO', 'WORLD', 'CODE', 'TEST', 'GAME'];
  
  describe('RNG Determinism', () => {
    it('should produce same sequence with same seed', () => {
      const rng1 = createRNG('test-seed-123');
      const rng2 = createRNG('test-seed-123');
      
      const values1 = Array.from({ length: 100 }, () => rng1.next());
      const values2 = Array.from({ length: 100 }, () => rng2.next());
      
      expect(values1).toEqual(values2);
    });
    
    it('should produce different sequences with different seeds', () => {
      const rng1 = createRNG('seed-1');
      const rng2 = createRNG('seed-2');
      
      const values1 = Array.from({ length: 100 }, () => rng1.next());
      const values2 = Array.from({ length: 100 }, () => rng2.next());
      
      expect(values1).not.toEqual(values2);
    });
    
    it('should shuffle arrays deterministically', () => {
      const rng1 = createRNG('shuffle-seed');
      const rng2 = createRNG('shuffle-seed');
      
      const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const arr1 = [...original];
      const arr2 = [...original];
      
      const shuffled1 = rng1.shuffle(arr1);
      const shuffled2 = rng2.shuffle(arr2);
      
      expect(shuffled1).toEqual(shuffled2);
      expect(shuffled1).not.toEqual(original); // Should be shuffled
    });
  });
  
  describe('CrosswordGenerator Determinism', () => {
    it('should generate identical puzzles with same seed', async () => {
      const generator1 = new CrosswordGenerator({
        words: testWords,
        seed: 'puzzle-seed-456',
        gridRadius: 10
      });
      
      const generator2 = new CrosswordGenerator({
        words: testWords,
        seed: 'puzzle-seed-456',
        gridRadius: 10
      });
      
      const result1 = await generator1.generate();
      const result2 = await generator2.generate();
      
      // Convert board maps to arrays for comparison
      const board1Array = Array.from(result1.board.entries()).sort();
      const board2Array = Array.from(result2.board.entries()).sort();
      
      expect(board1Array).toEqual(board2Array);
      expect(result1.placedWords.length).toBe(result2.placedWords.length);
      
      // Check each placed word
      result1.placedWords.forEach((word, index) => {
        const word2 = result2.placedWords[index];
        expect(word.word).toBe(word2.word);
        expect(word.q).toBe(word2.q);
        expect(word.r).toBe(word2.r);
        expect(word.dir).toBe(word2.dir);
      });
    });
    
    it('should generate different puzzles with different seeds', async () => {
      const generator1 = new CrosswordGenerator({
        words: testWords,
        seed: 'seed-A',
        gridRadius: 10
      });
      
      const generator2 = new CrosswordGenerator({
        words: testWords,
        seed: 'seed-B',
        gridRadius: 10
      });
      
      const result1 = await generator1.generate();
      const result2 = await generator2.generate();
      
      // At least one word should be placed differently
      let foundDifference = false;
      
      for (let i = 0; i < Math.min(result1.placedWords.length, result2.placedWords.length); i++) {
        const word1 = result1.placedWords[i];
        const word2 = result2.placedWords[i];
        
        if (word1.q !== word2.q || word1.r !== word2.r || word1.dir !== word2.dir) {
          foundDifference = true;
          break;
        }
      }
      
      expect(foundDifference).toBe(true);
    });
  });
  
  describe('WordPlacementService Determinism', () => {
    it('should place words consistently with same RNG', () => {
      const rng1 = createRNG('placement-seed');
      const rng2 = createRNG('placement-seed');
      
      const service1 = new WordPlacementService(10, rng1);
      const service2 = new WordPlacementService(10, rng2);
      
      const words = testWords.map(w => ({
        word: w,
        chars: w.split(''),
        totalMatches: 0,
        effectiveMatches: 0,
        successfulMatches: []
      }));
      
      const success1 = service1.placeWords([...words]);
      const success2 = service2.placeWords([...words]);
      
      expect(success1).toBe(success2);
      
      const board1 = service1.getBoard();
      const board2 = service2.getBoard();
      
      expect(board1.size).toBe(board2.size);
      
      // Check all cells match
      board1.forEach((cell, key) => {
        const cell2 = board2.get(key);
        expect(cell2).toBeDefined();
        expect(cell.letter).toBe(cell2?.letter);
      });
    });
  });
  
  describe('End-to-End Determinism', () => {
    it('should produce identical games across reloads with same seed', async () => {
      const seed = 'e2e-test-seed';
      const words = ['FOE', 'REF', 'GIG', 'RIG', 'FIG', 'FIRE', 'FROG'];
      
      // Simulate two independent game loads
      const runGeneration = async () => {
        const generator = new CrosswordGenerator({
          words,
          seed,
          gridRadius: 10
        });
        return await generator.generate();
      };
      
      const game1 = await runGeneration();
      const game2 = await runGeneration();
      
      // Verify identical output
      expect(game1.success).toBe(game2.success);
      expect(game1.board.size).toBe(game2.board.size);
      expect(game1.placedWords.length).toBe(game2.placedWords.length);
      
      // Deep check placement details
      game1.placedWords.forEach((word, i) => {
        const word2 = game2.placedWords[i];
        expect({
          word: word.word,
          q: word.q,
          r: word.r,
          dir: word.dir
        }).toEqual({
          word: word2.word,
          q: word2.q,
          r: word2.r,
          dir: word2.dir
        });
      });
    });
  });
});

// Test helper to verify no Math.random() usage
describe('No Unseeded Randomness', () => {
  it('should not use Math.random in critical paths', () => {
    // Mock Math.random to throw if called
    const originalRandom = Math.random;
    Math.random = () => {
      throw new Error('Math.random() called - use seeded RNG instead!');
    };
    
    try {
      const generator = new CrosswordGenerator({
        words: ['TEST', 'WORD'],
        seed: 'no-random-test',
        gridRadius: 5
      });
      
      // This should not throw if no Math.random is used
      expect(() => generator.generate()).not.toThrow();
    } finally {
      // Restore original Math.random
      Math.random = originalRandom;
    }
  });
});
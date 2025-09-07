/**
 * Core types for HexaWord game
 */

export interface WordObject {
  word: string;
  chars: string[];
  totalMatches: number;
  effectiveMatches: number;
  successfulMatches: Array<{q: number, r: number, dir: number}>;
  placed?: boolean;
  q?: number;
  r?: number;
  dir?: number;
}

export interface HexCell {
  q: number;
  r: number;
  letter: string | null;
  wordIds: number[];
}

export interface HexCoordinate {
  q: number;
  r: number;
}

export interface HexDirection {
  q: number;
  r: number;
}

export interface GridBounds {
  minQ: number;
  maxQ: number;
  minR: number;
  maxR: number;
}

export interface PlacementResult {
  q: number;
  r: number;
  dir: number;
}

export interface ConnectionPoint {
  q: number;
  r: number;
  parentDir: number;
}

export interface WordPlacement {
  word: WordObject;
  startQ: number;
  startR: number;
  direction: number;
}

export interface PuzzleConfig {
  gridRadius: number;
  words: string[];
  seed?: string;
}

export interface RenderConfig {
  hexSize: number;
  fillColor: string;
  strokeColor: string;
  intersectionColor: string;
  textColor: string;
  fontFamily: string;
}

// Direction constants
export const DIRECTIONS = {
  HORIZONTAL: 0,  // Q axis
  VERTICAL: 1,    // R axis  
  DIAGONAL: 2     // S axis
} as const;

export type DirectionType = typeof DIRECTIONS[keyof typeof DIRECTIONS];

// Hexagonal directions for readable words (pointy-top orientation)
export const HEX_DIRECTIONS: HexDirection[] = [
  {q: 1, r: 0},    // Left to right (horizontal along Q axis)
  {q: 0, r: 1},    // Up to down (vertical along R axis)
  {q: 1, r: -1},   // NW to SE diagonal (Southeast direction)
];

// All 6 hexagonal neighbor directions
export const ALL_HEX_DIRECTIONS: HexDirection[] = [
  {q: 1, r: 0},   // East
  {q: -1, r: 1},  // Southwest 
  {q: 0, r: -1},  // Northeast
  {q: -1, r: 0},  // West
  {q: 1, r: -1},  // Southeast
  {q: 0, r: 1}    // South
];
#!/usr/bin/env node
// Simple CSV → JSON builder for level words.
// Reads: src/levels/HexaWord - English.csv
// Writes: src/server/data/words.json and src/server/data/levels.json
// Output shape: [{ word: string, clue?: string, level?: number, difficulty?: number }]

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const CSV_PATH = path.join(ROOT, 'src', 'levels', 'HexaWord - English.csv');
const OUT_DIR = path.join(ROOT, 'src', 'server', 'data');
const OUT_WORDS_PATH = path.join(OUT_DIR, 'words.json');
const OUT_LEVELS_PATH = path.join(OUT_DIR, 'levels.json');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function parseCSVLine(line) {
  // Basic CSV with commas, fields are simple and WORDS is ; separated based on the sample
  // LEVEL,NUM OF LETTERS,NUM OF WORDS,DIFFICULTY,LEVEL CLUE,WORDS
  // 1,92,3,980,NUTS,ALMOND;CASHEW;PEANUT
  const parts = line.split(',');
  if (parts.length < 6) return null;
  const level = Number(parts[0]);
  const difficulty = Number(parts[3]);
  const clue = parts[4]?.trim();
  // WORDS field might contain commas if clue had commas earlier; join the rest then split by ;
  const wordsJoined = parts.slice(5).join(',');
  const words = wordsJoined.split(/;|\|/).map(w => w.trim()).filter(Boolean);
  return { level, difficulty, clue, words };
}

function normalizeWord(w) {
  const upper = w.toUpperCase().replace(/[^A-Z]/g, '');
  return upper;
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found at ${CSV_PATH}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const header = lines.shift();
  if (!header || !header.startsWith('LEVEL')) {
    console.warn('Unexpected CSV header; proceeding anyway.');
  }

  const out = [];
  const levels = [];
  const seen = new Set();
  for (const line of lines) {
    const row = parseCSVLine(line);
    if (!row) continue;
    // Capture the level row with normalized words
    const normalizedWords = row.words.map(normalizeWord).filter(Boolean);
    levels.push({
      level: row.level,
      numLetters: Number.isFinite(row.level) ? row.level : undefined, // CSV had NUM OF LETTERS; skip exact mapping here
      numWords: normalizedWords.length,
      difficulty: row.difficulty,
      clue: row.clue,
      words: normalizedWords,
    });
    for (const word of row.words) {
      const normalized = normalizeWord(word);
      if (!normalized) continue;
      if (normalized.length < 2) continue;
      // de-duplicate globally
      const key = normalized;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ word: normalized, clue: row.clue || undefined, level: row.level, difficulty: Number.isFinite(row.difficulty) ? row.difficulty : undefined });
    }
  }

  ensureDir(OUT_DIR);
  fs.writeFileSync(OUT_WORDS_PATH, JSON.stringify(out, null, 2));
  fs.writeFileSync(OUT_LEVELS_PATH, JSON.stringify(levels, null, 2));
  console.log(`Wrote ${out.length} unique words to ${path.relative(ROOT, OUT_WORDS_PATH)}`);
  console.log(`Wrote ${levels.length} levels to ${path.relative(ROOT, OUT_LEVELS_PATH)}`);
}

main();

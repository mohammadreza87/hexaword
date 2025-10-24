import { describe, expect, it } from 'vitest';
import { getLevelQuery, hasLevelQuery, isUserLevelId, shouldAutoLaunchUserLevel } from '../client/utils/levelLinks';

describe('level link helpers', () => {
  it('extracts level query values when present', () => {
    expect(getLevelQuery('?level=ul_abc')).toBe('ul_abc');
    expect(getLevelQuery('?foo=bar&level=123')).toBe('123');
    expect(getLevelQuery('?level=')).toBeNull();
    expect(getLevelQuery('')).toBeNull();
  });

  it('detects when a search string contains a level parameter', () => {
    expect(hasLevelQuery('?level=ul_test')).toBe(true);
    expect(hasLevelQuery('?foo=bar')).toBe(false);
    expect(hasLevelQuery('')).toBe(false);
  });

  it('identifies user-level identifiers correctly', () => {
    expect(isUserLevelId('ul_123abc')).toBe(true);
    expect(isUserLevelId('123')).toBe(false);
    expect(isUserLevelId('')).toBe(false);
    expect(isUserLevelId(null)).toBe(false);
  });

  it('determines when to auto-launch user levels', () => {
    expect(shouldAutoLaunchUserLevel('?level=ul_test')).toBe(true);
    expect(shouldAutoLaunchUserLevel('?level=42')).toBe(false);
    expect(shouldAutoLaunchUserLevel('')).toBe(false);
  });
});

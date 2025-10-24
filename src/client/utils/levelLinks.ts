/**
 * Extracts the level query parameter from a search string.
 */
export function getLevelQuery(search: string): string | null {
  const params = new URLSearchParams(search);
  const value = params.get('level');
  return value && value.trim().length > 0 ? value : null;
}

/**
 * Determines if the provided level identifier represents a user-created level.
 * User level identifiers are non-empty and contain non-numeric characters.
 */
export function isUserLevelId(levelId: string | null | undefined): levelId is string {
  if (!levelId) {
    return false;
  }

  return !/^\d+$/.test(levelId);
}

/**
 * Checks if the provided search string contains a level query parameter.
 */
export function hasLevelQuery(search: string): boolean {
  return getLevelQuery(search) !== null;
}

/**
 * Returns true when the search string corresponds to a user level deep link.
 */
export function shouldAutoLaunchUserLevel(search: string): boolean {
  const levelId = getLevelQuery(search);
  return isUserLevelId(levelId);
}

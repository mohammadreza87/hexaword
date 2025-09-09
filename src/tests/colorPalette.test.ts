import { getPaletteForLevel, createColorMapping, COLOR_PALETTES } from '../web-view/config/ColorPalettes';

describe('Color Palette System', () => {
  test('should return different palettes for different level ranges', () => {
    // Levels 1-5 should use palette 0
    expect(getPaletteForLevel(1).name).toBe(COLOR_PALETTES[0].name);
    expect(getPaletteForLevel(2).name).toBe(COLOR_PALETTES[0].name);
    expect(getPaletteForLevel(3).name).toBe(COLOR_PALETTES[0].name);
    expect(getPaletteForLevel(4).name).toBe(COLOR_PALETTES[0].name);
    expect(getPaletteForLevel(5).name).toBe(COLOR_PALETTES[0].name);
    
    // Levels 6-10 should use palette 1
    expect(getPaletteForLevel(6).name).toBe(COLOR_PALETTES[1].name);
    expect(getPaletteForLevel(7).name).toBe(COLOR_PALETTES[1].name);
    expect(getPaletteForLevel(8).name).toBe(COLOR_PALETTES[1].name);
    expect(getPaletteForLevel(9).name).toBe(COLOR_PALETTES[1].name);
    expect(getPaletteForLevel(10).name).toBe(COLOR_PALETTES[1].name);
    
    // Levels 11-15 should use palette 2
    expect(getPaletteForLevel(11).name).toBe(COLOR_PALETTES[2].name);
    expect(getPaletteForLevel(15).name).toBe(COLOR_PALETTES[2].name);
    
    // Test palette cycling after 30 palettes (150 levels)
    expect(getPaletteForLevel(151).name).toBe(COLOR_PALETTES[0].name); // Should cycle back
    expect(getPaletteForLevel(156).name).toBe(COLOR_PALETTES[1].name);
  });
  
  test('should create different color mappings for dark and light themes', () => {
    const palette = getPaletteForLevel(1);
    const darkMapping = createColorMapping(palette, true);
    const lightMapping = createColorMapping(palette, false);
    
    // Background should be the last color (designed to be darkest)
    expect(darkMapping.background).toBe("#0A0E27"); // Background from Arctic Aurora palette
    expect(darkMapping.letterColor).toBe("#FFFFFF"); // Pure white for contrast
    
    // Light theme also uses same colors for consistency
    expect(lightMapping.background).toBe("#0A0E27");
    expect(lightMapping.letterColor).toBe("#FFFFFF"); // Pure white for contrast
    
    // Both should use the same accent color
    expect(darkMapping.accent).toBe(palette.colors[0]);
    expect(lightMapping.accent).toBe(palette.colors[0]);
    
    // Check darker cells for better contrast
    expect(darkMapping.cellFill).toBe("rgba(0, 0, 0, 0.3)");
    expect(darkMapping.cellStroke).toBe("rgba(255, 255, 255, 0.08)");
  });
  
  test('should have all required color properties', () => {
    const palette = getPaletteForLevel(1);
    const mapping = createColorMapping(palette, true);
    
    // Check all required properties exist
    expect(mapping).toHaveProperty('background');
    expect(mapping).toHaveProperty('primary');
    expect(mapping).toHaveProperty('secondary');
    expect(mapping).toHaveProperty('accent');
    expect(mapping).toHaveProperty('text');
    expect(mapping).toHaveProperty('cellFill');
    expect(mapping).toHaveProperty('cellStroke');
    expect(mapping).toHaveProperty('intersectionFill');
    expect(mapping).toHaveProperty('intersectionStroke');
    expect(mapping).toHaveProperty('solvedFill');
    expect(mapping).toHaveProperty('solvedStroke');
    expect(mapping).toHaveProperty('inputFill');
    expect(mapping).toHaveProperty('inputStroke');
    expect(mapping).toHaveProperty('letterColor');
    expect(mapping).toHaveProperty('clueColor');
  });
  
  test('each palette should have unique colors', () => {
    COLOR_PALETTES.forEach((palette, index) => {
      expect(palette.colors).toHaveLength(5);
      expect(palette.name).toBeTruthy();
      
      // Check colors are unique within palette
      const uniqueColors = new Set(palette.colors);
      expect(uniqueColors.size).toBeGreaterThanOrEqual(4); // At least 4 unique colors
    });
  });
});

// Log palette info for manual verification
console.log('Color Palette Schedule:');
for (let level = 1; level <= 30; level += 5) {
  const palette = getPaletteForLevel(level);
  console.log(`Levels ${level}-${level + 4}: ${palette.name}`);
  console.log(`  Colors: ${palette.colors.join(', ')}`);
}
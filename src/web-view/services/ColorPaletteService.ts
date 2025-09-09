/**
 * Color Palette Service
 * Manages dynamic color palettes for different levels
 * Uses Colormind API for dynamic palette generation with fallback to static palettes
 */

import { getPaletteForLevel, createColorMapping, ColorMapping } from '../config/ColorPalettes';
import { ColormindService } from './ColormindService';

export interface ColorScheme {
  background: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  cellFill: string;
  cellStroke: string;
  intersectionColor: string;
  intersectionStroke: string;
  solvedColor: string;
  solvedStroke: string;
  inputCellFill: string;
  inputCellStroke: string;
  letterColor: string;
  clueColor: string;
}

export interface LevelPalette {
  dark: ColorScheme;
  light: ColorScheme;
}

export class ColorPaletteService {
  private static instance: ColorPaletteService;
  private currentLevel: number = 1;
  private isDarkMode: boolean = true;
  private cachedPalettes: Map<number, LevelPalette> = new Map();
  private currentPaletteName: string = '';
  private colormindService: ColormindService;
  private useColormind: boolean = true; // Toggle for API usage
  
  private constructor() {
    this.colormindService = ColormindService.getInstance();
    // Disable Colormind by default due to CORS/proxy issues in production
    // Can be enabled by setting localStorage.setItem('enable_colormind', 'true')
    this.useColormind = localStorage.getItem('enable_colormind') === 'true';
  }
  
  static getInstance(): ColorPaletteService {
    if (!ColorPaletteService.instance) {
      ColorPaletteService.instance = new ColorPaletteService();
    }
    return ColorPaletteService.instance;
  }
  
  /**
   * Generates a color palette using Colormind API
   * NOTE: Due to CORS restrictions, this will only work server-side or with a proxy
   * For now, we'll skip the API and use our predefined palettes
   */
  async generatePaletteFromAPI(seedColors?: string[]): Promise<string[] | null> {
    // Skip API call due to CORS - use predefined palettes instead
    // In production, this would be called server-side and cached
    return null;
  }
  
  /**
   * Calculate contrast ratio between two colors
   */
  getContrastRatio(color1: string, color2: string): number {
    const getLuminance = (hex: string): number => {
      const rgb = this.hexToRgb(hex);
      const [r, g, b] = rgb.map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    
    const l1 = getLuminance(color1);
    const l2 = getLuminance(color2);
    const lmax = Math.max(l1, l2);
    const lmin = Math.min(l1, l2);
    
    return (lmax + 0.05) / (lmin + 0.05);
  }
  
  /**
   * Convert hex to RGB
   */
  private hexToRgb(hex: string): number[] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0];
  }
  
  /**
   * Adjust color for better contrast
   */
  adjustForContrast(foreground: string, background: string, minRatio: number = 4.5): string {
    let contrast = this.getContrastRatio(foreground, background);
    if (contrast >= minRatio) return foreground;
    
    // Try to lighten or darken the foreground color
    const rgb = this.hexToRgb(foreground);
    const bgLuminance = this.getContrastRatio(background, '#000000');
    const shouldLighten = bgLuminance < 1.5;
    
    let adjusted = [...rgb];
    let step = shouldLighten ? 10 : -10;
    
    while (contrast < minRatio && ((shouldLighten && adjusted[0] < 255) || (!shouldLighten && adjusted[0] > 0))) {
      adjusted = adjusted.map(c => Math.max(0, Math.min(255, c + step)));
      const newHex = `#${adjusted.map(c => c.toString(16).padStart(2, '0')).join('')}`;
      contrast = this.getContrastRatio(newHex, background);
      if (contrast >= minRatio) return newHex;
    }
    
    return foreground; // Return original if adjustment fails
  }
  
  /**
   * Generate palette for a specific level
   */
  async generateLevelPalette(level: number): Promise<LevelPalette> {
    // Check cache first
    const cacheKey = level;
    if (this.cachedPalettes.has(cacheKey)) {
      return this.cachedPalettes.get(cacheKey)!;
    }

    let colors: string[] = [];
    
    // Try to get palette from Colormind API first
    if (this.useColormind) {
      try {
        const colormindPalette = await this.colormindService.generateLevelPalette(level);
        if (colormindPalette && colormindPalette.colors.length === 5) {
          colors = colormindPalette.colors;
          this.currentPaletteName = `Dynamic ${Math.floor((level - 1) / 5) + 1}`;
        }
      } catch (error) {
        console.warn('Colormind API failed, using fallback palette:', error);
      }
    }
    
    // Fallback to static palette if API fails or is disabled
    if (colors.length === 0) {
      const palette = getPaletteForLevel(level);
      colors = palette.colors;
      this.currentPaletteName = palette.name;
    }
    
    // Create palette object for color mapping
    const dynamicPalette = {
      colors,
      name: this.currentPaletteName
    };
    
    // Create color mappings for both themes
    const darkMapping = createColorMapping(dynamicPalette, true);
    const lightMapping = createColorMapping(dynamicPalette, false);
    
    // Convert to ColorScheme format
    const darkScheme: ColorScheme = {
      background: darkMapping.background,
      primary: darkMapping.primary,
      secondary: darkMapping.secondary,
      accent: darkMapping.accent,
      text: darkMapping.text,
      cellFill: darkMapping.cellFill,
      cellStroke: darkMapping.cellStroke,
      intersectionColor: darkMapping.intersectionFill,
      intersectionStroke: darkMapping.intersectionStroke,
      solvedColor: darkMapping.solvedFill,
      solvedStroke: darkMapping.solvedStroke,
      inputCellFill: darkMapping.inputFill,
      inputCellStroke: darkMapping.inputStroke,
      letterColor: darkMapping.letterColor,
      clueColor: darkMapping.clueColor
    };
    
    const lightScheme: ColorScheme = {
      background: lightMapping.background,
      primary: lightMapping.primary,
      secondary: lightMapping.secondary,
      accent: lightMapping.accent,
      text: lightMapping.text,
      cellFill: lightMapping.cellFill,
      cellStroke: lightMapping.cellStroke,
      intersectionColor: lightMapping.intersectionFill,
      intersectionStroke: lightMapping.intersectionStroke,
      solvedColor: lightMapping.solvedFill,
      solvedStroke: lightMapping.solvedStroke,
      inputCellFill: lightMapping.inputFill,
      inputCellStroke: lightMapping.inputStroke,
      letterColor: lightMapping.letterColor,
      clueColor: lightMapping.clueColor
    };
    
    // Ensure text contrast
    darkScheme.text = this.adjustForContrast(darkScheme.text, darkScheme.background);
    lightScheme.text = this.adjustForContrast(lightScheme.text, lightScheme.background);
    
    const levelPalette: LevelPalette = { dark: darkScheme, light: lightScheme };
    this.cachedPalettes.set(cacheKey, levelPalette);
    
    return levelPalette;
  }
  
  /**
   * Lighten a color
   */
  private lightenColor(hex: string, amount: number): string {
    const rgb = this.hexToRgb(hex);
    const lightened = rgb.map(c => Math.min(255, c + (255 - c) * amount));
    return `#${lightened.map(c => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
  }
  
  /**
   * Get current color scheme
   */
  async getCurrentScheme(): Promise<ColorScheme> {
    const palette = await this.generateLevelPalette(this.currentLevel);
    const scheme = this.isDarkMode ? palette.dark : palette.light;
    
    // Update CSS variables to match current scheme
    this.updateCSSVariables(scheme);
    
    return scheme;
  }
  
  /**
   * Update CSS variables with current color scheme
   */
  private updateCSSVariables(scheme: ColorScheme): void {
    const root = document.documentElement;
    
    // Update data-theme attribute
    root.setAttribute('data-theme', this.isDarkMode ? 'dark' : 'light');
    
    // Update all color variables
    root.style.setProperty('--hw-background', scheme.background);
    root.style.setProperty('--hw-primary', scheme.primary);
    root.style.setProperty('--hw-secondary', scheme.secondary);
    root.style.setProperty('--hw-accent-primary', scheme.accent);
    root.style.setProperty('--hw-accent-secondary', this.lightenColor(scheme.accent, 0.2));
    root.style.setProperty('--hw-accent-tertiary', this.lightenColor(scheme.accent, -0.2));
    root.style.setProperty('--hw-text', scheme.text);
    root.style.setProperty('--hw-letter', scheme.letterColor);
    root.style.setProperty('--hw-clue', scheme.clueColor);
    
    // Cell colors
    root.style.setProperty('--hw-cell-fill', scheme.cellFill);
    root.style.setProperty('--hw-cell-stroke', scheme.cellStroke);
    root.style.setProperty('--hw-cell-intersect', scheme.intersectionColor);
    root.style.setProperty('--hw-cell-intersect-stroke', scheme.intersectionStroke);
    root.style.setProperty('--hw-cell-solved', scheme.solvedColor);
    root.style.setProperty('--hw-cell-solved-stroke', scheme.solvedStroke);
    root.style.setProperty('--hw-cell-input-fill', scheme.inputCellFill);
    root.style.setProperty('--hw-cell-input-stroke', scheme.inputCellStroke);
  }
  
  /**
   * Set the current level
   */
  async setLevel(level: number): Promise<ColorScheme> {
    this.currentLevel = level;
    return this.getCurrentScheme();
  }
  
  /**
   * Toggle between dark and light mode
   */
  async toggleTheme(): Promise<ColorScheme> {
    this.isDarkMode = !this.isDarkMode;
    return this.getCurrentScheme();
  }
  
  /**
   * Get theme mode
   */
  getThemeMode(): 'dark' | 'light' {
    return this.isDarkMode ? 'dark' : 'light';
  }
  
  /**
   * Set theme mode
   */
  async setThemeMode(mode: 'dark' | 'light'): Promise<ColorScheme> {
    this.isDarkMode = mode === 'dark';
    return this.getCurrentScheme();
  }
  
  /**
   * Get current palette name
   */
  getCurrentPaletteName(): string {
    return this.currentPaletteName;
  }
  
  /**
   * Toggle Colormind API usage
   */
  setUseColormind(use: boolean): void {
    this.useColormind = use;
    if (use) {
      localStorage.setItem('enable_colormind', 'true');
    } else {
      localStorage.removeItem('enable_colormind');
    }
    // Clear cache to force regeneration
    this.cachedPalettes.clear();
  }
  
  /**
   * Check if using Colormind API
   */
  isUsingColormind(): boolean {
    return this.useColormind;
  }
}

/**
 * Color Palette Service
 * Manages dynamic color palettes for different levels using Colormind API
 * Ensures proper contrast ratios for accessibility
 */

export interface ColorScheme {
  background: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  cellFill: string;
  cellStroke: string;
  intersectionColor: string;
  solvedColor: string;
  inputCellFill: string;
  inputCellStroke: string;
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
  
  // Accent colors looped per level (keeps backgrounds/strokes neutral)
  private readonly accents: string[] = ['#1FB6FF', '#E9458D', '#FF7A45', '#B7F36B', '#6C8CFF'];
  
  private constructor() {}
  
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
    if (this.cachedPalettes.has(level)) return this.cachedPalettes.get(level)!;

    const accent = this.accents[(level - 1) % this.accents.length];

    const make = (theme: 'dark' | 'light'): ColorScheme => {
      if (theme === 'dark') {
        const scheme: ColorScheme = {
          background: '#0F1115',
          primary: '#151922',
          secondary: '#1A2030',
          text: '#E6ECF2',
          accent,
          cellFill: '#1A1F2B',
          cellStroke: '#2E3A4E',
          intersectionColor: accent,
          solvedColor: '#1DD67C',
          inputCellFill: '#2A3446',
          inputCellStroke: '#3B4760',
        };
        scheme.text = this.adjustForContrast(scheme.text, scheme.background);
        return scheme;
      }
      const scheme: ColorScheme = {
        background: '#F5F7FB',
        primary: '#FFFFFF',
        secondary: '#F3F6FB',
        text: '#1F2430',
        accent,
        cellFill: '#FFFFFF',
        cellStroke: '#CBD5E1',
        intersectionColor: accent,
        solvedColor: '#17B66A',
        inputCellFill: '#EDF2F7',
        inputCellStroke: '#CBD5E1',
      };
      scheme.text = this.adjustForContrast(scheme.text, scheme.background);
      return scheme;
    }

    const palette: LevelPalette = { dark: make('dark'), light: make('light') };
    this.cachedPalettes.set(level, palette);
    return palette;
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
    return this.isDarkMode ? palette.dark : palette.light;
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
}

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
  
  // Predefined base palettes for levels (fallback if API fails)
  private readonly basePalettes: LevelPalette[] = [
    // Level 1 - Deep Blue & Cyan
    {
      dark: {
        background: '#0a0e1a',
        primary: '#1a1f2e',
        secondary: '#2d3748',
        accent: '#00d9ff',
        text: '#e2e8f0',
        cellFill: '#1a1f2e',
        cellStroke: '#2d3748',
        intersectionColor: '#00d9ff',
        solvedColor: '#00ff88',
        inputCellFill: '#3a4558',
        inputCellStroke: '#4a5568'
      },
      light: {
        background: '#f7fafc',
        primary: '#e2e8f0',
        secondary: '#cbd5e0',
        accent: '#0099cc',
        text: '#1a202c',
        cellFill: '#ffffff',
        cellStroke: '#cbd5e0',
        intersectionColor: '#0099cc',
        solvedColor: '#00cc66',
        inputCellFill: '#e2e8f0',
        inputCellStroke: '#a0aec0'
      }
    },
    // Level 2 - Purple & Pink
    {
      dark: {
        background: '#1a0f1f',
        primary: '#2d1b3d',
        secondary: '#4a2c5e',
        accent: '#e91e63',
        text: '#f3e5f5',
        cellFill: '#2d1b3d',
        cellStroke: '#4a2c5e',
        intersectionColor: '#e91e63',
        solvedColor: '#00ff88',
        inputCellFill: '#5e3c7a',
        inputCellStroke: '#7b4d9a'
      },
      light: {
        background: '#fce4ec',
        primary: '#f8bbd0',
        secondary: '#f48fb1',
        accent: '#c2185b',
        text: '#1a0f1f',
        cellFill: '#ffffff',
        cellStroke: '#f48fb1',
        intersectionColor: '#c2185b',
        solvedColor: '#00cc66',
        inputCellFill: '#f8bbd0',
        inputCellStroke: '#f06292'
      }
    },
    // Level 3 - Teal & Orange
    {
      dark: {
        background: '#0f1a1a',
        primary: '#1b2d2d',
        secondary: '#2c4a4a',
        accent: '#ff6b35',
        text: '#e0f2f1',
        cellFill: '#1b2d2d',
        cellStroke: '#2c4a4a',
        intersectionColor: '#ff6b35',
        solvedColor: '#00ff88',
        inputCellFill: '#3c5e5e',
        inputCellStroke: '#4d7a7a'
      },
      light: {
        background: '#e0f2f1',
        primary: '#b2dfdb',
        secondary: '#80cbc4',
        accent: '#ff5722',
        text: '#0f1a1a',
        cellFill: '#ffffff',
        cellStroke: '#80cbc4',
        intersectionColor: '#ff5722',
        solvedColor: '#00cc66',
        inputCellFill: '#b2dfdb',
        inputCellStroke: '#4db6ac'
      }
    },
    // Level 4 - Green & Gold
    {
      dark: {
        background: '#0a1a0a',
        primary: '#1b2d1b',
        secondary: '#2d4a2d',
        accent: '#ffd700',
        text: '#e8f5e9',
        cellFill: '#1b2d1b',
        cellStroke: '#2d4a2d',
        intersectionColor: '#ffd700',
        solvedColor: '#00ff88',
        inputCellFill: '#3e5e3e',
        inputCellStroke: '#4f7a4f'
      },
      light: {
        background: '#e8f5e9',
        primary: '#c8e6c9',
        secondary: '#a5d6a7',
        accent: '#ffc107',
        text: '#0a1a0a',
        cellFill: '#ffffff',
        cellStroke: '#a5d6a7',
        intersectionColor: '#ffc107',
        solvedColor: '#00cc66',
        inputCellFill: '#c8e6c9',
        inputCellStroke: '#81c784'
      }
    },
    // Level 5 - Red & Indigo
    {
      dark: {
        background: '#1a0a0a',
        primary: '#2d1b1b',
        secondary: '#4a2d2d',
        accent: '#3f51b5',
        text: '#ffebee',
        cellFill: '#2d1b1b',
        cellStroke: '#4a2d2d',
        intersectionColor: '#3f51b5',
        solvedColor: '#00ff88',
        inputCellFill: '#5e3c3c',
        inputCellStroke: '#7a4d4d'
      },
      light: {
        background: '#ffebee',
        primary: '#ffcdd2',
        secondary: '#ef9a9a',
        accent: '#3f51b5',
        text: '#1a0a0a',
        cellFill: '#ffffff',
        cellStroke: '#ef9a9a',
        intersectionColor: '#3f51b5',
        solvedColor: '#00cc66',
        inputCellFill: '#ffcdd2',
        inputCellStroke: '#e57373'
      }
    }
  ];
  
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
    // Check cache first
    if (this.cachedPalettes.has(level)) {
      return this.cachedPalettes.get(level)!;
    }
    
    // Use predefined palette if available
    const paletteIndex = (level - 1) % this.basePalettes.length;
    const basePalette = this.basePalettes[paletteIndex];
    
    // Try to enhance with Colormind API
    const apiColors = await this.generatePaletteFromAPI([
      basePalette.dark.background,
      basePalette.dark.primary,
      basePalette.dark.accent
    ]);
    
    let palette: LevelPalette;
    
    if (apiColors) {
      // Create enhanced palette from API colors
      palette = {
        dark: {
          background: apiColors[0],
          primary: apiColors[1],
          secondary: apiColors[2],
          accent: apiColors[3],
          text: this.adjustForContrast('#ffffff', apiColors[0]),
          cellFill: apiColors[1],
          cellStroke: apiColors[2],
          intersectionColor: apiColors[3],
          solvedColor: '#00ff88',
          inputCellFill: apiColors[2],
          inputCellStroke: apiColors[3]
        },
        light: {
          background: this.lightenColor(apiColors[0], 0.9),
          primary: this.lightenColor(apiColors[1], 0.7),
          secondary: this.lightenColor(apiColors[2], 0.5),
          accent: apiColors[3],
          text: this.adjustForContrast('#000000', this.lightenColor(apiColors[0], 0.9)),
          cellFill: '#ffffff',
          cellStroke: this.lightenColor(apiColors[2], 0.5),
          intersectionColor: apiColors[3],
          solvedColor: '#00cc66',
          inputCellFill: this.lightenColor(apiColors[1], 0.7),
          inputCellStroke: this.lightenColor(apiColors[2], 0.5)
        }
      };
    } else {
      palette = basePalette;
    }
    
    // Ensure all colors have proper contrast
    palette.dark.text = this.adjustForContrast(palette.dark.text, palette.dark.background);
    palette.light.text = this.adjustForContrast(palette.light.text, palette.light.background);
    
    // Cache the palette
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
/**
 * Colormind API Service
 * Generates dynamic, harmonious color palettes using the Colormind.io API
 * API Documentation: http://colormind.io/api-access/
 */

export interface ColormindPalette {
  colors: string[]; // Array of 5 hex colors
  model?: string;   // The model used (default, ui, etc.)
}

export class ColormindService {
  private static instance: ColormindService;
  private readonly API_URL: string;
  private cache: Map<string, ColormindPalette> = new Map();
  private models: string[] = ['default', 'ui']; // Available models
  
  private constructor() {
    // Use proxy endpoint when in browser to avoid CORS
    const isServer = typeof window === 'undefined';
    this.API_URL = isServer ? 'http://colormind.io/api/' : '/api/colormind';
  }
  
  static getInstance(): ColormindService {
    if (!ColormindService.instance) {
      ColormindService.instance = new ColormindService();
    }
    return ColormindService.instance;
  }
  
  /**
   * Generates a color palette using Colormind API
   * @param seedColors Optional array of colors to use as seeds (use "N" for random)
   * @param model The model to use (default, ui, etc.)
   */
  async generatePalette(
    seedColors?: (string | 'N')[], 
    model: string = 'default'
  ): Promise<ColormindPalette | null> {
    // Create cache key
    const cacheKey = `${model}-${seedColors?.join('-') || 'random'}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    try {
      // Prepare the request body
      const body: any = { model };
      
      if (seedColors && seedColors.length > 0) {
        // Convert hex colors to RGB format for API
        const input = seedColors.map(color => {
          if (color === 'N') return 'N';
          return this.hexToRgb(color);
        });
        body.input = input;
      }
      
      // Make the API request
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Check if we got a fallback response
      if (data.fallback) {
        console.warn('Using fallback palette due to API error');
        return null;
      }
      
      // Convert RGB arrays to hex colors
      const hexColors = data.result.map((rgb: number[]) => 
        this.rgbToHex(rgb[0], rgb[1], rgb[2])
      );
      
      const palette: ColormindPalette = {
        colors: hexColors,
        model
      };
      
      // Cache the result
      this.cache.set(cacheKey, palette);
      
      return palette;
      
    } catch (error) {
      console.error('Failed to generate palette from Colormind:', error);
      
      // Return null to indicate failure (caller should use fallback)
      return null;
    }
  }
  
  /**
   * Generates a palette for a specific level
   * Changes the seed/model every 5 levels for variety
   */
  async generateLevelPalette(level: number): Promise<ColormindPalette | null> {
    // Change generation strategy every 5 levels
    const paletteIndex = Math.floor((level - 1) / 5);
    
    // Alternate between models
    const model = paletteIndex % 2 === 0 ? 'default' : 'ui';
    
    // Create different seed patterns for variety
    const seedPatterns = [
      ['N', 'N', 'N', 'N', 'N'],                    // Fully random
      ['#FF6B6B', 'N', 'N', 'N', 'N'],             // Red seed
      ['N', '#4ECDC4', 'N', 'N', 'N'],             // Teal seed
      ['N', 'N', '#95E77E', 'N', 'N'],             // Green seed
      ['N', 'N', 'N', '#FFE66D', 'N'],             // Yellow seed
      ['N', 'N', 'N', 'N', '#A8DADC'],             // Blue seed
      ['#F1556C', 'N', 'N', 'N', '#2D3436'],       // Red to dark
      ['N', '#6C5CE7', 'N', '#FFEAA7', 'N'],       // Purple and yellow
      ['#00B894', 'N', '#FDCB6E', 'N', 'N'],       // Green and orange
      ['N', 'N', '#E17055', 'N', '#74B9FF'],       // Coral and sky
    ];
    
    // Use a seed pattern based on palette index
    const seedIndex = paletteIndex % seedPatterns.length;
    const seeds = seedPatterns[seedIndex];
    
    return this.generatePalette(seeds as (string | 'N')[], model);
  }
  
  /**
   * Get available models from the API
   */
  async getModels(): Promise<string[]> {
    try {
      const isServer = typeof window === 'undefined';
      const url = isServer ? 'http://colormind.io/list/' : '/api/colormind/models';
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        this.models = data.result;
        return this.models;
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
    return this.models;
  }
  
  /**
   * Convert hex color to RGB array
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
   * Convert RGB values to hex color
   */
  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
  
  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}
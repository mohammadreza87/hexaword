export interface Palette {
  colors: string[];
  name: string;
}

// Professionally designed color palettes for dark mode
// Each palette: [accent, intersection, solved, secondary, background]
export const COLOR_PALETTES: Palette[] = [
  // Cool tones
  { name: "Arctic Aurora", colors: ["#00D4FF", "#7B68EE", "#4FFFB0", "#E0E5FF", "#0A0E27"] },
  { name: "Deep Ocean", colors: ["#00F5FF", "#00CED1", "#40E0D0", "#B0E0E6", "#0B1929"] },
  { name: "Nebula", colors: ["#9D4EDD", "#C77DFF", "#E0AAFF", "#F0E6FF", "#10002B"] },
  { name: "Northern Lights", colors: ["#51E5FF", "#00FF88", "#FFFD01", "#C4FAF8", "#071E3D"] },
  { name: "Cosmic Blue", colors: ["#4361EE", "#7209B7", "#F72585", "#E5E5FF", "#0D1321"] },
  
  // Warm tones
  { name: "Sunset Glow", colors: ["#FF6B6B", "#FFE66D", "#4ECDC4", "#FFE5E5", "#1A1423"] },
  { name: "Desert Night", colors: ["#F77F00", "#FCBF49", "#EAE2B7", "#FFF3E0", "#1C1410"] },
  { name: "Ruby Flame", colors: ["#E63946", "#F1FAEE", "#A8DADC", "#FFE5E5", "#1D1E2C"] },
  { name: "Golden Hour", colors: ["#FFB700", "#FFA400", "#FF6000", "#FFF8E7", "#1A1A2E"] },
  { name: "Crimson Sky", colors: ["#DC2F02", "#E85D04", "#F48C06", "#FFE8E8", "#0C0F0A"] },
  
  // Green tones
  { name: "Forest Mist", colors: ["#52B788", "#74C69D", "#95D5B2", "#E8F5E8", "#081C15"] },
  { name: "Emerald Dream", colors: ["#10B981", "#34D399", "#6EE7B7", "#D1FAE5", "#0F172A"] },
  { name: "Jade Garden", colors: ["#00BF63", "#00E676", "#69F0AE", "#E0FFF0", "#0D1F17"] },
  { name: "Mint Fresh", colors: ["#06FFA5", "#00E5CC", "#00CFC1", "#E0FFF8", "#0A1612"] },
  { name: "Sage Wisdom", colors: ["#87A96B", "#A4C3A2", "#B6D7A8", "#EAF4E7", "#151D16"] },
  
  // Purple/Pink tones
  { name: "Amethyst", colors: ["#B565D8", "#D291FF", "#E7C6FF", "#F5EFFF", "#1B0B2E"] },
  { name: "Orchid Bloom", colors: ["#DA70D6", "#DDA0DD", "#E6E6FA", "#FFF0FA", "#1A0E1F"] },
  { name: "Lavender Dusk", colors: ["#967BB6", "#B19CD9", "#DCD0FF", "#F5F0FF", "#14121D"] },
  { name: "Rose Quartz", colors: ["#F8BBD0", "#F48FB1", "#F06292", "#FCE4EC", "#1C0F13"] },
  { name: "Magenta Wave", colors: ["#FF0080", "#FF4081", "#FF80AB", "#FFE0F0", "#1A0D15"] },
  
  // Cyan/Teal tones
  { name: "Cyan Matrix", colors: ["#00FFFF", "#00E5E5", "#00CDD7", "#E0FFFF", "#0A1A1A"] },
  { name: "Teal Dreams", colors: ["#14B8A6", "#2DD4BF", "#5EEAD4", "#CCFBF1", "#0F1B1B"] },
  { name: "Aqua Marine", colors: ["#7FFFD4", "#40E0D0", "#48D1CC", "#E0FFF8", "#0D1A17"] },
  { name: "Turquoise Bay", colors: ["#00CED1", "#48D1CC", "#20B2AA", "#E0FFFE", "#0B1617"] },
  { name: "Ice Crystal", colors: ["#B0E0E6", "#ADD8E6", "#87CEEB", "#F0FBFF", "#0E1418"] },
  
  // Mixed/Unique tones
  { name: "Synthwave", colors: ["#FF006E", "#8338EC", "#3A86FF", "#FFE5F1", "#0D0221"] },
  { name: "Vapor Dream", colors: ["#FF71CE", "#B967FF", "#01CDFE", "#FFF0FA", "#0F0C29"] },
  { name: "Neon Nights", colors: ["#00FFF0", "#FF00F5", "#FFFF00", "#F0FFFF", "#0A0A0F"] },
  { name: "Digital Rain", colors: ["#00FF41", "#39FF14", "#7FFF00", "#F0FFF0", "#0A0F0A"] },
  { name: "Plasma Core", colors: ["#E11584", "#7209B7", "#3A0CA3", "#FFE5F5", "#0A0118"] }
];

export interface ColorMapping {
  background: string;      // Main background
  primary: string;         // Primary UI elements
  secondary: string;       // Secondary UI elements
  accent: string;         // Accent/highlight color
  text: string;           // Text color
  cellFill: string;       // Normal cell fill
  cellStroke: string;     // Normal cell border
  intersectionFill: string;    // Intersection cell fill
  intersectionStroke: string;  // Intersection cell border
  solvedFill: string;     // Solved cell fill
  solvedStroke: string;   // Solved cell border
  inputFill: string;      // Input cell fill
  inputStroke: string;    // Input cell stroke
  letterColor: string;    // Letter text color
  clueColor: string;      // Clue text color
}

export function getPaletteForLevel(level: number): Palette {
  // Change palette every 5 levels (1-5 use palette 0, 6-10 use palette 1, etc.)
  const paletteIndex = Math.floor((level - 1) / 5) % COLOR_PALETTES.length;
  return COLOR_PALETTES[paletteIndex];
}

export function createColorMapping(palette: Palette, isDark: boolean = true): ColorMapping {
  const colors = palette.colors;
  
  // Use the last color (index 4) as background - it's designed to be the darkest
  const background = colors[4];
  const accent = colors[0];           // Primary accent color for glow/highlights
  const intersection = colors[1];     // Intersection outline color
  const solved = colors[2];          // Solved state color
  const textColor = "#FFFFFF";       // Always pure white for maximum contrast
  
  if (isDark) {
    return {
      // Dark theme mapping
      background: background,                          // Dark background from palette
      primary: adjustBrightness(background, 15),      // Slightly lighter for UI
      secondary: adjustBrightness(background, 25),    // Even lighter for secondary UI
      accent: accent,                                  // Accent color for highlights/glow
      text: textColor,                                 // Pure white text
      cellFill: "rgba(0, 0, 0, 0.3)",                // Darker cells for better contrast
      cellStroke: "rgba(255, 255, 255, 0.08)",       // Subtle light border
      intersectionFill: "rgba(0, 0, 0, 0.3)",        // Same dark fill
      intersectionStroke: intersection,               // Colored outline for intersections
      solvedFill: adjustBrightness(solved, -30),      // Darker solved for text contrast
      solvedStroke: solved,                           // Original solved color for border
      inputFill: "rgba(0, 0, 0, 0.2)",               // Darker input cells
      inputStroke: "rgba(255, 255, 255, 0.06)",      // Very subtle border
      letterColor: textColor,                         // Pure white letters
      clueColor: textColor                            // Pure white clue
    };
  } else {
    // Light theme (rarely used, but keeping for compatibility)
    return {
      background: background,                          // Keep dark background
      primary: adjustBrightness(background, 15),
      secondary: adjustBrightness(background, 25),
      accent: accent,
      text: textColor,
      cellFill: "rgba(0, 0, 0, 0.25)",
      cellStroke: "rgba(255, 255, 255, 0.1)",
      intersectionFill: "rgba(0, 0, 0, 0.25)",
      intersectionStroke: intersection,
      solvedFill: adjustBrightness(solved, -25),
      solvedStroke: solved,
      inputFill: "rgba(0, 0, 0, 0.15)",
      inputStroke: "rgba(255, 255, 255, 0.08)",
      letterColor: textColor,
      clueColor: textColor
    };
  }
}

function adjustBrightness(hex: string, percent: number): string {
  // Remove # if present
  hex = hex.replace(/^#/, '');
  
  // Parse RGB values
  let r = parseInt(hex.substr(0, 2), 16);
  let g = parseInt(hex.substr(2, 2), 16);
  let b = parseInt(hex.substr(4, 2), 16);
  
  // Adjust brightness
  if (percent > 0) {
    // Lighten
    r = Math.min(255, r + (255 - r) * (percent / 100));
    g = Math.min(255, g + (255 - g) * (percent / 100));
    b = Math.min(255, b + (255 - b) * (percent / 100));
  } else {
    // Darken
    const factor = 1 + (percent / 100);
    r = Math.max(0, Math.floor(r * factor));
    g = Math.max(0, Math.floor(g * factor));
    b = Math.max(0, Math.floor(b * factor));
  }
  
  // Convert back to hex
  const toHex = (n: number) => {
    const hex = Math.round(n).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

function findDarkestColor(colors: string[]): string {
  let darkest = colors[0];
  let lowestBrightness = 255 * 3;
  
  for (const color of colors) {
    const hex = color.replace(/^#/, '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = r + g + b;
    
    if (brightness < lowestBrightness) {
      lowestBrightness = brightness;
      darkest = color;
    }
  }
  
  return darkest;
}

export function interpolateColor(color1: string, color2: string, ratio: number): string {
  // Remove # if present
  color1 = color1.replace(/^#/, '');
  color2 = color2.replace(/^#/, '');
  
  // Parse RGB values
  const r1 = parseInt(color1.substr(0, 2), 16);
  const g1 = parseInt(color1.substr(2, 2), 16);
  const b1 = parseInt(color1.substr(4, 2), 16);
  
  const r2 = parseInt(color2.substr(0, 2), 16);
  const g2 = parseInt(color2.substr(2, 2), 16);
  const b2 = parseInt(color2.substr(4, 2), 16);
  
  // Interpolate
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  
  // Convert back to hex
  const toHex = (n: number) => {
    const hex = n.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return '#' + toHex(r) + toHex(g) + toHex(b);
}
import type { HSL, ThemeConfig } from "./types.ts";
import { createTheme, type ThemeOptions } from "@mui/material";

export function hslToString(hsl: HSL): string {
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

export function generateTriads(hsl: HSL): HSL[] {
    const triads: HSL[] = [];
    for (let i = 0; i < 3; i++) {
        const hue = (hsl.h + i * 120) % 360;
        triads.push({ h: hue, s: hsl.s, l: hsl.l });
    }
    return triads;
}

export function generateComplementary(hsl: HSL): HSL {
    const hue = (hsl.h + 180) % 360;
    return { h: hue, s: hsl.s, l: hsl.l };
}

export function adjustLightness(hsl: HSL, amount: number): HSL {
  return { h: hsl.h, s: hsl.s, l: Math.min(100, Math.max(0, hsl.l + amount)) };
}

export function adjustSaturation(hsl: HSL, amount: number): HSL {
  return {
    ...hsl,
    s: Math.max(0, Math.min(100, hsl.s + amount)),
  };
}

export function generatePalette(base: HSL) {
  return {
    main: hslToString(base),
    light: hslToString(adjustLightness(base, 15)),
    dark: hslToString(adjustLightness(base, -15)),
    contrastText: base.l > 50 ? "#000" : "#fff",
  };
}

export function generateBackgrounds(base: HSL) {
  return {
    default: hslToString(base),
    paper: hslToString(adjustLightness(base, 5)),
  };
}

export function createHSLTheme({
  primaryHSL,
  backgroundHSL,
  mode,
}: ThemeConfig) {
  const isLight = mode === "light";
  const bgBase = isLight ? backgroundHSL : adjustLightness(backgroundHSL, -70);
  const themeOptions: ThemeOptions = {
    palette: {
      mode,
      primary: generatePalette(primaryHSL),
      secondary: generatePalette({
        ...primaryHSL,
        h: generateComplementary(primaryHSL).h,
      }),
      background: generateBackgrounds(bgBase),
      text: {
        primary: isLight
          ? hslToString(adjustLightness(bgBase, -80))
          : hslToString(adjustLightness(bgBase, 80)),
        secondary: isLight
          ? hslToString(adjustLightness(bgBase, -60))
          : hslToString(adjustLightness(bgBase, 60)),
      },
    },
  };

  return createTheme(themeOptions);
}

/**
 * Convert HSL color to RGB.
 * @param h Hue (0-360)
 * @param s Saturation (0-100)
 * @param l Lightness (0-100)
 * @returns RGB color
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    return [
        Math.round((r + m) * 255),
        Math.round((g + m) * 255),
        Math.round((b + m) * 255)
    ];
}

/**
 * Calculate the luminance of an RGB color.
 * @param r Red component (0-255)
 * @param g Green component (0-255)
 * @param b Blue component (0-255)
 * @returns Luminance value
 */
function getLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate the contrast ratio between two colors.
 * @param color1
 * @param color2
 * @returns Contrast ratio between the two colors.
 */
function getContrastRatio(color1: HSL, color2: HSL): number {
    const [r1, g1, b1] = hslToRgb(color1.h, color1.s, color1.l);
    const [r2, g2, b2] = hslToRgb(color2.h, color2.s, color2.l);

    const lum1 = getLuminance(r1, g1, b1);
    const lum2 = getLuminance(r2, g2, b2);

    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);

    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if the color meets WCAG contrast standards.
 * @param textColor
 * @param bgColor
 * @param level WCAG contrast level. Defaults to AA.
 * @returns True if the color meets WCAG contrast standards.
 */
function meetsWCAGStandard(textColor: HSL, bgColor: HSL, level: 'AA' | 'AAA' = 'AA'): boolean {
    const ratio = getContrastRatio(textColor, bgColor);
    return level === 'AA' ? ratio >= 4.5 : ratio >= 7;
}

/**
 * Adjust the color to meet WCAG contrast standards.
 * @param textColor
 * @param bgColor
 * @param targetRatio Target contrast ratio. Defaults to 4.5 for AA, 7 for AAA.
 * @returns Adjusted color that meets WCAG contrast standards.
 */
function adjustForContrast(textColor: HSL, bgColor: HSL, targetRatio: number = 4.5): HSL {
    const adjusted = { ...textColor };
    let ratio = getContrastRatio(adjusted, bgColor);

    // Determine if we need to go lighter or darker
    const bgLuminance = getLuminance(...hslToRgb(bgColor.h, bgColor.s, bgColor.l));
    const direction = bgLuminance > 0.5 ? -1 : 1; // Dark text on light bg, light text on dark bg

    while (ratio < targetRatio && adjusted.l > 0 && adjusted.l < 100) {
        adjusted.l += direction * 5;
        adjusted.l = Math.max(0, Math.min(100, adjusted.l));
        ratio = getContrastRatio(adjusted, bgColor);
    }

    return adjusted;
}

/**
 * Ensure the color is vibrant enough to meet WCAG contrast standards.
 * @param color
 */
function ensureVibrantColor(color: HSL): HSL {
    return {
        ...color,
        s: Math.max(70, color.s), // At least 70% saturation
        l: Math.max(50, Math.min(70, color.l))
    };
}

/**
 * Generate triad colors that meet WCAG contrast standards
 * @param baseColor
 * @param bgColor
 */
export function getAccessibleTriadColors(baseColor: HSL, bgColor: HSL): [HSL, HSL, HSL] {
    const triads = generateTriads(baseColor);

    return triads.map(color => {
        // Make it bright and vibrant
        let adjusted = ensureVibrantColor(color);

        // Ensure it meets contrast requirements
        adjusted = adjustForContrast(adjusted, bgColor);

        return adjusted;
    }) as [HSL, HSL, HSL];
}

/*
export function generateBackgrounds(primaryColor: HSL, mode: "light" | "dark") {
    if (mode === "light") {
        return {
            paper: {
                h: primaryColor.h,
                s: Math.min(primaryColor.s * 0.1, 10),
                l: 98
            },
            default: {
                h: primaryColor.h,
                s: Math.min(primaryColor.s * 0.15, 15),
                l: 95
            }
        }
    }

    return {
        paper: {
            h: primaryColor.h,
            s: Math.min(primaryColor.s * 0.2, 20),
            l: 12
        },
        default: {
            h: primaryColor.h,
            s: Math.min(primaryColor.s * 0.25, 25),
            l: 8
        }
    }
}

* */
function hslToHex(color: HSL): string {
    const h = color.h
    let s = color.s / 100
    let l = color.l / 100

    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs((h/60) % 2 - 1))
    const m = l - c / 2

    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    function toHex(n: number) {
        const hex = Math.round((n + m) * 255).toString(16)
        return hex.length === 1 ? "0" + hex : hex
    }

    return `${toHex(r)}${toHex(g)}${toHex(b)}`
}
/*

function generatePalette(color: HSL, mode: "light" | "dark") {
    return {
        light: hslToHex({h: color.h, s: color.s, l: Math.min(color.l + 15, 85)}),
        main: hslToHex(color),
        dark: hslToHex({h: color.h, s: color.s, l: Math.max(color.l - 15, 15)}),
        contrastText: mode === "light"
        ? hslToHex({h: color.h, s: color.s, l: 10})
            : hslToHex({h: color.h, s: Math.max(color.s * 0.3, 20), l: 95})
    }
}
* */

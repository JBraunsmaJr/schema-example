import type { HSL, ThemeConfig } from "./types.ts";
import { createTheme, type ThemeOptions } from "@mui/material";

export function hslToString(hsl: HSL): string {
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
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
        h: (primaryHSL.h + 180) & 360, // complementary
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

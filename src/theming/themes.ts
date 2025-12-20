import type { ThemeConfig } from "./types.ts";

export const defaultLight: ThemeConfig = {
  primaryHSL: { h: 220, s: 80, l: 50 },
  backgroundHSL: { h: 0, s: 0, l: 98 },
  mode: "light",
};

export const defaultDark: ThemeConfig = {
  primaryHSL: { h: 220, s: 80, l: 50 },
  backgroundHSL: { h: 220, s: 15, l: 10 },
  mode: "dark",
};

export interface HSL {
  /**
   * Value between 0 and 360
   */
  h: number;

  /**
   * Value between 0 and 100
   */
  s: number;

  /**
   * Value between 0 and 100
   */
  l: number;
}

export interface ThemeConfig {
  primaryHSL: HSL;
  backgroundHSL: HSL;
  mode: "light" | "dark";
}

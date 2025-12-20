import type { HSL, ThemeConfig } from "./types.ts";
import React, { createContext, useContext, useEffect, useState } from "react";
import { defaultDark } from "./themes.ts";
import { createHSLTheme, hslToString } from "./colorUtils.ts";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Slider,
  Stack,
  ThemeProvider,
  Typography,
} from "@mui/material";

const THEME_STORAGE_KEY = "app-theme-config";

function saveThemeToStorage(config: ThemeConfig) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error("Failed to save theme", error);
  }
}

function loadThemeFromStorage(): ThemeConfig | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error("Failed to load theme", error);
    return null;
  }
}

interface ThemeContextType {
  themeConfig: ThemeConfig;
  updateTheme: (config: ThemeConfig) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useThemeConfig() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeConfig must be used within a ThemeConfigProvider");
  }
  return context;
}

export function ThemeConfigProvider({ children }: React.PropsWithChildren) {
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => {
    return loadThemeFromStorage() || defaultDark;
  });

  function updateTheme(config: ThemeConfig) {
    setThemeConfig(config);
    saveThemeToStorage(config);
  }

  function resetTheme() {
    setThemeConfig(defaultDark);
    saveThemeToStorage(defaultDark);
  }

  console.log(themeConfig);
  const theme = createHSLTheme(themeConfig);

  return (
    <ThemeContext.Provider
      value={{
        themeConfig,
        updateTheme,
        resetTheme,
      }}
    >
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ThemeContext.Provider>
  );
}

interface HSLPickerProps {
  label: string;
  value: HSL;
  onChange: (value: HSL) => void;
}
export function HSLPicker({ label, value, onChange }: HSLPickerProps) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" gutterBottom>
        {label}
      </Typography>
      <Box
        sx={{
          width: "100%",
          height: 60,
          borderRadius: 1,
          backgroundColor: hslToString(value),
          mb: 2,
          border: "1px solid",
          borderColor: "divider",
        }}
      />
      <Stack spacing={2}>
        <Box>
          <Typography variant={"caption"}>Hue: {value.h}</Typography>
          <Slider
            value={value.h}
            onChange={(_, v) => onChange({ ...value, h: v as number })}
            min={0}
            max={360}
            sx={{
              "& .MuiSlider-track": {
                background: `'linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))'`,
              },
            }}
          />
        </Box>
        <Box>
          <Typography variant={"caption"}>Saturation: {value.s}%</Typography>
          <Slider
            value={value.s}
            onChange={(_, v) => onChange({ ...value, s: v as number })}
            min={0}
            max={100}
          />
        </Box>
        <Box>
          <Typography variant={"caption"}>Lightness: {value.l}%</Typography>
          <Slider
            value={value.l}
            onChange={(_, v) => onChange({ ...value, l: v as number })}
            min={0}
            max={100}
          />
        </Box>
      </Stack>
    </Box>
  );
}

interface ThemeCustomizationModalProps {
  open: boolean;
  onClose: () => void;
}
export function ThemeCustomizationModal({
  open,
  onClose,
}: ThemeCustomizationModalProps) {
  const { themeConfig, updateTheme, resetTheme } = useThemeConfig();
  const [tempConfig, setTempConfig] = useState<ThemeConfig>(themeConfig);

  useEffect(() => {
    if (open) {
      setTempConfig(themeConfig);
    }
  }, [open, themeConfig]);

  function handleSave() {
    updateTheme(tempConfig);
    onClose();
  }

  function handleReset() {
    resetTheme();
    setTempConfig(defaultDark);
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth={"sm"} fullWidth>
      <DialogTitle>Customize Theme</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <HSLPicker
            label={"Primary Color"}
            value={tempConfig.primaryHSL}
            onChange={(primaryHSL) =>
              setTempConfig({ ...tempConfig, primaryHSL })
            }
          />
          <HSLPicker
            label={"Background Color"}
            value={tempConfig.backgroundHSL}
            onChange={(backgroundHSL) =>
              setTempConfig({ ...tempConfig, backgroundHSL })
            }
          />
          <Box>
            <Typography variant={"subtitle2"} gutterBottom>
              Mode
            </Typography>
            <Stack direction={"row"} spacing={1}>
              <Button
                onClick={() => setTempConfig({ ...tempConfig, mode: "light" })}
                variant={tempConfig.mode === "light" ? "contained" : "outlined"}
              >
                Light
              </Button>
              <Button
                variant={tempConfig.mode === "dark" ? "contained" : "outlined"}
                onClick={() => setTempConfig({ ...tempConfig, mode: "dark" })}
              >
                Dark
              </Button>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleReset} color={"error"}>
          Reset to Default
        </Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant={"contained"}>
          Save Theme
        </Button>
      </DialogActions>
    </Dialog>
  );
}

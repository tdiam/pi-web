import { describe, expect, it } from "vitest";
import {
  listThemes,
  readStoredThemePreference,
  resolveActiveTheme,
  resolveAppThemeVars,
  resolveShikiTheme,
  setThemePreferenceMode,
  setThemePreferenceTheme,
  toggleThemePreferenceMode,
} from "../themes";

describe("theme registry", () => {
  it("keeps legacy dark and light cache values working", () => {
    expect(readStoredThemePreference("dark", true)).toMatchObject({
      mode: "dark",
      darkThemeId: "pi-base46-dark",
      lightThemeId: "pi-base46-light",
    });
    expect(readStoredThemePreference("light", false)).toMatchObject({
      mode: "light",
      darkThemeId: "pi-base46-dark",
      lightThemeId: "pi-base46-light",
    });
  });

  it("sanitizes stored theme preferences against the registry", () => {
    const preference = readStoredThemePreference(
      JSON.stringify({
        mode: "light",
        darkThemeId: "pi-base46-light",
        lightThemeId: "missing-theme",
      }),
      false,
    );

    expect(preference).toEqual({
      mode: "light",
      darkThemeId: "pi-base46-dark",
      lightThemeId: "pi-base46-light",
    });
  });

  it("toggles theme mode without discarding theme ids", () => {
    const toggled = toggleThemePreferenceMode({
      mode: "dark",
      darkThemeId: "pi-base46-dark",
      lightThemeId: "pi-base46-light",
    });

    expect(toggled).toEqual({
      mode: "light",
      darkThemeId: "pi-base46-dark",
      lightThemeId: "pi-base46-light",
    });
  });

  it("lists multiple built-in themes for both modes", () => {
    const darkThemes = listThemes("dark");
    const lightThemes = listThemes("light");

    expect(darkThemes.length).toBeGreaterThan(1);
    expect(lightThemes.length).toBeGreaterThan(1);
    expect(darkThemes.every(theme => theme.mode === "dark")).toBe(true);
    expect(lightThemes.every(theme => theme.mode === "light")).toBe(true);
    expect(darkThemes.some(theme => theme.id === "catppuccin-mocha")).toBe(
      true,
    );
    expect(lightThemes.some(theme => theme.id === "catppuccin-latte")).toBe(
      true,
    );
  });

  it("updates the selected mode and assigned theme ids", () => {
    const preference = {
      mode: "dark" as const,
      darkThemeId: "pi-base46-dark",
      lightThemeId: "pi-base46-light",
    };

    expect(setThemePreferenceMode(preference, "light")).toMatchObject({
      mode: "light",
      darkThemeId: "pi-base46-dark",
      lightThemeId: "pi-base46-light",
    });
    expect(
      setThemePreferenceTheme(preference, "dark", "tokyo-night"),
    ).toMatchObject({
      darkThemeId: "tokyo-night",
      lightThemeId: "pi-base46-light",
    });
    expect(setThemePreferenceTheme(preference, "light", "tokyo-night")).toEqual(
      preference,
    );
  });

  it("derives app and shiki themes from the active Base46 theme", () => {
    const theme = resolveActiveTheme({
      mode: "dark",
      darkThemeId: "catppuccin-mocha",
      lightThemeId: "pi-base46-light",
    });

    expect(resolveAppThemeVars(theme)).toMatchObject({
      "--bg": "#1e1e2e",
      "--accent": "#89b4fa",
      "--text": "#cdd6f4",
    });
    expect(resolveShikiTheme(theme)).toMatchObject({
      name: "catppuccin-mocha",
      type: "dark",
      bg: "#1e1e2e",
      fg: "#cdd6f4",
    });
  });
});

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { THEME_OPTIONS, type ThemeName } from "./theme-options";

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>("obsidian");

  useEffect(() => {
    const stored = window.localStorage.getItem("ats-lens-theme");
    const valid = THEME_OPTIONS.some((option) => option.value === stored);
    const next = valid ? (stored as ThemeName) : "obsidian";
    setThemeState(next);
    document.documentElement.dataset.theme = next;
  }, []);

  const setTheme = (next: ThemeName) => {
    setThemeState(next);
    window.localStorage.setItem("ats-lens-theme", next);
    document.documentElement.dataset.theme = next;
  };

  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function ThemeSelector() {
  const context = useContext(ThemeContext);
  if (!context) return null;

  return (
    <Select value={context.theme} onValueChange={(value) => context.setTheme(value as ThemeName)}>
      <SelectTrigger aria-label="Color theme" className="w-[132px] bg-input/30 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {THEME_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export const THEME_OPTIONS = [
  {
    value: "obsidian",
    label: "Obsidian",
    description: "Teal signal on a deep navy surface",
  },
  {
    value: "cyberpunk",
    label: "Cyberpunk",
    description: "High-contrast cyan, rose, and electric violet",
  },
  {
    value: "monochrome",
    label: "Monochrome",
    description: "A focused grayscale reading mode",
  },
] as const;

export type ThemeName = (typeof THEME_OPTIONS)[number]["value"];
import { useEffect, useState } from 'react';
import { ThemeContext } from './useTheme';

const STORAGE_KEY = 'civilpyq-theme';
const DEFAULT_THEME = 'nebula';

const THEMES = [
  {
    id: 'nebula',
    label: 'Nebula',
    description: 'Deep space navy with drifting stars',
    swatch: ['#0a192f', '#172a45', '#64ffda'],
  },
  {
    id: 'aurora',
    label: 'Aurora',
    description: 'Dark teal-green with drifting light ribbons',
    swatch: ['#051815', '#0d2f27', '#2de8b0'],
  },
  {
    id: 'sunset',
    label: 'Sunset',
    description: 'Warm dark coral with a slow glowing pulse',
    swatch: ['#2b0f14', '#3d1a1f', '#ff7a59'],
  },
  {
    id: 'ocean',
    label: 'Ocean',
    description: 'Light airy blue with drifting wave bands',
    swatch: ['#eaf6ff', '#d3ecfc', '#0284c7'],
  },
  {
    id: 'paper',
    label: 'Paper',
    description: 'Warm light reading mode, minimal motion',
    swatch: ['#f7f1e3', '#efe6d0', '#8a5a3b'],
  },
  {
    id: 'cyber',
    label: 'Cyber',
    description: 'Neon synthwave grid with a sweeping light beam',
    swatch: ['#0d0221', '#1a0b2e', '#ff2fd4'],
  },
  {
    id: 'forest',
    label: 'Forest',
    description: 'Deep woodland green with drifting fireflies',
    swatch: ['#0d1f14', '#16301f', '#7ed957'],
  },
  {
    id: 'monochrome',
    label: 'Monochrome',
    description: 'Grayscale noir with a sweeping spotlight',
    swatch: ['#101010', '#1e1e1e', '#d9d9d9'],
  },
  {
    id: 'blossom',
    label: 'Blossom',
    description: 'Soft pastel pink with falling petals',
    swatch: ['#fff0f5', '#ffe0eb', '#d6336c'],
  },
  {
    id: 'eclipse',
    label: 'Eclipse',
    description: 'Deep violet dark mode with drifting glowing orbs',
    swatch: ['#0a0a18', '#15152b', '#a78bfa'],
  },
];

const THEME_IDS = THEMES.map((t) => t.id);

function getInitialTheme() {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && THEME_IDS.includes(saved)) return saved;
  } catch {
    return DEFAULT_THEME;
  }
  return DEFAULT_THEME;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      return;
    }
  }, [theme]);

  const setTheme = (id) => {
    if (THEME_IDS.includes(id)) setThemeState(id);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

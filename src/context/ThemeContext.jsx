import { useEffect, useState } from 'react';
import { ThemeContext } from './useTheme';

const STORAGE_KEY = 'civilpyq-theme';
const PERF_STORAGE_KEY = 'civilpyq-perf';
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
  {
    id: 'galaxy',
    label: 'Galaxy',
    description: 'Near-black space with a slowly turning golden spiral',
    swatch: ['#07080f', '#14152a', '#fbbf24'],
  },
  {
    id: 'storm',
    label: 'Storm',
    description: 'Slate night with layered rain and distant lightning',
    swatch: ['#0a0f1a', '#152036', '#60a5fa'],
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

function getInitialPerformanceMode() {
  try {
    return window.localStorage.getItem(PERF_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);
  const [performanceMode, setPerformanceMode] = useState(getInitialPerformanceMode);

  useEffect(() => {
    if (performanceMode) document.documentElement.setAttribute('data-perf', 'lite');
    else document.documentElement.removeAttribute('data-perf');
    try {
      window.localStorage.setItem(PERF_STORAGE_KEY, performanceMode ? '1' : '0');
    } catch {
      return;
    }
  }, [performanceMode]);

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
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES, performanceMode, setPerformanceMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

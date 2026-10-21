import { useState, useEffect } from 'react';
import { Theme, AccentColor } from '../types';
import { lighten, rotateHue, withAlpha } from '../lib/color';

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>('dark');
  const [accentColor, setAccentColor] = useState<AccentColor>('#6B46C1');

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('clipvault-theme') as Theme;
    const savedAccentColor = localStorage.getItem('clipvault-accent-color');
    
    if (savedTheme) {
      setTheme(savedTheme);
    }
    
    if (savedAccentColor) {
      setAccentColor(savedAccentColor);
    }
    
    // Check system preference if no saved theme
    if (!savedTheme) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }, []);

  // Theme tokens live in index.css; the accent-derived ones are set here.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    const second = rotateHue(accentColor, 50);
    const glow = theme === 'dark' ? 0.42 : 0.5;
    const vars: Record<string, string> = {
      '--accent': accentColor,
      '--accent-light': lighten(accentColor, 0.22),
      '--accent-soft': withAlpha(accentColor, 0.18),
      '--accent-faint': withAlpha(accentColor, 0.09),
      '--accent-glow': withAlpha(accentColor, glow),
      '--accent-2-glow': withAlpha(second, glow * 0.8),
    };
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  }, [theme, accentColor]);

  const updateTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('clipvault-theme', newTheme);
  };

  const updateAccentColor = (newColor: AccentColor) => {
    setAccentColor(newColor);
    localStorage.setItem('clipvault-accent-color', newColor);
  };

  return {
    theme,
    accentColor,
    setTheme: updateTheme,
    setAccentColor: updateAccentColor,
  };
};
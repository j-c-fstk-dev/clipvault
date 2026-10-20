import { useState, useEffect } from 'react';
import { Theme, AccentColor } from '../types';

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

  // Native controls (select popups, scrollbars) follow the app theme.
  useEffect(() => {
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

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
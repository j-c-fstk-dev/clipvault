import { useState, useEffect } from 'react';
import { Settings } from '../types';

const defaultSettings: Settings = {
  maxItems: 1000,
  shortcuts: {
    toggleApp: 'Ctrl+Shift+V',
    copySelected: 'Ctrl+C',
    deleteSelected: 'Delete',
  },
  autoSave: true,
  notifications: true,
  startOnBoot: false,
  minimizeToTray: true,
};

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('clipvault-settings');
    if (savedSettings) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(savedSettings) });
      } catch (error) {
        console.error('Failed to parse saved settings:', error);
      }
    }
  }, []);

  const updateSettings = (newSettings: Partial<Settings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    
    // Save to localStorage
    localStorage.setItem('clipvault-settings', JSON.stringify(updatedSettings));
  };

  return {
    settings,
    updateSettings,
  };
};
import { useEffect, useRef, useState } from 'react';
import { Settings } from '../types';
import * as backend from '../lib/backend';

const SAVE_DELAY_MS = 300;

const defaultSettings: Settings = {
  maxItems: 1000,
  snapshotLimitMb: 25,
  captureEnabled: true,
  notifications: true,
  startOnBoot: false,
  minimizeToTray: true,
  shortcuts: {
    toggleApp: 'Ctrl+Shift+V',
    copySelected: 'Ctrl+C',
    deleteSelected: 'Delete',
  },
};

/** Settings stored by the backend; changes apply locally at once and are saved shortly after. */
export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!backend.hasBackend) return;
    backend
      .getSettings()
      .then(setSettings)
      .catch(error => console.error('Failed to load settings:', error));
  }, []);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const updateSettings = (changes: Partial<Settings>) => {
    const next = { ...settings, ...changes };
    setSettings(next);
    if (!backend.hasBackend) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      backend
        .updateSettings(next)
        .then(setSettings)
        .catch(error => console.error('Failed to save settings:', error));
    }, SAVE_DELAY_MS);
  };

  return {
    settings,
    updateSettings,
  };
};

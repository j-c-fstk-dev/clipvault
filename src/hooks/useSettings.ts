import { useEffect, useRef, useState } from 'react';
import { Settings } from '../types';
import * as backend from '../lib/backend';

const SAVE_DELAY_MS = 300;

const defaultSettings: Settings = {
  maxItems: 1000,
  snapshotLimitMb: 25,
  captureEnabled: true,
  notifications: false,
  startOnBoot: false,
  minimizeToTray: true,
  hardwareAcceleration: true,
  openWith: {},
  language: 'auto',
  shortcuts: {
    toggleApp: 'Ctrl+Shift+V',
    copySelected: 'Ctrl+C',
    deleteSelected: 'Delete',
  },
};

/**
 * Settings stored by the backend. Changes apply locally at once and are
 * saved shortly after; a rejected save (e.g. a shortcut another app holds)
 * restores the saved settings and sets `saveError`.
 */
export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!backend.hasBackend) return;
    backend
      .getSettings()
      .then(setSettings)
      .catch(error => console.error('Failed to load settings:', error));
    const unlisten = backend.onSettingsChanged(setSettings);
    return () => {
      clearTimeout(saveTimer.current);
      unlisten.then(stop => stop());
    };
  }, []);

  const updateSettings = (changes: Partial<Settings>) => {
    const next = { ...settings, ...changes };
    setSettings(next);
    if (!backend.hasBackend) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      backend
        .updateSettings(next)
        .then(saved => {
          setSettings(saved);
          setSaveError(null);
        })
        .catch(error => {
          setSaveError(backend.errorMessage(error));
          backend.getSettings().then(setSettings).catch(() => {});
        });
    }, SAVE_DELAY_MS);
  };

  return {
    settings,
    updateSettings,
    saveError,
  };
};

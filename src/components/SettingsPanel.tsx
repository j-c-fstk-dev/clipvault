import React, { useEffect, useState } from 'react';
import { X, Moon, Sun, Download, Upload } from 'lucide-react';
import { Settings, Theme, AccentColor } from '../types';
import { eventToAccelerator } from '../lib/shortcuts';
import * as backend from '../lib/backend';

interface SettingsPanelProps {
  settings: Settings;
  onUpdateSettings: (settings: Partial<Settings>) => void;
  theme: Theme;
  accentColor: AccentColor;
  onThemeChange: (theme: Theme) => void;
  onAccentColorChange: (color: AccentColor) => void;
  onClose: () => void;
  /** Why the last change could not be saved, if it could not. */
  saveError: string | null;
}

const accentColors = [
  { name: 'Deep Purple', value: '#6B46C1' },
  { name: 'Electric Blue', value: '#3B82F6' },
  { name: 'Emerald Green', value: '#059669' },
  { name: 'Sunset Orange', value: '#EA580C' },
  { name: 'Ruby Red', value: '#DC2626' },
  { name: 'Hot Pink', value: '#DB2777' },
  { name: 'Indigo', value: '#4F46E5' },
  { name: 'Teal', value: '#0D9488' },
  { name: 'Amber', value: '#D97706' },
  { name: 'Rose', value: '#E11D48' },
  { name: 'Cyan', value: '#0891B2' },
  { name: 'Violet', value: '#7C3AED' },
];

interface NumberFieldProps {
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
  className: string;
}

/**
 * Number input that applies its value on blur or Enter, so intermediate
 * keystrokes (typing "500" passes through "5") never reach the backend.
 */
const NumberField: React.FC<NumberFieldProps> = ({ value, min, max, onCommit, className }) => {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const parsed = parseInt(draft, 10);
    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <input
      type="number"
      min={min}
      max={max}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      className={className}
    />
  );
};

const formatBytes = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

interface BackupSectionProps {
  maxItems: number;
  theme: Theme;
  accentColor: AccentColor;
}

/** Export the history to a .zip, or merge one back in. */
const BackupSection: React.FC<BackupSectionProps> = ({ maxItems, theme, accentColor }) => {
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [result, setResult] = useState<{ message: string; error: boolean } | null>(null);

  const run = async (kind: 'export' | 'import') => {
    setBusy(kind);
    setResult(null);
    try {
      if (kind === 'export') {
        const stats = await backend.exportBackup();
        if (stats) {
          setResult({
            message: `Saved ${plural(stats.items, 'item')} and ${plural(stats.files, 'file')} (${formatBytes(stats.bytes)}).`,
            error: false,
          });
        }
      } else {
        const stats = await backend.importBackup();
        if (stats) {
          const parts = [`Added ${plural(stats.added, 'new item')}`];
          if (stats.merged) parts.push(`${stats.merged} already in your history (tags and favorites combined)`);
          let message = `${parts.join('; ')}.`;
          if (stats.skipped) message += ` ${plural(stats.skipped, 'damaged entry')} ignored.`;
          if (stats.pruned) {
            message += ` ${plural(stats.pruned, 'oldest item')} removed to stay within the limit of ${maxItems} — raise "Maximum Items" first to keep everything.`;
          }
          setResult({ message, error: false });
        }
      }
    } catch (error) {
      setResult({ message: backend.errorMessage(error), error: true });
    } finally {
      setBusy(null);
    }
  };

  const button = (kind: 'export' | 'import', label: string, Icon: typeof Download) => (
    <button
      onClick={() => run(kind)}
      disabled={busy !== null || !backend.hasBackend}
      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
      style={{ backgroundColor: accentColor }}
    >
      <Icon className="w-4 h-4" />
      {busy === kind ? `${kind === 'export' ? 'Exporting' : 'Importing'}…` : label}
    </button>
  );

  return (
    <section>
      <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Backup
      </h3>
      <p className={`text-xs mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
        A .zip with your whole history: text, images, saved file copies, tags and favorites.
        Importing merges into the current history; nothing is replaced.
      </p>
      <div className="flex gap-3">
        {button('export', 'Export backup…', Download)}
        {button('import', 'Import backup…', Upload)}
      </div>
      {result && (
        <p
          role="status"
          className={`mt-3 text-sm ${result.error ? 'text-red-500' : theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
        >
          {result.message}
        </p>
      )}
    </section>
  );
};

interface ShortcutFieldProps {
  value: string;
  onChange: (accelerator: string) => void;
  /** Allow clearing the shortcut with Backspace. */
  clearable?: boolean;
  className: string;
}

/** Records the next key combination pressed while focused. */
const ShortcutField: React.FC<ShortcutFieldProps> = ({ value, onChange, clearable, className }) => {
  const [recording, setRecording] = useState(false);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') return;
    e.preventDefault();
    if (e.key === 'Escape') {
      e.currentTarget.blur();
      return;
    }
    if (clearable && e.key === 'Backspace' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      onChange('');
      e.currentTarget.blur();
      return;
    }
    const accelerator = eventToAccelerator(e);
    if (accelerator) {
      onChange(accelerator);
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type="text"
      readOnly
      value={recording ? 'Press a key combination…' : value || 'Disabled'}
      onFocus={() => setRecording(true)}
      onBlur={() => setRecording(false)}
      onKeyDown={onKeyDown}
      className={`${className} cursor-pointer caret-transparent`}
    />
  );
};

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onUpdateSettings,
  theme,
  accentColor,
  onThemeChange,
  onAccentColorChange,
  onClose,
  saveError
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`max-w-2xl w-full max-h-[90vh] rounded-2xl backdrop-blur-lg border overflow-hidden ${
        theme === 'dark' 
          ? 'bg-gray-900/90 border-gray-700' 
          : 'bg-white/90 border-gray-300'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <h2 className={`text-2xl font-bold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Settings
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-all duration-300 ${
              theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-auto max-h-[70vh] space-y-8">
          {saveError && (
            <div role="alert" className="px-4 py-3 rounded-lg text-sm bg-red-600/10 text-red-500 border border-red-500/30">
              Could not save settings: {saveError}
            </div>
          )}
          {/* Appearance */}
          <section>
            <h3 className={`text-lg font-semibold mb-4 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Appearance
            </h3>
            
            {/* Theme Selection */}
            <div className="mb-6">
              <label className={`block text-sm font-medium mb-3 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Theme
              </label>
              <div className="flex space-x-3">
                <button
                  onClick={() => onThemeChange('light')}
                  className={`flex items-center space-x-2 px-4 py-3 rounded-lg border transition-all duration-300 ${
                    theme === 'light'
                      ? 'text-white border-transparent'
                      : theme === 'dark'
                      ? 'text-gray-300 border-gray-600 hover:border-gray-500'
                      : 'text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                  style={{ backgroundColor: theme === 'light' ? accentColor : 'transparent' }}
                >
                  <Sun className="w-5 h-5" />
                  <span>Light</span>
                </button>
                <button
                  onClick={() => onThemeChange('dark')}
                  className={`flex items-center space-x-2 px-4 py-3 rounded-lg border transition-all duration-300 ${
                    theme === 'dark'
                      ? 'text-white border-transparent'
                      : 'text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                  style={{ backgroundColor: theme === 'dark' ? accentColor : 'transparent' }}
                >
                  <Moon className="w-5 h-5" />
                  <span>Dark</span>
                </button>
              </div>
            </div>

            {/* Accent Color Selection */}
            <div>
              <label className={`block text-sm font-medium mb-3 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Accent Color
              </label>
              <div className="grid grid-cols-4 gap-3">
                {accentColors.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => onAccentColorChange(color.value)}
                    className={`group relative p-3 rounded-lg border-2 transition-all duration-300 ${
                      accentColor === color.value
                        ? 'border-white shadow-lg scale-105'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  >
                    <div className="w-full h-8 rounded flex items-center justify-center">
                      {accentColor === color.value && (
                        <span className="text-white font-bold text-sm">✓</span>
                      )}
                    </div>
                    <p className="text-xs text-white mt-1 text-center font-medium">
                      {color.name}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Clipboard Settings */}
          <section>
            <h3 className={`text-lg font-semibold mb-4 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Clipboard Settings
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Maximum Items (1-99999)
                </label>
                <NumberField
                  min={1}
                  max={99999}
                  value={settings.maxItems}
                  onCommit={(maxItems) => onUpdateSettings({ maxItems })}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
                <p className={`mt-1 text-xs ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Lowering this removes the oldest items. Favorites are always kept.
                </p>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Keep a copy of copied files up to (MB)
                </label>
                <NumberField
                  min={0}
                  max={10240}
                  value={settings.snapshotLimitMb}
                  onCommit={(snapshotLimitMb) => onUpdateSettings({ snapshotLimitMb })}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
                <p className={`mt-1 text-xs ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Files you copy are saved in the vault when the whole copy fits this size, so they can be pasted even after being moved or deleted. 0 keeps only their paths.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className={`block text-sm font-medium ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Record clipboard
                  </label>
                  <p className={`text-xs ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Save everything you copy (also toggled from the header)
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.captureEnabled}
                    onChange={(e) => onUpdateSettings({ captureEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div 
                    className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600"
                    style={{ backgroundColor: settings.captureEnabled ? accentColor : undefined }}
                  />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className={`block text-sm font-medium ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Notify on new items
                  </label>
                  <p className={`text-xs ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Show a desktop notification for each new item while ClipVault is hidden
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications}
                    onChange={(e) => onUpdateSettings({ notifications: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div 
                    className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600"
                    style={{ backgroundColor: settings.notifications ? accentColor : undefined }}
                  />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className={`block text-sm font-medium ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Start on boot
                  </label>
                  <p className={`text-xs ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Launch ClipVault hidden in the tray when you log in
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.startOnBoot}
                    onChange={(e) => onUpdateSettings({ startOnBoot: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div 
                    className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600"
                    style={{ backgroundColor: settings.startOnBoot ? accentColor : undefined }}
                  />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className={`block text-sm font-medium ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Keep running in the tray
                  </label>
                  <p className={`text-xs ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Closing the window keeps capturing; quit from the tray menu
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.minimizeToTray}
                    onChange={(e) => onUpdateSettings({ minimizeToTray: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div 
                    className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600"
                    style={{ backgroundColor: settings.minimizeToTray ? accentColor : undefined }}
                  />
                </label>
              </div>
            </div>
          </section>

          <BackupSection maxItems={settings.maxItems} theme={theme} accentColor={accentColor} />

          {/* Keyboard Shortcuts */}
          <section>
            <h3 className={`text-lg font-semibold mb-4 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Keyboard Shortcuts
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Toggle App
                </label>
                <ShortcutField
                  value={settings.shortcuts.toggleApp}
                  onChange={(toggleApp) => onUpdateSettings({
                    shortcuts: { ...settings.shortcuts, toggleApp }
                  })}
                  clearable
                  className={`w-full px-4 py-2 rounded-lg border ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
                <p className={`mt-1 text-xs ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Shows or hides ClipVault from anywhere. Backspace disables it.
                </p>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Copy Selected Item
                </label>
                <ShortcutField
                  value={settings.shortcuts.copySelected}
                  onChange={(copySelected) => onUpdateSettings({
                    shortcuts: { ...settings.shortcuts, copySelected }
                  })}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
                <p className={`mt-1 text-xs ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Copies the selected item and hides ClipVault so you can paste. Use the arrow keys to select.
                </p>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Delete Selected Item
                </label>
                <ShortcutField
                  value={settings.shortcuts.deleteSelected}
                  onChange={(deleteSelected) => onUpdateSettings({
                    shortcuts: { ...settings.shortcuts, deleteSelected }
                  })}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
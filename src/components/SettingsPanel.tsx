import React from 'react';
import { X, Palette, Monitor, Moon, Sun } from 'lucide-react';
import { Settings, Theme, AccentColor } from '../types';

interface SettingsPanelProps {
  settings: Settings;
  onUpdateSettings: (settings: Partial<Settings>) => void;
  theme: Theme;
  accentColor: AccentColor;
  onThemeChange: (theme: Theme) => void;
  onAccentColorChange: (color: AccentColor) => void;
  onClose: () => void;
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

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onUpdateSettings,
  theme,
  accentColor,
  onThemeChange,
  onAccentColorChange,
  onClose
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
                <input
                  type="number"
                  min="1"
                  max="99999"
                  value={settings.maxItems}
                  onChange={(e) => onUpdateSettings({ maxItems: parseInt(e.target.value) || 1000 })}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className={`block text-sm font-medium ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Auto-save clipboard items
                  </label>
                  <p className={`text-xs ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Automatically save all copied items
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoSave}
                    onChange={(e) => onUpdateSettings({ autoSave: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div 
                    className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600"
                    style={{ backgroundColor: settings.autoSave ? accentColor : undefined }}
                  />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className={`block text-sm font-medium ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Show notifications
                  </label>
                  <p className={`text-xs ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Get notified when items are saved
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
                    Launch ClipVault when system starts
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
                    Minimize to system tray
                  </label>
                  <p className={`text-xs ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Keep ClipVault running in background
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
                <input
                  type="text"
                  value={settings.shortcuts.toggleApp}
                  onChange={(e) => onUpdateSettings({ 
                    shortcuts: { ...settings.shortcuts, toggleApp: e.target.value }
                  })}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Copy Selected Item
                </label>
                <input
                  type="text"
                  value={settings.shortcuts.copySelected}
                  onChange={(e) => onUpdateSettings({ 
                    shortcuts: { ...settings.shortcuts, copySelected: e.target.value }
                  })}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Delete Selected Item
                </label>
                <input
                  type="text"
                  value={settings.shortcuts.deleteSelected}
                  onChange={(e) => onUpdateSettings({ 
                    shortcuts: { ...settings.shortcuts, deleteSelected: e.target.value }
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
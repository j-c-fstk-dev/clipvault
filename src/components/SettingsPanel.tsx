import React, { useEffect, useState } from 'react';
import { X, Moon, Sun, Download, Upload } from 'lucide-react';
import { IconButton, Segmented, Switch, Overlay } from './ui';
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

/** A titled group of settings rows, like System Settings on macOS. */
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section>
    <h3 className="px-1 mb-2 text-small font-semibold text-muted">{title}</h3>
    <div className="card rounded-xl divide-y divide-[color:var(--line)]">{children}</div>
  </section>
);

interface RowProps {
  label: string;
  hint?: React.ReactNode;
  children?: React.ReactNode;
}

/** One setting: what it is on the left, its control on the right. */
const Row: React.FC<RowProps> = ({ label, hint, children }) => (
  <div className="flex items-center justify-between gap-6 px-4 py-3">
    <div className="min-w-0">
      <p className="text-body">{label}</p>
      {hint && <p className="mt-0.5 text-caption text-muted">{hint}</p>}
    </div>
    {children}
  </div>
);

const SMALL_FIELD = 'field h-8 rounded-lg px-2.5 text-small';

interface BackupSectionProps {
  maxItems: number;
}

/** Export the history to a .zip, or merge one back in. */
const BackupSection: React.FC<BackupSectionProps> = ({ maxItems }) => {
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
      type="button"
      onClick={() => run(kind)}
      disabled={busy !== null || !backend.hasBackend}
      className="pill h-8 px-3 rounded-lg inline-flex items-center gap-1.5 text-small font-medium disabled:opacity-40 hover:text-accent transition-colors"
    >
      <Icon className="w-4 h-4" />
      {busy === kind ? `${kind === 'export' ? 'Exporting' : 'Importing'}…` : label}
    </button>
  );

  return (
    <Section title="Backup">
      <Row
        label="History backup"
        hint="A .zip with text, images, saved file copies, tags and favorites. Importing adds to the current history and replaces nothing."
      >
        <div className="flex gap-2 shrink-0">
          {button('export', 'Export…', Download)}
          {button('import', 'Import…', Upload)}
        </div>
      </Row>
      {result && (
        <p role="status" className={`px-4 py-3 text-small ${result.error ? 'text-danger' : 'text-muted'}`}>
          {result.message}
        </p>
      )}
    </Section>
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target as HTMLElement).closest('input')) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const openWithTypes = Object.keys(settings.openWith);
  const toggle = (key: 'captureEnabled' | 'notifications' | 'startOnBoot' | 'minimizeToTray' | 'hardwareAcceleration', label: string) => (
    <Switch label={label} checked={settings[key]} onChange={value => onUpdateSettings({ [key]: value })} />
  );
  const shortcut = (key: keyof Settings['shortcuts'], clearable = false) => (
    <ShortcutField
      value={settings.shortcuts[key]}
      onChange={value => onUpdateSettings({ shortcuts: { ...settings.shortcuts, [key]: value } })}
      clearable={clearable}
      className={`${SMALL_FIELD} w-44 text-center shrink-0`}
    />
  );

  return (
    <Overlay onClose={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={e => e.stopPropagation()}
        className="sheet sheet-in w-full max-w-2xl max-h-[88vh] rounded-2xl flex flex-col overflow-hidden !bg-canvas"
      >
        <header className="flex items-center justify-between px-6 h-16 shrink-0 border-b border-line">
          <h2 className="text-title font-semibold tracking-[-0.015em]">Settings</h2>
          <IconButton label="Close" icon={X} onClick={onClose} />
        </header>

        <div className="flex-1 min-h-0 overflow-auto px-6 py-5 flex flex-col gap-6">
          {saveError && (
            <div role="alert" className="px-4 py-3 rounded-xl text-small text-danger card">
              Could not save settings: {saveError}
            </div>
          )}

          <Section title="Appearance">
            <Row label="Theme">
              <Segmented
                label="Theme"
                value={theme}
                onChange={onThemeChange}
                options={[
                  { value: 'light', label: 'Light', icon: Sun },
                  { value: 'dark', label: 'Dark', icon: Moon },
                ]}
              />
            </Row>
            <Row label="Accent color">
              <div role="radiogroup" aria-label="Accent color" className="flex flex-wrap justify-end gap-2">
                {accentColors.map(color => {
                  const selected = accentColor.toLowerCase() === color.value.toLowerCase();
                  return (
                    <button
                      key={color.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={color.name}
                      title={color.name}
                      onClick={() => onAccentColorChange(color.value)}
                      className={`w-6 h-6 rounded-full transition-shadow ${
                        selected ? 'shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)]' : ''
                      }`}
                      style={{
                        background: `linear-gradient(180deg, ${color.value}cc, ${color.value})`,
                      }}
                    />
                  );
                })}
              </div>
            </Row>
            <Row
              label="Hardware acceleration"
              hint="Turn off if text or images look garbled or noisy, as on older integrated graphics. Applies after restarting ClipVault."
            >
              {toggle('hardwareAcceleration', 'Hardware acceleration')}
            </Row>
          </Section>

          <Section title="Clipboard">
            <Row label="Record clipboard" hint="Save everything you copy. Also in the sidebar.">
              {toggle('captureEnabled', 'Record clipboard')}
            </Row>
            <Row label="Items to keep" hint="Lowering this removes the oldest items. Favorites are always kept.">
              <NumberField
                min={1}
                max={99999}
                value={settings.maxItems}
                onCommit={maxItems => onUpdateSettings({ maxItems })}
                className={`${SMALL_FIELD} w-24 text-right shrink-0`}
              />
            </Row>
            <Row label="Notify on new items" hint="A desktop notification for each copy while ClipVault is hidden.">
              {toggle('notifications', 'Notify on new items')}
            </Row>
          </Section>

          <Section title="Files">
            <Row
              label="Save copies of files up to (MB)"
              hint="Copied files are saved in the vault in the background when the whole copy fits, so they can be pasted after being moved or deleted. 0 keeps only their paths."
            >
              <NumberField
                min={0}
                max={10240}
                value={settings.snapshotLimitMb}
                onCommit={snapshotLimitMb => onUpdateSettings({ snapshotLimitMb })}
                className={`${SMALL_FIELD} w-24 text-right shrink-0`}
              />
            </Row>
            <Row
              label='Apps chosen with "Always"'
              hint={
                openWithTypes.length === 0
                  ? 'None yet. Opening a file lets you pick an app just once or always.'
                  : `Opened straight away: ${openWithTypes.join(', ')}`
              }
            >
              <button
                type="button"
                onClick={() => onUpdateSettings({ openWith: {} })}
                disabled={openWithTypes.length === 0}
                className="pill shrink-0 h-8 px-3 rounded-lg text-small font-medium disabled:opacity-40"
              >
                Reset
              </button>
            </Row>
          </Section>

          <Section title="Startup">
            <Row label="Start on login" hint="Launch ClipVault hidden in the tray when you log in.">
              {toggle('startOnBoot', 'Start on login')}
            </Row>
            <Row label="Keep running in the tray" hint="Closing the window keeps recording. Quit from the tray menu.">
              {toggle('minimizeToTray', 'Keep running in the tray')}
            </Row>
          </Section>

          <BackupSection maxItems={settings.maxItems} />

          <Section title="Keyboard shortcuts">
            <Row label="Show or hide ClipVault" hint="Works from any app. Backspace turns it off.">
              {shortcut('toggleApp', true)}
            </Row>
            <Row label="Copy selected item" hint="Copies and hides ClipVault so you can paste. Arrow keys select.">
              {shortcut('copySelected')}
            </Row>
            <Row label="Delete selected item">{shortcut('deleteSelected')}</Row>
          </Section>
        </div>
      </div>
    </Overlay>
  );
};

export default SettingsPanel;

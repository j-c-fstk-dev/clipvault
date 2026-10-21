import React, { useEffect, useState } from 'react';
import { X, Moon, Sun, Download, Upload } from 'lucide-react';
import { IconButton, Segmented, Switch, Overlay } from './ui';
import { Settings, Theme, AccentColor, Language } from '../types';
import { useI18n } from '../i18n';
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

/** Names are in `t.settings.accentNames`, in the same order. */
const accentColors = [
  '#6B46C1',
  '#3B82F6',
  '#059669',
  '#EA580C',
  '#DC2626',
  '#DB2777',
  '#4F46E5',
  '#0D9488',
  '#D97706',
  '#E11D48',
  '#0891B2',
  '#7C3AED',
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
  const { t } = useI18n();
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [result, setResult] = useState<{ message: string; error: boolean } | null>(null);

  const run = async (kind: 'export' | 'import') => {
    setBusy(kind);
    setResult(null);
    try {
      if (kind === 'export') {
        const stats = await backend.exportBackup();
        if (stats) {
          setResult({ message: t.settings.exported(stats), error: false });
        }
      } else {
        const stats = await backend.importBackup();
        if (stats) {
          setResult({ message: t.settings.imported(stats, maxItems), error: false });
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
      {busy === kind ? (kind === 'export' ? t.settings.exporting : t.settings.importing) : label}
    </button>
  );

  return (
    <Section title={t.settings.backup}>
      <Row label={t.settings.backupRow} hint={t.settings.backupHint}>
        <div className="flex gap-2 shrink-0">
          {button('export', t.settings.export, Download)}
          {button('import', t.settings.import, Upload)}
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
  const { t } = useI18n();
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
      value={recording ? t.settings.pressKeys : value || t.settings.disabled}
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
  const { t } = useI18n();
  const s = t.settings;
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
        aria-label={s.title}
        onClick={e => e.stopPropagation()}
        className="sheet sheet-in w-full max-w-2xl max-h-[88vh] rounded-2xl flex flex-col overflow-hidden !bg-canvas"
      >
        <header className="flex items-center justify-between px-6 h-16 shrink-0 border-b border-line">
          <h2 className="text-title font-semibold tracking-[-0.015em]">{s.title}</h2>
          <IconButton label={t.item.close} icon={X} onClick={onClose} />
        </header>

        <div className="flex-1 min-h-0 overflow-auto px-6 py-5 flex flex-col gap-6">
          {saveError && (
            <div role="alert" className="px-4 py-3 rounded-xl text-small text-danger card">
              {s.saveFailed(saveError)}
            </div>
          )}

          <Section title={s.appearance}>
            <Row label={s.language} hint={s.languageHint}>
              <Segmented<Language>
                label={s.language}
                value={settings.language}
                onChange={language => onUpdateSettings({ language })}
                options={[
                  { value: 'auto', label: s.languageAuto },
                  { value: 'en', label: 'English' },
                  { value: 'pt', label: 'Português' },
                ]}
              />
            </Row>
            <Row label={s.theme}>
              <Segmented
                label={s.theme}
                value={theme}
                onChange={onThemeChange}
                options={[
                  { value: 'light', label: s.light, icon: Sun },
                  { value: 'dark', label: s.dark, icon: Moon },
                ]}
              />
            </Row>
            <Row label={s.accent}>
              <div role="radiogroup" aria-label={s.accent} className="flex flex-wrap justify-end gap-2">
                {accentColors.map((value, i) => {
                  const selected = accentColor.toLowerCase() === value.toLowerCase();
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={s.accentNames[i]}
                      title={s.accentNames[i]}
                      onClick={() => onAccentColorChange(value)}
                      className={`w-6 h-6 rounded-full transition-shadow ${
                        selected ? 'shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)]' : ''
                      }`}
                      style={{
                        background: `linear-gradient(180deg, ${value}cc, ${value})`,
                      }}
                    />
                  );
                })}
              </div>
            </Row>
            <Row label={s.hardware} hint={s.hardwareHint}>
              {toggle('hardwareAcceleration', s.hardware)}
            </Row>
          </Section>

          <Section title={s.clipboard}>
            <Row label={s.record} hint={s.recordHint}>
              {toggle('captureEnabled', s.record)}
            </Row>
            <Row label={s.keep} hint={s.keepHint}>
              <NumberField
                min={1}
                max={99999}
                value={settings.maxItems}
                onCommit={maxItems => onUpdateSettings({ maxItems })}
                className={`${SMALL_FIELD} w-24 text-right shrink-0`}
              />
            </Row>
            <Row label={s.notify} hint={s.notifyHint}>
              {toggle('notifications', s.notify)}
            </Row>
          </Section>

          <Section title={s.files}>
            <Row label={s.snapshots} hint={s.snapshotsHint}>
              <NumberField
                min={0}
                max={10240}
                value={settings.snapshotLimitMb}
                onCommit={snapshotLimitMb => onUpdateSettings({ snapshotLimitMb })}
                className={`${SMALL_FIELD} w-24 text-right shrink-0`}
              />
            </Row>
            <Row
              label={s.alwaysApps}
              hint={openWithTypes.length === 0 ? s.alwaysAppsNone : s.alwaysAppsSome(openWithTypes)}
            >
              <button
                type="button"
                onClick={() => onUpdateSettings({ openWith: {} })}
                disabled={openWithTypes.length === 0}
                className="pill shrink-0 h-8 px-3 rounded-lg text-small font-medium disabled:opacity-40"
              >
                {s.reset}
              </button>
            </Row>
          </Section>

          <Section title={s.startup}>
            <Row label={s.startOnLogin} hint={s.startOnLoginHint}>
              {toggle('startOnBoot', s.startOnLogin)}
            </Row>
            <Row label={s.tray} hint={s.trayHint}>
              {toggle('minimizeToTray', s.tray)}
            </Row>
          </Section>

          <BackupSection maxItems={settings.maxItems} />

          <Section title={s.shortcuts}>
            <Row label={s.toggleApp} hint={s.toggleAppHint}>
              {shortcut('toggleApp', true)}
            </Row>
            <Row label={s.copySelected} hint={s.copySelectedHint}>
              {shortcut('copySelected')}
            </Row>
            <Row label={s.deleteSelected}>{shortcut('deleteSelected')}</Row>
          </Section>
        </div>
      </div>
    </Overlay>
  );
};

export default SettingsPanel;

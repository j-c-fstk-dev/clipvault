/**
 * Keyboard accelerators in the format the backend's global-shortcut parser
 * accepts, e.g. `Ctrl+Shift+V`, `Super+V`, `Delete`.
 */

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'Super', 'Hyper', 'OS', 'AltGraph']);

const MODIFIER_ALIASES: Record<string, 'Ctrl' | 'Alt' | 'Shift' | 'Super'> = {
  ctrl: 'Ctrl',
  control: 'Ctrl',
  commandorcontrol: 'Ctrl',
  cmdorctrl: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  super: 'Super',
  meta: 'Super',
  cmd: 'Super',
  command: 'Super',
};

/** Key name from a physical key code: `KeyV` → `V`, `Digit1` → `1`. */
const keyName = (code: string): string => {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  return code;
};

/** The accelerator for a key press, or `null` while only modifiers are held. */
export const eventToAccelerator = (e: KeyboardEvent | React.KeyboardEvent): string | null => {
  if (MODIFIER_KEYS.has(e.key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Super');
  parts.push(keyName(e.code));
  return parts.join('+');
};

/** Whether a key press matches `accelerator` (case-insensitive, aliases allowed). */
export const matchesAccelerator = (e: KeyboardEvent, accelerator: string): boolean => {
  const parts = accelerator.split('+').map(p => p.trim()).filter(Boolean);
  const key = parts.pop();
  if (!key) return false;
  const wanted = new Set(parts.map(p => MODIFIER_ALIASES[p.toLowerCase()]));
  if (wanted.has(undefined as never)) return false;
  return (
    wanted.has('Ctrl') === e.ctrlKey &&
    wanted.has('Alt') === e.altKey &&
    wanted.has('Shift') === e.shiftKey &&
    wanted.has('Super') === e.metaKey &&
    keyName(e.code).toLowerCase() === key.toLowerCase()
  );
};

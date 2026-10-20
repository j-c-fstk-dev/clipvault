import React, { useLayoutEffect, useRef, useState } from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: React.ElementType;
  /** Shown pressed, e.g. an active filter. */
  active?: boolean;
  tone?: 'default' | 'danger' | 'star';
  size?: 'sm' | 'md';
}

/** Square icon button with an accessible label and a tooltip. */
export const IconButton: React.FC<IconButtonProps> = ({
  label,
  icon: Icon,
  active = false,
  tone = 'default',
  size = 'md',
  className = '',
  ...rest
}) => {
  const toneClass =
    tone === 'danger' ? 'hover:text-danger' : tone === 'star' ? 'hover:text-star' : 'hover:text-ink';
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      className={`inline-flex items-center justify-center rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none ${
        size === 'sm' ? 'w-7 h-7' : 'w-8 h-8'
      } ${active ? 'text-accent bg-accent-faint' : `text-muted hover-tint ${toneClass}`} ${className}`}
      {...rest}
    >
      <Icon className={size === 'sm' ? 'w-[15px] h-[15px]' : 'w-4 h-4'} />
    </button>
  );
};

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string; icon?: React.ElementType }[];
  onChange: (value: T) => void;
  /** Show only icons, with the label as tooltip. */
  iconOnly?: boolean;
}

/** Glass segmented control; the selected segment sits under a sliding lens. */
export function Segmented<T extends string>({ label, value, options, onChange, iconOnly }: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [lens, setLens] = useState<{ left: number; width: number } | null>(null);
  const index = Math.max(0, options.findIndex(o => o.value === value));

  useLayoutEffect(() => {
    const node = refs.current[index];
    if (node) setLens({ left: node.offsetLeft, width: node.offsetWidth });
  }, [index, options.length]);

  return (
    <div role="radiogroup" aria-label={label} className="pill relative inline-flex p-[3px] rounded-[10px]">
      {lens && (
        <span
          aria-hidden
          className="lens absolute top-[3px] bottom-[3px] rounded-[7px] transition-[left,width] duration-200 ease-out"
          style={{ left: lens.left, width: lens.width }}
        />
      )}
      {options.map((option, i) => {
        const Icon = option.icon;
        const selected = i === index;
        return (
          <button
            key={option.value}
            ref={node => (refs.current[i] = node)}
            type="button"
            role="radio"
            aria-checked={selected}
            title={iconOnly ? option.label : undefined}
            aria-label={iconOnly ? option.label : undefined}
            onClick={() => onChange(option.value)}
            className={`relative z-10 inline-flex items-center justify-center gap-1.5 h-7 rounded-[7px] text-small font-medium transition-colors ${
              iconOnly ? 'w-8' : 'px-3'
            } ${selected ? 'text-white' : 'text-muted hover:text-ink'}`}
          >
            {Icon && <Icon className="w-4 h-4" />}
            {!iconOnly && option.label}
          </button>
        );
      })}
    </div>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

/** On/off switch. */
export const Switch: React.FC<SwitchProps> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative shrink-0 w-[38px] h-[22px] rounded-full transition-colors ${
      checked ? 'lens' : 'bg-line-strong'
    }`}
  >
    <span
      aria-hidden
      className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.35)] transition-transform duration-200 ${
        checked ? 'translate-x-4' : ''
      }`}
    />
  </button>
);

/** A key or key combination, e.g. Ctrl+Shift+V. */
export const Kbd: React.FC<{ keys: string }> = ({ keys }) => (
  <span className="inline-flex items-center gap-0.5 align-middle">
    {keys.split('+').map(key => (
      <kbd
        key={key}
        className="min-w-[22px] px-1.5 h-[22px] inline-flex items-center justify-center rounded-md card text-caption font-sans font-medium text-ink"
      >
        {key}
      </kbd>
    ))}
  </span>
);

import React, { useEffect, useState } from 'react';
import { AppWindow, X } from 'lucide-react';
import { AccentColor, AppChoice, Theme } from '../types';

interface OpenWithDialogProps {
  /** File being opened. */
  name: string;
  /** Content type description, e.g. "PNG image". */
  description: string;
  apps: AppChoice[];
  onOpen: (appId: string, always: boolean) => void;
  onClose: () => void;
  theme: Theme;
  accentColor: AccentColor;
}

/**
 * Android-style chooser: the system default is listed first and selected;
 * open with it (or another app) just this once, or always for this type.
 */
const OpenWithDialog: React.FC<OpenWithDialogProps> = ({
  name,
  description,
  apps,
  onOpen,
  onClose,
  theme,
  accentColor,
}) => {
  const [selected, setSelected] = useState<string | null>(apps[0]?.id ?? null);
  const dark = theme === 'dark';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Enter' && selected) {
        e.preventDefault();
        onOpen(selected, false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, onOpen, selected]);

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`Open ${name} with`}
        onClick={e => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden ${
          dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
        }`}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <h2 className={`text-lg font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>
              Open with
            </h2>
            <p className={`text-sm truncate ${dark ? 'text-gray-400' : 'text-gray-500'}`} title={name}>
              {name} · {description}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className={`p-1.5 rounded-lg ${dark ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {apps.length === 0 ? (
          <p className={`px-5 pb-6 text-sm ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
            No installed application can open this type of file.
          </p>
        ) : (
          <ul className="max-h-80 overflow-auto px-3 pb-3" role="listbox" aria-label="Applications">
            {apps.map(app => {
              const isSelected = app.id === selected;
              return (
                <li key={app.id}>
                  <button
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => setSelected(app.id)}
                    onDoubleClick={() => onOpen(app.id, false)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                      isSelected ? '' : dark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                    }`}
                    style={isSelected ? { backgroundColor: `${accentColor}26` } : undefined}
                  >
                    {app.icon ? (
                      <img src={app.icon} alt="" className="w-9 h-9 shrink-0 object-contain" />
                    ) : (
                      <span
                        className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-white"
                        style={{ backgroundColor: accentColor }}
                      >
                        <AppWindow className="w-5 h-5" />
                      </span>
                    )}
                    <span className={`flex-1 truncate ${dark ? 'text-gray-100' : 'text-gray-900'}`}>
                      {app.name}
                    </span>
                    {app.isDefault && (
                      <span
                        className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium"
                        style={{ backgroundColor: `${accentColor}26`, color: accentColor }}
                      >
                        Default
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div
          className={`flex justify-end gap-2 px-5 py-4 border-t ${
            dark ? 'border-gray-800' : 'border-gray-100'
          }`}
        >
          <button
            disabled={!selected}
            onClick={() => selected && onOpen(selected, false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 ${
              dark ? 'text-gray-200 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Just once
          </button>
          <button
            disabled={!selected}
            onClick={() => selected && onOpen(selected, true)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 hover:opacity-90"
            style={{ backgroundColor: accentColor }}
          >
            Always
          </button>
        </div>
      </div>
    </div>
  );
};

export default OpenWithDialog;

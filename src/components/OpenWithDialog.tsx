import React, { useEffect, useState } from 'react';
import { AppWindow, X } from 'lucide-react';
import { AppChoice } from '../types';
import { IconButton } from './ui';

interface OpenWithDialogProps {
  /** File being opened. */
  name: string;
  /** Content type description, e.g. "PNG image". */
  description: string;
  apps: AppChoice[];
  onOpen: (appId: string, always: boolean) => void;
  onClose: () => void;
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
}) => {
  const [selected, setSelected] = useState<string | null>(apps[0]?.id ?? null);

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
    <div className="overlay fixed inset-0 z-[60] flex items-center justify-center p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Open ${name} with`}
        onClick={e => e.stopPropagation()}
        className="sheet sheet-in w-full max-w-md rounded-2xl overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold">Open with</h2>
            <p className="text-small text-muted truncate" title={name}>
              {name}
              <span className="text-faint ml-2">{description}</span>
            </p>
          </div>
          <IconButton label="Close" icon={X} onClick={onClose} />
        </div>

        {apps.length === 0 ? (
          <p className="px-5 pb-6 text-small text-muted">
            No installed app opens this type of file. Install one, then try again.
          </p>
        ) : (
          <ul className="max-h-80 overflow-auto px-3 pb-3 flex flex-col gap-0.5" role="listbox" aria-label="Apps">
            {apps.map(app => {
              const isSelected = app.id === selected;
              return (
                <li key={app.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => setSelected(app.id)}
                    onDoubleClick={() => onOpen(app.id, false)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${
                      isSelected ? 'bg-accent-soft' : 'hover-tint'
                    }`}
                  >
                    {app.icon ? (
                      <img src={app.icon} alt="" className="w-9 h-9 shrink-0 object-contain" />
                    ) : (
                      <span className="lens w-9 h-9 shrink-0 rounded-[10px] flex items-center justify-center">
                        <AppWindow className="w-5 h-5" />
                      </span>
                    )}
                    <span className="flex-1 truncate text-body">{app.name}</span>
                    {app.isDefault && (
                      <span className="shrink-0 px-2 h-5 inline-flex items-center rounded-full text-[11px] font-medium bg-accent-faint text-accent">
                        Default
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-line">
          <button
            type="button"
            disabled={!selected}
            onClick={() => selected && onOpen(selected, false)}
            className="pill h-8 px-4 rounded-lg text-small font-medium disabled:opacity-40"
          >
            Just once
          </button>
          <button
            type="button"
            disabled={!selected}
            onClick={() => selected && onOpen(selected, true)}
            className="lens h-8 px-4 rounded-lg text-small font-medium disabled:opacity-40"
          >
            Always
          </button>
        </div>
      </div>
    </div>
  );
};

export default OpenWithDialog;

import React from 'react';
import { Clipboard } from 'lucide-react';
import { CaptureStatus, CategoryCounts } from '../types';
import { CATEGORIES, CategoryFilter } from '../lib/categories';

interface SidebarProps {
  activeCategory: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  counts: CategoryCounts;
  captureEnabled: boolean;
  /** `null` until known, or when running outside the desktop app. */
  captureStatus: CaptureStatus | null;
  onToggleCapture: () => void;
}

/** Floating glass sidebar: categories and whether copying is being recorded. */
const Sidebar: React.FC<SidebarProps> = ({
  activeCategory,
  onCategoryChange,
  counts,
  captureEnabled,
  captureStatus,
  onToggleCapture,
}) => {
  const unavailable = captureStatus !== null && !captureStatus.available;
  const [state, detail] = unavailable
    ? ['Capture unavailable', captureStatus.error ?? 'The clipboard could not be read']
    : captureEnabled
      ? ['Recording', captureStatus?.wayland ? 'Only X11 apps are recorded under Wayland' : `${counts.all} items saved`]
      : ['Paused', 'New copies are not saved'];
  const dot = unavailable ? 'bg-danger' : captureEnabled ? 'bg-[#34c759]' : 'bg-faint';

  return (
    <aside className="w-[232px] shrink-0 h-full p-2.5 pr-0">
      <div className="glass h-full rounded-[18px] flex flex-col p-2.5">
        <div className="flex items-center gap-2.5 px-1.5 pt-1.5 pb-4">
          <span className="lens w-7 h-7 rounded-lg inline-flex items-center justify-center">
            <Clipboard className="w-4 h-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-[-0.01em]">ClipVault</span>
        </div>

        <nav aria-label="Categories" className="flex flex-col gap-0.5">
          {CATEGORIES.map(({ id, label, icon: Icon }) => {
            const active = id === activeCategory;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onCategoryChange(id)}
                aria-current={active ? 'page' : undefined}
                className={`h-9 px-2.5 rounded-[10px] flex items-center gap-2.5 text-body transition-colors ${
                  active ? 'lens font-medium' : 'text-ink hover-tint'
                }`}
              >
                <Icon className={`w-[17px] h-[17px] ${active ? '' : 'text-muted'}`} />
                <span className="flex-1 text-left">{label}</span>
                <span className={`text-caption tabular-nums ${active ? 'text-white/80' : 'text-faint'}`}>
                  {counts[id]}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto rounded-xl p-3 bg-line">
          <div className="flex items-center gap-2 text-small font-medium">
            <span aria-hidden className={`w-2 h-2 rounded-full ${dot}`} />
            {state}
          </div>
          <p className="mt-0.5 text-caption text-muted [overflow-wrap:anywhere]">{detail}</p>
          {!unavailable && captureStatus !== null && (
            <button
              type="button"
              onClick={onToggleCapture}
              className="pill mt-2.5 w-full h-7 rounded-lg text-small font-medium hover:text-accent transition-colors"
            >
              {captureEnabled ? 'Pause recording' : 'Resume recording'}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

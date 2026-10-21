import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clipboard } from 'lucide-react';
import { ClipboardItem, ViewMode, Settings } from '../types';
import { errorMessage, hasBackend, hideWindow, openFile, openFileWith } from '../lib/backend';
import { matchesAccelerator } from '../lib/shortcuts';
import { dayLabel } from '../lib/format';
import { Kbd } from './ui';
import { SEARCH_INPUT_ID } from './Header';
import ClipboardItemCard from './ClipboardItemCard';
import ClipboardItemList from './ClipboardItemList';
import ItemModal from './ItemModal';
import OpenWithDialog from './OpenWithDialog';
import { OpenResult } from '../types';

const TOAST_MS = 2500;
/** Narrowest grid column, and the gap between cards. */
const COLUMN_MIN = 250;
const GAP = 14;

interface ClipboardViewProps {
  items: ClipboardItem[];
  hasMore: boolean;
  onLoadMore: () => void;
  /** A search or filter is active, so an empty list means "no matches". */
  isFiltered: boolean;
  viewMode: ViewMode;
  /** Sorted by date: show a heading for each day. */
  groupByDay: boolean;
  onToggleFavorite: (id: string) => void;
  onAddTag: (id: string, tag: string) => void;
  onRemoveTag: (id: string, tag: string) => void;
  onDeleteItem: (id: string) => void;
  onCopyItem: (id: string) => Promise<unknown>;
  shortcuts: Settings['shortcuts'];
  /** Hide the window after copying with the keyboard, so the user can paste. */
  hideAfterKeyboardCopy: boolean;
  /** Keyboard actions are off while another panel (settings) is open. */
  keyboardEnabled: boolean;
  /** Changes when the window is brought up; selection returns to the top. */
  focusToken: number;
}

const ClipboardView: React.FC<ClipboardViewProps> = ({
  items,
  hasMore,
  onLoadMore,
  isFiltered,
  viewMode,
  groupByDay,
  onToggleFavorite,
  onAddTag,
  onRemoveTag,
  onDeleteItem,
  onCopyItem,
  shortcuts,
  hideAfterKeyboardCopy,
  keyboardEnabled,
  focusToken,
}) => {
  // Track the open item by id so it reflects updates (favorite, tags).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const [cursor, setCursor] = useState(0);
  // A file waiting for the user to pick an application.
  const [chooser, setChooser] = useState<{
    itemId: string;
    position: number;
    choices: Extract<OpenResult, { kind: 'choose' }>;
  } | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(3);
  const isEmpty = items.length === 0;

  // Cards differ in height, so the grid is laid out as columns (masonry).
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setColumns(Math.max(1, Math.floor((width + GAP) / (COLUMN_MIN + GAP))));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [isEmpty]);
  const selectedItem = items.find(item => item.id === selectedId) ?? null;
  const cursorIndex = Math.min(cursor, items.length - 1);
  const cursorItem = cursorIndex >= 0 ? items[cursorIndex] : undefined;

  useEffect(() => setCursor(0), [focusToken]);

  // Consecutive items copied on the same day share a heading.
  const groups = useMemo(() => {
    if (!groupByDay) return [{ label: null as string | null, items }];
    const now = new Date();
    const result: { label: string | null; items: ClipboardItem[] }[] = [];
    for (const item of items) {
      const label = dayLabel(item.timestamp, now);
      const last = result[result.length - 1];
      if (last?.label === label) last.items.push(item);
      else result.push({ label, items: [item] });
    }
    return result;
  }, [items, groupByDay]);

  useEffect(() => {
    if (!cursorItem) return;
    document
      .querySelector(`[data-item-id="${cursorItem.id}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [cursorItem]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  // Load the next page when the end of the list scrolls into view.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      entries => entries.some(e => e.isIntersecting) && onLoadMore(),
      { rootMargin: '400px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, items.length]);

  const handleCopy = (id: string, fromKeyboard = false) => {
    onCopyItem(id).then(
      () => {
        setToast({ message: 'Copied to clipboard', error: false });
        if (fromKeyboard && hideAfterKeyboardCopy) hideWindow().catch(() => {});
      },
      error => setToast({ message: `Could not copy: ${errorMessage(error)}`, error: true })
    );
  };

  const handleOpenFile = (itemId: string, position: number) => {
    openFile(itemId, position).then(
      result => {
        if (result.kind === 'choose') setChooser({ itemId, position, choices: result });
      },
      error => setToast({ message: `Could not open: ${errorMessage(error)}`, error: true })
    );
  };

  const handleOpenWith = (appId: string, always: boolean) => {
    if (!chooser) return;
    const { itemId, position } = chooser;
    setChooser(null);
    openFileWith(itemId, position, appId, always).then(
      () => always && setToast({ message: 'Will always open files of this type with this app', error: false }),
      error => setToast({ message: `Could not open: ${errorMessage(error)}`, error: true })
    );
  };

  // Arrow keys move the selection; Enter opens it; the configured shortcuts
  // copy or delete it; Escape closes the preview or hides the window.
  useEffect(() => {
    if (!keyboardEnabled || chooser) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (selectedId) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setSelectedId(null);
        }
        return;
      }
      const target = e.target as HTMLElement;
      const inSearch = target.id === SEARCH_INPUT_ID;
      const typing = !!target.closest('input, textarea, select, [contenteditable="true"]');
      if (typing && !inSearch) return;

      const move = (delta: number) => {
        e.preventDefault();
        setCursor(Math.max(0, Math.min(items.length - 1, cursorIndex + delta)));
      };
      if (e.key === 'ArrowDown' || (!typing && e.key === 'ArrowRight')) return move(1);
      if (e.key === 'ArrowUp' || (!typing && e.key === 'ArrowLeft')) return move(-1);
      if (e.key === 'Escape') {
        if (hideAfterKeyboardCopy) hideWindow().catch(() => {});
        return;
      }
      if (!cursorItem) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        setSelectedId(cursorItem.id);
      } else if (matchesAccelerator(e, shortcuts.copySelected)) {
        const input = target as HTMLInputElement;
        // Let the search field copy its own selected text.
        if (inSearch && input.selectionStart !== input.selectionEnd) return;
        e.preventDefault();
        handleCopy(cursorItem.id, true);
      } else if (!typing && matchesAccelerator(e, shortcuts.deleteSelected)) {
        e.preventDefault();
        onDeleteItem(cursorItem.id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // In <body> and absolute, not fixed: see Overlay in ./ui.
  const toastView = toast && createPortal(
    <div
      role="status"
      className={`glass absolute bottom-6 left-1/2 -translate-x-1/2 z-[70] px-4 h-10 inline-flex items-center rounded-full text-small font-medium ${
        toast.error ? 'text-danger' : 'text-ink'
      }`}
    >
      {toast.message}
    </div>,
    document.body
  );

  if (items.length === 0) {
    const [title, hint] = !hasBackend
      ? ['Desktop app required', 'Run `npm run tauri dev` to see your clipboard history.']
      : isFiltered
        ? ['Nothing matches', 'Try other words, another category, or turn off the favorites filter.']
        : ['Nothing copied yet', 'Copy text, a link, an image or files and it shows up here.'];
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="max-w-sm text-center flex flex-col items-center">
          <span className="glass w-14 h-14 rounded-2xl inline-flex items-center justify-center text-muted mb-4">
            <Clipboard className="w-6 h-6" />
          </span>
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <p className="mt-1 text-small text-muted">{hint}</p>
          {hasBackend && !isFiltered && shortcuts.toggleApp && (
            <p className="mt-4 text-small text-muted">
              Bring ClipVault back from anywhere with <Kbd keys={shortcuts.toggleApp} />
            </p>
          )}
        </div>
        {toastView}
      </div>
    );
  }

  const renderItem = (item: ClipboardItem, showTimeOnly: boolean) => {
    const props = {
      item,
      onToggleFavorite,
      onAddTag,
      onRemoveTag,
      onDeleteItem,
      onCopy: () => handleCopy(item.id),
      onView: () => setSelectedId(item.id),
      onOpenFile: (position: number) => handleOpenFile(item.id, position),
      isSelected: item.id === cursorItem?.id,
      showTimeOnly,
    };
    return viewMode === 'grid' ? (
      <ClipboardItemCard key={item.id} {...props} />
    ) : (
      <ClipboardItemList key={item.id} {...props} />
    );
  };

  return (
    <div ref={scroller} className="h-full overflow-auto px-6 pb-8">
      {groups.map(group => (
        <section key={group.label ?? 'all'} aria-label={group.label ?? undefined}>
          {group.label && (
            <h2 className="sticky top-0 z-10 bg-canvas pt-2 pb-2.5 text-small font-semibold text-muted">
              {group.label}
            </h2>
          )}
          {viewMode === 'grid' ? (
            // Item i goes to column i % columns, so reading order stays row by row.
            <div className="flex items-start pt-0.5 pb-5" style={{ gap: GAP }}>
              {Array.from({ length: columns }, (_, column) => (
                <div key={column} className="flex-1 min-w-0 flex flex-col" style={{ gap: GAP }}>
                  {group.items
                    .filter((_, i) => i % columns === column)
                    .map(item => renderItem(item, group.label !== null))}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2 pt-0.5 pb-5">
              {group.items.map(item => renderItem(item, group.label !== null))}
            </div>
          )}
        </section>
      ))}

      {hasMore && <div ref={sentinel} className="h-8" aria-hidden />}

      {selectedItem && (
        <ItemModal
          item={selectedItem}
          onClose={() => setSelectedId(null)}
          onToggleFavorite={onToggleFavorite}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          onDeleteItem={onDeleteItem}
          onCopy={() => handleCopy(selectedItem.id)}
          onOpenFile={position => handleOpenFile(selectedItem.id, position)}
        />
      )}

      {chooser && (
        <OpenWithDialog
          name={chooser.choices.name}
          description={chooser.choices.description}
          apps={chooser.choices.apps}
          onOpen={handleOpenWith}
          onClose={() => setChooser(null)}
        />
      )}

      {toastView}
    </div>
  );
};

export default ClipboardView;

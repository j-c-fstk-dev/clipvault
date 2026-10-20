import React, { useEffect, useRef, useState } from 'react';
import { ClipboardItem, ViewMode, Theme, AccentColor, Settings } from '../types';
import { errorMessage, hasBackend, hideWindow, openFile, openFileWith } from '../lib/backend';
import { matchesAccelerator } from '../lib/shortcuts';
import { SEARCH_INPUT_ID } from './Header';
import ClipboardItemCard from './ClipboardItemCard';
import ClipboardItemList from './ClipboardItemList';
import ItemModal from './ItemModal';
import OpenWithDialog from './OpenWithDialog';
import { OpenResult } from '../types';

const TOAST_MS = 2500;

interface ClipboardViewProps {
  items: ClipboardItem[];
  hasMore: boolean;
  onLoadMore: () => void;
  /** A search or filter is active, so an empty list means "no matches". */
  isFiltered: boolean;
  viewMode: ViewMode;
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
  theme: Theme;
  accentColor: AccentColor;
}

const ClipboardView: React.FC<ClipboardViewProps> = ({
  items,
  hasMore,
  onLoadMore,
  isFiltered,
  viewMode,
  onToggleFavorite,
  onAddTag,
  onRemoveTag,
  onDeleteItem,
  onCopyItem,
  shortcuts,
  hideAfterKeyboardCopy,
  keyboardEnabled,
  focusToken,
  theme,
  accentColor
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
  const selectedItem = items.find(item => item.id === selectedId) ?? null;
  const cursorIndex = Math.min(cursor, items.length - 1);
  const cursorItem = cursorIndex >= 0 ? items[cursorIndex] : undefined;

  useEffect(() => setCursor(0), [focusToken]);

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

  const toastView = toast && (
    <div
      role="status"
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-sm text-white ${
        toast.error ? 'bg-red-600' : ''
      }`}
      style={toast.error ? undefined : { backgroundColor: accentColor }}
    >
      {toast.message}
    </div>
  );

  if (items.length === 0) {
    const [title, hint] = !hasBackend
      ? ['Desktop app required', 'Run `npm run tauri dev` to see your clipboard history']
      : isFiltered
        ? ['No matching items', 'Try another search or filter']
        : ['No items yet', 'Everything you copy will appear here'];
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div 
            className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center text-3xl shadow-lg"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            📋
          </div>
          <h3 className={`text-xl font-semibold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            {title}
          </h3>
          <p className={`${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {hint}
          </p>
        </div>
        {toastView}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map((item) => (
            <ClipboardItemCard
              key={item.id}
              item={item}
              onToggleFavorite={onToggleFavorite}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
              onDeleteItem={onDeleteItem}
              onCopy={() => handleCopy(item.id)}
              onView={() => setSelectedId(item.id)}
              onOpenFile={position => handleOpenFile(item.id, position)}
              isSelected={item.id === cursorItem?.id}
              theme={theme}
              accentColor={accentColor}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ClipboardItemList
              key={item.id}
              item={item}
              onToggleFavorite={onToggleFavorite}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
              onDeleteItem={onDeleteItem}
              onCopy={() => handleCopy(item.id)}
              onView={() => setSelectedId(item.id)}
              onOpenFile={position => handleOpenFile(item.id, position)}
              isSelected={item.id === cursorItem?.id}
              theme={theme}
              accentColor={accentColor}
            />
          ))}
        </div>
      )}

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
          theme={theme}
          accentColor={accentColor}
        />
      )}

      {chooser && (
        <OpenWithDialog
          name={chooser.choices.name}
          description={chooser.choices.description}
          apps={chooser.choices.apps}
          onOpen={handleOpenWith}
          onClose={() => setChooser(null)}
          theme={theme}
          accentColor={accentColor}
        />
      )}

      {toastView}
    </div>
  );
};

export default ClipboardView;

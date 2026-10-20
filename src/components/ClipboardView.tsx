import React, { useEffect, useRef, useState } from 'react';
import { ClipboardItem, ViewMode, Theme, AccentColor } from '../types';
import { errorMessage, hasBackend } from '../lib/backend';
import ClipboardItemCard from './ClipboardItemCard';
import ClipboardItemList from './ClipboardItemList';
import ItemModal from './ItemModal';

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
  theme,
  accentColor
}) => {
  // Track the open item by id so it reflects updates (favorite, tags).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const selectedItem = items.find(item => item.id === selectedId) ?? null;

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

  const handleCopy = (id: string) => {
    onCopyItem(id).then(
      () => setToast({ message: 'Copied to clipboard', error: false }),
      error => setToast({ message: `Could not copy: ${errorMessage(error)}`, error: true })
    );
  };

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
          theme={theme}
          accentColor={accentColor}
        />
      )}

      {toastView}
    </div>
  );
};

export default ClipboardView;

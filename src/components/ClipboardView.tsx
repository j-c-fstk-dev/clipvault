import React, { useState } from 'react';
import { Star, Tag, Trash2, Copy, ExternalLink, Download, Eye } from 'lucide-react';
import { ClipboardItem, ViewMode, Theme, AccentColor } from '../types';
import ClipboardItemCard from './ClipboardItemCard';
import ClipboardItemList from './ClipboardItemList';
import ItemModal from './ItemModal';

interface ClipboardViewProps {
  items: ClipboardItem[];
  viewMode: ViewMode;
  onToggleFavorite: (id: string) => void;
  onAddTag: (id: string, tag: string) => void;
  onRemoveTag: (id: string, tag: string) => void;
  onDeleteItem: (id: string) => void;
  theme: Theme;
  accentColor: AccentColor;
}

const ClipboardView: React.FC<ClipboardViewProps> = ({
  items,
  viewMode,
  onToggleFavorite,
  onAddTag,
  onRemoveTag,
  onDeleteItem,
  theme,
  accentColor
}) => {
  const [selectedItem, setSelectedItem] = useState<ClipboardItem | null>(null);

  const handleCopyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      // Show success notification (could be implemented later)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  if (items.length === 0) {
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
            No items found
          </h3>
          <p className={`${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Your clipboard history will appear here when you copy items
          </p>
        </div>
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
              onCopy={() => handleCopyToClipboard(item.content)}
              onView={() => setSelectedItem(item)}
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
              onCopy={() => handleCopyToClipboard(item.content)}
              onView={() => setSelectedItem(item)}
              theme={theme}
              accentColor={accentColor}
            />
          ))}
        </div>
      )}

      {selectedItem && (
        <ItemModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onToggleFavorite={onToggleFavorite}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          onDeleteItem={onDeleteItem}
          onCopy={() => handleCopyToClipboard(selectedItem.content)}
          theme={theme}
          accentColor={accentColor}
        />
      )}
    </div>
  );
};

export default ClipboardView;
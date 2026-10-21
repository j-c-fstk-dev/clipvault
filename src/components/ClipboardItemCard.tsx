import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { ClipboardItem } from '../types';
import { categoryIcon } from '../lib/categories';
import { useI18n } from '../i18n';
import { dateTimeLabel, formatSize, hostOf, timeLabel } from '../lib/format';
import FileSummary from './FileSummary';
import { ItemActions, Tags } from './ItemParts';

/** Longest text drawn in a card; the rest is clamped away anyway. */
const PREVIEW_CHARS = 600;

export interface ItemViewProps {
  item: ClipboardItem;
  onToggleFavorite: (id: string) => void;
  onAddTag: (id: string, tag: string) => void;
  onRemoveTag: (id: string, tag: string) => void;
  onDeleteItem: (id: string) => void;
  onCopy: () => void;
  /** Opens one of a file item's files. */
  onOpenFile: (position: number) => void;
  onView: () => void;
  /** Highlighted for keyboard actions. */
  isSelected?: boolean;
  /** A day heading above already gives the date. */
  showTimeOnly?: boolean;
}

/** What an item holds, sized for a card or a row. */
export const ItemBody: React.FC<{ item: ClipboardItem; compact?: boolean; onOpenFile: (position: number) => void }> = ({
  item,
  compact = false,
  onOpenFile,
}) => {
  const { t } = useI18n();
  if (item.files.length > 0) {
    return (
      <div className="flex flex-col gap-2.5">
        {item.thumbnailUrl && !compact && (
          <img src={item.thumbnailUrl} alt="" className="w-full max-h-44 object-cover rounded-[10px] bg-surface-2" />
        )}
        <FileSummary files={item.files} onOpen={onOpenFile} limit={compact ? 2 : 3} />
      </div>
    );
  }
  if (item.kind === 'image') {
    const dimensions = item.width && item.height ? `${item.width} × ${item.height}` : null;
    return item.thumbnailUrl && !compact ? (
      <img
        src={item.thumbnailUrl}
        alt={dimensions ? t.item.imageSized(dimensions) : t.item.image}
        className="w-full max-h-48 object-cover rounded-[10px] bg-surface-2"
      />
    ) : (
      <p className="text-body font-medium">{dimensions ? t.item.imageSized(dimensions) : t.item.image}</p>
    );
  }
  const host = item.category === 'link' ? hostOf(item.content) : null;
  if (host) {
    return (
      <div className="min-w-0">
        <p className="text-body font-medium truncate">{host}</p>
        <p
          className={`font-mono text-clip text-muted [overflow-wrap:anywhere] ${compact ? 'truncate' : 'line-clamp-2'}`}
        >
          {item.content.slice(0, PREVIEW_CHARS)}
        </p>
      </div>
    );
  }
  return (
    <p
      className={`font-mono text-clip text-ink [overflow-wrap:anywhere] ${
        compact ? 'truncate' : 'whitespace-pre-wrap line-clamp-6'
      }`}
    >
      {item.content.slice(0, PREVIEW_CHARS)}
    </p>
  );
};

/** When the item was copied, its size, and whether it is a favorite. */
export const ItemMeta: React.FC<{ item: ClipboardItem; showTimeOnly?: boolean }> = ({ item, showTimeOnly }) => {
  const i18n = useI18n();
  const Icon = categoryIcon(item.category);
  const full = dateTimeLabel(item.timestamp, i18n.locale);
  return (
    <div className="flex items-center gap-1.5 text-caption text-muted min-w-0">
      <Icon aria-hidden className="w-3.5 h-3.5 shrink-0 text-faint" />
      <span>{i18n.t.singular[item.category]}</span>
      <span className="text-faint" title={full}>
        {showTimeOnly ? timeLabel(item.timestamp, i18n) : full}
      </span>
      {item.size !== undefined && <span className="text-faint">{formatSize(item.size)}</span>}
      {item.isFavorite && <Star aria-label={i18n.t.item.favorite} className="w-3.5 h-3.5 text-star fill-current" />}
    </div>
  );
};

const ClipboardItemCard: React.FC<ItemViewProps> = ({
  item,
  onToggleFavorite,
  onAddTag,
  onRemoveTag,
  onDeleteItem,
  onCopy,
  onOpenFile,
  onView,
  isSelected = false,
  showTimeOnly,
}) => {
  const [tagging, setTagging] = useState(false);
  return (
    <article
      data-item-id={item.id}
      aria-selected={isSelected}
      onClick={onView}
      className={`card group relative rounded-[14px] p-3.5 flex flex-col gap-2.5 transition-[border-color,box-shadow] ${
        isSelected ? 'border-transparent shadow-[0_0_0_2px_var(--accent)]' : 'hover:border-line-strong'
      }`}
    >
      <ItemMeta item={item} showTimeOnly={showTimeOnly} />
      <ItemBody item={item} onOpenFile={onOpenFile} />
      <Tags
        tags={item.tags}
        onAdd={tag => onAddTag(item.id, tag)}
        onRemove={tag => onRemoveTag(item.id, tag)}
        adding={tagging}
        onAddingChange={setTagging}
      />
      <ItemActions
        item={item}
        visible={isSelected}
        onToggleFavorite={() => onToggleFavorite(item.id)}
        onCopy={onCopy}
        onView={onView}
        onDelete={() => onDeleteItem(item.id)}
        onTag={() => setTagging(true)}
        className="absolute top-2 right-2"
      />
    </article>
  );
};

export default ClipboardItemCard;

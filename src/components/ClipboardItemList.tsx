import React, { useState } from 'react';
import { categoryIcon } from '../lib/categories';
import { fileIcon } from '../lib/fileTypes';
import { ItemBody, ItemMeta, ItemViewProps } from './ClipboardItemCard';
import { ItemActions, Tags } from './ItemParts';

/** One history item as a compact row. */
const ClipboardItemList: React.FC<ItemViewProps> = ({
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
  const [first] = item.files;
  const Icon = first ? fileIcon(first.name, first.isDir) : categoryIcon(item.category);
  return (
    <article
      data-item-id={item.id}
      aria-selected={isSelected}
      onClick={onView}
      className={`card group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-[border-color,box-shadow] ${
        isSelected ? 'border-transparent shadow-[0_0_0_2px_var(--accent)]' : 'hover:border-line-strong'
      }`}
    >
      {item.thumbnailUrl ? (
        <img src={item.thumbnailUrl} alt="" className="w-11 h-11 shrink-0 object-cover rounded-lg bg-surface-2" />
      ) : (
        <span className="w-11 h-11 shrink-0 rounded-lg bg-surface-2 inline-flex items-center justify-center text-muted">
          <Icon className="w-5 h-5" />
        </span>
      )}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <ItemBody item={item} compact onOpenFile={onOpenFile} />
        <div className="flex items-center gap-3 min-w-0">
          <ItemMeta item={item} showTimeOnly={showTimeOnly} />
          <Tags
            tags={item.tags}
            onAdd={tag => onAddTag(item.id, tag)}
            onRemove={tag => onRemoveTag(item.id, tag)}
            adding={tagging}
            onAddingChange={setTagging}
          />
        </div>
      </div>
      <ItemActions
        item={item}
        visible={isSelected}
        onToggleFavorite={() => onToggleFavorite(item.id)}
        onCopy={onCopy}
        onView={onView}
        onDelete={() => onDeleteItem(item.id)}
        onTag={() => setTagging(true)}
        className="shrink-0"
      />
    </article>
  );
};

export default ClipboardItemList;

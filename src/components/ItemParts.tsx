import React, { useState } from 'react';
import { Copy, Maximize2, Plus, Star, Tag, Trash2, X } from 'lucide-react';
import { ClipboardItem } from '../types';
import { IconButton } from './ui';

interface TagsProps {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  /**
   * Controlled from outside (a "Tag" action on cards and rows); when
   * omitted, the tags show their own "Add tag" button.
   */
  adding?: boolean;
  onAddingChange?: (adding: boolean) => void;
}

/** An item's tags; each can be removed, and new ones typed in. */
export const Tags: React.FC<TagsProps> = ({ tags, onAdd, onRemove, adding: controlled, onAddingChange }) => {
  const [own, setOwn] = useState(false);
  const adding = controlled ?? own;
  const setAdding = (value: boolean) => (onAddingChange ? onAddingChange(value) : setOwn(value));
  const [draft, setDraft] = useState('');

  const commit = () => {
    if (draft.trim()) onAdd(draft.trim());
    setDraft('');
    setAdding(false);
  };

  if (tags.length === 0 && !adding && controlled !== undefined) return null;

  return (
    <div className="flex flex-wrap items-center gap-1" onClick={e => e.stopPropagation()}>
      {tags.map(tag => (
        <span
          key={tag}
          className="inline-flex items-center gap-0.5 h-[22px] pl-2 pr-1 rounded-full bg-accent-faint text-accent text-caption font-medium"
        >
          {tag}
          <button
            type="button"
            onClick={() => onRemove(tag)}
            aria-label={`Remove tag ${tag}`}
            title="Remove tag"
            className="w-4 h-4 inline-flex items-center justify-center rounded-full opacity-60 hover:opacity-100"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              e.stopPropagation();
              setDraft('');
              setAdding(false);
            }
          }}
          onBlur={commit}
          aria-label="New tag"
          placeholder="Tag name"
          className="field h-[22px] w-28 px-2 rounded-full text-caption"
          autoFocus
        />
      ) : (
        controlled === undefined && <AddTag onClick={() => setAdding(true)} />
      )}
    </div>
  );
};

const AddTag: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={e => {
      e.stopPropagation();
      onClick();
    }}
    className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-caption text-faint hover:text-ink hover-tint"
  >
    <Plus className="w-3 h-3" />
    Add tag
  </button>
);

interface ItemActionsProps {
  item: ClipboardItem;
  onToggleFavorite: () => void;
  onCopy: () => void;
  onView: () => void;
  onDelete: () => void;
  onTag: () => void;
  /** Keep visible, e.g. while the item is selected with the keyboard. */
  visible?: boolean;
  className?: string;
}

/** Floating bar with an item's actions, shown on hover. Opaque: it sits on content. */
export const ItemActions: React.FC<ItemActionsProps> = ({
  item,
  onToggleFavorite,
  onCopy,
  onView,
  onDelete,
  onTag,
  visible = false,
  className = '',
}) => (
  <div
    onClick={e => e.stopPropagation()}
    className={`float-bar flex items-center p-0.5 rounded-[10px] transition-opacity ${
      visible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
    } ${className}`}
  >
    <IconButton size="sm" label="Copy" icon={Copy} onClick={onCopy} />
    <IconButton
      size="sm"
      label={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      icon={Star}
      tone="star"
      onClick={onToggleFavorite}
      className={item.isFavorite ? '!text-star [&>svg]:fill-current' : ''}
    />
    <IconButton size="sm" label="Add tag" icon={Tag} onClick={onTag} />
    <IconButton size="sm" label="Open preview" icon={Maximize2} onClick={onView} />
    <IconButton size="sm" label="Delete" icon={Trash2} tone="danger" onClick={onDelete} />
  </div>
);

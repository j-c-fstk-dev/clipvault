import React from 'react';
import { Copy, Star, Trash2, X } from 'lucide-react';
import { ClipboardItem } from '../types';
import { categoryInfo } from '../lib/categories';
import { dateTimeLabel, formatSize, hostOf } from '../lib/format';
import FileSummary from './FileSummary';
import { Tags } from './ItemParts';
import { IconButton } from './ui';

interface ItemModalProps {
  item: ClipboardItem;
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
  onAddTag: (id: string, tag: string) => void;
  onRemoveTag: (id: string, tag: string) => void;
  onDeleteItem: (id: string) => void;
  onCopy: () => void;
  /** Opens one of a file item's files. */
  onOpenFile: (position: number) => void;
}

/** Everything an item holds, with its actions. */
const ItemModal: React.FC<ItemModalProps> = ({
  item,
  onClose,
  onToggleFavorite,
  onAddTag,
  onRemoveTag,
  onDeleteItem,
  onCopy,
  onOpenFile,
}) => {
  const { singular, icon: Icon } = categoryInfo(item.category);
  const host = item.category === 'link' ? hostOf(item.content) : null;
  const details = [
    dateTimeLabel(item.timestamp),
    item.size !== undefined ? formatSize(item.size) : null,
    item.width && item.height ? `${item.width} × ${item.height}` : null,
    item.files.length > 1 ? `${item.files.length} files` : null,
  ].filter(Boolean);

  return (
    <div className="overlay fixed inset-0 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${singular} preview`}
        onClick={e => e.stopPropagation()}
        className="sheet sheet-in w-full max-w-3xl max-h-[86vh] rounded-2xl flex flex-col overflow-hidden"
      >
        <header className="flex items-center gap-3 px-5 h-16 shrink-0 border-b border-line">
          <span className="w-9 h-9 rounded-[10px] bg-surface-2 inline-flex items-center justify-center text-muted">
            <Icon className="w-[18px] h-[18px]" />
          </span>
          <div className="min-w-0 mr-auto">
            <h2 className="text-body font-semibold">{host ?? singular}</h2>
            <p className="text-caption text-muted flex gap-3">
              {details.map(detail => (
                <span key={detail}>{detail}</span>
              ))}
            </p>
          </div>
          <IconButton
            label={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            icon={Star}
            tone="star"
            onClick={() => onToggleFavorite(item.id)}
            className={item.isFavorite ? '!text-star [&>svg]:fill-current' : ''}
          />
          <IconButton
            label="Delete"
            icon={Trash2}
            tone="danger"
            onClick={() => {
              onDeleteItem(item.id);
              onClose();
            }}
          />
          <button
            type="button"
            onClick={onCopy}
            className="lens h-8 px-3.5 ml-1 rounded-lg inline-flex items-center gap-1.5 text-small font-medium"
          >
            <Copy className="w-4 h-4" />
            Copy
          </button>
          <IconButton label="Close" icon={X} onClick={onClose} />
        </header>

        <div className="flex-1 min-h-0 overflow-auto p-5 flex flex-col gap-4">
          {item.thumbnailUrl && (
            <img
              src={item.thumbnailUrl}
              alt=""
              className="max-w-full max-h-[55vh] self-center object-contain rounded-xl bg-surface-2"
            />
          )}
          {item.files.length > 0 ? (
            <FileSummary files={item.files} onOpen={onOpenFile} />
          ) : item.kind !== 'image' ? (
            <pre className="font-mono text-clip whitespace-pre-wrap [overflow-wrap:anywhere] bg-canvas border border-line rounded-xl p-4 select-text">
              {item.content}
            </pre>
          ) : null}
        </div>

        <footer className="px-5 py-3.5 border-t border-line shrink-0">
          <Tags
            tags={item.tags}
            onAdd={tag => onAddTag(item.id, tag)}
            onRemove={tag => onRemoveTag(item.id, tag)}
          />
        </footer>
      </div>
    </div>
  );
};

export default ItemModal;

import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { ClipboardCategory, ClipboardItem } from '../types';

/** Mirrors `model::Item` in src-tauri. */
interface BackendItem {
  id: number;
  kind: 'text' | 'image' | 'files';
  category: ClipboardCategory;
  content: string;
  html: string | null;
  mime: string | null;
  imagePath: string | null;
  width: number | null;
  height: number | null;
  size: number | null;
  files: {
    path: string;
    name: string;
    isDir: boolean;
    size: number | null;
    snapshotPath: string | null;
    status: 'stored' | 'too_large' | 'unavailable';
  }[];
  isFavorite: boolean;
  tags: string[];
  createdAt: number;
  lastUsedAt: number;
}

/** True when running inside the desktop app rather than a plain browser. */
export const hasBackend = isTauri();

const toClipboardItem = (item: BackendItem): ClipboardItem => ({
  id: String(item.id),
  content: item.content,
  category: item.category,
  timestamp: new Date(item.lastUsedAt).toISOString(),
  size: item.size ?? undefined,
  filename: item.files.length ? item.files.map(f => f.name).join(', ') : undefined,
  thumbnailUrl: item.imagePath ? convertFileSrc(item.imagePath) : undefined,
  isFavorite: item.isFavorite,
  tags: item.tags,
});

export const listItems = async (): Promise<ClipboardItem[]> =>
  (await invoke<BackendItem[]>('list_items')).map(toClipboardItem);

export const setFavorite = (id: string, favorite: boolean) =>
  invoke('set_favorite', { id: Number(id), favorite });

export const addTag = (id: string, tag: string) => invoke('add_tag', { id: Number(id), tag });

export const removeTag = (id: string, tag: string) =>
  invoke('remove_tag', { id: Number(id), tag });

export const deleteItem = (id: string) => invoke('delete_item', { id: Number(id) });

/** Calls `onChange` whenever the backend stores a clipboard change. */
export const onHistoryChanged = (onChange: () => void): Promise<UnlistenFn> =>
  listen('clipboard-captured', onChange);

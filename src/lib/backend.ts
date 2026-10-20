import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import {
  CaptureStatus,
  CategoryCounts,
  ClipboardCategory,
  ClipboardItem,
  Settings,
  SortOption,
} from '../types';

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

/** Mirrors `store::Query` in src-tauri. */
export interface ItemQuery {
  search: string;
  category: ClipboardCategory | null;
  favoritesOnly: boolean;
  sort: SortOption;
  limit: number;
  offset: number;
}

/** True when running inside the desktop app rather than a plain browser. */
export const hasBackend = isTauri();

const toClipboardItem = (item: BackendItem): ClipboardItem => ({
  id: String(item.id),
  kind: item.kind,
  content: item.content,
  category: item.category,
  timestamp: new Date(item.lastUsedAt).toISOString(),
  size: item.size ?? undefined,
  filename: item.files.length ? item.files.map(f => f.name).join(', ') : undefined,
  thumbnailUrl: item.imagePath ? convertFileSrc(item.imagePath) : undefined,
  width: item.width ?? undefined,
  height: item.height ?? undefined,
  files: item.files.map(f => ({
    path: f.path,
    name: f.name,
    isDir: f.isDir,
    size: f.size ?? undefined,
    status: f.status,
  })),
  isFavorite: item.isFavorite,
  tags: item.tags,
});

export const queryItems = async (
  query: ItemQuery
): Promise<{ items: ClipboardItem[]; total: number }> => {
  const page = await invoke<{ items: BackendItem[]; total: number }>('query_items', { query });
  return { items: page.items.map(toClipboardItem), total: page.total };
};

export const getCounts = () => invoke<CategoryCounts>('get_counts');

/** Puts an item back on the system clipboard. */
export const copyItem = (id: string) => invoke('copy_item', { id: Number(id) });

export const setFavorite = (id: string, favorite: boolean) =>
  invoke('set_favorite', { id: Number(id), favorite });

export const addTag = (id: string, tag: string) => invoke('add_tag', { id: Number(id), tag });

export const removeTag = (id: string, tag: string) =>
  invoke('remove_tag', { id: Number(id), tag });

export const deleteItem = (id: string) => invoke('delete_item', { id: Number(id) });

export const getCaptureStatus = () => invoke<CaptureStatus>('get_capture_status');

export const getSettings = () => invoke<Settings>('get_settings');

export const updateSettings = (settings: Settings) =>
  invoke<Settings>('update_settings', { settings });

/** Sends the window to the tray. */
export const hideWindow = () => invoke('hide_window');

/** Calls `onChange` with the new settings, including changes made from the tray. */
export const onSettingsChanged = (onChange: (settings: Settings) => void): Promise<UnlistenFn> =>
  listen<Settings>('settings-changed', event => onChange(event.payload));

/** Calls `onShown` when the window is brought up (tray, shortcut, second launch). */
export const onWindowShown = (onShown: () => void): Promise<UnlistenFn> =>
  listen('window-shown', onShown);

/** Calls `onChange` whenever the backend stores a clipboard change. */
export const onHistoryChanged = (onChange: () => void): Promise<UnlistenFn> =>
  listen('clipboard-captured', onChange);

/** Readable message from a rejected `invoke`. */
export const errorMessage = (error: unknown): string =>
  typeof error === 'string' ? error : error instanceof Error ? error.message : String(error);

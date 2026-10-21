import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import {
  CaptureStatus,
  CategoryCounts,
  ClipboardCategory,
  ClipboardItem,
  ExportStats,
  ImportStats,
  OpenResult,
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
    status: 'pending' | 'stored' | 'too_large' | 'unavailable';
    exists: boolean;
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

/** Image shown for an item: its stored image, or the saved copy of an image file. */
const previewPath = (item: BackendItem): string | null => {
  if (item.imagePath) return item.imagePath;
  const [first] = item.files;
  return item.category === 'image' && first?.status === 'stored' ? first.snapshotPath : null;
};

const toClipboardItem = (item: BackendItem): ClipboardItem => ({
  id: String(item.id),
  kind: item.kind,
  content: item.content,
  category: item.category,
  timestamp: new Date(item.lastUsedAt).toISOString(),
  size: item.size ?? undefined,
  filename: item.files.length ? item.files.map(f => f.name).join(', ') : undefined,
  thumbnailUrl: previewPath(item) ? convertFileSrc(previewPath(item)!) : undefined,
  width: item.width ?? undefined,
  height: item.height ?? undefined,
  files: item.files.map(f => ({
    path: f.path,
    name: f.name,
    isDir: f.isDir,
    size: f.size ?? undefined,
    status: f.status,
    exists: f.exists,
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

/** macOS: opens System Settings where clipboard access is allowed. */
export const openClipboardSettings = () => invoke('open_clipboard_settings');

export const getSettings = () => invoke<Settings>('get_settings');

/** The desktop's language, for the "auto" language setting. */
export const systemLanguage = () => invoke<'en' | 'pt'>('system_language');

export const updateSettings = (settings: Settings) =>
  invoke<Settings>('update_settings', { settings });

/** Opens one of an item's files, or returns the apps to choose from. */
export const openFile = (id: string, position: number) =>
  invoke<OpenResult>('open_file', { id: Number(id), position });

/** Opens one of an item's files with `appId`; `always` remembers it for the type. */
export const openFileWith = (id: string, position: number, appId: string, always: boolean) =>
  invoke('open_file_with', { id: Number(id), position, appId, always });

/** Sends the window to the tray. */
export const hideWindow = () => invoke('hide_window');

/** Calls `onChange` with the new settings, including changes made from the tray. */
export const onSettingsChanged = (onChange: (settings: Settings) => void): Promise<UnlistenFn> =>
  listen<Settings>('settings-changed', event => onChange(event.payload));

/** Calls `onShown` when the window is brought up (tray, shortcut, second launch). */
export const onWindowShown = (onShown: () => void): Promise<UnlistenFn> =>
  listen('window-shown', onShown);

/** Saves a `.zip` backup where the user picks; `null` if they cancel. */
export const exportBackup = () => invoke<ExportStats | null>('export_backup');

/** Merges a `.zip` backup the user picks; `null` if they cancel. */
export const importBackup = () => invoke<ImportStats | null>('import_backup');

/** Calls `onChange` whenever the history changes: a capture or an import. */
export const onHistoryChanged = async (onChange: () => void): Promise<UnlistenFn> => {
  const stops = await Promise.all([
    listen('clipboard-captured', onChange),
    listen('history-changed', onChange),
  ]);
  return () => stops.forEach(stop => stop());
};

/** Readable message from a rejected `invoke`. */
export const errorMessage = (error: unknown): string =>
  typeof error === 'string' ? error : error instanceof Error ? error.message : String(error);

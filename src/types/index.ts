export type ClipboardCategory = 'text' | 'link' | 'image' | 'file' | 'folder';

export interface FileInfo {
  path: string;
  name: string;
  isDir: boolean;
  size?: number;
  /** stored: a copy is kept in the vault; too_large: only the path; unavailable: missing when copied */
  status: 'stored' | 'too_large' | 'unavailable';
}

export interface ClipboardItem {
  id: string;
  kind: 'text' | 'image' | 'files';
  content: string;
  category: ClipboardCategory;
  timestamp: string;
  size?: number;
  filename?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  files: FileInfo[];
  isFavorite: boolean;
  tags: string[];
}

export type CategoryCounts = Record<ClipboardCategory | 'all', number>;

export interface CaptureStatus {
  available: boolean;
  paused: boolean;
  error?: string;
  wayland: boolean;
}

export type ViewMode = 'grid' | 'list';

export type SortOption = 'date-asc' | 'date-desc' | 'name-asc' | 'name-desc';

export type Theme = 'light' | 'dark';

export type AccentColor = string;

/** Mirrors `settings::Settings` in src-tauri. */
export interface Settings {
  maxItems: number;
  snapshotLimitMb: number;
  captureEnabled: boolean;
  notifications: boolean;
  startOnBoot: boolean;
  minimizeToTray: boolean;
  shortcuts: {
    toggleApp: string;
    copySelected: string;
    deleteSelected: string;
  };
}

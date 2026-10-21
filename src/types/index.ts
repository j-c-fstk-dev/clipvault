export type ClipboardCategory = 'text' | 'link' | 'image' | 'file' | 'folder';

export interface FileInfo {
  path: string;
  name: string;
  isDir: boolean;
  size?: number;
  /** pending: being copied into the vault; stored: copy kept; too_large: only the path; unavailable: missing when copied */
  status: 'pending' | 'stored' | 'too_large' | 'unavailable';
  /** Still at `path`; when false it was moved or deleted. */
  exists: boolean;
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
  /** macOS: whether the user lets ClipVault read the clipboard; `null` when there is no such setting or no choice yet. */
  access: 'allowed' | 'ask' | 'denied' | null;
}

/** Mirrors `backup::ExportStats` in src-tauri. */
export interface ExportStats {
  items: number;
  files: number;
  bytes: number;
}

/** Mirrors `store::ImportStats` in src-tauri. */
export interface ImportStats {
  added: number;
  merged: number;
  skipped: number;
  pruned: number;
}

/** Mirrors `open::AppChoice` in src-tauri. */
export interface AppChoice {
  id: string;
  name: string;
  /** data: URL */
  icon: string | null;
  isDefault: boolean;
}

/** Mirrors `commands::OpenResult` in src-tauri. */
export type OpenResult =
  | { kind: 'opened' }
  | { kind: 'choose'; name: string; contentType: string; description: string; apps: AppChoice[] };

export type ViewMode = 'grid' | 'list';

export type SortOption = 'date-asc' | 'date-desc' | 'name-asc' | 'name-desc';

export type Theme = 'light' | 'dark';

export type AccentColor = string;

/** "auto" follows the system language. */
export type Language = 'auto' | 'en' | 'pt';

/** Mirrors `settings::Settings` in src-tauri. */
export interface Settings {
  maxItems: number;
  snapshotLimitMb: number;
  captureEnabled: boolean;
  notifications: boolean;
  startOnBoot: boolean;
  minimizeToTray: boolean;
  hardwareAcceleration: boolean;
  /** App chosen with "Always", by content type. */
  openWith: Record<string, string>;
  language: Language;
  shortcuts: {
    toggleApp: string;
    copySelected: string;
    deleteSelected: string;
  };
}

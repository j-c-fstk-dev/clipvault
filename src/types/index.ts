export type ClipboardCategory = 'text' | 'link' | 'image' | 'file' | 'folder';

export interface ClipboardItem {
  id: string;
  content: string;
  category: ClipboardCategory;
  timestamp: string;
  size?: number;
  filename?: string;
  thumbnailUrl?: string;
  isFavorite: boolean;
  tags: string[];
}

export type ViewMode = 'grid' | 'list';

export type SortOption = 'date-asc' | 'date-desc' | 'name-asc' | 'name-desc';

export type Theme = 'light' | 'dark';

export type AccentColor = string;

export interface Settings {
  maxItems: number;
  shortcuts: {
    toggleApp: string;
    copySelected: string;
    deleteSelected: string;
  };
  autoSave: boolean;
  notifications: boolean;
  startOnBoot: boolean;
  minimizeToTray: boolean;
}

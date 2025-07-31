export interface ClipboardItem {
  id: string;
  content: string;
  category: ClipboardCategory;
  timestamp: Date;
  size?: number;
  filename?: string;
  thumbnailUrl?: string;
  isFavorite: boolean;
  tags: string[];
  metadata?: Record<string, any>;
}

export type ClipboardCategory = 'all' | 'text' | 'link' | 'image' | 'file' | 'folder';

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

export interface CategoryTab {
  id: ClipboardCategory;
  label: string;
  icon: React.ComponentType;
}
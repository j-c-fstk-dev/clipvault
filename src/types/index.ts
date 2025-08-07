// src/types/index.ts
import React from 'react';

// DECLARAÇÃO CORRIGIDA: Agora, o tipo ClipboardCategory é definido e exportado aqui
// Incluindo a categoria 'all' que você usa em outros componentes
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
  // O tipo do id agora é ClipboardCategory
  id: ClipboardCategory; 
  label: string;
  icon: React.ComponentType;
}
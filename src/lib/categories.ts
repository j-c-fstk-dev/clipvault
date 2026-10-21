import { ClipboardList, File, FileText, Folder, Image, Link } from 'lucide-react';
import { ClipboardCategory } from '../types';

export type CategoryFilter = ClipboardCategory | 'all';

/** Sidebar order; names come from the translations (`t.categories`). */
export const CATEGORIES: { id: CategoryFilter; icon: typeof File }[] = [
  { id: 'all', icon: ClipboardList },
  { id: 'text', icon: FileText },
  { id: 'link', icon: Link },
  { id: 'image', icon: Image },
  { id: 'file', icon: File },
  { id: 'folder', icon: Folder },
];

export const categoryIcon = (id: CategoryFilter) => (CATEGORIES.find(c => c.id === id) ?? CATEGORIES[0]).icon;

import { ClipboardList, File, FileText, Folder, Image, Link } from 'lucide-react';
import { ClipboardCategory } from '../types';

export type CategoryFilter = ClipboardCategory | 'all';

export const CATEGORIES: { id: CategoryFilter; label: string; singular: string; icon: typeof File }[] = [
  { id: 'all', label: 'All items', singular: 'Item', icon: ClipboardList },
  { id: 'text', label: 'Text', singular: 'Text', icon: FileText },
  { id: 'link', label: 'Links', singular: 'Link', icon: Link },
  { id: 'image', label: 'Images', singular: 'Image', icon: Image },
  { id: 'file', label: 'Files', singular: 'File', icon: File },
  { id: 'folder', label: 'Folders', singular: 'Folder', icon: Folder },
];

export const categoryInfo = (id: CategoryFilter) => CATEGORIES.find(c => c.id === id) ?? CATEGORIES[0];

import { useState, useEffect, useCallback } from 'react';
import { ClipboardItem } from '../types';
import * as backend from '../lib/backend';

// Mock data, used when the UI runs in a plain browser (`npm run dev`).
const generateMockData = (): ClipboardItem[] => {
  const mockItems: ClipboardItem[] = [
    {
      id: '1',
      content: 'https://github.com/clipvault/clipvault',
      category: 'link',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      isFavorite: true,
      tags: ['github', 'repository'],
    },
    {
      id: '2',
      content: 'ClipVault is a revolutionary clipboard manager that changes how you interact with your clipboard history. With advanced categorization, smart content detection, and a beautiful interface, it\'s like having a memory companion that never forgets.',
      category: 'text',
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      size: 256,
      isFavorite: false,
      tags: ['description', 'app'],
    },
    {
      id: '3',
      content: 'Screenshot_2024_01_15.png',
      category: 'image',
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      size: 1024 * 512,
      filename: 'Screenshot_2024_01_15.png',
      thumbnailUrl: 'https://images.pexels.com/photos/1714208/pexels-photo-1714208.jpeg?auto=compress&cs=tinysrgb&w=400',
      isFavorite: true,
      tags: ['screenshot', 'work'],
    },
    {
      id: '4',
      content: '/home/user/Documents/project-files/',
      category: 'folder',
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      isFavorite: false,
      tags: ['documents', 'project'],
    },
    {
      id: '5',
      content: 'npm install @clipvault/core --save',
      category: 'text',
      timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      isFavorite: false,
      tags: ['command', 'npm'],
    },
    {
      id: '6',
      content: 'presentation.pdf',
      category: 'file',
      timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      size: 1024 * 1024 * 2.5,
      filename: 'presentation.pdf',
      isFavorite: true,
      tags: ['presentation', 'work', 'important'],
    },
    {
      id: '7',
      content: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      category: 'link',
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      isFavorite: false,
      tags: ['video', 'youtube'],
    },
    {
      id: '8',
      content: 'wallpaper_4k.jpg',
      category: 'image',
      timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      size: 1024 * 1024 * 3.2,
      filename: 'wallpaper_4k.jpg',
      thumbnailUrl: 'https://images.pexels.com/photos/956999/milky-way-starry-sky-night-sky-star-956999.jpeg?auto=compress&cs=tinysrgb&w=400',
      isFavorite: false,
      tags: ['wallpaper', 'space'],
    },
  ];

  return mockItems;
};

export const useClipboard = () => {
  const [clipboardItems, setClipboardItems] = useState<ClipboardItem[]>(() =>
    backend.hasBackend ? [] : generateMockData()
  );

  const refresh = useCallback(async () => {
    if (!backend.hasBackend) return;
    try {
      setClipboardItems(await backend.listItems());
    } catch (error) {
      console.error('Failed to load clipboard history:', error);
    }
  }, []);

  useEffect(() => {
    if (!backend.hasBackend) return;
    refresh();
    const unlisten = backend.onHistoryChanged(refresh);
    return () => {
      unlisten.then(stop => stop());
    };
  }, [refresh]);

  /** Applies a change locally, or through the backend and then reloads. */
  const update = (
    remote: () => Promise<unknown>,
    local: (items: ClipboardItem[]) => ClipboardItem[]
  ) => {
    if (backend.hasBackend) {
      remote().then(refresh, error => console.error('Clipboard update failed:', error));
    } else {
      setClipboardItems(local);
    }
  };

  const toggleFavorite = (id: string) => {
    const item = clipboardItems.find(i => i.id === id);
    if (!item) return;
    update(
      () => backend.setFavorite(id, !item.isFavorite),
      prev => prev.map(i => (i.id === id ? { ...i, isFavorite: !i.isFavorite } : i))
    );
  };

  const addTag = (id: string, tag: string) => {
    update(
      () => backend.addTag(id, tag),
      prev =>
        prev.map(i =>
          i.id === id && !i.tags.includes(tag) ? { ...i, tags: [...i.tags, tag] } : i
        )
    );
  };

  const removeTag = (id: string, tag: string) => {
    update(
      () => backend.removeTag(id, tag),
      prev => prev.map(i => (i.id === id ? { ...i, tags: i.tags.filter(t => t !== tag) } : i))
    );
  };

  const deleteItem = (id: string) => {
    update(
      () => backend.deleteItem(id),
      prev => prev.filter(i => i.id !== id)
    );
  };

  return {
    clipboardItems,
    toggleFavorite,
    addTag,
    removeTag,
    deleteItem,
  };
};

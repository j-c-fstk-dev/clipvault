import { useState, useEffect } from 'react';
import { ClipboardItem, ClipboardCategory } from '../types';

// Mock data for demonstration
const generateMockData = (): ClipboardItem[] => {
  const mockItems: ClipboardItem[] = [
    {
      id: '1',
      content: 'https://github.com/clipvault/clipvault',
      category: 'link',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      isFavorite: true,
      tags: ['github', 'repository'],
    },
    {
      id: '2',
      content: 'ClipVault is a revolutionary clipboard manager that changes how you interact with your clipboard history. With advanced categorization, smart content detection, and a beautiful interface, it\'s like having a memory companion that never forgets.',
      category: 'text',
      timestamp: new Date(Date.now() - 1000 * 60 * 15),
      size: 256,
      isFavorite: false,
      tags: ['description', 'app'],
    },
    {
      id: '3',
      content: 'Screenshot_2024_01_15.png',
      category: 'image',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
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
      timestamp: new Date(Date.now() - 1000 * 60 * 45),
      isFavorite: false,
      tags: ['documents', 'project'],
    },
    {
      id: '5',
      content: 'npm install @clipvault/core --save',
      category: 'text',
      timestamp: new Date(Date.now() - 1000 * 60 * 60),
      isFavorite: false,
      tags: ['command', 'npm'],
    },
    {
      id: '6',
      content: 'presentation.pdf',
      category: 'file',
      timestamp: new Date(Date.now() - 1000 * 60 * 90),
      size: 1024 * 1024 * 2.5,
      filename: 'presentation.pdf',
      isFavorite: true,
      tags: ['presentation', 'work', 'important'],
    },
    {
      id: '7',
      content: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      category: 'link',
      timestamp: new Date(Date.now() - 1000 * 60 * 120),
      isFavorite: false,
      tags: ['video', 'youtube'],
    },
    {
      id: '8',
      content: 'wallpaper_4k.jpg',
      category: 'image',
      timestamp: new Date(Date.now() - 1000 * 60 * 180),
      size: 1024 * 1024 * 3.2,
      filename: 'wallpaper_4k.jpg',
      thumbnailUrl: 'https://images.pexels.com/photos/956999/milky-way-starry-sky-night-sky-star-956999.jpeg?auto=compress&cs=tinysrgb&w=400',
      isFavorite: false,
      tags: ['wallpaper', 'space'],
    },
  ];

  return mockItems;
};

const detectCategory = (content: string): ClipboardCategory => {
  // URL detection
  const urlRegex = /^https?:\/\/.+/i;
  if (urlRegex.test(content)) {
    return 'link';
  }

  // File path detection
  if (content.includes('/') && (content.includes('.') || content.endsWith('/'))) {
    if (content.endsWith('/')) {
      return 'folder';
    }
    
    const extension = content.split('.').pop()?.toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
    
    if (extension && imageExtensions.includes(extension)) {
      return 'image';
    }
    
    return 'file';
  }

  // Long text (default category)
  return 'text';
};

export const useClipboard = () => {
  const [clipboardItems, setClipboardItems] = useState<ClipboardItem[]>([]);

  useEffect(() => {
    // Initialize with mock data
    setClipboardItems(generateMockData());
  }, []);

  const addItem = (content: string) => {
    const newItem: ClipboardItem = {
      id: Date.now().toString(),
      content,
      category: detectCategory(content),
      timestamp: new Date(),
      size: content.length,
      isFavorite: false,
      tags: [],
    };

    setClipboardItems(prev => [newItem, ...prev]);
  };

  const toggleFavorite = (id: string) => {
    setClipboardItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
      )
    );
  };

  const addTag = (id: string, tag: string) => {
    setClipboardItems(prev =>
      prev.map(item =>
        item.id === id && !item.tags.includes(tag)
          ? { ...item, tags: [...item.tags, tag] }
          : item
      )
    );
  };

  const removeTag = (id: string, tag: string) => {
    setClipboardItems(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, tags: item.tags.filter(t => t !== tag) }
          : item
      )
    );
  };

  const deleteItem = (id: string) => {
    setClipboardItems(prev => prev.filter(item => item.id !== id));
  };

  return {
    clipboardItems,
    addItem,
    toggleFavorite,
    addTag,
    removeTag,
    deleteItem,
  };
};
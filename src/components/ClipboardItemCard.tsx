import React, { useState } from 'react';
import { Star, Tag, Trash2, Copy, Eye, FileText, Link, Image, File, Folder } from 'lucide-react';
import { ClipboardItem, Theme, AccentColor } from '../types';

interface ClipboardItemCardProps {
  item: ClipboardItem;
  onToggleFavorite: (id: string) => void;
  onAddTag: (id: string, tag: string) => void;
  onRemoveTag: (id: string, tag: string) => void;
  onDeleteItem: (id: string) => void;
  onCopy: () => void;
  onView: () => void;
  theme: Theme;
  accentColor: AccentColor;
}

const ClipboardItemCard: React.FC<ClipboardItemCardProps> = ({
  item,
  onToggleFavorite,
  onAddTag,
  onRemoveTag,
  onDeleteItem,
  onCopy,
  onView,
  theme,
  accentColor
}) => {
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState('');

  const getCategoryIcon = () => {
    switch (item.category) {
      case 'text': return FileText;
      case 'link': return Link;
      case 'image': return Image;
      case 'file': return File;
      case 'folder': return Folder;
      default: return FileText;
    }
  };

  const CategoryIcon = getCategoryIcon();

  const handleAddTag = () => {
    if (newTag.trim()) {
      onAddTag(item.id, newTag.trim());
      setNewTag('');
      setShowTagInput(false);
    }
  };

  const formatContent = (content: string) => {
    if (content.length > 150) {
      return content.substring(0, 150) + '...';
    }
    return content;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={`group relative rounded-xl backdrop-blur-sm border transition-all duration-300 hover:scale-105 hover:shadow-xl ${
      theme === 'dark' 
        ? 'bg-gray-800/30 border-gray-600 hover:bg-gray-800/50' 
        : 'bg-white/30 border-gray-300 hover:bg-white/50'
    }`}
    style={{ 
      boxShadow: `0 4px 20px ${accentColor}10`,
      borderColor: item.isFavorite ? accentColor : undefined
    }}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <CategoryIcon 
              className="w-5 h-5" 
              style={{ color: accentColor }}
            />
            <span className={`text-sm font-medium capitalize ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              {item.category}
            </span>
          </div>
          
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(item.id);
              }}
              className={`p-1 rounded transition-all duration-300 ${
                item.isFavorite
                  ? 'text-yellow-500 hover:text-yellow-400'
                  : theme === 'dark' ? 'text-gray-400 hover:text-yellow-500' : 'text-gray-500 hover:text-yellow-500'
              }`}
            >
              <Star className={`w-4 h-4 ${item.isFavorite ? 'fill-current' : ''}`} />
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopy();
              }}
              className={`p-1 rounded transition-all duration-300 ${
                theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Copy className="w-4 h-4" />
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onView();
              }}
              className={`p-1 rounded transition-all duration-300 ${
                theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Eye className="w-4 h-4" />
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteItem(item.id);
              }}
              className="p-1 rounded transition-all duration-300 text-red-500 hover:text-red-400"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className={`text-xs ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        }`}>
          {new Date(item.timestamp).toLocaleString()}
          {item.size && ` • ${formatSize(item.size)}`}
        </p>
      </div>

      {/* Content */}
      <div className="p-4">
        {item.category === 'image' && item.thumbnailUrl ? (
          <div className="mb-3">
            <img 
              src={item.thumbnailUrl} 
              alt="Thumbnail" 
              className="w-full h-32 object-cover rounded-lg"
            />
          </div>
        ) : null}

        <p className={`text-sm leading-relaxed [overflow-wrap:anywhere] ${
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}>
          {formatContent(item.content)}
        </p>

        {/* Tags */}
        <div className="mt-3 flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <span
              key={tag}
              onClick={(e) => {
                e.stopPropagation();
                onRemoveTag(item.id, tag);
              }}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs cursor-pointer transition-all duration-300 hover:scale-105"
              style={{ 
                backgroundColor: `${accentColor}20`,
                color: accentColor
              }}
            >
              {tag}
              <span className="ml-1 opacity-60">×</span>
            </span>
          ))}
          
          {showTagInput ? (
            <div className="flex items-center space-x-1">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                onBlur={handleAddTag}
                className={`px-2 py-1 text-xs rounded border ${
                  theme === 'dark' 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="Add tag..."
                autoFocus
              />
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTagInput(true);
              }}
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs transition-all duration-300 hover:scale-105 ${
                theme === 'dark' 
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              <Tag className="w-3 h-3 mr-1" />
              Tag
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClipboardItemCard;
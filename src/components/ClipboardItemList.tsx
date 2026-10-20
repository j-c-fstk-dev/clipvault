import React, { useState } from 'react';
import { Star, Tag, Trash2, Copy, Eye, FileText, Link, Image, File, Folder } from 'lucide-react';
import { ClipboardItem, Theme, AccentColor } from '../types';

interface ClipboardItemListProps {
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

const ClipboardItemList: React.FC<ClipboardItemListProps> = ({
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
    if (content.length > 200) {
      return content.substring(0, 200) + '...';
    }
    return content;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={`group flex items-center space-x-4 p-4 rounded-xl backdrop-blur-sm border transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${
      theme === 'dark' 
        ? 'bg-gray-800/30 border-gray-600 hover:bg-gray-800/50' 
        : 'bg-white/30 border-gray-300 hover:bg-white/50'
    }`}
    style={{ 
      boxShadow: `0 2px 10px ${accentColor}10`,
      borderColor: item.isFavorite ? accentColor : undefined
    }}>
      {/* Thumbnail/Icon */}
      <div className="flex-shrink-0">
        {item.category === 'image' && item.thumbnailUrl ? (
          <img 
            src={item.thumbnailUrl} 
            alt="Thumbnail" 
            className="w-16 h-16 object-cover rounded-lg"
          />
        ) : (
          <div 
            className="w-16 h-16 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <CategoryIcon 
              className="w-8 h-8" 
              style={{ color: accentColor }}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <span className={`text-sm font-medium capitalize ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            {item.category}
          </span>
          <span className={`text-xs ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`}>
            {new Date(item.timestamp).toLocaleString()}
            {item.size && ` • ${formatSize(item.size)}`}
          </span>
        </div>

        <p className={`text-sm leading-relaxed [overflow-wrap:anywhere] mb-2 ${
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}>
          {formatContent(item.content)}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
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

      {/* Actions */}
      <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(item.id);
          }}
          className={`p-2 rounded-lg transition-all duration-300 ${
            item.isFavorite
              ? 'text-yellow-500 hover:text-yellow-400'
              : theme === 'dark' ? 'text-gray-400 hover:text-yellow-500' : 'text-gray-500 hover:text-yellow-500'
          }`}
        >
          <Star className={`w-5 h-5 ${item.isFavorite ? 'fill-current' : ''}`} />
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopy();
          }}
          className={`p-2 rounded-lg transition-all duration-300 ${
            theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Copy className="w-5 h-5" />
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onView();
          }}
          className={`p-2 rounded-lg transition-all duration-300 ${
            theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Eye className="w-5 h-5" />
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteItem(item.id);
          }}
          className="p-2 rounded-lg transition-all duration-300 text-red-500 hover:text-red-400"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default ClipboardItemList;
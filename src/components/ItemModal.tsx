import React, { useState } from 'react';
import { X, Star, Tag, Trash2, Copy, FileText, Link, Image, File, Folder } from 'lucide-react';
import { ClipboardItem, Theme, AccentColor } from '../types';

interface ItemModalProps {
  item: ClipboardItem;
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
  onAddTag: (id: string, tag: string) => void;
  onRemoveTag: (id: string, tag: string) => void;
  onDeleteItem: (id: string) => void;
  onCopy: () => void;
  theme: Theme;
  accentColor: AccentColor;
}

const ItemModal: React.FC<ItemModalProps> = ({
  item,
  onClose,
  onToggleFavorite,
  onAddTag,
  onRemoveTag,
  onDeleteItem,
  onCopy,
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

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`max-w-4xl w-full max-h-[90vh] rounded-2xl backdrop-blur-lg border overflow-hidden ${
        theme === 'dark' 
          ? 'bg-gray-900/90 border-gray-700' 
          : 'bg-white/90 border-gray-300'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center space-x-3">
            <CategoryIcon 
              className="w-6 h-6" 
              style={{ color: accentColor }}
            />
            <div>
              <h2 className={`text-xl font-semibold capitalize ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {item.category} Item
              </h2>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {new Date(item.timestamp).toLocaleString()}
                {item.size && ` • ${formatSize(item.size)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onToggleFavorite(item.id)}
              className={`p-2 rounded-lg transition-all duration-300 ${
                item.isFavorite
                  ? 'text-yellow-500 hover:text-yellow-400'
                  : theme === 'dark' ? 'text-gray-400 hover:text-yellow-500' : 'text-gray-500 hover:text-yellow-500'
              }`}
            >
              <Star className={`w-5 h-5 ${item.isFavorite ? 'fill-current' : ''}`} />
            </button>
            
            <button
              onClick={onCopy}
              className={`p-2 rounded-lg transition-all duration-300 ${
                theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Copy className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => {
                onDeleteItem(item.id);
                onClose();
              }}
              className="p-2 rounded-lg transition-all duration-300 text-red-500 hover:text-red-400"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-all duration-300 ${
                theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-auto max-h-[60vh]">
          {item.category === 'image' && item.thumbnailUrl ? (
            <div className="mb-6">
              <img 
                src={item.thumbnailUrl} 
                alt="Full size preview" 
                className="max-w-full h-auto rounded-lg shadow-lg"
              />
            </div>
          ) : null}

          <div className={`p-4 rounded-lg border ${
            theme === 'dark' 
              ? 'bg-gray-800/50 border-gray-600' 
              : 'bg-gray-50/50 border-gray-200'
          }`}>
            <pre className={`text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere] font-mono ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              {item.content}
            </pre>
          </div>
        </div>

        {/* Tags Section */}
        <div className={`p-6 border-t ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <h3 className={`text-lg font-semibold mb-3 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Tags
          </h3>
          
          <div className="flex flex-wrap gap-2">
            {item.tags.map((tag) => (
              <span
                key={tag}
                onClick={() => onRemoveTag(item.id, tag)}
                className="inline-flex items-center px-3 py-2 rounded-full text-sm cursor-pointer transition-all duration-300 hover:scale-105"
                style={{ 
                  backgroundColor: `${accentColor}20`,
                  color: accentColor
                }}
              >
                {tag}
                <span className="ml-2 opacity-60">×</span>
              </span>
            ))}
            
            {showTagInput ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                  className={`px-3 py-2 text-sm rounded-lg border ${
                    theme === 'dark' 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Add a new tag..."
                  autoFocus
                />
                <button
                  onClick={handleAddTag}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all duration-300 hover:scale-105"
                  style={{ backgroundColor: accentColor }}
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowTagInput(false);
                    setNewTag('');
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    theme === 'dark' 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowTagInput(true)}
                className={`inline-flex items-center px-3 py-2 rounded-full text-sm transition-all duration-300 hover:scale-105 ${
                  theme === 'dark' 
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                <Tag className="w-4 h-4 mr-2" />
                Add Tag
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemModal;
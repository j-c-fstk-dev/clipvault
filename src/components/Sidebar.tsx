import React from 'react';
import { ClipboardList, FileText, Link, Image, File, Folder } from 'lucide-react';
import { ClipboardCategory, Theme, AccentColor } from '../types';

interface SidebarProps {
  activeCategory: ClipboardCategory;
  onCategoryChange: (category: ClipboardCategory) => void;
  getCategoryIcon: (category: ClipboardCategory) => React.ComponentType;
  getCategoryCount: (category: ClipboardCategory) => number;
  theme: Theme;
  accentColor: AccentColor;
}

const categories: { id: ClipboardCategory; label: string; icon: React.ComponentType }[] = [
  { id: 'all', label: 'All Items', icon: ClipboardList },
  { id: 'text', label: 'Text', icon: FileText },
  { id: 'link', label: 'Links', icon: Link },
  { id: 'image', label: 'Images', icon: Image },
  { id: 'file', label: 'Files', icon: File },
  { id: 'folder', label: 'Folders', icon: Folder },
];

const Sidebar: React.FC<SidebarProps> = ({
  activeCategory,
  onCategoryChange,
  getCategoryCount,
  theme,
  accentColor
}) => {
  return (
    <aside className={`w-64 backdrop-blur-lg border-r transition-all duration-300 ${
      theme === 'dark' 
        ? 'bg-gray-900/50 border-gray-700' 
        : 'bg-white/50 border-gray-200'
    }`}>
      <div className="p-4">
        <h2 className={`text-lg font-semibold mb-4 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          Categories
        </h2>
        
        <nav className="space-y-2">
          {categories.map((category) => {
            const Icon = category.icon;
            const count = getCategoryCount(category.id);
            const isActive = activeCategory === category.id;
            
            return (
              <button
                key={category.id}
                onClick={() => onCategoryChange(category.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-300 group ${
                  isActive
                    ? 'text-white shadow-lg transform scale-105'
                    : theme === 'dark'
                    ? 'text-gray-300 hover:text-white hover:bg-gray-800/50'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/50'
                }`}
                style={{ 
                  backgroundColor: isActive ? accentColor : 'transparent',
                  boxShadow: isActive ? `0 4px 20px ${accentColor}40` : 'none'
                }}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-5 h-5 transition-all duration-300 ${
                    isActive ? 'scale-110' : 'group-hover:scale-105'
                  }`} />
                  <span className="font-medium">{category.label}</span>
                </div>
                
                <span className={`text-xs px-2 py-1 rounded-full transition-all duration-300 ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : theme === 'dark'
                    ? 'bg-gray-700 text-gray-300'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
        
        {/* Mascot Section */}
        <div className={`mt-8 p-4 rounded-xl backdrop-blur-sm border transition-all duration-300 ${
          theme === 'dark' 
            ? 'bg-gray-800/30 border-gray-600' 
            : 'bg-white/30 border-gray-300'
        }`}>
          <div className="text-center">
            <div 
              className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center text-2xl shadow-lg"
              style={{ backgroundColor: accentColor }}
            >
              🧠
            </div>
            <h3 className={`font-semibold mb-1 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Vaulter
            </h3>
            <p className={`text-xs ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Your memory keeper is watching over {getCategoryCount('all')} items
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
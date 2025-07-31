import React from 'react';
import { Search, Grid3X3, List, Star, Settings, Clipboard } from 'lucide-react';
import { ViewMode, SortOption, Theme, AccentColor } from '../types';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  showFavoritesOnly: boolean;
  onShowFavoritesChange: (show: boolean) => void;
  onSettingsClick: () => void;
  theme: Theme;
  accentColor: AccentColor;
}

const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  showFavoritesOnly,
  onShowFavoritesChange,
  onSettingsClick,
  theme,
  accentColor
}) => {
  return (
    <header className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-lg border-b transition-all duration-300 ${
      theme === 'dark' 
        ? 'bg-gray-900/80 border-gray-700' 
        : 'bg-white/80 border-gray-200'
    }`}>
      <div className="flex items-center justify-between px-6 py-3">
        {/* Logo and Title */}
        <div className="flex items-center space-x-3">
          <div 
            className="p-2 rounded-xl shadow-lg transition-all duration-300 hover:scale-105"
            style={{ backgroundColor: accentColor }}
          >
            <Clipboard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className={`text-xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              ClipVault
            </h1>
            <p className={`text-xs ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              Your Memory Companion
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md mx-8">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`} />
            <input
              type="text"
              placeholder="Search clipboard history..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-2 ${
                theme === 'dark'
                  ? 'bg-gray-800/50 border-gray-600 text-white placeholder-gray-400 focus:border-gray-500'
                  : 'bg-white/50 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-gray-400'
              }`}
              style={{ 
                focusRingColor: `${accentColor}40`,
                borderColor: searchQuery ? accentColor : undefined
              }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2">
          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className={`px-3 py-2 rounded-lg border backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-2 ${
              theme === 'dark'
                ? 'bg-gray-800/50 border-gray-600 text-white'
                : 'bg-white/50 border-gray-300 text-gray-900'
            }`}
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
          </select>

          {/* View Mode Toggle */}
          <div className={`flex rounded-lg border overflow-hidden ${
            theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
          }`}>
            <button
              onClick={() => onViewModeChange('grid')}
              className={`p-2 transition-all duration-300 ${
                viewMode === 'grid'
                  ? 'text-white'
                  : theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              style={{ backgroundColor: viewMode === 'grid' ? accentColor : 'transparent' }}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`p-2 transition-all duration-300 ${
                viewMode === 'list'
                  ? 'text-white'
                  : theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              style={{ backgroundColor: viewMode === 'list' ? accentColor : 'transparent' }}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Favorites Filter */}
          <button
            onClick={() => onShowFavoritesChange(!showFavoritesOnly)}
            className={`p-2 rounded-lg transition-all duration-300 ${
              showFavoritesOnly
                ? 'text-white'
                : theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            style={{ backgroundColor: showFavoritesOnly ? accentColor : 'transparent' }}
          >
            <Star className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
          </button>

          {/* Settings Button */}
          <button
            onClick={onSettingsClick}
            className={`p-2 rounded-lg transition-all duration-300 ${
              theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
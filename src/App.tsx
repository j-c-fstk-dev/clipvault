import { useState } from 'react';
import { ClipboardList, Image, FileText, Link, Folder, File } from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ClipboardView from './components/ClipboardView';
import SettingsPanel from './components/SettingsPanel';
import { ViewMode, SortOption, ClipboardCategory } from './types';
import { useClipboard } from './hooks/useClipboard';
import { useSettings } from './hooks/useSettings';
import { useTheme } from './hooks/useTheme';

function App() {
  const { clipboardItems, toggleFavorite, addTag, removeTag, deleteItem } = useClipboard();
  const { settings, updateSettings } = useSettings();
  const { theme, accentColor, setTheme, setAccentColor } = useTheme();

  const [activeCategory, setActiveCategory] = useState<ClipboardCategory | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Filter and sort items
  const filteredItems = clipboardItems
    .filter(item => {
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      const matchesSearch = item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesFavorites = !showFavoritesOnly || item.isFavorite;

      return matchesCategory && matchesSearch && matchesFavorites;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date-asc':
          return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        case 'date-desc':
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        case 'name-asc':
          return a.content.localeCompare(b.content);
        case 'name-desc':
          return b.content.localeCompare(a.content);
        default:
          return 0;
      }
    });

    const getCategoryIcon = (category: ClipboardCategory | 'all') => {
      switch (category) {
        case 'text': return FileText;
        case 'link': return Link;
        case 'image': return Image;
        case 'file': return File;
        case 'folder': return Folder;
        default: return ClipboardList;
      }
    };

    const getCategoryCount = (category: ClipboardCategory | 'all') => {
      if (category === 'all') return clipboardItems.length;
      return clipboardItems.filter(item => item.category === category).length;
    };

    return (
      <div className={`min-h-screen transition-all duration-300 ${
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      }`}
           style={{
             background: theme === 'dark'
               ? `linear-gradient(135deg, rgba(17, 24, 39, 0.95) 0%, rgba(55, 65, 81, 0.95) 100%)`
               : `linear-gradient(135deg, rgba(249, 250, 251, 0.95) 0%, rgba(243, 244, 246, 0.95) 100%)`
           }}>
        {/* Background Pattern */}
        <div className="fixed inset-0 opacity-30 pointer-events-none">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, ${accentColor}20 0%, transparent 50%), radial-gradient(circle at 75% 75%, ${accentColor}20 0%, transparent 50%)`,
          }} />
        </div>

        <div className="relative z-10">
          <Header
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            sortBy={sortBy}
            onSortChange={setSortBy}
            showFavoritesOnly={showFavoritesOnly}
            onShowFavoritesChange={setShowFavoritesOnly}
            onSettingsClick={() => setShowSettings(true)}
            theme={theme}
            accentColor={accentColor}
          />

          <div className="flex h-screen pt-16">
            <Sidebar
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              getCategoryIcon={getCategoryIcon}
              getCategoryCount={getCategoryCount}
              theme={theme}
              accentColor={accentColor}
            />

            <main className="flex-1 overflow-hidden">
              <ClipboardView
                items={filteredItems}
                viewMode={viewMode}
                onToggleFavorite={toggleFavorite}
                onAddTag={addTag}
                onRemoveTag={removeTag}
                onDeleteItem={deleteItem}
                theme={theme}
                accentColor={accentColor}
              />
            </main>
          </div>

          {showSettings && (
            <SettingsPanel
              settings={settings}
              onUpdateSettings={updateSettings}
              theme={theme}
              accentColor={accentColor}
              onThemeChange={setTheme}
              onAccentColorChange={setAccentColor}
              onClose={() => setShowSettings(false)}
            />
          )}
        </div>
      </div>
    );
  }

  export default App;
import { useEffect, useState } from 'react';
import { ClipboardList, Image, FileText, Link, Folder, File } from 'lucide-react';
import Header, { SEARCH_INPUT_ID } from './components/Header';
import Sidebar from './components/Sidebar';
import ClipboardView from './components/ClipboardView';
import SettingsPanel from './components/SettingsPanel';
import { ViewMode, SortOption, ClipboardCategory, CaptureStatus } from './types';
import * as backend from './lib/backend';
import { useClipboard } from './hooks/useClipboard';
import { useSettings } from './hooks/useSettings';
import { useTheme } from './hooks/useTheme';

function App() {
  const { settings, updateSettings, saveError } = useSettings();
  const { theme, accentColor, setTheme, setAccentColor } = useTheme();

  const [activeCategory, setActiveCategory] = useState<ClipboardCategory | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus | null>(null);
  const [focusToken, setFocusToken] = useState(0);

  const clipboard = useClipboard({
    search: searchQuery,
    category: activeCategory,
    favoritesOnly: showFavoritesOnly,
    sort: sortBy,
  });

  useEffect(() => {
    if (!backend.hasBackend) return;
    backend
      .getCaptureStatus()
      .then(setCaptureStatus)
      .catch(error => console.error('Failed to read capture status:', error));
  }, []);

  // Brought up from the tray or the global shortcut: ready to search.
  useEffect(() => {
    if (!backend.hasBackend) return;
    const unlisten = backend.onWindowShown(() => {
      document.getElementById(SEARCH_INPUT_ID)?.focus();
      setFocusToken(token => token + 1);
    });
    return () => {
      unlisten.then(stop => stop());
    };
  }, []);

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

    const getCategoryCount = (category: ClipboardCategory | 'all') => clipboard.counts[category];

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
            captureEnabled={settings.captureEnabled}
            captureStatus={captureStatus}
            onToggleCapture={() => updateSettings({ captureEnabled: !settings.captureEnabled })}
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
                items={clipboard.items}
                hasMore={clipboard.hasMore}
                onLoadMore={clipboard.loadMore}
                isFiltered={searchQuery !== '' || showFavoritesOnly || activeCategory !== 'all'}
                viewMode={viewMode}
                onToggleFavorite={clipboard.toggleFavorite}
                onAddTag={clipboard.addTag}
                onRemoveTag={clipboard.removeTag}
                onDeleteItem={clipboard.deleteItem}
                onCopyItem={clipboard.copyItem}
                shortcuts={settings.shortcuts}
                hideAfterKeyboardCopy={settings.minimizeToTray}
                keyboardEnabled={!showSettings}
                focusToken={focusToken}
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
              saveError={saveError}
            />
          )}
        </div>
      </div>
    );
  }

  export default App;
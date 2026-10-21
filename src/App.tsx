import { useEffect, useMemo, useState } from 'react';
import Header, { SEARCH_INPUT_ID } from './components/Header';
import Sidebar from './components/Sidebar';
import ClipboardView from './components/ClipboardView';
import SettingsPanel from './components/SettingsPanel';
import { ViewMode, SortOption, CaptureStatus } from './types';
import * as backend from './lib/backend';
import { CategoryFilter } from './lib/categories';
import { I18nContext, resolveI18n } from './i18n';
import { useClipboard } from './hooks/useClipboard';
import { useSettings } from './hooks/useSettings';
import { useTheme } from './hooks/useTheme';

function App() {
  const { settings, updateSettings, saveError } = useSettings();
  const { theme, accentColor, setTheme, setAccentColor } = useTheme();

  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const [systemLanguage, setSystemLanguage] = useState<'en' | 'pt'>();
  const i18n = useMemo(() => resolveI18n(settings.language, systemLanguage), [settings.language, systemLanguage]);
  const { t } = i18n;

  useEffect(() => {
    document.documentElement.lang = i18n.locale;
  }, [i18n.locale]);

  const clipboard = useClipboard({
    search: searchQuery,
    category: activeCategory,
    favoritesOnly: showFavoritesOnly,
    sort: sortBy,
  });

  useEffect(() => {
    if (!backend.hasBackend) return;
    backend
      .systemLanguage()
      .then(setSystemLanguage)
      .catch(error => console.error('Failed to read the system language:', error));
  }, []);

  // Read again whenever the window comes back, e.g. from System Settings
  // after allowing clipboard access on macOS.
  useEffect(() => {
    if (!backend.hasBackend) return;
    const refresh = () =>
      backend
        .getCaptureStatus()
        .then(setCaptureStatus)
        .catch(error => console.error('Failed to read capture status:', error));
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
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

  return (
    <I18nContext.Provider value={i18n}>
    <div className="backdrop h-full flex overflow-hidden">
      <Sidebar
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        counts={clipboard.counts}
        captureEnabled={settings.captureEnabled}
        captureStatus={captureStatus}
        onToggleCapture={() => updateSettings({ captureEnabled: !settings.captureEnabled })}
        onOpenAccessSettings={() =>
          backend
            .openClipboardSettings()
            .catch(error => console.error('Failed to open System Settings:', error))
        }
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <Header
          title={showFavoritesOnly ? t.favoritesTitle[activeCategory] : t.categories[activeCategory]}
          count={clipboard.counts[activeCategory]}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          sortBy={sortBy}
          onSortChange={setSortBy}
          showFavoritesOnly={showFavoritesOnly}
          onShowFavoritesChange={setShowFavoritesOnly}
          onSettingsClick={() => setShowSettings(true)}
        />

        <main className="flex-1 min-h-0">
          <ClipboardView
            items={clipboard.items}
            hasMore={clipboard.hasMore}
            onLoadMore={clipboard.loadMore}
            isFiltered={searchQuery !== '' || showFavoritesOnly || activeCategory !== 'all'}
            viewMode={viewMode}
            groupByDay={sortBy.startsWith('date')}
            onToggleFavorite={clipboard.toggleFavorite}
            onAddTag={clipboard.addTag}
            onRemoveTag={clipboard.removeTag}
            onDeleteItem={clipboard.deleteItem}
            onCopyItem={clipboard.copyItem}
            shortcuts={settings.shortcuts}
            hideAfterKeyboardCopy={settings.minimizeToTray}
            keyboardEnabled={!showSettings}
            focusToken={focusToken}
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
    </I18nContext.Provider>
  );
}

export default App;

import React from 'react';
import { ChevronDown, LayoutGrid, List, Search, Settings, Star } from 'lucide-react';
import { SortOption, ViewMode } from '../types';
import { IconButton, Segmented } from './ui';

/** Focused when the window is brought up, so typing searches right away. */
export const SEARCH_INPUT_ID = 'clipvault-search';

interface HeaderProps {
  title: string;
  count: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  showFavoritesOnly: boolean;
  onShowFavoritesChange: (show: boolean) => void;
  onSettingsClick: () => void;
}

/** Toolbar above the history: what is shown, search, sorting and view. */
const Header: React.FC<HeaderProps> = ({
  title,
  count,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  showFavoritesOnly,
  onShowFavoritesChange,
  onSettingsClick,
}) => (
  <header className="h-16 shrink-0 flex items-center gap-3 pl-6 pr-4">
    <h1 className="min-w-0 flex items-baseline gap-2 mr-auto">
      <span className="text-title font-semibold tracking-[-0.015em] truncate">
        {showFavoritesOnly ? `Favorite ${title.toLowerCase()}` : title}
      </span>
      <span className="text-small text-faint tabular-nums">{count}</span>
    </h1>

    <label className="pill relative flex items-center w-64 h-[34px] rounded-[10px] focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)] transition-shadow">
      <Search aria-hidden className="absolute left-2.5 w-4 h-4 text-faint" />
      <input
        id={SEARCH_INPUT_ID}
        type="search"
        placeholder="Search history"
        aria-label="Search history"
        value={searchQuery}
        onChange={e => onSearchChange(e.target.value)}
        className="w-full h-full pl-8 pr-3 bg-transparent text-body placeholder:text-faint outline-none"
      />
    </label>

    <div className="relative">
      <select
        value={sortBy}
        onChange={e => onSortChange(e.target.value as SortOption)}
        aria-label="Sort order"
        className="pill appearance-none h-[34px] pl-3 pr-8 rounded-[10px] text-small font-medium text-ink cursor-pointer outline-none focus-visible:border-accent"
      >
        <option value="date-desc">Newest first</option>
        <option value="date-asc">Oldest first</option>
        <option value="name-asc">Name A–Z</option>
        <option value="name-desc">Name Z–A</option>
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
    </div>

    <Segmented
      label="View"
      iconOnly
      value={viewMode}
      onChange={onViewModeChange}
      options={[
        { value: 'grid', label: 'Grid', icon: LayoutGrid },
        { value: 'list', label: 'List', icon: List },
      ]}
    />

    <div className="flex items-center">
      <IconButton
        label={showFavoritesOnly ? 'Show all items' : 'Show favorites only'}
        icon={Star}
        active={showFavoritesOnly}
        onClick={() => onShowFavoritesChange(!showFavoritesOnly)}
      />
      <IconButton label="Settings" icon={Settings} onClick={onSettingsClick} />
    </div>
  </header>
);

export default Header;

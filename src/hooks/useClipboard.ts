import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CategoryCounts, ClipboardCategory, ClipboardItem, SortOption } from '../types';
import * as backend from '../lib/backend';

const PAGE_SIZE = 60;
const SEARCH_DEBOUNCE_MS = 150;
const EMPTY_COUNTS: CategoryCounts = { all: 0, text: 0, link: 0, image: 0, file: 0, folder: 0 };

export interface ClipboardFilters {
  search: string;
  category: ClipboardCategory | 'all';
  favoritesOnly: boolean;
  sort: SortOption;
}

/** Clipboard history from the backend, filtered, sorted and paged there. */
export const useClipboard = ({ search, category, favoritesOnly, sort }: ClipboardFilters) => {
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<CategoryCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  // Responses to superseded requests are ignored.
  const requestId = useRef(0);
  // Rows currently shown, kept on live reloads so the scroll position holds.
  const shown = useRef(PAGE_SIZE);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const baseQuery = useMemo(
    () => ({
      search: debouncedSearch,
      category: category === 'all' ? null : category,
      favoritesOnly,
      sort,
    }),
    [debouncedSearch, category, favoritesOnly, sort]
  );

  /** Loads the first `count` matching rows and the category counts. */
  const reload = useCallback(
    async (count: number) => {
      if (!backend.hasBackend) return;
      const id = ++requestId.current;
      setLoading(true);
      try {
        const [page, newCounts] = await Promise.all([
          backend.queryItems({ ...baseQuery, limit: count, offset: 0 }),
          backend.getCounts(),
        ]);
        if (id !== requestId.current) return;
        shown.current = count;
        setItems(page.items);
        setTotal(page.total);
        setCounts(newCounts);
      } catch (error) {
        console.error('Failed to load clipboard history:', error);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [baseQuery]
  );

  // New filters start again from the first page.
  useEffect(() => {
    reload(PAGE_SIZE);
  }, [reload]);

  useEffect(() => {
    if (!backend.hasBackend) return;
    const unlisten = backend.onHistoryChanged(() => reload(shown.current));
    return () => {
      unlisten.then(stop => stop());
    };
  }, [reload]);

  const hasMore = items.length < total;

  const loadMore = useCallback(async () => {
    if (!backend.hasBackend || loading || !hasMore) return;
    const id = ++requestId.current;
    setLoading(true);
    try {
      const page = await backend.queryItems({
        ...baseQuery,
        limit: PAGE_SIZE,
        offset: items.length,
      });
      if (id !== requestId.current) return;
      // A capture between pages shifts offsets; drop rows already shown.
      const known = new Set(items.map(i => i.id));
      const merged = [...items, ...page.items.filter(i => !known.has(i.id))];
      shown.current = merged.length;
      setItems(merged);
      setTotal(page.total);
    } catch (error) {
      console.error('Failed to load more items:', error);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [baseQuery, hasMore, items, loading]);

  /** Runs a backend change, then refreshes what is shown. */
  const mutate = useCallback(
    async (change: () => Promise<unknown>) => {
      try {
        await change();
      } finally {
        await reload(shown.current);
      }
    },
    [reload]
  );

  const logFailure = (action: string) => (error: unknown) =>
    console.error(`Failed to ${action}:`, error);

  const toggleFavorite = (id: string) => {
    const item = items.find(i => i.id === id);
    if (item) {
      mutate(() => backend.setFavorite(id, !item.isFavorite)).catch(logFailure('update favorite'));
    }
  };

  const addTag = (id: string, tag: string) =>
    mutate(() => backend.addTag(id, tag)).catch(logFailure('add tag'));

  const removeTag = (id: string, tag: string) =>
    mutate(() => backend.removeTag(id, tag)).catch(logFailure('remove tag'));

  const deleteItem = (id: string) =>
    mutate(() => backend.deleteItem(id)).catch(logFailure('delete item'));

  /** Puts an item back on the clipboard; rejects with a readable message. */
  const copyItem = (id: string) => mutate(() => backend.copyItem(id));

  return {
    items,
    total,
    counts,
    loading,
    hasMore,
    loadMore,
    toggleFavorite,
    addTag,
    removeTag,
    deleteItem,
    copyItem,
  };
};

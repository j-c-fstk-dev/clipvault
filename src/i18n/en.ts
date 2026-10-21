/** English texts. `pt.ts` must provide the same keys (checked by its type). */

import type { CategoryFilter } from '../lib/categories';
import type { ExportStats, ImportStats } from '../types';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const formatBytes = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export const en = {
  categories: {
    all: 'All items',
    text: 'Text',
    link: 'Links',
    image: 'Images',
    file: 'Files',
    folder: 'Folders',
  } as Record<CategoryFilter, string>,
  singular: {
    all: 'Item',
    text: 'Text',
    link: 'Link',
    image: 'Image',
    file: 'File',
    folder: 'Folder',
  } as Record<CategoryFilter, string>,
  favoritesTitle: {
    all: 'Favorites',
    text: 'Favorite text',
    link: 'Favorite links',
    image: 'Favorite images',
    file: 'Favorite files',
    folder: 'Favorite folders',
  } as Record<CategoryFilter, string>,

  sidebar: {
    categories: 'Categories',
    unavailable: 'Capture unavailable',
    unavailableDetail: 'The clipboard could not be read',
    recording: 'Recording',
    waylandNote: 'Only X11 apps are recorded under Wayland',
    itemsSaved: (n: number) => plural(n, 'item saved', 'items saved'),
    paused: 'Paused',
    pausedDetail: 'New copies are not saved',
    pause: 'Pause recording',
    resume: 'Resume recording',
  },

  toolbar: {
    search: 'Search history',
    sort: 'Sort order',
    newest: 'Newest first',
    oldest: 'Oldest first',
    nameAsc: 'Name A–Z',
    nameDesc: 'Name Z–A',
    view: 'View',
    grid: 'Grid',
    list: 'List',
    showAll: 'Show all items',
    showFavorites: 'Show favorites only',
    settings: 'Settings',
  },

  time: {
    today: 'Today',
    yesterday: 'Yesterday',
    justNow: 'Just now',
    minutesAgo: (n: number) => `${n} min ago`,
  },

  history: {
    copied: 'Copied to clipboard',
    copyFailed: (error: string) => `Could not copy: ${error}`,
    openFailed: (error: string) => `Could not open: ${error}`,
    alwaysOpen: 'Files of this type will open with this app from now on',
    desktopRequired: 'Desktop app required',
    desktopRequiredHint: 'Run `npm run tauri dev` to see your clipboard history.',
    noMatches: 'Nothing matches',
    noMatchesHint: 'Try other words, another category, or turn off the favorites filter.',
    empty: 'Nothing copied yet',
    emptyHint: 'Copy text, a link, an image or files and it shows up here.',
    bringBack: 'Bring ClipVault back from anywhere with',
  },

  item: {
    favorite: 'Favorite',
    image: 'Image',
    imageSized: (size: string) => `Image, ${size}`,
    files: (n: number) => `${n} files`,
    preview: (kind: string) => `${kind} preview`,
    copy: 'Copy',
    addFavorite: 'Add to favorites',
    removeFavorite: 'Remove from favorites',
    addTag: 'Add tag',
    newTag: 'New tag',
    tagName: 'Tag name',
    removeTag: 'Remove tag',
    removeTagNamed: (tag: string) => `Remove tag ${tag}`,
    openPreview: 'Open preview',
    delete: 'Delete',
    close: 'Close',
  },

  files: {
    savedCopyOnly: 'Saved copy only',
    notFound: 'Not found',
    savedCopy: 'Saved copy',
    saving: 'Saving…',
    pathOnly: 'Path only',
    missing: 'Missing',
    open: (name: string) => `Open ${name}`,
    more: (n: number) => `${n} more`,
  },

  openWith: {
    title: 'Open with',
    label: (name: string) => `Open ${name} with`,
    noApps: 'No installed app opens this type of file. Install one, then try again.',
    apps: 'Apps',
    default: 'Default',
    justOnce: 'Just once',
    always: 'Always',
  },

  settings: {
    title: 'Settings',
    saveFailed: (error: string) => `Could not save settings: ${error}`,
    appearance: 'Appearance',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    accent: 'Accent color',
    accentNames: [
      'Deep purple',
      'Electric blue',
      'Emerald green',
      'Sunset orange',
      'Ruby red',
      'Hot pink',
      'Indigo',
      'Teal',
      'Amber',
      'Rose',
      'Cyan',
      'Violet',
    ],
    language: 'Language',
    languageHint: 'Also used by the tray menu and notifications.',
    languageAuto: 'Automatic',
    hardware: 'Hardware acceleration',
    hardwareHint:
      'Turn off if text or images look garbled or noisy, as on older integrated graphics. Applies after restarting ClipVault.',
    clipboard: 'Clipboard',
    record: 'Record clipboard',
    recordHint: 'Save everything you copy. Also in the sidebar.',
    keep: 'Items to keep',
    keepHint: 'Lowering this removes the oldest items. Favorites are always kept.',
    notify: 'Notify on new items',
    notifyHint: 'A desktop notification for each copy while ClipVault is hidden.',
    files: 'Files',
    snapshots: 'Save copies of files up to (MB)',
    snapshotsHint:
      'Copied files are saved in the vault in the background when the whole copy fits, so they can be pasted after being moved or deleted. 0 keeps only their paths.',
    alwaysApps: 'Apps chosen with "Always"',
    alwaysAppsNone: 'None yet. Opening a file lets you pick an app just once or always.',
    alwaysAppsSome: (types: string[]) => `Opened straight away: ${types.join(', ')}`,
    reset: 'Reset',
    startup: 'Startup',
    startOnLogin: 'Start on login',
    startOnLoginHint: 'Launch ClipVault hidden in the tray when you log in.',
    tray: 'Keep running in the tray',
    trayHint: 'Closing the window keeps recording. Quit from the tray menu.',
    backup: 'Backup',
    backupRow: 'History backup',
    backupHint:
      'A .zip with text, images, saved file copies, tags and favorites. Importing adds to the current history and replaces nothing.',
    export: 'Export…',
    import: 'Import…',
    exporting: 'Exporting…',
    importing: 'Importing…',
    exported: (s: ExportStats) =>
      `Saved ${plural(s.items, 'item', 'items')} and ${plural(s.files, 'file', 'files')} (${formatBytes(s.bytes)}).`,
    imported: (s: ImportStats, maxItems: number) => {
      let message = `Added ${plural(s.added, 'new item', 'new items')}`;
      if (s.merged) message += `; ${s.merged} already in your history (tags and favorites combined)`;
      message += '.';
      if (s.skipped) message += ` ${plural(s.skipped, 'damaged entry', 'damaged entries')} ignored.`;
      if (s.pruned) {
        message += ` ${plural(s.pruned, 'oldest item', 'oldest items')} removed to stay within the limit of ${maxItems}. Raise "Items to keep" first to keep everything.`;
      }
      return message;
    },
    shortcuts: 'Keyboard shortcuts',
    toggleApp: 'Show or hide ClipVault',
    toggleAppHint: 'Works from any app. Backspace turns it off.',
    copySelected: 'Copy selected item',
    copySelectedHint: 'Copies and hides ClipVault so you can paste. Arrow keys select.',
    deleteSelected: 'Delete selected item',
    pressKeys: 'Press a key combination…',
    disabled: 'Disabled',
  },
};

export type Messages = typeof en;

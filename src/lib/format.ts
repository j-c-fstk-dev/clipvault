/** Formatting for sizes and dates shown in the history. */

export const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "Today", "Yesterday", a weekday for the last week, then the date. */
export const dayLabel = (iso: string, now = new Date()) => {
  const date = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
};

/** Time of day, or "Just now" / "5 min ago" within the last hour. */
export const timeLabel = (iso: string, now = new Date()) => {
  const date = new Date(iso);
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

/** Date and time, for places without a day heading. */
export const dateTimeLabel = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Host of a URL without "www.", or `null` when it is not a URL. */
export const hostOf = (text: string) => {
  try {
    return new URL(text.trim()).hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
};

/** Formatting for sizes and dates shown in the history. */

import type { I18n } from '../i18n';

export const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "Today", "Yesterday", a weekday for the last week, then the date. */
export const dayLabel = (iso: string, { t, locale }: I18n, now = new Date()) => {
  const date = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return t.time.today;
  if (days === 1) return t.time.yesterday;
  if (days < 7) {
    const weekday = date.toLocaleDateString(locale, { weekday: 'long' });
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  }
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
};

/** Time of day, or "Just now" / "5 min ago" within the last hour. */
export const timeLabel = (iso: string, { t, locale }: I18n, now = new Date()) => {
  const date = new Date(iso);
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return t.time.justNow;
  if (minutes < 60) return t.time.minutesAgo(minutes);
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
};

/** Date and time, for places without a day heading. */
export const dateTimeLabel = (iso: string, locale: string) =>
  new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

/** Host of a URL without "www.", or `null` when it is not a URL. */
export const hostOf = (text: string) => {
  try {
    return new URL(text.trim()).hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
};

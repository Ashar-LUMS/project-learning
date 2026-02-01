/**
 * Timezone abbreviation to IANA timezone mapping
 */
export const TIMEZONE_MAP: Record<string, string> = {
  UTC: 'UTC',
  EST: 'America/New_York',
  PST: 'America/Los_Angeles',
  CET: 'Europe/Paris',
  PKT: 'Asia/Karachi',
};

/**
 * Get timezone settings from document attributes (set by AppLayout from admin settings)
 */
function getLocaleSettings(): { lang: string; timeZone: string } {
  if (typeof document === 'undefined') {
    return { lang: 'en', timeZone: 'UTC' };
  }
  const root = document.documentElement;
  const lang = root.getAttribute('lang') || 'en';
  const tzAttr = root.getAttribute('data-timezone') || 'UTC';
  const timeZone = TIMEZONE_MAP[tzAttr] || tzAttr;
  return { lang, timeZone };
}

/**
 * Format a date string with optional timezone support.
 * Uses document attributes for locale/timezone if available.
 * @param value - ISO date string or null/undefined
 * @param options - Optional Intl.DateTimeFormatOptions overrides
 */
export function formatDate(value?: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return 'Unknown';
  try {
    const { lang, timeZone } = getLocaleSettings();
    return new Intl.DateTimeFormat(lang, {
      dateStyle: 'medium',
      timeZone,
      ...options,
    }).format(new Date(value));
  } catch {
    // Fallback without timezone
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
    } catch {
      return String(value);
    }
  }
}

/**
 * Format a date with full details (year, month, day).
 */
export function formatDateLong(value?: string | null): string {
  if (!value) return 'Unknown';
  try {
    const { lang, timeZone } = getLocaleSettings();
    return new Date(value).toLocaleDateString(lang, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone,
    });
  } catch {
    return new Date(value).toLocaleDateString();
  }
}

/**
 * Format a timestamp with date and time.
 */
export function formatTimestamp(value?: string | null): string | null {
  if (!value) return null;
  try {
    const { lang, timeZone } = getLocaleSettings();
    return new Intl.DateTimeFormat(lang, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

/**
 * Format a relative time (e.g., "2 days ago", "Yesterday").
 */
export function formatRelativeTime(value?: string | null): string {
  if (!value) return 'Unknown';
  try {
    const date = new Date(value);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
    return `${Math.floor(diffInDays / 365)} years ago`;
  } catch {
    return 'Unknown';
  }
}

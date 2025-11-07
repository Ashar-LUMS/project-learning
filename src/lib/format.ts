export function formatDate(value?: string | null): string {
  if (!value) return 'Unknown';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
  } catch {
    return String(value);
  }
}

export function formatTimestamp(value?: string | null): string | null {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}

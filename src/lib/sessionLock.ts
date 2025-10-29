const LOCK_STATUS_KEY = "tison:isLocked";

const safeSessionStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.sessionStorage;
};

export const extractIsLocked = (user: { user_metadata?: Record<string, any> } | null | undefined): boolean | null => {
  if (!user) return null;
  const meta = user.user_metadata || {};
  const value = meta.isLocked ?? meta.is_locked;
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return null;
};

export const storeLockStatus = (locked: boolean) => {
  const storage = safeSessionStorage();
  if (!storage) return;
  storage.setItem(LOCK_STATUS_KEY, locked ? "1" : "0");
};

export const readStoredLockStatus = (): boolean | null => {
  const storage = safeSessionStorage();
  if (!storage) return null;
  const raw = storage.getItem(LOCK_STATUS_KEY);
  if (raw === null) return null;
  if (raw === "1") return true;
  if (raw === "0") return false;
  return null;
};

export const clearStoredLockStatus = () => {
  const storage = safeSessionStorage();
  if (!storage) return;
  storage.removeItem(LOCK_STATUS_KEY);
};

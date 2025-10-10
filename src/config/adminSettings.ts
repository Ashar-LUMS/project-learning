import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

// Shared application-wide settings persisted in the database.
// Keep this minimal and focused on cross-feature toggles.
export type AdminSettings = {
  policies: {
    inviteOnly: boolean;
    allowedDomains: string[]; // e.g. ['org.edu']
    defaultRoles: string[]; // e.g. ['User']
  };
  projects: {
    onlyAdminsCreate: boolean;
    autoAddCreator: boolean;
    autoRemoveDeletedAssignees: boolean;
    maxAssignees: number | null;
  };
  banner: {
    enabled: boolean;
    type: 'info' | 'success' | 'warn' | 'error';
    text: string;
  };
};

export const defaultAdminSettings: AdminSettings = {
  policies: {
    inviteOnly: false,
    allowedDomains: [],
    defaultRoles: ['User'],
  },
  projects: {
    onlyAdminsCreate: false,
    autoAddCreator: true,
    autoRemoveDeletedAssignees: true,
    maxAssignees: null,
  },
  banner: {
    enabled: false,
    type: 'info',
    text: '',
  },
};

export async function loadAdminSettings(): Promise<AdminSettings> {
  try {
    const { data } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'admin_settings')
      .single();
    if (data?.value) {
      const merged = { ...defaultAdminSettings, ...(data.value as AdminSettings) };
      if (typeof window !== 'undefined') localStorage.setItem('admin_settings', JSON.stringify(merged));
      return merged;
    }
  } catch {/* ignore */}
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('admin_settings');
      if (raw) return { ...defaultAdminSettings, ...(JSON.parse(raw) as AdminSettings) };
    }
  } catch {/* ignore */}
  return defaultAdminSettings;
}

export function useAdminSettings() {
  const [settings, setSettings] = useState<AdminSettings>(defaultAdminSettings);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const s = await loadAdminSettings();
      if (mounted) {
        setSettings(s);
        setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);
  return { settings, isLoading } as const;
}

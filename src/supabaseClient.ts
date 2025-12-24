import { createClient } from '@supabase/supabase-js';

// Get your Supabase URL and anon key from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars = [];
  if (!supabaseUrl) missingVars.push('VITE_SUPABASE_URL');
  if (!supabaseAnonKey) missingVars.push('VITE_SUPABASE_ANON_KEY');
  throw new Error(
    `Missing required environment variables: ${missingVars.join(', ')}. ` +
    'Please create a .env.local file with these values.'
  );
}

// Validate URL format
try {
  new URL(supabaseUrl);
} catch {
  throw new Error('VITE_SUPABASE_URL must be a valid URL');
}

// Configure Supabase client with sessionStorage instead of localStorage
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // In development disable automatic refresh/persistent sessions to avoid
    // CORS refresh-token requests while iterating locally. Production keeps
    // the defaults (auto refresh + persist session).
    autoRefreshToken: import.meta.env.DEV ? false : true,
    persistSession: import.meta.env.DEV ? false : true,
    detectSessionInUrl: import.meta.env.DEV ? false : true,
    flowType: 'pkce',
    storage: {
      getItem: (key: string) => {
        try {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            return sessionStorage.getItem(key);
          }
          return null;
        } catch {
          return null;
        }
      },
      setItem: (key: string, value: string) => {
        try {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            sessionStorage.setItem(key, value);
          }
        } catch {
          // Silent fail if sessionStorage is not available
        }
      },
      removeItem: (key: string) => {
        try {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            sessionStorage.removeItem(key);
          }
        } catch {
          // Silent fail if sessionStorage is not available
        }
      },
    },
  },
});

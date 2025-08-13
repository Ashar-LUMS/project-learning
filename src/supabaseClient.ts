import { createClient } from '@supabase/supabase-js';

// Get your Supabase URL and anon key from your .env.local file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and anon key must be provided.');
}
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
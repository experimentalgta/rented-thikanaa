import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project-id') &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseAnonKey.includes('your-anon') &&
  !supabaseAnonKey.includes('placeholder')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase client is not configured. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in environment variables.'
    );
  }
  return supabase;
}

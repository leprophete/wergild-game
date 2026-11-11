import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Read-only Supabase client (publishable key). Row Level Security only lets it read
 * the public map and the rankings; it has no write right on anything.
 * The secret key never reaches this file nor the browser.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(url && key);

let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  browserClient ??= createClient(url!, key!, { auth: { persistSession: false } });
  return browserClient;
}

/** Fresh client per server request (no shared state between users). */
export function getServerReadSupabase(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  return createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
}

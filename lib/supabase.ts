import { createClient } from '@supabase/supabase-js';

// The URL and publishable (anon) key are public by design — they are shipped
// to every browser. Access control is enforced server-side by Row Level
// Security. They are read from the environment only: hardcoding a fallback
// project has bitten us once already (the baked-in project was deleted, its
// hostname stopped resolving, and every call failed with an opaque
// "Failed to fetch" that looked like a bug in the app).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * False when the Supabase env vars are missing. The UI checks this so it can
 * say "the app isn't connected to a database" instead of surfacing a network
 * error that reads like a wrong password.
 */
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const SUPABASE_SETUP_MESSAGE =
  'BeltFlow is not connected to a database. Set NEXT_PUBLIC_SUPABASE_URL and ' +
  'NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example) and restart the server.';

if (!supabaseConfigured && typeof window !== 'undefined') {
  console.error(SUPABASE_SETUP_MESSAGE);
}

// When unconfigured we still construct a client so that importing this module
// never throws — static pages (landing, privacy, terms) render fine without a
// database, and the pages that do need one report the problem themselves.
export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey || 'public-anon-key-not-set',
);

import { createClient } from '@supabase/supabase-js';

// The URL and publishable (anon) key are public by design — they are shipped
// to every browser. Access control is enforced server-side by Row Level
// Security. Env vars take precedence so the project can be repointed.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cohnylnoxfnmyhpfpmmt.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_EKrFPYHkcObveIZqbe8jsA_k4dauCby';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

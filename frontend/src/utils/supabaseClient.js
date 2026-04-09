import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'
  );
}

// Main client — used for auth (login/logout) and public queries
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { lock: false }
});

// Kvittra schema client — data queries only, no own auth session
export const supabaseKvittra = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'kvittra' },
  auth: {
    storageKey: 'sb-kvittra-noop',
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    lock: false,
  }
});

// Admin client — uses service_role key for full access (create/delete users, bypass RLS)
// Only available on filipadmin — never expose this on public pages
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        storageKey: 'sb-admin-noop',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        lock: false,
      }
    })
  : null;

// Admin client for kvittra schema with service_role
export const supabaseAdminKvittra = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'kvittra' },
      auth: {
        storageKey: 'sb-admin-kvittra-noop',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        lock: false,
      }
    })
  : null;

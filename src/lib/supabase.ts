import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ── Client navigateur (singleton) — à utiliser dans tous les composants "use client"
export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Client admin (service role) — uniquement dans les API routes côté serveur
export function getSupabaseAdmin() {
  return createClient(
    SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

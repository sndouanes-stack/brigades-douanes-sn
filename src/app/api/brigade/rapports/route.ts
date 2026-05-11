import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/brigade/rapports
 *
 * Retourne tous les rapports de la brigade de l'utilisateur connecté.
 * Utilise le service role pour contourner la politique RLS "own write"
 * qui limiterait la lecture aux seuls rapports créés par l'utilisateur.
 */
export async function GET() {
  // ── 1. Identifier l'utilisateur depuis la session cookie ────────────────
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Lecture seule dans cette route
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // ── 2. Récupérer brigade_id depuis public.users via le service role ──────
  const admin = getSupabaseAdmin();

  const { data: profile, error: profileErr } = await admin
    .from("users")
    .select("brigade_id")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile?.brigade_id) {
    // Pas de brigade associée → liste vide (pas une erreur bloquante)
    return NextResponse.json({ rapports: [] });
  }

  // ── 3. Charger tous les rapports de la brigade (RLS bypassed) ────────────
  const { data: rapports, error: rapportsErr } = await admin
    .from("rapports")
    .select("id, date, titre, contenu, created_by")
    .eq("brigade_id", profile.brigade_id)
    .order("date", { ascending: false })
    .limit(100);

  if (rapportsErr) {
    return NextResponse.json({ error: rapportsErr.message }, { status: 500 });
  }

  return NextResponse.json({ rapports: rapports ?? [] });
}

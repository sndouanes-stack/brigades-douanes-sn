import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * DELETE /api/admin/delete-user
 *
 * Supprime un utilisateur Supabase Auth + sa ligne public.users.
 * Doit impérativement passer par le service role (côté serveur) :
 * l'API supabase.auth.admin.deleteUser n'est pas disponible depuis le client.
 */
export async function DELETE(request: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Service role key non configurée sur ce serveur." },
      { status: 500 }
    );
  }

  let uid: string | undefined;
  try {
    const body = await request.json() as { uid?: string };
    uid = body.uid;
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  if (!uid) {
    return NextResponse.json({ error: "uid requis" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // ── 1. Supprimer la ligne public.users (contient la FK vers auth.users) ──
  // On ignore l'erreur si la ligne n'existe pas — la suppression Auth reste nécessaire.
  await admin.from("users").delete().eq("id", uid);

  // ── 2. Supprimer le compte Supabase Auth (service role requis) ────────────
  const { error: authError } = await admin.auth.admin.deleteUser(uid);
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

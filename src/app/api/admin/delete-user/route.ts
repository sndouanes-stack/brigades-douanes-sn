import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function DELETE(request: Request) {
  const { uid } = await request.json();
  if (!uid) return NextResponse.json({ error: "uid requis" }, { status: 400 });

  const admin = getSupabaseAdmin();

  // Supprimer d'abord le profil dans public.users (la FK sur auth.users pourrait bloquer)
  const { error: dbError } = await admin.from("users").delete().eq("id", uid);
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Supprimer le compte Auth
  const { error: authError } = await admin.auth.admin.deleteUser(uid);
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

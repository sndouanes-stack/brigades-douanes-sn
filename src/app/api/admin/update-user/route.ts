import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      uid, password, nom, prenom, role,
      brigade_id, subdivision_id, direction_regionale_id,
      matricule, grade, actif,
    } = body;

    if (!uid) {
      return NextResponse.json({ error: "ID utilisateur requis." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Si un mot de passe est fourni, le mettre à jour dans Supabase Auth
    if (password && typeof password === "string" && password.trim() !== "") {
      if (password.trim().length < 6) {
        return NextResponse.json({ error: "Le mot de passe doit contenir au moins 6 caractères." }, { status: 400 });
      }
      const { error: authErr } = await admin.auth.admin.updateUserById(uid, {
        password: password.trim(),
      });
      if (authErr) {
        console.error("[UpdateUser API] Erreur maj password:", authErr);
        return NextResponse.json({ error: `Erreur mot de passe : ${authErr.message}` }, { status: 400 });
      }
    }

    // Mettre à jour les données dans la table public.users
    const updates: Record<string, unknown> = {
      nom: (nom ?? "").trim(),
      prenom: (prenom ?? "").trim(),
      role,
      brigade_id: brigade_id || null,
      subdivision_id: subdivision_id || null,
      direction_regionale_id: direction_regionale_id || null,
      matricule: (matricule ?? "").trim() || null,
    };
    if (grade !== undefined) updates.grade = grade || null;
    if (actif !== undefined) updates.actif = actif;

    const { error: dbError } = await admin
      .from("users")
      .update(updates)
      .eq("id", uid);

    if (dbError) {
      console.error("[UpdateUser API] Erreur db update:", dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[UpdateUser API] Exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

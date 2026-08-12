import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      uid, password, nom, prenom, role,
      brigade_id, subdivision_id, direction_regionale_id,
      matricule, grade, actif, telephone,
    } = body;

    if (!uid) {
      return NextResponse.json({ error: "ID utilisateur requis." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const cleanPhone = (telephone ?? "").trim();

    // Mettre à jour metadata + password dans Auth (toujours fiable)
    const authUpdates: Record<string, unknown> = {
      user_metadata: {
        nom,
        prenom,
        role,
        telephone: cleanPhone,
      },
    };

    if (password && typeof password === "string" && password.trim() !== "") {
      if (password.trim().length < 6) {
        return NextResponse.json({ error: "Le mot de passe doit contenir au moins 6 caractères." }, { status: 400 });
      }
      authUpdates.password = password.trim();
    }

    const { error: authErr } = await admin.auth.admin.updateUserById(uid, authUpdates);
    if (authErr) {
      console.error("[UpdateUser API] Erreur maj auth:", authErr);
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
    if (telephone !== undefined) updates.telephone = cleanPhone || null;

    let { error: dbError } = await admin
      .from("users")
      .update(updates)
      .eq("id", uid);

    // Fallback si la colonne 'telephone' n'existe pas encore dans la table users
    if (dbError && dbError.message.includes("telephone")) {
      delete updates.telephone;
      const retry = await admin
        .from("users")
        .update(updates)
        .eq("id", uid);
      dbError = retry.error;
    }

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

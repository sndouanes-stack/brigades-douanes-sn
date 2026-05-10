import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json();
  const {
    email, password, nom, prenom, role,
    brigade_id, subdivision_id, direction_regionale_id,
    matricule, grade, actif,
  } = body;

  const admin = getSupabaseAdmin();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const uid = authData.user.id;

  const { error: dbError } = await admin.from("users").upsert({
    id: uid,
    email,
    nom,
    prenom,
    role,
    brigade_id: brigade_id || null,
    subdivision_id: subdivision_id || null,
    direction_regionale_id: direction_regionale_id || null,
    matricule: matricule || null,
    grade: grade || null,
    actif: actif ?? true,
  });

  if (dbError) {
    // Auth user was created — clean up to avoid orphan
    await admin.auth.admin.deleteUser(uid);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ uid });
}

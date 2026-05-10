import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const uid = "F2ngWOEETfV4uPAh05tz3qhcrYl2";

  try {
    const admin = getSupabaseAdmin();

    const { error } = await admin.from("users").upsert({
      id: uid,
      email:     "admin@douanes.sn",
      nom:       "Gaye",
      prenom:    "Baye",
      role:      "ADMIN",
      brigade_id: "brigade-dakar-pikine",
      actif:     true,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: `Document users/${uid} créé avec rôle ADMIN.`,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

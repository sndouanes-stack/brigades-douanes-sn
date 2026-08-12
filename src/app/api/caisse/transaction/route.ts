import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, montant, motif, libelle, date, brigade_id, created_by } = body;

    const montantNum = parseFloat(String(montant).replace(/\s/g, "").replace(",", "."));
    if (!montantNum || montantNum <= 0) {
      return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const payload = {
      type,
      montant: montantNum,
      libelle: (libelle || motif || "").trim(),
      date: date || new Date().toISOString().split("T")[0],
      brigade_id: brigade_id || null,
      created_by: created_by || "",
    };

    const { data, error: dbError } = await admin
      .from("transactions")
      .insert(payload)
      .select()
      .single();

    if (dbError) {
      console.error("[API Caisse] Erreur DB:", dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, transaction: data });
  } catch (err) {
    console.error("[API Caisse] Exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, newPassword, userId } = body;

    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "Numéro de téléphone requis." }, { status: 400 });
    }

    const cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.length < 8) {
      return NextResponse.json({ error: "Numéro de téléphone invalide (au moins 8 chiffres)." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // 1. Chercher dans la table public.users
    const { data: users, error: usersErr } = await admin
      .from("users")
      .select("*");

    if (usersErr) {
      console.error("[ResetPassword API] Erreur fetch users:", usersErr);
    }

    // Tenter de trouver le compte par téléphone, matricule, ou email
    const matchedUser = (users ?? []).find((u) => {
      if (userId && u.id === userId) return true;
      const uPhone = (u.telephone ?? "").replace(/[^0-9]/g, "");
      if (uPhone && (uPhone.endsWith(cleanPhone) || cleanPhone.endsWith(uPhone))) return true;

      const uMatricule = (u.matricule ?? "").replace(/[^0-9]/g, "");
      if (uMatricule && cleanPhone.includes(uMatricule)) return true;

      const uEmail = (u.email ?? "").toLowerCase();
      if (uEmail.includes(cleanPhone)) return true;

      return false;
    });

    // Si réinitialisation directe avec un nouveau mot de passe
    if (newPassword && typeof newPassword === "string") {
      if (newPassword.length < 6) {
        return NextResponse.json({ error: "Le mot de passe doit contenir au moins 6 caractères." }, { status: 400 });
      }

      let targetUserId = userId || matchedUser?.id;

      // Si pas trouvé dans public.users, chercher dans auth.users
      if (!targetUserId) {
        const { data: authUsers } = await admin.auth.admin.listUsers();
        const foundAuth = authUsers?.users?.find((au) => {
          const ph = (au.phone ?? (au.user_metadata?.phone as string) ?? "").replace(/[^0-9]/g, "");
          return ph && (ph.endsWith(cleanPhone) || cleanPhone.endsWith(ph));
        });
        if (foundAuth) targetUserId = foundAuth.id;
      }

      if (!targetUserId) {
        return NextResponse.json({ error: "Impossible d'identifier le compte pour la mise à jour." }, { status: 404 });
      }

      // Mettre à jour le mot de passe dans Supabase Auth
      const { error: updateErr } = await admin.auth.admin.updateUserById(targetUserId, {
        password: newPassword,
      });

      if (updateErr) {
        console.error("[ResetPassword API] Erreur update auth password:", updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        message: "Mot de passe réinitialisé avec succès ! Vous pouvez maintenant vous connecter.",
      });
    }

    // Recherche de compte (Étape 1)
    if (!matchedUser) {
      // Chercher aussi dans Auth direct au cas où le téléphone est dans metadata
      const { data: authUsers } = await admin.auth.admin.listUsers();
      const foundAuth = authUsers?.users?.find((au) => {
        const ph = (au.phone ?? (au.user_metadata?.phone as string) ?? "").replace(/[^0-9]/g, "");
        return ph && (ph.endsWith(cleanPhone) || cleanPhone.endsWith(ph));
      });

      if (foundAuth) {
        const maskEmail = foundAuth.email ? foundAuth.email.replace(/(.{2})(.*)(?=@)/, "$1***") : "Email masqué";
        return NextResponse.json({
          ok: true,
          found: true,
          userId: foundAuth.id,
          accountInfo: {
            email: maskEmail,
            nom: (foundAuth.user_metadata?.nom as string) ?? "",
            prenom: (foundAuth.user_metadata?.prenom as string) ?? "",
          },
        });
      }

      // Pour offrir une assistance même si le numéro n'est pas encore dans la base:
      // Si aucun compte trouvé, retourner found: false avec instructions
      return NextResponse.json({
        ok: true,
        found: false,
        message: "Aucun compte trouvé avec ce numéro de téléphone. Veuillez vérifier le numéro ou contacter votre Administrateur de Subdivision.",
      });
    }

    const maskEmail = matchedUser.email
      ? matchedUser.email.replace(/(.{2})(.*)(?=@)/, "$1***")
      : "Email masqué";

    return NextResponse.json({
      ok: true,
      found: true,
      userId: matchedUser.id,
      accountInfo: {
        email: maskEmail,
        nom: matchedUser.nom ?? "",
        prenom: matchedUser.prenom ?? "",
        grade: matchedUser.grade ?? "",
      },
    });
  } catch (err) {
    console.error("[ResetPassword API] Exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

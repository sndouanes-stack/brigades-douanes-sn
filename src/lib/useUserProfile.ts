"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { UserProfile, ROLE_HOME, normalizeRole } from "@/lib/roles";

export function useUserProfile() {
  const [user, setUser]       = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Utilise uniquement onAuthStateChange (l'événement INITIAL_SESSION remplace getSession).
    // Cela évite le double-appel à loadProfile qui causait des re-renders excessifs et
    // le clignotement des images dans les sidebars.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // TOKEN_REFRESHED : on renouvelle juste le cookie session, sans recharger le profil
      // (évite un re-render inutile toutes les ~55 min).
      if (event === "TOKEN_REFRESHED") {
        if (session) setSessionCookie(session.access_token);
        return;
      }

      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser && session) {
        setSessionCookie(session.access_token);
        loadProfile(currentUser.id);
      } else {
        clearCookies();
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProfile(uid: string) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", uid)
      .single();

    if (!error && data) {
      const mappedRole = normalizeRole(data.role);
      const mapped: UserProfile = {
        uid:                  data.id,
        email:                data.email ?? "",
        nom:                  data.nom ?? "",
        prenom:               data.prenom ?? "",
        role:                 mappedRole,
        brigadeId:            data.brigade_id ?? undefined,
        subdivisionId:        data.subdivision_id ?? undefined,
        directionRegionaleId: data.direction_regionale_id ?? undefined,
        matricule:            data.matricule ?? undefined,
        grade:                data.grade ?? undefined,
        actif:                data.actif ?? true,
      };

      // Déconnexion forcée si compte désactivé (sauf ADMIN)
      if (mapped.actif === false && mapped.role !== "ADMIN") {
        await supabase.auth.signOut();
        return;
      }

      setProfile(mapped);
      document.cookie = `role=${mapped.role}; path=/; max-age=3600; SameSite=Lax`;
    } else {
      // Table inaccessible (RLS) — lire le rôle depuis les métadonnées Auth
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const metaRole = normalizeRole(authUser?.user_metadata?.role as string);
      const fallback: UserProfile = {
        uid,
        email:   authUser?.email   ?? "",
        nom:     (authUser?.user_metadata?.nom    as string) ?? "",
        prenom:  (authUser?.user_metadata?.prenom as string) ?? "",
        role:    metaRole,
        actif:   true,
      };
      setProfile(fallback);
      document.cookie = `role=${metaRole}; path=/; max-age=3600; SameSite=Lax`;
    }
    setLoading(false);
  }

  return { user, profile, loading };
}

function setSessionCookie(token: string) {
  document.cookie = `session=${token}; path=/; max-age=3600; SameSite=Lax`;
}
function clearCookies() {
  document.cookie = "session=; path=/; max-age=0; SameSite=Lax";
  document.cookie = "role=; path=/; max-age=0; SameSite=Lax";
}

export { ROLE_HOME };

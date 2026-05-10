"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { UserProfile, ROLE_HOME } from "@/lib/roles";

export function useUserProfile() {
  const [user, setUser]       = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Session initiale
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        setSessionCookie(session.access_token);
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 2. Changements d'état auth (connexion / déconnexion / refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
      const mapped: UserProfile = {
        uid:                  data.id,
        email:                data.email ?? "",
        nom:                  data.nom ?? "",
        prenom:               data.prenom ?? "",
        role:                 (data.role?.toUpperCase() ?? "CHEF_BRIGADE") as UserProfile["role"],
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
      document.cookie = `role=${mapped.role}; path=/; max-age=3600; SameSite=Strict`;
    } else {
      // Profil absent — fallback
      const fallback: UserProfile = {
        uid, email: "", nom: "", prenom: "", role: "CHEF_BRIGADE", actif: true,
      };
      setProfile(fallback);
      document.cookie = `role=CHEF_BRIGADE; path=/; max-age=3600; SameSite=Strict`;
    }
    setLoading(false);
  }

  return { user, profile, loading };
}

function setSessionCookie(token: string) {
  document.cookie = `session=${token}; path=/; max-age=3600; SameSite=Strict`;
}
function clearCookies() {
  document.cookie = "session=; path=/; max-age=0";
  document.cookie = "role=; path=/; max-age=0";
}

export { ROLE_HOME };

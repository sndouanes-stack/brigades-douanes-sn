"use client";

import { useState, useEffect } from "react";
import { useUserProfile } from "@/lib/useUserProfile";

/**
 * Retourne l'identité complète de l'utilisateur connecté formatée selon son rôle :
 *   AGENT               → "Agent — Prénom Nom"
 *   CHEF_BRIGADE        → "Chef de Brigade — Nom Brigade"
 *   CHEF_SUBDIVISION    → "Chef de Subdivision de Nom Subdivision"
 *   DIRECTEUR_REGIONAL  → "Directeur Régional — Nom Direction"
 *   ADMIN               → "Administrateur — Prénom Nom"
 */
export function useIdentityLabel(): { label: string; loading: boolean } {
  const { profile, loading } = useUserProfile();
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (loading || !profile) return;

    // Capture in a local non-null reference so TypeScript can narrow inside the async function
    const p = profile;
    const role = p.role?.toUpperCase() ?? "";
    const fullName = `${p.prenom ?? ""} ${p.nom ?? ""}`.trim();

    async function resolve() {
      const nom = p.nom ?? "";

      if (role === "AGENT") {
        const grade = p.grade ?? "";
        setLabel(`${grade} ${nom}`.trim() || fullName);
        return;
      }

      if (role === "ADMIN") {
        setLabel(`Administrateur — ${fullName}`);
        return;
      }

      if (role === "CHEF_BRIGADE") {
        setLabel(`Chef de Brigade ${fullName}`.trim());
        return;
      }

      if (role === "CHEF_SUBDIVISION") {
        setLabel(`Chef de Subdivision ${fullName}`.trim());
        return;
      }

      if (role === "DIRECTEUR_REGIONAL") {
        setLabel(`Directeur Régional ${fullName}`.trim());
        return;
      }

      // Fallback
      setLabel(fullName || p.email);
    }

    resolve();
  }, [profile, loading]);

  return { label, loading };
}

"use client";

import { useUserProfile } from "@/lib/useUserProfile";

export function useRole() {
  const { profile, user, loading } = useUserProfile();
  const role = (profile?.role?.toUpperCase() ?? "") as string;

  const isAgent             = role === "AGENT";
  const isChefBrigade       = role === "CHEF_BRIGADE";
  const isChefSubdivision   = role === "CHEF_SUBDIVISION";
  const isDirecteurRegional = role === "DIRECTEUR_REGIONAL";
  const isAdmin             = role === "ADMIN";

  // Lecture seule stricte : peuvent consulter et générer des PDF, jamais écrire
  // L'ADMIN gère les utilisateurs/structure mais ne modifie pas les données opérationnelles
  const isReadOnly = isChefSubdivision || isDirecteurRegional || isAdmin;

  return {
    role,
    profile,
    user,
    loading,
    isAgent,
    isChefBrigade,
    isChefSubdivision,
    isDirecteurRegional,
    isAdmin,
    isReadOnly,
  };
}

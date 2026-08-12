"use client";

import { useState, useEffect } from "react";
import { useUserProfile } from "@/lib/useUserProfile";
import { formatAgentName } from "@/lib/agents";

export function useIdentityLabel(): { label: string; loading: boolean } {
  const { profile, loading } = useUserProfile();
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (loading || !profile) return;

    const p = profile;
    const role = p.role?.toUpperCase() ?? "";
    const formatted = formatAgentName(p.grade, p.nom, p.prenom);

    if (role === "ADMIN") {
      setLabel(`Administrateur — ${p.prenom ?? ""} ${p.nom ?? ""}`.trim());
      return;
    }

    setLabel(formatted);
  }, [profile, loading]);

  return { label, loading };
}

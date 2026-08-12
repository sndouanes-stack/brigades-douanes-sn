"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/useUserProfile";
import { useIdentityLabel } from "@/lib/useIdentityLabel";
import Sidebar from "@/components/Sidebar";
import { BRIGADES, SUBDIVISIONS, DIRECTIONS_REGIONALES, type Brigade } from "@/lib/roles";
import { STATUT_STYLES, type Statut } from "@/lib/agents";
import { logout } from "@/lib/logout";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MontageData {
  brigadeId?: string;
  date: string;
  statuts: Record<string, Statut>;
  resume: { presents: number; patrouilles: number; barrages: number; permissionnaires: number; repos: number };
  saisiPar?: string;
  statut?: string;
}

interface TransactionData {
  type: "recette" | "depense";
  montant: number;
  motif: string;
  date: string;
}

interface EvenementData {
  heure: string;
  nature: string;
  description: string;
  lieu: string;
  agent: string;
}

interface BrigadeAgentData {
  matricule: string;
  nom: string;
  prenom: string;
  grade?: string;
}

const NATURE_STYLES: Record<string, string> = {
  "Incident":      "bg-red-100 text-red-700",
  "Contrôle":      "bg-[#4A5C2F]/10 text-[#4A5C2F]",
  "Saisie":        "bg-[#C9A84C]/15 text-[#8B6914]",
  "Interpellation":"bg-blue-100 text-blue-700",
  "Autre":         "bg-gray-100 text-gray-600",
};

// ── Composant ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, profile, loading } = useUserProfile();
  const { label: identityLabel } = useIdentityLabel();
  const router = useRouter();

  const today = new Date().toISOString().split("T")[0];

  const roleUpper = profile?.role?.toUpperCase() ?? "";
  const isSupervisor = roleUpper === "ADMIN" || roleUpper === "DIRECTEUR_REGIONAL" || roleUpper === "CHEF_SUBDIVISION";

  // ── Nom de brigade résolu (statique + Firestore fallback) ────────────────
  const [brigadeName, setBrigadeName] = useState<string>("");

  useEffect(() => {
    if (!profile?.brigadeId) return;
    const staticBrigade = BRIGADES.find((b) => b.id === profile.brigadeId);
    if (staticBrigade) { setBrigadeName(staticBrigade.nom); return; }
    void (async () => {
      const { data } = await supabase.from("brigades").select("nom").eq("id", profile.brigadeId).single();
      if (data) setBrigadeName(data.nom ?? "");
    })();
  }, [profile?.brigadeId]);

  // ── Stats temps-réel (Chef de Brigade seulement) ─────────────────────────
  const [statsLoading, setStatsLoading]         = useState(true);
  const [todayResume, setTodayResume]           = useState({ presents: 0, patrouilles: 0, barrages: 0, permissionnaires: 0, repos: 0 });
  const [todaySolde, setTodaySolde]             = useState(0);
  const [pendingCourriers, setPendingCourriers] = useState(0);
  const [recentActivities, setRecentActivities] = useState<EvenementData[]>([]);

  // ── Recherche brigade (superviseurs) ─────────────────────────────────────
  const [searchQuery, setSearchQuery]         = useState("");
  const [selectedBrigade, setSelectedBrigade] = useState<Brigade | null>(null);
  const [brigadeLoading, setBrigadeLoading]   = useState(false);
  const [brigadeMontage, setBrigadeMontage]   = useState<MontageData | null>(null);
  const [brigadeTx, setBrigadeTx]             = useState<TransactionData[]>([]);
  const [brigadeEvents, setBrigadeEvents]     = useState<EvenementData[]>([]);
  const [brigadeAgents, setBrigadeAgents]     = useState<BrigadeAgentData[]>([]);

  // ── Chargement stats propres au Chef de Brigade ──────────────────────────
  useEffect(() => {
    if (isSupervisor || !profile) { setStatsLoading(false); return; }

    async function loadStats() {
      const brigadeId = profile?.brigadeId;

      try {
        const promises = [
          Promise.resolve(supabase.from("main_courante").select("*").eq("date", today)),
          Promise.resolve(supabase.from("correspondances").select("statut")),
          brigadeId ? Promise.resolve(supabase.from("montages").select("*").eq("date", today).eq("brigade_id", brigadeId).maybeSingle()) : Promise.resolve({ data: null }),
          brigadeId ? Promise.resolve(supabase.from("transactions").select("*").eq("date", today).eq("brigade_id", brigadeId)) : Promise.resolve({ data: null }),
        ];

        const results = await Promise.all(promises);
        const [mcResult, corrResult, montageResult, txResult] = results as [
          { data: EvenementData[] | null },
          { data: { statut?: string }[] | null },
          { data: MontageData | null } | undefined,
          { data: TransactionData[] | null } | undefined,
        ];

        const events = (mcResult.data ?? []).sort((a, b) => b.heure.localeCompare(a.heure));
        setRecentActivities(events);

        const pendingStatuts = ["En attente", "En attente d'envoi", "En cours"];
        setPendingCourriers(
          (corrResult.data ?? []).filter((d) => pendingStatuts.includes(d.statut ?? "")).length
        );

        if (montageResult?.data) {
          const m = montageResult.data as MontageData;
          setTodayResume(m.resume ?? { presents: 0, patrouilles: 0, barrages: 0, permissionnaires: 0, repos: 0 });
        }

        if (txResult?.data) {
          const txs = txResult.data;
          const rec = txs.filter((t) => t.type === "recette").reduce((s, t) => s + t.montant, 0);
          const dep = txs.filter((t) => t.type === "depense").reduce((s, t) => s + t.montant, 0);
          setTodaySolde(rec - dep);
        }
      } catch { /* silencieux */ }
      finally { setStatsLoading(false); }
    }

    loadStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.brigadeId, isSupervisor]);

  // ── Recherche brigade ─────────────────────────────────────────────────────
  const searchTerm = searchQuery.toLowerCase().trim();
  const filteredBrigades: Brigade[] = searchTerm.length < 2 ? [] : BRIGADES.filter((b) => {
    const subdiv = SUBDIVISIONS.find((s) => s.id === b.subdivisionId);
    const region = subdiv ? DIRECTIONS_REGIONALES.find((dr) => dr.id === subdiv.directionRegionaleId) : null;
    return (
      b.nom.toLowerCase().includes(searchTerm) ||
      (subdiv?.nom ?? "").toLowerCase().includes(searchTerm) ||
      (region?.nom ?? "").toLowerCase().includes(searchTerm)
    );
  });

  const loadBrigadeData = useCallback(async (brigade: Brigade) => {
    setSelectedBrigade(brigade);
    setBrigadeMontage(null);
    setBrigadeTx([]);
    setBrigadeEvents([]);
    setBrigadeAgents([]);
    setBrigadeLoading(true);
    try {
      const [montageResult, txResult, evResult, agentsResult] = await Promise.all([
        supabase.from("montages").select("*").eq("brigade_id", brigade.id).eq("date", today).maybeSingle(),
        supabase.from("transactions").select("*").eq("brigade_id", brigade.id).eq("date", today),
        supabase.from("main_courante").select("*").eq("brigade_id", brigade.id).eq("date", today),
        supabase.from("agents").select("*").eq("brigade_id", brigade.id),
      ]);
      setBrigadeMontage(montageResult.data as MontageData | null);
      setBrigadeTx((txResult.data ?? []) as TransactionData[]);
      setBrigadeEvents(((evResult.data ?? []) as EvenementData[]).sort((a, b) => a.heure.localeCompare(b.heure)));
      setBrigadeAgents((agentsResult.data ?? []) as BrigadeAgentData[]);
    } catch { /* silencieux */ }
    finally { setBrigadeLoading(false); }
  }, [today]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-[#4A5C2F] border-t-transparent animate-spin" />
          <p className="text-[#4A5C2F] text-sm font-medium">Chargement…</p>
        </div>
      </div>
    );
  }

  const todayLabel = new Date().toLocaleDateString("fr-SN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const fmt = (n: number) => new Intl.NumberFormat("fr-SN", { maximumFractionDigits: 0 }).format(n);

  // Cartes stats dynamiques
  const statsCards = [
    {
      label: "Agents présents",
      value: statsLoading ? "…" : String(todayResume.presents),
      sub: "selon le montage du jour",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none"
          viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 100-8 4 4 0 000 8zm6 0a3 3 0 100-6 3 3 0 000 6zM3 14a3 3 0 100-6 3 3 0 000 6z" />
        </svg>
      ),
      accent: "#4A5C2F", bg: "bg-[#4A5C2F]",
    },
    {
      label: "Solde caisse du jour",
      value: statsLoading ? "…" : fmt(todaySolde),
      sub: "FCFA net aujourd'hui",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none"
          viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
      accent: "#C9A84C", bg: "bg-[#C9A84C]",
    },
    {
      label: "Courriers en attente",
      value: statsLoading ? "…" : String(pendingCourriers),
      sub: "dont traitement en cours",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none"
          viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      accent: "#4A5C2F", bg: "bg-[#4A5C2F]",
    },
    {
      label: "Patrouilles & Barrages",
      value: statsLoading ? "…" : String(todayResume.patrouilles + todayResume.barrages),
      sub: `${todayResume.patrouilles} patrouilles · ${todayResume.barrages} barrages`,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none"
          viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9m0 0L9 7" />
        </svg>
      ),
      accent: "#C9A84C", bg: "bg-[#C9A84C]",
    },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 pt-16 md:pt-4 flex items-center justify-between shadow-sm">
          <div>
            <h1 className="text-base md:text-lg font-bold text-[#4A5C2F]">
              {roleUpper === "ADMIN"
                ? "Direction Générale des Douanes"
                : brigadeName || "Brigade des Douanes"}
            </h1>
            <p className="text-xs text-gray-400 capitalize mt-0.5">{todayLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            {identityLabel && (
              <div className="hidden sm:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-1.5">
                <div className="w-6 h-6 rounded-full bg-[#4A5C2F] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {profile?.prenom?.[0]?.toUpperCase() ?? user.email?.[0].toUpperCase()}
                </div>
                <span className="text-sm text-gray-700 font-medium max-w-[260px] truncate">{identityLabel}</span>
              </div>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-2 text-xs md:text-sm text-gray-700 hover:text-red-600
                bg-gray-100 hover:bg-red-50 border border-gray-200 hover:border-red-200
                px-3 md:px-4 py-2 rounded-lg transition-all duration-150 shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Déconnexion</span>
            </button>
          </div>
        </header>

        {/* Corps */}
        <main className="flex-1 overflow-y-auto px-8 py-8 space-y-8">

          {/* ── Recherche de brigade (superviseurs uniquement) ── */}
          {isSupervisor && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Rechercher une brigade
              </h2>

              <div className="relative">
                <svg xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); if (selectedBrigade) setSelectedBrigade(null); }}
                  placeholder="Rechercher une brigade par nom, subdivision ou région…"
                  className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm
                    focus:outline-none focus:ring-2 focus:ring-[#4A5C2F] bg-white shadow-sm"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(""); setSelectedBrigade(null); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {searchTerm.length >= 2 && !selectedBrigade && (
                <div className="mt-2 bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden">
                  {filteredBrigades.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">
                      Aucune brigade trouvée pour &quot;{searchQuery}&quot;
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-50 max-h-60 overflow-y-auto">
                      {filteredBrigades.map((b) => {
                        const subdiv = SUBDIVISIONS.find((s) => s.id === b.subdivisionId);
                        const region = subdiv ? DIRECTIONS_REGIONALES.find((dr) => dr.id === subdiv.directionRegionaleId) : null;
                        return (
                          <li key={b.id}>
                            <button
                              onClick={() => loadBrigadeData(b)}
                              className="w-full px-5 py-3 flex items-center gap-3 hover:bg-[#4A5C2F]/5 text-left transition-colors">
                              <div className="w-8 h-8 rounded-lg bg-[#4A5C2F]/10 flex items-center justify-center shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#4A5C2F]" fill="none"
                                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm text-gray-800 truncate">{b.nom}</p>
                                <p className="text-xs text-gray-400 truncate">
                                  {subdiv?.nom ?? "—"}{region ? ` · ${region.nom}` : ""}
                                </p>
                              </div>
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-300 shrink-0"
                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {/* Fiche brigade sélectionnée */}
              {selectedBrigade && (
                <div className="mt-2 bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden">
                  <div className="bg-[#4A5C2F] px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none"
                          viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm">{selectedBrigade.nom}</p>
                        <p className="text-[#C9A84C] text-xs">
                          {(() => {
                            const s = SUBDIVISIONS.find((x) => x.id === selectedBrigade.subdivisionId);
                            const r = s ? DIRECTIONS_REGIONALES.find((x) => x.id === s.directionRegionaleId) : null;
                            return [s?.nom, r?.nom].filter(Boolean).join(" · ");
                          })()}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => { setSelectedBrigade(null); setSearchQuery(""); }}
                      className="text-white/50 hover:text-white transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
                        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {brigadeLoading ? (
                    <div className="py-10 flex items-center justify-center">
                      <div className="w-7 h-7 rounded-full border-3 border-[#4A5C2F] border-t-transparent animate-spin" />
                    </div>
                  ) : (
                    <div className="p-5 space-y-5">

                      {/* Résumé montage */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                          Montage du jour
                        </p>
                        {brigadeMontage ? (
                          <>
                            <div className="grid grid-cols-5 gap-3 mb-4">
                              {[
                                { key: "presents",         label: "Présents",    color: "bg-green-50 text-green-700 border-green-200"   },
                                { key: "patrouilles",      label: "Patrouilles", color: "bg-[#4A5C2F]/5 text-[#4A5C2F] border-[#4A5C2F]/20" },
                                { key: "barrages",         label: "Barrages",    color: "bg-blue-50 text-blue-700 border-blue-200"       },
                                { key: "permissionnaires", label: "Permission",  color: "bg-orange-50 text-orange-700 border-orange-200" },
                                { key: "repos",            label: "Repos",       color: "bg-gray-50 text-gray-600 border-gray-200"       },
                              ].map((item) => (
                                <div key={item.key} className={`rounded-xl p-3 border text-center ${item.color}`}>
                                  <p className="text-xl font-bold">
                                    {brigadeMontage.resume[item.key as keyof typeof brigadeMontage.resume]}
                                  </p>
                                  <p className="text-xs mt-0.5 opacity-80">{item.label}</p>
                                </div>
                              ))}
                            </div>

                            {/* Tableau agents (depuis Firestore) */}
                            {brigadeAgents.length > 0 ? (
                              <div className="rounded-xl border border-gray-100 overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent</th>
                                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Matricule</th>
                                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-50">
                                    {brigadeAgents.map((agent) => {
                                      const s = brigadeMontage.statuts?.[agent.matricule] as Statut | undefined;
                                      return (
                                        <tr key={agent.matricule} className="hover:bg-gray-50">
                                          <td className="px-4 py-2.5 font-medium text-gray-800">
                                            {agent.prenom} {agent.nom}
                                          </td>
                                          <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{agent.matricule}</td>
                                          <td className="px-4 py-2.5">
                                            {s ? (
                                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUT_STYLES[s]}`}>
                                                {s}
                                              </span>
                                            ) : (
                                              <span className="text-xs text-gray-300">—</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400 italic">Aucun agent enregistré pour cette brigade.</p>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-500 shrink-0" fill="none"
                              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            </svg>
                            <p className="text-sm text-amber-700">Aucun montage enregistré aujourd&apos;hui pour cette brigade.</p>
                          </div>
                        )}
                      </div>

                      {/* Transactions */}
                      {brigadeTx.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                            Caisse du jour
                          </p>
                          <div className="grid grid-cols-3 gap-3">
                            {(() => {
                              const rec = brigadeTx.filter((t) => t.type === "recette").reduce((s, t) => s + t.montant, 0);
                              const dep = brigadeTx.filter((t) => t.type === "depense").reduce((s, t) => s + t.montant, 0);
                              return (
                                <>
                                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                                    <p className="text-lg font-bold text-green-700">+{fmt(rec)}</p>
                                    <p className="text-xs text-green-600 mt-0.5">Recettes FCFA</p>
                                  </div>
                                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                                    <p className="text-lg font-bold text-red-600">−{fmt(dep)}</p>
                                    <p className="text-xs text-red-500 mt-0.5">Dépenses FCFA</p>
                                  </div>
                                  <div className={`rounded-xl p-3 text-center border ${rec - dep >= 0 ? "bg-[#4A5C2F]/5 border-[#4A5C2F]/20" : "bg-red-50 border-red-200"}`}>
                                    <p className={`text-lg font-bold ${rec - dep >= 0 ? "text-[#4A5C2F]" : "text-red-600"}`}>
                                      {rec - dep >= 0 ? "+" : ""}{fmt(rec - dep)}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">Solde FCFA</p>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Main courante */}
                      {brigadeEvents.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                            Main courante ({brigadeEvents.length} événement{brigadeEvents.length > 1 ? "s" : ""})
                          </p>
                          <div className="space-y-2">
                            {brigadeEvents.map((ev, i) => (
                              <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-lg px-4 py-2.5">
                                <span className="font-mono text-xs font-bold text-[#4A5C2F] shrink-0 mt-0.5">{ev.heure}</span>
                                <div>
                                  <span className="text-xs bg-[#C9A84C]/15 text-[#8B6914] rounded-full px-2 py-0.5 font-medium mr-2">{ev.nature}</span>
                                  <span className="text-sm text-gray-700">{ev.description}</span>
                                  <p className="text-xs text-gray-400 mt-0.5">{ev.lieu} — {ev.agent}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="pt-1">
                        <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
                            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          Mode consultation — aucune modification autorisée
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Titre section ── */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Tableau de bord</h2>
              <p className="text-sm text-gray-400 mt-0.5">Vue d&apos;ensemble de la brigade</p>
            </div>
            <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 text-xs font-medium px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Système opérationnel
            </span>
          </div>

          {/* ── Cartes statistiques ── */}
          {!isSupervisor && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
              {statsCards.map((stat) => (
                <div
                  key={stat.label}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-200"
                >
                  <div className={`h-1 w-full ${stat.bg}`} />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider leading-tight">
                        {stat.label}
                      </p>
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: stat.accent + "18", color: stat.accent }}
                      >
                        {stat.icon}
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-800 leading-none mb-1">
                      {stat.value}
                    </p>
                    <p className="text-xs text-gray-400">{stat.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Activités récentes ── */}
          {!isSupervisor && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-800">Activités récentes</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Main courante — {todayLabel}</p>
                </div>
              </div>
              {statsLoading ? (
                <div className="py-10 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-[#4A5C2F] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : recentActivities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 mb-2 opacity-30" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm">Aucune activité enregistrée aujourd&apos;hui</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {recentActivities.slice(0, 8).map((activity, i) => (
                    <li key={i} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                      <span className="text-xs text-gray-400 font-mono w-12 shrink-0">{activity.heure}</span>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0
                        ${NATURE_STYLES[activity.nature] ?? "bg-gray-100 text-gray-600"}`}>
                        {activity.nature}
                      </span>
                      <span className="text-sm text-gray-700 truncate">{activity.description}</span>
                      <span className="text-xs text-gray-400 shrink-0">{activity.agent}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Message pour superviseurs sans brigade sélectionnée */}
          {isSupervisor && !selectedBrigade && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <p className="text-gray-500 font-medium">Sélectionnez une brigade pour consulter ses données</p>
              <p className="text-gray-400 text-sm mt-1">Utilisez le champ de recherche ci-dessus</p>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

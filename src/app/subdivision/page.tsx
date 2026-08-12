"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/useUserProfile";
import SubdivisionSidebar from "@/components/SubdivisionSidebar";
import BrigadeSearch from "@/components/BrigadeSearch";
import { STATUT_STYLES, type Statut } from "@/lib/agents";
import { BRIGADES, SUBDIVISIONS, ROLE_HOME } from "@/lib/roles";
import { logout } from "@/lib/logout";

interface MontageData {
  brigade_id: string;
  date: string;
  statuts: Record<string, Statut>;
}

interface AgentInfo {
  nom: string;
  prenom: string;
  grade?: string;
  matricule?: string;
  brigadeId?: string;
}

function computeResume(statuts: Record<string, Statut>) {
  const counts = { presents: 0, patrouilles: 0, barrages: 0, permissionnaires: 0, repos: 0 };
  Object.values(statuts ?? {}).forEach((s) => {
    if (s === "En patrouille") counts.patrouilles++;
    else if (s === "Barrage sur route") counts.barrages++;
    else if (s === "Permissionnaire") counts.permissionnaires++;
    else if (s === "Repos") counts.repos++;
    if (s !== "Permissionnaire") counts.presents++;
  });
  return counts;
}

function SubdivisionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vue = searchParams.get("vue") ?? "dashboard";

  const { user, profile, loading } = useUserProfile();
  const [montages, setMontages] = useState<MontageData[]>([]);
  const [agentsByMatricule, setAgentsByMatricule] = useState<Record<string, AgentInfo>>({});
  const [allAgents, setAllAgents] = useState<AgentInfo[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedBrigade, setSelectedBrigade] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const subdivision = useMemo(() => SUBDIVISIONS.find((s) => s.id === profile?.subdivisionId), [profile?.subdivisionId]);
  const brigades = useMemo(() => BRIGADES.filter((b) => b.subdivisionId === profile?.subdivisionId), [profile?.subdivisionId]);

  const fetchAgentNames = useCallback(async (montageList: MontageData[]) => {
    const allMatricules = new Set<string>();
    montageList.forEach((m) => Object.keys(m.statuts ?? {}).forEach((mat) => allMatricules.add(mat)));
    const matriculeArr = Array.from(allMatricules);
    if (matriculeArr.length === 0) return;

    const lookup: Record<string, AgentInfo> = {};
    for (let i = 0; i < matriculeArr.length; i += 30) {
      const batch = matriculeArr.slice(i, i + 30);
      const { data: rows } = await supabase.from("agents").select("nom, prenom, grade, matricule").in("matricule", batch);
      (rows ?? []).forEach((d) => {
        if (d.matricule) lookup[d.matricule] = { nom: d.nom ?? "", prenom: d.prenom ?? "", grade: d.grade };
      });
    }
    setAgentsByMatricule(lookup);
  }, []);

  const fetchAllAgents = useCallback(async () => {
    if (brigades.length === 0) return;
    const brigadeIds = brigades.map((b) => b.id);
    const agents: AgentInfo[] = [];
    for (let i = 0; i < brigadeIds.length; i += 30) {
      const batch = brigadeIds.slice(i, i + 30);
      const { data: rows } = await supabase.from("agents").select("*").in("brigade_id", batch);
      (rows ?? []).forEach((d) => agents.push(d as AgentInfo));
    }
    setAllAgents(agents);
  }, [brigades]);

  const fetchMontages = useCallback(async () => {
    if (!profile?.subdivisionId) return;
    setDataLoading(true);
    const { data: montageRows } = await supabase.from("montages").select("*").eq("date", today);
    const data = (montageRows ?? []) as MontageData[];
    // Filter only montages for brigades of this subdivision
    const subdivBrigadeIds = new Set(brigades.map((b) => b.id));
    const filtered = data.filter((m) => subdivBrigadeIds.has(m.brigade_id));
    setMontages(filtered);
    await fetchAgentNames(filtered);
    setDataLoading(false);
  }, [profile, today, fetchAgentNames, brigades]);

  const fetchedSubdivKey = useRef<string>("");

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login");
        return;
      }
      if (profile && profile.role !== "ADMIN" && profile.role !== "CHEF_SUBDIVISION") {
        router.replace(ROLE_HOME[profile.role] || "/dashboard");
        return;
      }
      const key = `${profile?.subdivisionId}_${today}`;
      if (fetchedSubdivKey.current !== key) {
        fetchedSubdivKey.current = key;
        fetchMontages();
        fetchAllAgents();
      }
    }
  }, [loading, user, profile, router, today, fetchMontages, fetchAllAgents]);

  const totalResume = montages.reduce(
    (acc, m) => {
      const r = computeResume(m.statuts ?? {});
      return {
        presents: acc.presents + r.presents,
        patrouilles: acc.patrouilles + r.patrouilles,
        barrages: acc.barrages + r.barrages,
        permissionnaires: acc.permissionnaires + r.permissionnaires,
        repos: acc.repos + r.repos,
      };
    },
    { presents: 0, patrouilles: 0, barrages: 0, permissionnaires: 0, repos: 0 }
  );

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#4A5C2F] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SubdivisionSidebar />

      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">

        {/* Header */}
        <div className="bg-[#4A5C2F] px-4 md:px-8 py-6 shadow-lg shrink-0 pt-16 md:pt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[#C9A84C] text-xs uppercase tracking-widest mb-1">Chef de Subdivision</p>
              <h1 className="text-white text-lg md:text-xl font-bold">
                {subdivision?.nom ?? "Subdivision"}
              </h1>
              <p className="text-white/50 text-xs mt-0.5 capitalize">
                {new Date().toLocaleDateString("fr-SN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {profile && (
                <div className="hidden sm:flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-white">
                  <div className="w-6 h-6 rounded-full bg-[#C9A84C] text-[#4A5C2F] flex items-center justify-center text-xs font-bold shrink-0">
                    {profile.prenom?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs md:text-sm font-medium max-w-[200px] truncate">
                    {profile.prenom} <span className="uppercase">{profile.nom}</span>
                  </span>
                </div>
              )}
              <button
                onClick={logout}
                className="flex items-center gap-2 text-xs md:text-sm text-white/80 hover:text-white
                  bg-white/10 hover:bg-red-500/20 border border-white/20 hover:border-red-400
                  px-3 md:px-4 py-2 rounded-lg transition-all duration-150 shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-8">

          {/* ── Tableau de bord ─────────────────────────────────────────── */}
          {vue === "dashboard" && (
            <div className="space-y-8">

              {/* KPI résumé */}
              <div>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Résumé du jour — {subdivision?.nom}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="text-3xl font-bold text-[#4A5C2F]">{brigades.length}</p>
                    <p className="text-xs text-gray-500 mt-1">Brigades</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="text-3xl font-bold text-[#4A5C2F]">{allAgents.length}</p>
                    <p className="text-xs text-gray-500 mt-1">Agents</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="text-3xl font-bold text-green-600">{totalResume.presents}</p>
                    <p className="text-xs text-gray-500 mt-1">Présents</p>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-3">
                  {[
                    { label: "Présents", key: "presents", style: "bg-green-50 text-green-700 border-green-200" },
                    { label: "Patrouilles", key: "patrouilles", style: "bg-[#4A5C2F]/5 text-[#4A5C2F] border-[#4A5C2F]/20" },
                    { label: "Barrages", key: "barrages", style: "bg-blue-50 text-blue-700 border-blue-200" },
                    { label: "Permission", key: "permissionnaires", style: "bg-orange-50 text-orange-700 border-orange-200" },
                    { label: "Repos", key: "repos", style: "bg-gray-50 text-gray-600 border-gray-200" },
                  ].map((item) => (
                    <div key={item.key} className={`rounded-xl p-3 border ${item.style}`}>
                      <p className="text-xl font-bold">{totalResume[item.key as keyof typeof totalResume]}</p>
                      <p className="text-xs mt-0.5 opacity-80">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recherche de brigades */}
              <div>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Recherche de brigades
                </h2>
                <BrigadeSearch />
              </div>
            </div>
          )}

          {/* ── Brigades ────────────────────────────────────────────────── */}
          {vue === "brigades" && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Brigades de la subdivision ({brigades.length})
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {brigades.map((brigade) => {
                  const brigadeMontage = montages.find((m) => m.brigade_id === brigade.id);
                  return (
                    <div key={brigade.id}
                      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      <button
                        onClick={() => setSelectedBrigade(selectedBrigade === brigade.id ? null : brigade.id)}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#4A5C2F]/10 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#4A5C2F]" fill="none"
                              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-gray-800">{brigade.nom}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {dataLoading ? "Chargement…" : brigadeMontage ? "Montage disponible" : "Aucun montage aujourd'hui"}
                            </p>
                          </div>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg"
                          className={`w-4 h-4 text-gray-400 transition-transform ${selectedBrigade === brigade.id ? "rotate-180" : ""}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {selectedBrigade === brigade.id && (
                        <div className="border-t border-gray-100 px-6 py-4">
                          {dataLoading ? (
                            <p className="text-sm text-gray-400 text-center py-4">Chargement…</p>
                          ) : !brigadeMontage ? (
                            <p className="text-sm text-gray-400 text-center py-4">Aucun montage enregistré aujourd&apos;hui.</p>
                          ) : (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left">
                                  <th className="pb-2 text-xs text-gray-500 font-semibold">Agent</th>
                                  <th className="pb-2 text-xs text-gray-500 font-semibold">Matricule</th>
                                  <th className="pb-2 text-xs text-gray-500 font-semibold">Statut</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {Object.entries(brigadeMontage.statuts ?? {}).map(([matricule, s]) => {
                                  const info = agentsByMatricule[matricule];
                                  const agentName = info ? `${info.nom} ${info.prenom}`.trim() : matricule;
                                  return (
                                    <tr key={matricule}>
                                      <td className="py-2 text-xs text-gray-700 font-medium">{agentName}</td>
                                      <td className="py-2 font-mono text-xs text-gray-400">{matricule}</td>
                                      <td className="py-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUT_STYLES[s as Statut] ?? ""}`}>
                                          {s}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {brigades.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-8">
                    Aucune brigade associée à cette subdivision.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Personnel ───────────────────────────────────────────────── */}
          {vue === "personnel" && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Personnel de la subdivision ({allAgents.length} agents)
              </h2>
              {dataLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-[#4A5C2F] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : allAgents.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">Aucun agent enregistré dans cette subdivision.</p>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Matricule</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nom & Prénom</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Grade</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Brigade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {allAgents.map((agent, i) => {
                          const brigade = brigades.find((b) => b.id === agent.brigadeId);
                          return (
                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                              <td className="px-5 py-3 font-mono text-xs text-gray-500">{agent.matricule ?? "—"}</td>
                              <td className="px-5 py-3 font-semibold text-gray-800">{agent.nom} {agent.prenom}</td>
                              <td className="px-5 py-3 text-gray-500 text-xs">{agent.grade ?? "—"}</td>
                              <td className="px-5 py-3 text-gray-500 text-xs">{brigade?.nom ?? "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Montages ────────────────────────────────────────────────── */}
          {vue === "montages" && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Montages du jour — {today}
              </h2>
              <div className="grid grid-cols-5 gap-3 mb-6">
                {[
                  { label: "Présents", key: "presents", style: "bg-green-50 text-green-700 border-green-200" },
                  { label: "Patrouilles", key: "patrouilles", style: "bg-[#4A5C2F]/5 text-[#4A5C2F] border-[#4A5C2F]/20" },
                  { label: "Barrages", key: "barrages", style: "bg-blue-50 text-blue-700 border-blue-200" },
                  { label: "Permission", key: "permissionnaires", style: "bg-orange-50 text-orange-700 border-orange-200" },
                  { label: "Repos", key: "repos", style: "bg-gray-50 text-gray-600 border-gray-200" },
                ].map((item) => (
                  <div key={item.key} className={`rounded-xl p-3 border ${item.style}`}>
                    <p className="text-xl font-bold">{totalResume[item.key as keyof typeof totalResume]}</p>
                    <p className="text-xs mt-0.5 opacity-80">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {brigades.map((brigade) => {
                  const brigadeMontage = montages.find((m) => m.brigade_id === brigade.id);
                  const r = brigadeMontage ? computeResume(brigadeMontage.statuts ?? {}) : null;
                  return (
                    <div key={brigade.id} className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#4A5C2F]" fill="none"
                            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                          <span className="font-semibold text-gray-800 text-sm">{brigade.nom}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          brigadeMontage ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                        }`}>
                          {dataLoading ? "…" : brigadeMontage ? "Montage validé" : "Pas de montage"}
                        </span>
                      </div>
                      {r && (
                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                          <span>{r.presents} présents</span>
                          <span>{r.patrouilles} patrouilles</span>
                          <span>{r.barrages} barrages</span>
                          <span>{r.permissionnaires} permissions</span>
                          <span>{r.repos} repos</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Sections à venir ────────────────────────────────────────── */}
          {(vue === "saisies" || vue === "caisse" || vue === "correspondances" || vue === "rapports") && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mb-4 opacity-30" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-sm font-medium capitalize">{vue.replace("-", " ")} — section en cours de développement</p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default function SubdivisionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-400 text-sm">Chargement…</div></div>}>
      <SubdivisionPageContent />
    </Suspense>
  );
}

"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/useUserProfile";
import RegionSidebar from "@/components/RegionSidebar";
import BrigadeSearch from "@/components/BrigadeSearch";
import { STATUT_STYLES, type Statut } from "@/lib/agents";
import { BRIGADES, SUBDIVISIONS, DIRECTIONS_REGIONALES } from "@/lib/roles";

interface MontageData {
  brigade_id: string;
  date: string;
  statuts: Record<string, Statut>;
  statut?: string;
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
    if (s === "Présent") counts.presents++;
    else if (s === "En patrouille") counts.patrouilles++;
    else if (s === "Barrage sur route") counts.barrages++;
    else if (s === "Permissionnaire") counts.permissionnaires++;
    else if (s === "Repos") counts.repos++;
  });
  return counts;
}

function RegionPageContent() {
  const searchParams = useSearchParams();
  const vue = searchParams.get("vue") ?? "dashboard";

  const { profile, loading } = useUserProfile();
  const [montages, setMontages] = useState<MontageData[]>([]);
  const [agentsByMatricule, setAgentsByMatricule] = useState<Record<string, AgentInfo>>({});
  const [allAgents, setAllAgents] = useState<AgentInfo[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [expandedSubdivision, setExpandedSubdivision] = useState<string | null>(null);
  const [expandedBrigade, setExpandedBrigade] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const direction = DIRECTIONS_REGIONALES.find((dr) => dr.id === profile?.directionRegionaleId);
  const subdivisions = SUBDIVISIONS.filter((s) => s.directionRegionaleId === profile?.directionRegionaleId);
  const allBrigades = BRIGADES.filter((b) =>
    subdivisions.some((s) => s.id === b.subdivisionId)
  );

  // ── Fetch agent names from montage matricules ──────────────────────────────
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

  // ── Fetch all agents of this region (for Personnel tab) ───────────────────
  const fetchAllAgents = useCallback(async () => {
    if (allBrigades.length === 0) return;
    const brigadeIds = allBrigades.map((b) => b.id);
    const agents: AgentInfo[] = [];
    for (let i = 0; i < brigadeIds.length; i += 30) {
      const batch = brigadeIds.slice(i, i + 30);
      const { data: rows } = await supabase.from("agents").select("*").in("brigade_id", batch);
      (rows ?? []).forEach((d) => agents.push(d as AgentInfo));
    }
    setAllAgents(agents);
  }, [allBrigades]);

  // ── Fetch today's montages for this region ────────────────────────────────
  const fetchMontages = useCallback(async () => {
    if (!profile?.directionRegionaleId) return;
    setDataLoading(true);
    const { data: montageRows } = await supabase.from("montages").select("*").eq("date", today);
    const data = (montageRows ?? []) as MontageData[];
    // Filter only montages for brigades of this region
    const regionBrigadeIds = new Set(allBrigades.map((b) => b.id));
    const filtered = data.filter((m) => regionBrigadeIds.has(m.brigade_id));
    setMontages(filtered);
    await fetchAgentNames(filtered);
    setDataLoading(false);
  }, [profile, today, fetchAgentNames, allBrigades]);

  useEffect(() => {
    if (!loading) {
      fetchMontages();
      fetchAllAgents();
    }
  }, [loading, fetchMontages, fetchAllAgents]);

  // ── Totaux ────────────────────────────────────────────────────────────────
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#4A5C2F] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const STATUT_ITEMS = [
    { label: "Présents",   key: "presents",        style: "bg-green-50 text-green-700 border-green-200" },
    { label: "Patrouilles", key: "patrouilles",     style: "bg-[#4A5C2F]/5 text-[#4A5C2F] border-[#4A5C2F]/20" },
    { label: "Barrages",   key: "barrages",         style: "bg-blue-50 text-blue-700 border-blue-200" },
    { label: "Permission", key: "permissionnaires", style: "bg-orange-50 text-orange-700 border-orange-200" },
    { label: "Repos",      key: "repos",            style: "bg-gray-50 text-gray-600 border-gray-200" },
  ] as const;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <RegionSidebar />

      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">

        {/* Header */}
        <div className="bg-[#4A5C2F] px-8 py-6 shadow-lg shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#C9A84C] text-xs uppercase tracking-widest mb-1">Directeur Régional</p>
              <h1 className="text-white text-xl font-bold">
                {direction?.nom ?? "Direction Régionale"}
              </h1>
              <p className="text-white/50 text-xs mt-0.5">
                {new Date().toLocaleDateString("fr-SN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-8">

          {/* ── TABLEAU DE BORD ─────────────────────────────────────────── */}
          {vue === "dashboard" && (
            <div className="space-y-8">

              {/* KPI globaux */}
              <div>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Vue d&apos;ensemble — {direction?.nom}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="text-3xl font-bold text-[#4A5C2F]">{subdivisions.length}</p>
                    <p className="text-xs text-gray-500 mt-1">Subdivisions</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="text-3xl font-bold text-[#4A5C2F]">{allBrigades.length}</p>
                    <p className="text-xs text-gray-500 mt-1">Brigades</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="text-3xl font-bold text-[#4A5C2F]">{montages.length}</p>
                    <p className="text-xs text-gray-500 mt-1">Montages aujourd&apos;hui</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="text-3xl font-bold text-green-600">{totalResume.presents}</p>
                    <p className="text-xs text-gray-500 mt-1">Agents présents</p>
                  </div>
                </div>

                {/* Résumé statuts */}
                <div className="grid grid-cols-5 gap-3">
                  {STATUT_ITEMS.map((item) => (
                    <div key={item.key} className={`rounded-xl p-3 border ${item.style}`}>
                      <p className="text-xl font-bold">{totalResume[item.key]}</p>
                      <p className="text-xs mt-0.5 opacity-80">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recherche */}
              <div>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Recherche de brigades
                </h2>
                <BrigadeSearch />
              </div>

              {/* Structure rapide : subdivisions */}
              <div>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Structure de la région
                </h2>
                <div className="space-y-2">
                  {subdivisions.map((sub) => {
                    const subBrigades = allBrigades.filter((b) => b.subdivisionId === sub.id);
                    const montagesOk = subBrigades.filter((b) => montages.find((m) => m.brigade_id === b.id)).length;
                    return (
                      <div key={sub.id} className="bg-white rounded-xl px-5 py-3.5 shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{sub.nom}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{subBrigades.length} brigade{subBrigades.length > 1 ? "s" : ""}</p>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          montagesOk > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                        }`}>
                          {dataLoading ? "…" : `${montagesOk}/${subBrigades.length} montages`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── SUBDIVISIONS ────────────────────────────────────────────── */}
          {vue === "subdivisions" && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Subdivisions ({subdivisions.length})
              </h2>
              <div className="space-y-3">
                {subdivisions.map((subdivision) => {
                  const subBrigades = BRIGADES.filter((b) => b.subdivisionId === subdivision.id);
                  const isExpanded = expandedSubdivision === subdivision.id;
                  return (
                    <div key={subdivision.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      <button
                        onClick={() => setExpandedSubdivision(isExpanded ? null : subdivision.id)}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-purple-600" fill="none"
                              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-gray-800">{subdivision.nom}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{subBrigades.length} brigade{subBrigades.length > 1 ? "s" : ""}</p>
                          </div>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg"
                          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isExpanded && (
                        <div className="border-t border-gray-100 px-6 py-3 space-y-1">
                          {subBrigades.map((b) => {
                            const brigadeMontage = montages.find((m) => m.brigade_id === b.id);
                            return (
                              <div key={b.id} className="flex items-center justify-between py-1.5">
                                <div className="flex items-center gap-2">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-[#4A5C2F]" fill="none"
                                    viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                  </svg>
                                  <span className="text-sm text-gray-700">{b.nom}</span>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  brigadeMontage ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                                }`}>
                                  {dataLoading ? "…" : brigadeMontage ? "Montage OK" : "Pas de montage"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── BRIGADES ────────────────────────────────────────────────── */}
          {vue === "brigades" && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Brigades ({allBrigades.length})
              </h2>
              <div className="space-y-2">
                {subdivisions.map((sub) => {
                  const subBrigades = allBrigades.filter((b) => b.subdivisionId === sub.id);
                  return (
                    <div key={sub.id}>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 mt-4 first:mt-0">
                        {sub.nom}
                      </p>
                      {subBrigades.map((brigade) => {
                        const brigadeMontage = montages.find((m) => m.brigade_id === brigade.id);
                        const isExpanded = expandedBrigade === brigade.id;
                        return (
                          <div key={brigade.id} className="bg-white rounded-xl shadow-sm border border-gray-100 mb-2 overflow-hidden">
                            <button
                              onClick={() => setExpandedBrigade(isExpanded ? null : brigade.id)}
                              className="w-full px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#4A5C2F] shrink-0" fill="none"
                                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                              </svg>
                              <span className="text-sm text-gray-700 font-medium flex-1 text-left">{brigade.nom}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                brigadeMontage ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                              }`}>
                                {dataLoading ? "…" : brigadeMontage ? "Montage OK" : "Pas de montage"}
                              </span>
                              <svg xmlns="http://www.w3.org/2000/svg"
                                className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            {isExpanded && brigadeMontage && (
                              <div className="border-t border-gray-100 px-5 py-3">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-gray-400">
                                      <th className="text-left pb-1.5 font-semibold">Agent</th>
                                      <th className="text-left pb-1.5 font-semibold">Matricule</th>
                                      <th className="text-left pb-1.5 font-semibold">Statut</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-50">
                                    {Object.entries(brigadeMontage.statuts ?? {}).map(([matricule, s]) => {
                                      const info = agentsByMatricule[matricule];
                                      const agentName = info ? `${info.nom} ${info.prenom}`.trim() : matricule;
                                      return (
                                        <tr key={matricule}>
                                          <td className="py-1.5 text-gray-700 font-medium">{agentName}</td>
                                          <td className="py-1.5 font-mono text-gray-400">{matricule}</td>
                                          <td className="py-1.5">
                                            <span className={`px-2 py-0.5 rounded-full font-medium border ${STATUT_STYLES[s as Statut] ?? ""}`}>
                                              {s}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            {isExpanded && !brigadeMontage && (
                              <div className="border-t border-gray-100 px-5 py-3">
                                <p className="text-xs text-gray-400">Aucun montage aujourd&apos;hui.</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── PERSONNEL ────────────────────────────────────────────────── */}
          {vue === "personnel" && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Personnel de la région ({allAgents.length} agents)
              </h2>
              {dataLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-[#4A5C2F] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : allAgents.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">Aucun agent enregistré dans cette région.</p>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
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
                        const brigade = allBrigades.find((b) => b.id === agent.brigadeId);
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
              )}
            </div>
          )}

          {/* ── MONTAGES DU JOUR ────────────────────────────────────────── */}
          {vue === "montages" && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Montages du jour — {today}
              </h2>
              <div className="grid grid-cols-5 gap-3 mb-6">
                {STATUT_ITEMS.map((item) => (
                  <div key={item.key} className={`rounded-xl p-3 border ${item.style}`}>
                    <p className="text-xl font-bold">{totalResume[item.key]}</p>
                    <p className="text-xs mt-0.5 opacity-80">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {subdivisions.map((sub) => {
                  const subBrigades = allBrigades.filter((b) => b.subdivisionId === sub.id);
                  return (
                    <div key={sub.id}>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-4 first:mt-0">
                        {sub.nom}
                      </p>
                      {subBrigades.map((brigade) => {
                        const brigadeMontage = montages.find((m) => m.brigade_id === brigade.id);
                        const r = brigadeMontage ? computeResume(brigadeMontage.statuts ?? {}) : null;
                        return (
                          <div key={brigade.id} className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-3.5 mb-2">
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
                                {dataLoading ? "…" : brigadeMontage ? `Validé · ${brigadeMontage.statut ?? ""}` : "Pas de montage"}
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
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Sections à venir ────────────────────────────────────────── */}
          {(vue === "caisse" || vue === "correspondances" || vue === "saisies" || vue === "rapports") && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mb-4 opacity-30" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-sm font-medium capitalize">{vue} — section en cours de développement</p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default function RegionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-400 text-sm">Chargement…</div></div>}>
      <RegionPageContent />
    </Suspense>
  );
}

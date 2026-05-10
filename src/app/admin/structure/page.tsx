"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { DIRECTIONS_REGIONALES, SUBDIVISIONS as STATIC_SUBDIVISIONS, BRIGADES as STATIC_BRIGADES } from "@/lib/roles";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BrigadeDoc {
  id: string;
  nom: string;
  directionRegionaleId: string;
  subdivisionId: string;
  localite: string;
  chefBrigade: string;
  // snake_case aliases from Supabase
  direction_regionale_id?: string;
  subdivision_id?: string;
  chef_brigade?: string;
}

interface SubdivisionDoc {
  id: string;
  nom: string;
  directionRegionaleId: string;
  localite: string;
  // snake_case alias from Supabase
  direction_regionale_id?: string;
}

const EMPTY_BRIGADE: Omit<BrigadeDoc, "id"> = {
  nom: "", directionRegionaleId: "", subdivisionId: "", localite: "", chefBrigade: "",
};

const EMPTY_SUBDIVISION: Omit<SubdivisionDoc, "id"> = {
  nom: "", directionRegionaleId: "", localite: "",
};

const inputCls = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A5C2F] bg-white";
const labelCls = "block text-xs font-semibold text-gray-700 mb-1.5";

// ── Composant ─────────────────────────────────────────────────────────────────

export default function StructurePage() {
  const [brigades, setBrigades] = useState<BrigadeDoc[]>([]);
  const [subdivisions, setSubdivisions] = useState<SubdivisionDoc[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Tree expansion state
  const [expandedDRs, setExpandedDRs] = useState<Set<string>>(new Set());
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());

  // Brigade form
  const [showBForm, setShowBForm] = useState(false);
  const [editingB, setEditingB] = useState<BrigadeDoc | null>(null);
  const [bForm, setBForm] = useState<Omit<BrigadeDoc, "id">>(EMPTY_BRIGADE);
  const [bSaving, setBSaving] = useState(false);
  const [bError, setBError] = useState("");
  const [confirmDeleteB, setConfirmDeleteB] = useState<string | null>(null);

  // Subdivision form
  const [showSForm, setShowSForm] = useState(false);
  const [editingS, setEditingS] = useState<SubdivisionDoc | null>(null);
  const [sForm, setSForm] = useState<Omit<SubdivisionDoc, "id">>(EMPTY_SUBDIVISION);
  const [sSaving, setSSaving] = useState(false);
  const [sError, setSError] = useState("");
  const [confirmDeleteS, setConfirmDeleteS] = useState<string | null>(null);

  // Import
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string>("");

  // ── Fetches ────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoadingData(true);
    const [bRes, sRes] = await Promise.all([
      supabase.from("brigades").select("*"),
      supabase.from("subdivisions").select("*"),
    ]);
    const bList = ((bRes.data ?? []) as BrigadeDoc[]).map((d) => ({
      ...d,
      directionRegionaleId: d.direction_regionale_id ?? d.directionRegionaleId ?? "",
      subdivisionId: d.subdivision_id ?? d.subdivisionId ?? "",
      chefBrigade: d.chef_brigade ?? d.chefBrigade ?? "",
    }));
    const sList = ((sRes.data ?? []) as SubdivisionDoc[]).map((d) => ({
      ...d,
      directionRegionaleId: d.direction_regionale_id ?? d.directionRegionaleId ?? "",
    }));
    bList.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    sList.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    setBrigades(bList);
    setSubdivisions(sList);
    setLoadingData(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Import officiel ───────────────────────────────────────────────────────

  async function handleImport() {
    setImporting(true);
    setImportResult("");
    try {
      // Subdivisions
      for (const sub of STATIC_SUBDIVISIONS) {
        await supabase.from("subdivisions").upsert({
          id: sub.id,
          nom: sub.nom,
          direction_regionale_id: sub.directionRegionaleId,
          localite: "",
        });
      }
      // Brigades (with their direction_regionale_id derived from subdivision)
      for (const b of STATIC_BRIGADES) {
        const drId = STATIC_SUBDIVISIONS.find((s) => s.id === b.subdivisionId)?.directionRegionaleId ?? "";
        await supabase.from("brigades").upsert({
          id: b.id,
          nom: b.nom,
          subdivision_id: b.subdivisionId,
          direction_regionale_id: drId,
          localite: "",
          chef_brigade: "",
        });
      }
      setImportResult(`✓ Structure importée : ${STATIC_SUBDIVISIONS.length} subdivisions, ${STATIC_BRIGADES.length} brigades.`);
      setShowImportConfirm(false);
      await fetchAll();
    } catch {
      setImportResult("Erreur lors de l'importation. Vérifiez votre connexion.");
    } finally {
      setImporting(false);
    }
  }

  // ── Brigade CRUD ───────────────────────────────────────────────────────────

  function openNewBrigade(drId?: string, subId?: string) {
    setEditingB(null);
    setBForm({ ...EMPTY_BRIGADE, directionRegionaleId: drId ?? "", subdivisionId: subId ?? "" });
    setBError("");
    setShowBForm(true);
  }

  function openEditBrigade(b: BrigadeDoc) {
    setEditingB(b);
    setBForm({ nom: b.nom, directionRegionaleId: b.directionRegionaleId, subdivisionId: b.subdivisionId, localite: b.localite ?? "", chefBrigade: b.chefBrigade ?? "" });
    setBError("");
    setShowBForm(true);
  }

  async function saveBrigade() {
    if (!bForm.nom.trim()) { setBError("Le nom de la brigade est obligatoire."); return; }
    if (!bForm.directionRegionaleId) { setBError("Sélectionnez une Direction Régionale."); return; }
    setBSaving(true);
    try {
      const bPayload = {
        nom: bForm.nom.trim(),
        direction_regionale_id: bForm.directionRegionaleId,
        subdivision_id: bForm.subdivisionId,
        localite: bForm.localite,
        chef_brigade: bForm.chefBrigade,
      };
      if (editingB) {
        await supabase.from("brigades").update(bPayload).eq("id", editingB.id);
      } else {
        await supabase.from("brigades").insert(bPayload);
      }
      setShowBForm(false);
      await fetchAll();
    } catch {
      setBError("Erreur lors de l'enregistrement.");
    } finally {
      setBSaving(false);
    }
  }

  async function deleteBrigade(id: string) {
    await supabase.from("brigades").delete().eq("id", id);
    setBrigades((prev) => prev.filter((b) => b.id !== id));
    setConfirmDeleteB(null);
  }

  // ── Subdivision CRUD ───────────────────────────────────────────────────────

  function openNewSubdivision(drId?: string) {
    setEditingS(null);
    setSForm({ ...EMPTY_SUBDIVISION, directionRegionaleId: drId ?? "" });
    setSError("");
    setShowSForm(true);
  }

  function openEditSubdivision(s: SubdivisionDoc) {
    setEditingS(s);
    setSForm({ nom: s.nom, directionRegionaleId: s.directionRegionaleId, localite: s.localite ?? "" });
    setSError("");
    setShowSForm(true);
  }

  async function saveSubdivision() {
    if (!sForm.nom.trim()) { setSError("Le nom de la subdivision est obligatoire."); return; }
    if (!sForm.directionRegionaleId) { setSError("Sélectionnez une Direction Régionale."); return; }
    setSSaving(true);
    try {
      const sPayload = {
        nom: sForm.nom.trim(),
        direction_regionale_id: sForm.directionRegionaleId,
        localite: sForm.localite,
      };
      if (editingS) {
        await supabase.from("subdivisions").update(sPayload).eq("id", editingS.id);
      } else {
        await supabase.from("subdivisions").insert(sPayload);
      }
      setShowSForm(false);
      await fetchAll();
    } catch {
      setSError("Erreur lors de l'enregistrement.");
    } finally {
      setSSaving(false);
    }
  }

  async function deleteSubdivision(id: string) {
    await supabase.from("subdivisions").delete().eq("id", id);
    setSubdivisions((prev) => prev.filter((s) => s.id !== id));
    setConfirmDeleteS(null);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function toggleDR(id: string) {
    setExpandedDRs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSub(id: string) {
    setExpandedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Subdivisions filtered by directionRegionaleId (for form select)
  const subdivisionsForDR = bForm.directionRegionaleId
    ? subdivisions.filter((s) => s.directionRegionaleId === bForm.directionRegionaleId)
    : subdivisions;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-[#4A5C2F] px-8 py-6 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/utilisateurs"
              className="text-white/50 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-white text-xl font-bold">Structure organisationnelle</h1>
              <p className="text-[#C9A84C] text-xs mt-0.5 uppercase tracking-widest">Administration · DGD Sénégal</p>
            </div>
          </div>
          <button
            onClick={() => setShowImportConfirm(true)}
            className="flex items-center gap-2 bg-[#C9A84C] hover:bg-[#b8943f] text-[#4A5C2F] font-semibold
              px-4 py-2.5 rounded-xl text-sm transition-colors shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Importer la structure officielle
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">

        {/* Résultat import */}
        {importResult && (
          <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium border ${
            importResult.startsWith("✓")
              ? "bg-green-50 text-green-800 border-green-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}>
            {importResult}
          </div>
        )}

        {/* Compteurs */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#4A5C2F] flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#C9A84C]" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-800">{DIRECTIONS_REGIONALES.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Directions Régionales</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-800">{subdivisions.length || STATIC_SUBDIVISIONS.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Subdivisions</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#4A5C2F]/80 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-800">{brigades.length || STATIC_BRIGADES.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Brigades / Postes</p>
            </div>
          </div>
        </div>

        {/* Boutons d'ajout */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
            Arborescence de la structure
          </h2>
          <div className="flex gap-2">
            <button onClick={() => openNewSubdivision()}
              className="flex items-center gap-1.5 border border-blue-200 text-blue-700 hover:bg-blue-50
                font-semibold px-3 py-2 rounded-lg text-xs transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Subdivision
            </button>
            <button onClick={() => openNewBrigade()}
              className="flex items-center gap-1.5 bg-[#4A5C2F] hover:bg-[#3b4a25] text-white
                font-semibold px-3 py-2 rounded-lg text-xs transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Brigade
            </button>
          </div>
        </div>

        {/* Arborescence */}
        {loadingData ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-4 border-[#4A5C2F] border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {DIRECTIONS_REGIONALES.map((dr, drIdx) => {
              const drSubs = subdivisions.filter((s) => s.directionRegionaleId === dr.id);
              const drBrigadesCount = brigades.filter((b) => b.directionRegionaleId === dr.id).length;
              const isDRExpanded = expandedDRs.has(dr.id);

              return (
                <div key={dr.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

                  {/* DR header */}
                  <div className="flex items-center">
                    <button
                      onClick={() => toggleDR(dr.id)}
                      className="flex-1 px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left">
                      <div className="w-9 h-9 rounded-xl bg-[#4A5C2F] flex items-center justify-center shrink-0">
                        <span className="text-[#C9A84C] font-bold text-sm">{drIdx + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 text-sm">{dr.nom}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {drSubs.length} subdivision{drSubs.length > 1 ? "s" : ""} · {drBrigadesCount} brigade{drBrigadesCount > 1 ? "s" : ""}
                        </p>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg"
                        className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isDRExpanded ? "rotate-180" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div className="px-3 flex gap-1 shrink-0">
                      <button
                        onClick={() => openNewSubdivision(dr.id)}
                        title="Ajouter une subdivision"
                        className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors font-medium whitespace-nowrap">
                        + Subdivision
                      </button>
                    </div>
                  </div>

                  {/* Subdivisions */}
                  {isDRExpanded && (
                    <div className="border-t border-gray-100">
                      {drSubs.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-4">Aucune subdivision enregistrée pour cette DR.</p>
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {drSubs.map((sub) => {
                            const subBrigades = brigades.filter((b) => b.subdivisionId === sub.id);
                            const isSubExpanded = expandedSubs.has(sub.id);

                            return (
                              <div key={sub.id}>
                                <div className="flex items-center pl-8">
                                  <button
                                    onClick={() => toggleSub(sub.id)}
                                    className="flex-1 px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
                                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-blue-600" fill="none"
                                        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round"
                                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                                      </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-semibold text-gray-700 text-sm">{sub.nom}</p>
                                      <p className="text-xs text-gray-400 mt-0.5">
                                        {subBrigades.length} brigade{subBrigades.length > 1 ? "s" : ""}
                                        {sub.localite ? ` · ${sub.localite}` : ""}
                                      </p>
                                    </div>
                                    <svg xmlns="http://www.w3.org/2000/svg"
                                      className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${isSubExpanded ? "rotate-180" : ""}`}
                                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                  <div className="px-3 flex items-center gap-1 shrink-0">
                                    <button onClick={() => openNewBrigade(dr.id, sub.id)}
                                      title="Ajouter une brigade"
                                      className="text-xs text-[#4A5C2F] hover:bg-[#4A5C2F]/10 px-2 py-1 rounded-lg transition-colors font-medium whitespace-nowrap">
                                      + Brigade
                                    </button>
                                    <button onClick={() => openEditSubdivision(sub)} title="Modifier"
                                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
                                        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round"
                                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    <button onClick={() => setConfirmDeleteS(sub.id)} title="Supprimer"
                                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
                                        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round"
                                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>

                                {/* Brigades */}
                                {isSubExpanded && (
                                  <div className="pl-16 pr-4 pb-3">
                                    {subBrigades.length === 0 ? (
                                      <p className="text-xs text-gray-400 py-2">Aucune brigade dans cette subdivision.</p>
                                    ) : (
                                      <div className="space-y-1">
                                        {subBrigades.map((b) => (
                                          <div key={b.id}
                                            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 group">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                              <div className="w-6 h-6 rounded bg-[#4A5C2F]/10 flex items-center justify-center shrink-0">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-[#4A5C2F]" fill="none"
                                                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                                </svg>
                                              </div>
                                              <div className="min-w-0">
                                                <p className="text-sm text-gray-700 font-medium truncate">{b.nom}</p>
                                                {b.chefBrigade && (
                                                  <p className="text-xs text-gray-400 truncate">Chef : {b.chefBrigade}</p>
                                                )}
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                              <button onClick={() => openEditBrigade(b)} title="Modifier"
                                                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#4A5C2F] hover:bg-[#4A5C2F]/10 transition-colors">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
                                                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                  <path strokeLinecap="round" strokeLinejoin="round"
                                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                              </button>
                                              <button onClick={() => setConfirmDeleteB(b.id)} title="Supprimer"
                                                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
                                                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                  <path strokeLinecap="round" strokeLinejoin="round"
                                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ════════════ MODAL IMPORT ════════════ */}
      {showImportConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !importing && setShowImportConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-600" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-gray-800">Importer la structure officielle</p>
                <p className="text-sm text-gray-600 mt-1">
                  Cette action va créer ou écraser{" "}
                  <strong>{STATIC_SUBDIVISIONS.length} subdivisions</strong> et{" "}
                  <strong>{STATIC_BRIGADES.length} brigades</strong> dans Firestore
                  avec les IDs officiels de la DGD.
                </p>
                <p className="text-xs text-amber-700 mt-2 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                  Les documents existants avec les mêmes IDs seront écrasés.
                  Les autres données ne seront pas affectées.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowImportConfirm(false)}
                disabled={importing}
                className="px-5 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50">
                Annuler
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-5 py-2 text-sm font-semibold text-[#4A5C2F] bg-[#C9A84C] hover:bg-[#b8943f]
                  rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2">
                {importing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Importation en cours…
                  </>
                ) : "Confirmer l'importation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ MODAL BRIGADE ════════════ */}
      {showBForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowBForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="bg-[#4A5C2F] px-6 py-5 flex items-center justify-between shrink-0">
              <h2 className="text-white font-bold text-base">
                {editingB ? "Modifier la brigade" : "Nouvelle brigade"}
              </h2>
              <button onClick={() => setShowBForm(false)}
                className="text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-6 space-y-4 overflow-y-auto">
              <div>
                <label className={labelCls}>Nom de la brigade *</label>
                <input value={bForm.nom} onChange={(e) => setBForm((p) => ({ ...p, nom: e.target.value }))}
                  placeholder="Brigade commerciale de Karang" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Direction Régionale *</label>
                <select value={bForm.directionRegionaleId}
                  onChange={(e) => setBForm((p) => ({ ...p, directionRegionaleId: e.target.value, subdivisionId: "" }))}
                  className={inputCls}>
                  <option value="">— Sélectionner —</option>
                  {DIRECTIONS_REGIONALES.map((d) => (
                    <option key={d.id} value={d.id}>{d.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Subdivision rattachée</label>
                <select value={bForm.subdivisionId}
                  onChange={(e) => setBForm((p) => ({ ...p, subdivisionId: e.target.value }))}
                  className={inputCls}>
                  <option value="">— Sélectionner —</option>
                  {subdivisionsForDR.map((s) => (
                    <option key={s.id} value={s.id}>{s.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Localité / Ville</label>
                <input value={bForm.localite} onChange={(e) => setBForm((p) => ({ ...p, localite: e.target.value }))}
                  placeholder="Kaolack" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Chef de brigade (optionnel)</label>
                <input value={bForm.chefBrigade} onChange={(e) => setBForm((p) => ({ ...p, chefBrigade: e.target.value }))}
                  placeholder="Prénom NOM" className={inputCls} />
              </div>
              {bError && (
                <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg border border-red-100">{bError}</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowBForm(false)}
                className="px-5 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                Annuler
              </button>
              <button onClick={saveBrigade} disabled={bSaving}
                className="px-6 py-2 text-sm font-semibold text-white bg-[#4A5C2F] hover:bg-[#3b4a25]
                  rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2">
                {bSaving ? (
                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>Enregistrement…</>
                ) : editingB ? "Modifier" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ MODAL SUBDIVISION ════════════ */}
      {showSForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="bg-[#4A5C2F] px-6 py-5 flex items-center justify-between shrink-0">
              <h2 className="text-white font-bold text-base">
                {editingS ? "Modifier la subdivision" : "Nouvelle subdivision"}
              </h2>
              <button onClick={() => setShowSForm(false)}
                className="text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-6 space-y-4 overflow-y-auto">
              <div>
                <label className={labelCls}>Nom de la subdivision *</label>
                <input value={sForm.nom} onChange={(e) => setSForm((p) => ({ ...p, nom: e.target.value }))}
                  placeholder="Subdivision de Kaolack" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Direction Régionale *</label>
                <select value={sForm.directionRegionaleId}
                  onChange={(e) => setSForm((p) => ({ ...p, directionRegionaleId: e.target.value }))}
                  className={inputCls}>
                  <option value="">— Sélectionner —</option>
                  {DIRECTIONS_REGIONALES.map((d) => (
                    <option key={d.id} value={d.id}>{d.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Localité / Ville</label>
                <input value={sForm.localite} onChange={(e) => setSForm((p) => ({ ...p, localite: e.target.value }))}
                  placeholder="Kaolack" className={inputCls} />
              </div>
              {sError && (
                <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg border border-red-100">{sError}</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowSForm(false)}
                className="px-5 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                Annuler
              </button>
              <button onClick={saveSubdivision} disabled={sSaving}
                className="px-6 py-2 text-sm font-semibold text-white bg-[#4A5C2F] hover:bg-[#3b4a25]
                  rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2">
                {sSaving ? (
                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>Enregistrement…</>
                ) : editingS ? "Modifier" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog suppression brigade */}
      {confirmDeleteB && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDeleteB(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-600" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-gray-800">Supprimer cette brigade ?</p>
                <p className="text-xs text-gray-500 mt-0.5">Cette action est irréversible.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteB(null)}
                className="px-5 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Annuler
              </button>
              <button onClick={() => deleteBrigade(confirmDeleteB)}
                className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog suppression subdivision */}
      {confirmDeleteS && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDeleteS(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-600" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-gray-800">Supprimer cette subdivision ?</p>
                <p className="text-xs text-gray-500 mt-0.5">Cette action est irréversible.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteS(null)}
                className="px-5 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Annuler
              </button>
              <button onClick={() => deleteSubdivision(confirmDeleteS)}
                className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

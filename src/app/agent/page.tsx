"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/useUserProfile";
import { STATUTS, STATUT_STYLES, STATUT_DOT, gradeAbbrev, isKnownGrade, type Statut } from "@/lib/agents";
import { BRIGADES } from "@/lib/roles";
import Sidebar from "@/components/Sidebar";

// ── Types ─────────────────────────────────────────────────────────────────────

type StatutSaisie = "En instance" | "Transféré" | "Détruit" | "Vendu";
type Unite = "kg" | "litres" | "cartons" | "pièces" | "tonnes" | "mètres" | "sacs";

const STATUTS_SAISIE: StatutSaisie[] = ["En instance", "Transféré", "Détruit", "Vendu"];
const UNITES: Unite[] = ["kg", "litres", "cartons", "pièces", "tonnes", "mètres", "sacs"];

const STATUT_SAISIE_STYLES: Record<StatutSaisie, string> = {
  "En instance": "bg-orange-100 text-orange-700",
  "Transféré":   "bg-blue-100 text-blue-700",
  "Détruit":     "bg-red-100 text-red-700",
  "Vendu":       "bg-green-100 text-green-700",
};

interface Saisie {
  id: string;
  numero: string;
  date: string;
  heure: string;
  nature: string;
  description: string;
  quantite: string;
  unite: Unite;
  valeur: number;
  lieu: string;
  proprietaire: string;
  numeroPV: string;
  agent: string;
  observations: string;
  statut: StatutSaisie;
  createdBy?: string;
}

interface SaisieForm {
  date: string; heure: string; nature: string; description: string;
  quantite: string; unite: Unite; valeur: string;
  lieu: string; proprietaire: string; numeroPV: string;
  agent: string; observations: string; statut: StatutSaisie;
}

interface BrigadeAgent {
  id: string;
  nom: string;
  prenom: string;
  grade: string;
  matricule: string;
}

const EMPTY_SAISIE_FORM: SaisieForm = {
  date: "", heure: "", nature: "", description: "",
  quantite: "", unite: "kg", valeur: "",
  lieu: "", proprietaire: "", numeroPV: "", agent: "",
  observations: "", statut: "En instance",
};

async function getNextNumero(year: number): Promise<string> {
  const { data } = await supabase
    .from("saisies")
    .select("numero")
    .gte("numero", `SAI-${year}-`)
    .lt("numero", `SAI-${year + 1}-`);
  const nums = (data ?? [])
    .map((d) => parseInt((d.numero as string).split("-")[2] ?? "0", 10))
    .filter(Boolean);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `SAI-${year}-${String(next).padStart(3, "0")}`;
}

// ── Composant ─────────────────────────────────────────────────────────────────

function AgentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading } = useUserProfile();

  // Tab actif : dashboard (défaut), statut, personnel, rapports, saisies
  const rawTab = searchParams.get("tab");
  const activeTab = (rawTab === "statut" || rawTab === "personnel" || rawTab === "rapports" || rawTab === "saisies")
    ? rawTab
    : "dashboard";

  const today = new Date().toISOString().split("T")[0];
  const [brigadeName, setBrigadeName] = useState<string>("");

  // Résolution nom brigade
  useEffect(() => {
    if (!profile?.brigadeId) return;
    const staticBrigade = BRIGADES.find((b) => b.id === profile.brigadeId);
    if (staticBrigade) { setBrigadeName(staticBrigade.nom); return; }
    void supabase.from("brigades").select("nom").eq("id", profile.brigadeId).single()
      .then(({ data }) => { if (data) setBrigadeName(data.nom ?? ""); });
  }, [profile?.brigadeId]);

  // ── Statut du montage ────────────────────────────────────────────────────
  const [statut, setStatut] = useState<Statut | null>(null);
  const [statutLoading, setStatutLoading] = useState(true);
  const [statutSaving, setStatutSaving] = useState(false);
  const [montageId, setMontageId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.matricule) { setStatutLoading(false); return; }
    async function fetchStatut() {
      try {
        // 1. Essai avec filtre brigade_id (cas normal)
        // 2. Fallback sans filtre (si montage créé sans brigade_id ou format différent)
        const { data: allRows } = await supabase
          .from("montages")
          .select("id, statuts, brigade_id")
          .eq("date", today);

        const rows = allRows ?? [];
        // Préférer le montage qui correspond à la brigade de l'agent
        const montage =
          (profile?.brigadeId
            ? rows.find((r) => r.brigade_id === profile.brigadeId)
            : undefined) ?? rows[0];

        if (montage && profile?.matricule) {
          setMontageId(montage.id ?? null);
          const statuts = montage.statuts as Record<string, string> | null;
          const s = statuts?.[profile.matricule] as Statut | undefined;
          if (s) setStatut(s);
        }
      } catch {
        // Erreur silencieuse
      } finally {
        setStatutLoading(false);
      }
    }
    void fetchStatut();
  }, [profile, today]);

  async function handleUpdateStatut(newStatut: Statut) {
    if (!profile?.matricule || !montageId) return;
    setStatutSaving(true);
    try {
      const { data: current } = await supabase
        .from("montages")
        .select("statuts")
        .eq("id", montageId)
        .single();
      // Accès sécurisé au JSONB (peut être null ou tout type JSON)
      const existingStatuts: Record<string, string> =
        current?.statuts && typeof current.statuts === "object" && !Array.isArray(current.statuts)
          ? (current.statuts as Record<string, string>)
          : {};
      const merged = { ...existingStatuts, [profile.matricule]: newStatut };
      const { error: updateErr } = await supabase
        .from("montages")
        .update({ statuts: merged })
        .eq("id", montageId);
      if (!updateErr) setStatut(newStatut);
    } catch {
      // Erreur silencieuse
    } finally {
      setStatutSaving(false);
    }
  }

  // ── Rapports de la brigade (CRUD) ───────────────────────────────────────
  type Rapport = { id: string; date: string; titre: string; contenu: string | null; created_by: string | null };
  const [rapports, setRapports] = useState<Rapport[]>([]);
  const [rapportsLoading, setRapportsLoading] = useState(true);
  const [showRapportForm, setShowRapportForm] = useState(false);
  const [editingRapportId, setEditingRapportId] = useState<string | null>(null);
  const [rapportForm, setRapportForm] = useState({ date: "", titre: "", contenu: "" });
  const [rapportSaving, setRapportSaving] = useState(false);
  const [confirmDeleteRapportId, setConfirmDeleteRapportId] = useState<string | null>(null);

  const fetchRapports = useCallback(async () => {
    try {
      // Utilise l'API route côté serveur (service role) pour contourner la
      // politique RLS "own write" qui bloquerait les rapports des autres agents.
      const res = await fetch("/api/brigade/rapports");
      if (res.ok) {
        const json = await res.json() as { rapports?: Rapport[] };
        setRapports(json.rapports ?? []);
      }
    } catch {
      // Échec silencieux — la liste reste vide
    } finally {
      setRapportsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!profile?.brigadeId) { setRapportsLoading(false); return; }
    void fetchRapports();
  }, [profile?.brigadeId, fetchRapports]);

  function openNewRapport() {
    setRapportForm({ date: new Date().toISOString().split("T")[0], titre: "", contenu: "" });
    setEditingRapportId(null);
    setShowRapportForm(true);
  }

  function openEditRapport(r: Rapport) {
    setRapportForm({ date: r.date, titre: r.titre, contenu: r.contenu ?? "" });
    setEditingRapportId(r.id);
    setShowRapportForm(true);
  }

  async function handleSaveRapport() {
    if (!rapportForm.titre.trim() || !profile?.brigadeId) return;
    setRapportSaving(true);
    try {
      const payload = {
        date: rapportForm.date,
        titre: rapportForm.titre.trim(),
        contenu: rapportForm.contenu.trim() || null,
      };
      if (editingRapportId) {
        await supabase.from("rapports").update(payload).eq("id", editingRapportId);
      } else {
        await supabase
          .from("rapports")
          .insert({ ...payload, brigade_id: profile.brigadeId, created_by: user?.id ?? null });
      }
      // Re-fetch pour afficher les données réelles
      await fetchRapports();
      setShowRapportForm(false);
      setEditingRapportId(null);
    } catch {
      // Erreur silencieuse — l'utilisateur voit le formulaire encore ouvert
    } finally {
      setRapportSaving(false);
    }
  }

  async function handleDeleteRapport(id: string) {
    try {
      await supabase.from("rapports").delete().eq("id", id);
      setRapports((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // Échec silencieux
    }
    setConfirmDeleteRapportId(null);
  }

  // ── Personnel de la brigade ──────────────────────────────────────────────
  const [brigadeAgents, setBrigadeAgents] = useState<BrigadeAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [personnelStatuts, setPersonnelStatuts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!profile?.brigadeId) { setAgentsLoading(false); return; }
    (async () => {
      try {
        const [agentsRes, montageAllRes] = await Promise.all([
          supabase.from("agents").select("*").eq("brigade_id", profile.brigadeId),
          supabase.from("montages").select("statuts, brigade_id").eq("date", today),
        ]);
        const list = ((agentsRes.data ?? []) as BrigadeAgent[]);
        list.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
        setBrigadeAgents(list);
        // Même logique de fallback que pour fetchStatut
        const montageRows = montageAllRes.data ?? [];
        const montage =
          (profile?.brigadeId
            ? montageRows.find((r) => r.brigade_id === profile.brigadeId)
            : undefined) ?? montageRows[0];
        const rawStatuts = montage?.statuts;
        const statuts = (rawStatuts && typeof rawStatuts === "object" && !Array.isArray(rawStatuts))
          ? (rawStatuts as Record<string, string>)
          : {};
        setPersonnelStatuts(statuts);
      } catch {
        // Erreur silencieuse
      } finally {
        setAgentsLoading(false);
      }
    })();
  }, [profile?.brigadeId, today]);

  // ── Saisies ──────────────────────────────────────────────────────────────
  const [saisies, setSaisies]             = useState<Saisie[]>([]);
  const [saisiesLoading, setSaisiesLoading] = useState(true);
  const [showSaisieForm, setShowSaisieForm] = useState(false);
  const [editingSaisieId, setEditingSaisieId] = useState<string | null>(null);
  const [saisieForm, setSaisieForm]       = useState<SaisieForm>(EMPTY_SAISIE_FORM);
  const [saisiesSaving, setSaisiesSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("saisies").select("*");
        const list = (data ?? []).map((d) => ({
          ...d,
          numeroPV: d.numero_pv ?? d.numeroPV ?? "",
          createdBy: d.created_by ?? d.createdBy ?? "",
        })) as Saisie[];
        list.sort((a, b) => b.date.localeCompare(a.date) || b.heure.localeCompare(a.heure));
        setSaisies(list);
      } finally {
        setSaisiesLoading(false);
      }
    })();
  }, []);

  // ── CRUD Saisies ──────────────────────────────────────────────────────────

  function openNewSaisie() {
    const d = new Date();
    setSaisieForm({
      ...EMPTY_SAISIE_FORM,
      date:  d.toISOString().split("T")[0],
      heure: d.toTimeString().slice(0, 5),
      agent: profile ? `${profile.grade ?? ""} ${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() : "",
    });
    setEditingSaisieId(null);
    setShowSaisieForm(true);
  }

  function openEditSaisie(s: Saisie) {
    setSaisieForm({
      date: s.date, heure: s.heure, nature: s.nature, description: s.description,
      quantite: s.quantite, unite: s.unite, valeur: String(s.valeur),
      lieu: s.lieu, proprietaire: s.proprietaire, numeroPV: s.numeroPV,
      agent: s.agent, observations: s.observations, statut: s.statut,
    });
    setEditingSaisieId(s.id);
    setShowSaisieForm(true);
  }

  function closeSaisieForm() { setShowSaisieForm(false); setEditingSaisieId(null); }

  const sf = (k: keyof SaisieForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setSaisieForm((p) => ({ ...p, [k]: e.target.value }));

  async function handleSaveSaisie() {
    if (!saisieForm.nature.trim() || !saisieForm.lieu.trim() || !saisieForm.agent.trim() || !saisieForm.proprietaire.trim()) return;
    setSaisiesSaving(true);
    const payload = {
      date: saisieForm.date, heure: saisieForm.heure,
      nature: saisieForm.nature.trim(), description: saisieForm.description.trim(),
      quantite: saisieForm.quantite.trim(), unite: saisieForm.unite,
      valeur: parseFloat(saisieForm.valeur) || 0,
      lieu: saisieForm.lieu.trim(), proprietaire: saisieForm.proprietaire.trim(),
      numeroPV: saisieForm.numeroPV.trim(), agent: saisieForm.agent.trim(),
      observations: saisieForm.observations.trim(), statut: saisieForm.statut,
    };
    if (editingSaisieId) {
      const { numeroPV: pvNum, ...updateRest } = payload;
      await supabase.from("saisies").update({ ...updateRest, numero_pv: pvNum }).eq("id", editingSaisieId);
      setSaisies((prev) => prev.map((s) => s.id === editingSaisieId ? { ...s, ...payload } : s));
    } else {
      const year = new Date(saisieForm.date).getFullYear();
      const numero = await getNextNumero(year);
      const { numeroPV, ...rest } = payload;
      const { data: newRow } = await supabase
        .from("saisies")
        .insert({ ...rest, numero, numero_pv: numeroPV, created_by: user?.id ?? "" })
        .select()
        .single();
      if (newRow) setSaisies((prev) => [{ id: newRow.id, numero, createdBy: user?.id ?? "", ...payload }, ...prev]);
    }
    closeSaisieForm();
    setSaisiesSaving(false);
  }

  async function handleDeleteSaisie(id: string) {
    await supabase.from("saisies").delete().eq("id", id);
    setSaisies((prev) => prev.filter((s) => s.id !== id));
    setConfirmDeleteId(null);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    document.cookie = "session=; path=/; max-age=0";
    document.cookie = "role=; path=/; max-age=0";
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#4A5C2F] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Calculs dashboard ────────────────────────────────────────────────────
  const mySaisies = saisies.filter((s) => (s.createdBy ?? (s as {created_by?: string}).created_by) === user?.id);
  const othersSaisies = saisies.filter((s) => (s.createdBy ?? (s as {created_by?: string}).created_by) !== user?.id);

  const thisMonth = today.slice(0, 7); // "2026-05"
  const mySaisiesMois = mySaisies.filter((s) => s.date.startsWith(thisMonth));
  const valeurTotaleMois = mySaisiesMois.reduce((sum, s) => sum + (s.valeur || 0), 0);

  const initiales = [profile?.prenom?.[0], profile?.nom?.[0]].filter(Boolean).join("").toUpperCase();
  // Affichage compact en haut à droite : abréviation grade + nom de famille
  const agentLabel = profile
    ? `${gradeAbbrev(profile.grade)} ${profile.nom ?? ""}`.trim()
    : "";

  const inputCls = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A5C2F] bg-white";
  const labelCls = "block text-xs font-semibold text-gray-500 uppercase mb-1";

  // ── Composant Statut ─────────────────────────────────────────────────────
  const StatutContent = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-bold text-gray-800">Mon statut aujourd&apos;hui</h2>
        <p className="text-xs text-gray-400">
          {new Date().toLocaleDateString("fr-SN", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>
      {statutLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-[#4A5C2F] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !profile?.matricule ? (
        <p className="text-sm text-gray-400 text-center py-6">Aucun matricule associé à votre compte.</p>
      ) : (
        <>
          {/* Statut actuel */}
          {statut && (
            <div className={`flex items-center gap-4 px-5 py-4 rounded-2xl border-2 mb-5 ${STATUT_STYLES[statut]}`}>
              <div className="w-3 h-3 rounded-full bg-current opacity-80 shrink-0" />
              <div>
                <p className="font-bold text-base">{statut}</p>
                <p className="text-xs opacity-70 mt-0.5">Votre statut actuel</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 ml-auto opacity-80" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {/* Sélecteur de statut */}
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-3 font-semibold">
            {montageId ? "Modifier mon statut" : "Choisir mon statut"}
          </p>
          {!montageId && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 mb-3">
              Le montage du jour n&apos;a pas encore été créé par le Chef de Brigade. La mise à jour sera disponible dès qu&apos;il sera validé.
            </p>
          )}
          <div className="space-y-2">
            {STATUTS.map((s) => (
              <button
                key={s}
                disabled={!montageId || statutSaving}
                onClick={() => handleUpdateStatut(s)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-all
                  ${statut === s
                    ? STATUT_STYLES[s] + " font-semibold shadow-sm"
                    : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 hover:border-gray-200"}
                  ${(!montageId || statutSaving) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statut === s ? "bg-current opacity-80" : "bg-gray-300"}`} />
                <span className="flex-1">{s}</span>
                {statutSaving && statut !== s ? null : statut === s ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 ml-auto" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : null}
              </button>
            ))}
          </div>
          {statutSaving && (
            <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
              <div className="w-3.5 h-3.5 border-2 border-[#4A5C2F] border-t-transparent rounded-full animate-spin" />
              Mise à jour en cours…
            </div>
          )}

          {/* Statuts de tous les agents de la brigade */}
          {brigadeAgents.length > 0 && (
            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-3 font-semibold">
                Statuts de la brigade — {new Date().toLocaleDateString("fr-SN", { day: "numeric", month: "long" })}
              </p>
              <div className="space-y-2">
                {brigadeAgents.map((a) => {
                  const s = personnelStatuts[a.matricule] as Statut | undefined;
                  const isMe = a.matricule === profile?.matricule;
                  const initA = [a.prenom?.[0], a.nom?.[0]].filter(Boolean).join("").toUpperCase();
                  return (
                    <div key={a.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
                        isMe ? "bg-[#4A5C2F]/5 border-[#4A5C2F]/20" : "bg-gray-50 border-gray-100"
                      }`}>
                      {/* Avatar */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                        isMe ? "bg-[#4A5C2F] text-[#C9A84C]" : "bg-gray-200 text-gray-500"
                      }`}>
                        {initA || "?"}
                      </div>
                      {/* Nom */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {a.prenom} <span className="uppercase">{a.nom}</span>
                          {isMe && <span className="ml-1.5 text-[10px] text-[#4A5C2F] font-bold">(moi)</span>}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate">{a.grade || "—"}</p>
                      </div>
                      {/* Badge statut */}
                      {s ? (
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border shrink-0 ${STATUT_STYLES[s]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUT_DOT[s]}`} />
                          {s}
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400 italic shrink-0">Non défini</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">

        {/* En-tête */}
        <div className="bg-[#4A5C2F] px-8 py-5 shadow-lg shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-white font-bold text-xl leading-tight">
                {brigadeName || "Mon Espace Agent"}
              </h1>
              <p className="text-[#C9A84C] text-xs tracking-widest uppercase mt-0.5">Espace Agent</p>
            </div>
            <div className="flex items-center gap-4">
              {agentLabel && (
                <span className="hidden sm:block text-white/90 font-semibold text-sm">{agentLabel}</span>
              )}
              <button onClick={handleLogout}
                className="text-white/60 hover:text-white text-xs flex items-center gap-1.5 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Déconnexion
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5 max-w-4xl">

          {/* ══════════════════════════════════════════════════════════════
              TABLEAU DE BORD (défaut)
          ══════════════════════════════════════════════════════════════ */}
          {activeTab === "dashboard" && (
            <>
              {/* Carte profil */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-5">
                  {/* Avatar initiales */}
                  <div className="w-16 h-16 rounded-full bg-[#4A5C2F] flex items-center justify-center shrink-0 shadow-md">
                    <span className="text-[#C9A84C] font-bold text-xl">
                      {initiales || "?"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 text-xl leading-tight">
                      {profile?.prenom} {profile?.nom}
                    </p>
                    <p className="text-sm text-[#4A5C2F] font-semibold mt-0.5">
                      {isKnownGrade(profile?.grade) ? profile.grade : "—"}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {profile?.matricule && (
                        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
                          {profile.matricule}
                        </span>
                      )}
                      {brigadeName && (
                        <span className="flex items-center gap-1 text-xs text-[#4A5C2F] bg-[#4A5C2F]/8 px-2.5 py-0.5 rounded-full font-medium">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none"
                            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                          {brigadeName}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Statut compact */}
                  {statut && (
                    <div className={`hidden sm:flex flex-col items-center px-4 py-3 rounded-xl border-2 shrink-0 ${STATUT_STYLES[statut]}`}>
                      <div className="w-2.5 h-2.5 rounded-full bg-current mb-1.5 opacity-80" />
                      <p className="font-bold text-xs text-center leading-tight max-w-[80px]">{statut}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Cartes KPI */}
              <div className="grid grid-cols-2 gap-4">
                {/* Mon statut du jour */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-700 text-sm">Mon Statut du jour</h3>
                    <p className="text-xs text-gray-400">
                      {new Date().toLocaleDateString("fr-SN", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  {statutLoading ? (
                    <div className="flex items-center gap-2 text-gray-400">
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Chargement…</span>
                    </div>
                  ) : statut ? (
                    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border ${STATUT_STYLES[statut]}`}>
                      <div className="w-2 h-2 rounded-full bg-current opacity-80 shrink-0" />
                      <span className="font-bold text-sm">{statut}</span>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Pas encore défini</p>
                  )}
                  <p className="text-xs text-gray-400 mt-3">Défini par le Chef de Brigade</p>
                </div>

                {/* Saisies du mois */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-700 text-sm">Saisies du mois</h3>
                    <span className="text-xs text-gray-400">{new Date().toLocaleDateString("fr-SN", { month: "long", year: "numeric" })}</span>
                  </div>
                  {saisiesLoading ? (
                    <div className="flex items-center gap-2 text-gray-400">
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Chargement…</span>
                    </div>
                  ) : (
                    <>
                      <p className="text-3xl font-bold text-[#4A5C2F]">{mySaisiesMois.length}</p>
                      <p className="text-xs text-gray-400 mt-0.5">saisie{mySaisiesMois.length !== 1 ? "s" : ""} réalisée{mySaisiesMois.length !== 1 ? "s" : ""}</p>
                      {valeurTotaleMois > 0 && (
                        <p className="text-xs font-semibold text-[#4A5C2F] mt-2 bg-[#4A5C2F]/5 px-2 py-1 rounded-lg inline-block">
                          {Number(valeurTotaleMois).toLocaleString("fr-SN")} FCFA
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Activités récentes */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-700 text-sm">Activités récentes</h3>
                  {mySaisies.length > 0 && (
                    <span className="text-xs text-[#4A5C2F] font-medium">{mySaisies.length} saisie{mySaisies.length !== 1 ? "s" : ""} au total</span>
                  )}
                </div>
                {saisiesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-[#4A5C2F] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : mySaisies.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 mb-2 opacity-30" fill="none"
                      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-sm">Aucune activité récente</p>
                    <p className="text-xs mt-1">Vos saisies apparaîtront ici</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {mySaisies.slice(0, 5).map((s) => (
                      <div key={s.id} className="px-6 py-3.5 flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-[#4A5C2F]/10 flex items-center justify-center shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#4A5C2F]" fill="none"
                            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm truncate">{s.nature}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {s.date ? new Date(s.date + "T12:00:00").toLocaleDateString("fr-SN", {
                              day: "numeric", month: "short", year: "numeric"
                            }) : "—"} · {s.lieu}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {s.valeur > 0 && (
                            <span className="text-xs font-semibold text-[#4A5C2F]">
                              {Number(s.valeur).toLocaleString("fr-SN")} F
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_SAISIE_STYLES[s.statut]}`}>
                            {s.statut}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════
              MON STATUT DU JOUR
          ══════════════════════════════════════════════════════════════ */}
          {activeTab === "statut" && <StatutContent />}

          {/* ══════════════════════════════════════════════════════════════
              PERSONNEL
          ══════════════════════════════════════════════════════════════ */}
          {activeTab === "personnel" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-800">Personnel de la brigade</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {brigadeName || "Ma brigade"} · {brigadeAgents.length} agent{brigadeAgents.length !== 1 ? "s" : ""}
                </p>
              </div>
              {agentsLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-[#4A5C2F] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : !profile?.brigadeId ? (
                <div className="px-6 py-8 text-center text-gray-400">
                  <p className="text-sm">Aucune brigade associée à votre compte.</p>
                </div>
              ) : brigadeAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 mb-2 opacity-30" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 100-8 4 4 0 000 8z" />
                  </svg>
                  <p className="text-sm">Aucun agent enregistré</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Matricule</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nom & Prénom</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Grade</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut du jour</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {brigadeAgents.map((a) => {
                      const s = personnelStatuts[a.matricule] as Statut | undefined;
                      return (
                        <tr key={a.id} className={`hover:bg-gray-50 transition-colors ${a.matricule === profile?.matricule ? "bg-[#4A5C2F]/5" : ""}`}>
                          <td className="px-5 py-3 font-mono text-xs text-gray-500">
                            {a.matricule}
                            {a.matricule === profile?.matricule && (
                              <span className="ml-1.5 text-[10px] text-[#4A5C2F] font-bold">(moi)</span>
                            )}
                          </td>
                          <td className="px-5 py-3 font-semibold text-gray-800">{a.prenom} <span className="uppercase">{a.nom}</span></td>
                          <td className="px-5 py-3 text-gray-500 text-xs hidden sm:table-cell">{a.grade || "—"}</td>
                          <td className="px-5 py-3">
                            {s ? (
                              <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${STATUT_STYLES[s]}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUT_DOT[s]}`} />
                                {s}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Non défini</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              RAPPORTS
          ══════════════════════════════════════════════════════════════ */}
          {activeTab === "rapports" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <h2 className="font-bold text-gray-800">Rapports de la brigade</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {brigadeName || "Ma brigade"} · {rapports.length} rapport{rapports.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button onClick={openNewRapport}
                  className="flex items-center gap-1.5 bg-[#4A5C2F] hover:bg-[#3b4a25] text-white
                    font-semibold px-4 py-2 rounded-xl text-sm transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Nouveau rapport
                </button>
              </div>

              {/* Formulaire création / édition */}
              {showRapportForm && (
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50">
                  <h3 className="font-semibold text-gray-700 mb-4 text-sm">
                    {editingRapportId ? "Modifier le rapport" : "Nouveau rapport"}
                  </h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Date</label>
                        <input type="date" value={rapportForm.date}
                          onChange={(e) => setRapportForm((p) => ({ ...p, date: e.target.value }))}
                          className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Titre *</label>
                        <input value={rapportForm.titre}
                          onChange={(e) => setRapportForm((p) => ({ ...p, titre: e.target.value }))}
                          placeholder="Ex : Rapport d'activité journalier" className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Contenu / Observations</label>
                      <textarea value={rapportForm.contenu}
                        onChange={(e) => setRapportForm((p) => ({ ...p, contenu: e.target.value }))}
                        placeholder="Décrivez les activités, incidents ou observations du jour…"
                        rows={4} className={inputCls + " resize-none"} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-4">
                    <button onClick={() => { setShowRapportForm(false); setEditingRapportId(null); }}
                      className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">
                      Annuler
                    </button>
                    <button onClick={handleSaveRapport}
                      disabled={rapportSaving || !rapportForm.titre.trim()}
                      className="px-5 py-2 text-sm font-semibold text-white bg-[#4A5C2F] hover:bg-[#3b4a25]
                        rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {rapportSaving ? "Enregistrement…" : editingRapportId ? "Mettre à jour" : "Enregistrer"}
                    </button>
                  </div>
                </div>
              )}

              {rapportsLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-[#4A5C2F] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : !profile?.brigadeId ? (
                <div className="px-6 py-8 text-center text-gray-400">
                  <p className="text-sm">Aucune brigade associée à votre compte.</p>
                </div>
              ) : rapports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 mb-2 opacity-30" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm">Aucun rapport disponible</p>
                  <p className="text-xs mt-1">Cliquez sur « Nouveau rapport » pour commencer</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {rapports.map((r) => {
                    const isOwner = !r.created_by || r.created_by === user?.id;
                    const dateStr = r.date
                      ? new Date(r.date + "T12:00:00").toLocaleDateString("fr-SN", {
                          weekday: "long", day: "numeric", month: "long", year: "numeric"
                        })
                      : "—";
                    return (
                      <div key={r.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#4A5C2F]/10 flex items-center justify-center shrink-0 mt-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#4A5C2F]" fill="none"
                              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-sm">{r.titre}</p>
                            <p className="text-xs text-gray-400 mt-0.5 capitalize">{dateStr}</p>
                            {r.contenu && (
                              <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{r.contenu}</p>
                            )}
                            {isOwner && (
                              <span className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium bg-[#4A5C2F]/10 text-[#4A5C2F]">
                                Mon rapport
                              </span>
                            )}
                          </div>
                          {isOwner && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => openEditRapport(r)} title="Modifier"
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg
                                  text-gray-400 hover:text-[#4A5C2F] hover:bg-[#4A5C2F]/10 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button onClick={() => setConfirmDeleteRapportId(r.id)} title="Supprimer"
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg
                                  text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {!rapportsLoading && rapports.some((r) => r.created_by !== user?.id) && (
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
                  <p className="text-xs text-gray-400 flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
                      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Vous pouvez uniquement modifier et supprimer vos propres rapports (marqués « Mon rapport »)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              SAISIES ET RÈGLEMENTS
          ══════════════════════════════════════════════════════════════ */}
          {activeTab === "saisies" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <h2 className="font-bold text-gray-800">Saisies et Règlement</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {saisies.length} saisie{saisies.length !== 1 ? "s" : ""} au total
                    {mySaisies.length > 0 && ` · ${mySaisies.length} de vous`}
                  </p>
                </div>
                <button onClick={openNewSaisie}
                  className="flex items-center gap-1.5 bg-[#4A5C2F] hover:bg-[#3b4a25] text-white
                    font-semibold px-4 py-2 rounded-xl text-sm transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Nouvelle saisie
                </button>
              </div>

              {showSaisieForm && (
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50">
                  <h3 className="font-semibold text-gray-700 mb-4 text-sm">
                    {editingSaisieId ? "Modifier la saisie" : "Nouvelle saisie"}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Date</label>
                      <input type="date" value={saisieForm.date} onChange={sf("date")} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Heure</label>
                      <input type="time" value={saisieForm.heure} onChange={sf("heure")} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>N° Procès-Verbal</label>
                      <input value={saisieForm.numeroPV} onChange={sf("numeroPV")} placeholder="PV-2026-001" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Statut</label>
                      <select value={saisieForm.statut} onChange={sf("statut")} className={inputCls}>
                        {STATUTS_SAISIE.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Nature de la marchandise *</label>
                      <input value={saisieForm.nature} onChange={sf("nature")} placeholder="Ex : Carburant, Cigarettes…" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Quantité</label>
                      <input value={saisieForm.quantite} onChange={sf("quantite")} placeholder="Ex : 500" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Unité</label>
                      <select value={saisieForm.unite} onChange={sf("unite")} className={inputCls}>
                        {UNITES.map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Valeur estimée (FCFA)</label>
                      <input type="number" value={saisieForm.valeur} onChange={sf("valeur")} placeholder="0" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Lieu / Zone *</label>
                      <input value={saisieForm.lieu} onChange={sf("lieu")} placeholder="Ex : Axe RN1…" className={inputCls} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Propriétaire / Contrevenant *</label>
                      <input value={saisieForm.proprietaire} onChange={sf("proprietaire")} placeholder="Nom complet" className={inputCls} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Agent verbalisateur *</label>
                      <input value={saisieForm.agent} onChange={sf("agent")} placeholder="Nom et prénom" className={inputCls} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Description</label>
                      <textarea value={saisieForm.description} onChange={sf("description")}
                        placeholder="Description des marchandises…" rows={2}
                        className={inputCls + " resize-none"} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Observations</label>
                      <textarea value={saisieForm.observations} onChange={sf("observations")}
                        placeholder="Observations complémentaires…" rows={2}
                        className={inputCls + " resize-none"} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-4">
                    <button onClick={closeSaisieForm}
                      className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">
                      Annuler
                    </button>
                    <button onClick={handleSaveSaisie}
                      disabled={saisiesSaving || !saisieForm.nature.trim() || !saisieForm.lieu.trim() || !saisieForm.agent.trim() || !saisieForm.proprietaire.trim()}
                      className="px-5 py-2 text-sm font-semibold text-white bg-[#4A5C2F] hover:bg-[#3b4a25]
                        rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {saisiesSaving ? "Enregistrement…" : editingSaisieId ? "Mettre à jour" : "Enregistrer"}
                    </button>
                  </div>
                </div>
              )}

              {saisiesLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-[#4A5C2F] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : saisies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 mb-2 opacity-30" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <p className="text-sm">Aucune saisie enregistrée</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {saisies.map((s) => {
                    const createdBy = s.createdBy ?? (s as {created_by?: string}).created_by;
                    const isOwner = !createdBy || createdBy === user?.id;
                    return (
                      <div key={s.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-mono text-xs font-bold text-[#4A5C2F] bg-[#4A5C2F]/5 px-2 py-0.5 rounded">
                                {s.numero}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_SAISIE_STYLES[s.statut]}`}>
                                {s.statut}
                              </span>
                              {isOwner && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#4A5C2F]/10 text-[#4A5C2F]">
                                  Ma saisie
                                </span>
                              )}
                            </div>
                            <p className="font-semibold text-gray-800 text-sm">{s.nature}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {s.quantite} {s.unite}
                              {s.valeur > 0 && ` · ${Number(s.valeur).toLocaleString("fr-SN")} FCFA`}
                              {" · "}{s.lieu}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {s.date ? new Date(s.date + "T12:00:00").toLocaleDateString("fr-SN", {
                                day: "numeric", month: "short", year: "numeric"
                              }) : "—"} à {s.heure}
                              {" · "}{s.agent}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {isOwner ? (
                              <button onClick={() => openEditSaisie(s)} title="Modifier"
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg
                                  text-gray-400 hover:text-[#4A5C2F] hover:bg-[#4A5C2F]/10 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            ) : (
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-200 cursor-not-allowed">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </span>
                            )}
                            {isOwner && (
                              <button onClick={() => setConfirmDeleteId(s.id)} title="Supprimer"
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg
                                  text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!saisiesLoading && othersSaisies.length > 0 && (
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
                  <p className="text-xs text-gray-400 flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
                      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Vous pouvez uniquement modifier et supprimer vos propres saisies (marquées &quot;Ma saisie&quot;)
                  </p>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-xs text-gray-400 pb-4">DGD Sénégal © {new Date().getFullYear()}</p>
        </div>
      </main>

      {/* Dialog suppression rapport */}
      {confirmDeleteRapportId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDeleteRapportId(null)} />
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
                <p className="font-bold text-gray-800">Supprimer ce rapport ?</p>
                <p className="text-xs text-gray-500 mt-0.5">Cette action est irréversible.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteRapportId(null)}
                className="px-5 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Annuler
              </button>
              <button onClick={() => handleDeleteRapport(confirmDeleteRapportId)}
                className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog suppression saisie */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)} />
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
                <p className="font-bold text-gray-800">Supprimer cette saisie ?</p>
                <p className="text-xs text-gray-500 mt-0.5">Cette action est irréversible.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteId(null)}
                className="px-5 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Annuler
              </button>
              <button onClick={() => handleDeleteSaisie(confirmDeleteId)}
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

export default function AgentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-400 text-sm">Chargement…</div></div>}>
      <AgentPageContent />
    </Suspense>
  );
}

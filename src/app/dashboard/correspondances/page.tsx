"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/useUserProfile";
import Sidebar from "@/components/Sidebar";
import ReadOnlyBanner from "@/components/ReadOnlyBanner";
import { useRole } from "@/lib/useRole";
import CourrierModal, {
  type Courrier, type TypeCourrier, type StatutCourrier,
  STATUTS_ARRIVEE, STATUTS_DEPART,
} from "@/components/CourrierModal";

// ── Styles statut ─────────────────────────────────────────────────────────────
const STATUT_STYLES: Record<StatutCourrier, string> = {
  "En attente":       "bg-amber-100 text-amber-700 border-amber-200",
  "En cours":         "bg-blue-100 text-blue-700 border-blue-200",
  "Traité":           "bg-green-100 text-green-700 border-green-200",
  "Envoyé":           "bg-green-100 text-green-700 border-green-200",
  "En attente d'envoi": "bg-amber-100 text-amber-700 border-amber-200",
};


// ── Numéro automatique ────────────────────────────────────────────────────────
function buildNextNumero(courriers: Courrier[], type: TypeCourrier): string {
  const year   = new Date().getFullYear();
  const prefix = type === "arrivee" ? "ARR" : "DEP";
  const existing = courriers
    .filter((c) => c.type === type && c.numero.startsWith(`${prefix}-${year}`))
    .map((c) => parseInt(c.numero.split("-")[2] ?? "0", 10))
    .filter((n) => !isNaN(n));
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `${prefix}-${year}-${String(next).padStart(3, "0")}`;
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function CorrespondancesPage() {
  const { user, loading } = useUserProfile();
  const { isReadOnly } = useRole();
  const router = useRouter();

  const [onglet,        setOnglet]        = useState<TypeCourrier>("arrivee");
  const [courriers,     setCourriers]     = useState<Courrier[]>([]);
  const [loadingData,   setLoadingData]   = useState(true);
  const [search,        setSearch]        = useState("");
  const [filterStatut,  setFilterStatut]  = useState<StatutCourrier | "Tous">("Tous");
  const [updatingId,    setUpdatingId]    = useState<string | null>(null);

  // Modal
  const [modalType,       setModalType]       = useState<TypeCourrier | null>(null);
  const [editingCourrier, setEditingCourrier] = useState<Courrier | undefined>(undefined);

  // Suppression
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting,        setDeleting]        = useState(false);

  const todayLabel = new Date().toLocaleDateString("fr-SN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  // Charger depuis Supabase
  const fetchCourriers = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const { data } = await supabase
        .from("correspondances")
        .select("*")
        .order("date", { ascending: false });
      setCourriers((data ?? []) as Courrier[]);
    } catch {
      // Supabase non accessible
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => { fetchCourriers(); }, [fetchCourriers]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function openNew(type: TypeCourrier) {
    setEditingCourrier(undefined);
    setModalType(type);
  }

  function openEdit(c: Courrier) {
    setEditingCourrier(c);
    setModalType(c.type);
  }

  function closeModal() {
    setModalType(null);
    setEditingCourrier(undefined);
  }

  function handleSaved(c: Courrier) {
    setCourriers((prev) => [c, ...prev.filter((x) => x.id !== c.id)]);
  }

  function handleUpdated(c: Courrier) {
    setCourriers((prev) => prev.map((x) => x.id === c.id ? c : x));
  }

  async function handleChangeStatut(courrier: Courrier, newStatut: StatutCourrier) {
    if (!courrier.id) return;
    setUpdatingId(courrier.id);
    try {
      await supabase.from("correspondances").update({ statut: newStatut }).eq("id", courrier.id);
      setCourriers((prev) => prev.map((c) => c.id === courrier.id ? { ...c, statut: newStatut } : c));
    } catch { /* silencieux */ }
    finally { setUpdatingId(null); }
  }

  function handlePrint() {
    const win = window.open("", "_blank");
    if (!win) return;
    const all = [...courriers].sort((a, b) => b.date.localeCompare(a.date));
    const rows = all.map((c) => `
      <tr class="${c.urgence === "Urgent" ? "urgent" : ""}">
        <td class="mono">${c.numero}</td>
        <td>${c.type === "arrivee" ? "Arrivée" : "Départ"}</td>
        <td>${new Date(c.date + "T12:00:00").toLocaleDateString("fr-SN", { day: "numeric", month: "short", year: "numeric" })}</td>
        <td>${c.interlocuteur}${c.structure ? " / " + c.structure : ""}</td>
        <td>${c.objet}</td>
        <td>${c.urgence}</td>
        <td>${c.statut}</td>
      </tr>`).join("");
    win.document.write(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<title>Registre des correspondances</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #333; padding: 24px; }
  h1 { color: #4A5C2F; margin: 0 0 4px; font-size: 20px; }
  .subtitle { color: #888; font-size: 11px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #4A5C2F; color: white; padding: 7px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  .mono { font-family: monospace; font-size: 10px; white-space: nowrap; }
  .urgent { background: #fff5f5; }
  @media print { @page { margin: 1.5cm; size: landscape; } }
</style></head><body>
<h1>Registre des Correspondances</h1>
<p class="subtitle">${new Date().toLocaleDateString("fr-SN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} — ${all.length} courrier(s)</p>
<table>
  <thead><tr><th>N°</th><th>Type</th><th>Date</th><th>Interlocuteur</th><th>Objet</th><th>Urgence</th><th>Statut</th></tr></thead>
  <tbody>${rows.length ? rows : "<tr><td colspan='7' style='text-align:center;color:#aaa;padding:24px'>Aucun courrier</td></tr>"}</tbody>
</table>
</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await supabase.from("correspondances").delete().eq("id", id);
      setCourriers((prev) => prev.filter((c) => c.id !== id));
    } catch { /* silencieux */ }
    finally { setDeleting(false); setConfirmDeleteId(null); }
  }

  // ── Filtrage ──────────────────────────────────────────────────────────────

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 rounded-full border-4 border-[#4A5C2F] border-t-transparent animate-spin" />
      </div>
    );
  }

  const courriersFiltres = courriers.filter((c) => {
    if (c.type !== onglet) return false;
    if (filterStatut !== "Tous" && c.statut !== filterStatut) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.numero.toLowerCase().includes(q) ||
        c.interlocuteur.toLowerCase().includes(q) ||
        (c.structure ?? "").toLowerCase().includes(q) ||
        c.objet.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const arriveeCount  = courriers.filter((c) => c.type === "arrivee").length;
  const departCount   = courriers.filter((c) => c.type === "depart").length;
  const urgentsCount  = courriers.filter((c) => c.urgence === "Urgent" && c.statut !== "Traité" && c.statut !== "Envoyé").length;
  const enAttenteCount= courriers.filter((c) => c.statut === "En attente" || c.statut === "En attente d'envoi").length;

  const nextNumero = buildNextNumero(courriers, onglet);
  const statutOptions = onglet === "arrivee" ? STATUTS_ARRIVEE : STATUTS_DEPART;
  const allStatuts: (StatutCourrier | "Tous")[] = ["Tous", ...STATUTS_ARRIVEE, ...STATUTS_DEPART];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shadow-sm shrink-0">
          <div>
            <h1 className="text-lg font-bold text-[#4A5C2F]">Correspondances</h1>
            <p className="text-xs text-gray-400 capitalize mt-0.5">{todayLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimer
            </button>
          {!isReadOnly && (
            <div className="flex gap-3">
              {/* Bouton Arrivée */}
              <button onClick={() => openNew("arrivee")}
                className="flex items-center gap-2 bg-[#4A5C2F] hover:bg-[#3b4a25] text-white
                  text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Courrier arrivée
              </button>
              {/* Bouton Départ */}
              <button onClick={() => openNew("depart")}
                className="flex items-center gap-2 bg-[#C9A84C] hover:bg-[#b8963e] text-white
                  text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Courrier départ
              </button>
            </div>
          )}
          </div>
        </header>
        {isReadOnly && <ReadOnlyBanner />}

        <main className="flex-1 overflow-y-auto px-8 py-8 space-y-6">

          {/* Cartes statistiques */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              {
                label: "Courriers arrivée", value: arriveeCount,
                icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
                color: "text-[#4A5C2F]", bg: "bg-[#4A5C2F]/10", bar: "bg-[#4A5C2F]",
              },
              {
                label: "Courriers départ", value: departCount,
                icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
                color: "text-[#C9A84C]", bg: "bg-[#C9A84C]/15", bar: "bg-[#C9A84C]",
              },
              {
                label: "En attente", value: enAttenteCount,
                icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                color: "text-amber-600", bg: "bg-amber-50", bar: "bg-amber-400",
              },
              {
                label: "Urgents non traités", value: urgentsCount,
                icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>,
                color: "text-red-600", bg: "bg-red-50", bar: "bg-red-500",
              },
            ].map((s) => (
              <div key={s.label}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className={`h-1 ${s.bar}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider leading-tight">{s.label}</p>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.bg} ${s.color}`}>{s.icon}</div>
                  </div>
                  <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Alerte urgents */}
          {urgentsCount > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-600 shrink-0" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-sm text-red-700 font-medium">
                {urgentsCount} courrier{urgentsCount > 1 ? "s" : ""} urgent{urgentsCount > 1 ? "s" : ""} en attente de traitement
              </p>
            </div>
          )}

          {/* Onglets + Tableau */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

            {/* Onglets */}
            <div className="flex border-b border-gray-100">
              {([
                { key: "arrivee", label: "Arrivée", count: arriveeCount },
                { key: "depart",  label: "Départ",  count: departCount  },
              ] as { key: TypeCourrier; label: string; count: number }[]).map((tab) => (
                <button key={tab.key}
                  onClick={() => { setOnglet(tab.key); setFilterStatut("Tous"); setSearch(""); }}
                  className={`flex items-center gap-2.5 px-7 py-4 text-sm font-semibold border-b-2 transition-all
                    ${onglet === tab.key
                      ? "border-[#4A5C2F] text-[#4A5C2F]"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}>
                  {tab.key === "arrivee" ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                  {tab.label}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                    ${onglet === tab.key ? "bg-[#4A5C2F] text-white" : "bg-gray-100 text-gray-500"}`}>
                    {tab.count}
                  </span>
                </button>
              ))}

              {/* Recherche + Filtre */}
              <div className="flex items-center gap-3 ml-auto px-5 py-2">
                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
                  </svg>
                  <input type="text" placeholder="Rechercher…" value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-44
                      focus:outline-none focus:ring-2 focus:ring-[#4A5C2F] focus:border-transparent
                      placeholder-gray-400 text-gray-800" />
                </div>
                <select value={filterStatut}
                  onChange={(e) => setFilterStatut(e.target.value as StatutCourrier | "Tous")}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5
                    focus:outline-none focus:ring-2 focus:ring-[#4A5C2F] text-gray-700 bg-white">
                  {allStatuts.map((s) => (
                    <option key={s} value={s}>{s === "Tous" ? "Tous statuts" : s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tableau */}
            <div className="overflow-x-auto">
              {loadingData ? (
                <div className="py-16 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border-4 border-[#4A5C2F] border-t-transparent animate-spin" />
                </div>
              ) : courriersFiltres.length === 0 ? (
                <div className="py-16 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-400 text-sm">Aucun courrier trouvé</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">N°</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {onglet === "arrivee" ? "Expéditeur" : "Destinataire"}
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Objet</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Urgence</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {courriersFiltres.map((courrier) => (
                      <tr key={courrier.id}
                        className={`hover:bg-gray-50 transition-colors
                          ${courrier.urgence === "Urgent" && courrier.statut !== "Traité" && courrier.statut !== "Envoyé"
                            ? "bg-red-50/40" : ""}`}>

                        {/* Numéro */}
                        <td className="px-5 py-3.5">
                          <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            {courrier.numero}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap text-xs">
                          {new Date(courrier.date + "T12:00:00").toLocaleDateString("fr-SN", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </td>

                        {/* Expéditeur / Destinataire */}
                        <td className="px-5 py-3.5 max-w-[160px]">
                          <p className="font-medium text-gray-800 truncate">{courrier.interlocuteur}</p>
                          {courrier.structure && (
                            <p className="text-xs text-gray-400 truncate">{courrier.structure}</p>
                          )}
                        </td>

                        {/* Objet */}
                        <td className="px-5 py-3.5 text-gray-600 max-w-xs">
                          <p className="truncate">{courrier.objet}</p>
                        </td>

                        {/* Urgence */}
                        <td className="px-5 py-3.5">
                          {courrier.urgence === "Urgent" ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold
                              px-2.5 py-1 rounded-full bg-red-600 text-white">
                              <span className="w-1.5 h-1.5 rounded-full bg-white" />
                              Urgent
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium
                              px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                              Normal
                            </span>
                          )}
                        </td>

                        {/* Statut */}
                        <td className="px-5 py-3.5">
                          {isReadOnly ? (
                            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${STATUT_STYLES[courrier.statut]}`}>
                              {courrier.statut}
                            </span>
                          ) : updatingId === courrier.id ? (
                            <div className="w-5 h-5 rounded-full border-2 border-[#4A5C2F] border-t-transparent animate-spin" />
                          ) : (
                            <select
                              value={courrier.statut}
                              onChange={(e) => handleChangeStatut(courrier, e.target.value as StatutCourrier)}
                              className={`text-xs font-semibold px-3 py-1.5 rounded-full border cursor-pointer
                                focus:outline-none focus:ring-2 focus:ring-[#4A5C2F] appearance-none
                                ${STATUT_STYLES[courrier.statut]}`}>
                              {statutOptions.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          )}
                        </td>

                        {/* Actions */}
                        {!isReadOnly && (
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            {/* Modifier */}
                            <button onClick={() => openEdit(courrier)} title="Modifier"
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg
                                text-gray-400 hover:text-[#4A5C2F] hover:bg-[#4A5C2F]/10 transition-colors mr-0.5">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            {/* Supprimer */}
                            <button onClick={() => setConfirmDeleteId(courrier.id ?? null)} title="Supprimer"
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg
                                text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        )}
                        {isReadOnly && <td />}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer tableau */}
            {courriersFiltres.length > 0 && (
              <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {courriersFiltres.length} courrier{courriersFiltres.length > 1 ? "s" : ""}
                  {filterStatut !== "Tous" && ` · ${filterStatut}`}
                </p>
                <p className="text-xs text-gray-400">
                  Prochain numéro : <span className="font-mono font-semibold text-[#4A5C2F]">{nextNumero}</span>
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modal création / édition */}
      {modalType && (
        <CourrierModal
          type={modalType}
          nextNumero={nextNumero}
          editingCourrier={editingCourrier}
          onClose={closeModal}
          onSaved={handleSaved}
          onUpdated={handleUpdated}
        />
      )}

      {/* Dialog confirmation suppression */}
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
                <p className="font-bold text-gray-800">Supprimer ce courrier ?</p>
                <p className="text-xs text-gray-500 mt-0.5">Cette action est irréversible.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteId(null)}
                className="px-5 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Annuler
              </button>
              <button onClick={() => handleDelete(confirmDeleteId)} disabled={deleting}
                className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-60">
                {deleting ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

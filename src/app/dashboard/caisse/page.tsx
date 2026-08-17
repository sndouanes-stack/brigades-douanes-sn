"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/useUserProfile";
import Sidebar from "@/components/Sidebar";
import TransactionModal, { type Transaction, type TypeTransaction } from "@/components/TransactionModal";
import ReadOnlyBanner from "@/components/ReadOnlyBanner";
import { useRole } from "@/lib/useRole";
import { BRIGADES, SUBDIVISIONS, DIRECTIONS_REGIONALES, getBrigadesByDirection } from "@/lib/roles";

// ── Utilitaires ───────────────────────────────────────────────────────────────
function formatFCFA(n: number) {
  return new Intl.NumberFormat("fr-SN", { maximumFractionDigits: 0 }).format(n);
}


// ── Composant principal ───────────────────────────────────────────────────────
export default function CaissePage() {
  const { user, profile, loading } = useUserProfile();
  const { isReadOnly } = useRole();
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [modal, setModal] = useState<TypeTransaction | null>(null);
  const [filter, setFilter] = useState<"tous" | "recette" | "depense">("tous");

  const today = new Date().toISOString().split("T")[0];
  const todayLabel = new Date().toLocaleDateString("fr-SN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // Filtre de période historique
  const [datePeriod, setDatePeriod] = useState<"all" | "today" | "month" | "custom">("all");
  const [selectedCustomDate, setSelectedCustomDate] = useState<string>(today);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  // Charger les transactions depuis Supabase
  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    setLoadingTx(true);
    try {
      let query = supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (profile?.role === "CHEF_SUBDIVISION" && profile?.subdivisionId) {
        const subdivBrigadeIds = BRIGADES.filter((b) => b.subdivisionId === profile.subdivisionId).map((b) => b.id);
        if (subdivBrigadeIds.length > 0) {
          query = query.in("brigade_id", subdivBrigadeIds);
        }
      } else if (profile?.role === "DIRECTEUR_REGIONAL" && profile?.directionRegionaleId) {
        const regionBrigadeIds = getBrigadesByDirection(profile.directionRegionaleId).map((b) => b.id);
        if (regionBrigadeIds.length > 0) {
          query = query.in("brigade_id", regionBrigadeIds);
        }
      } else if (profile?.brigadeId && profile?.role !== "ADMIN") {
        query = query.eq("brigade_id", profile.brigadeId);
      }

      const { data, error } = await query;
      if (error) console.error("fetchTransactions error:", error);

      setTransactions((data ?? []).map((d) => ({
        ...d,
        motif: (d as Record<string, unknown>).libelle as string ?? (d as Record<string, unknown>).motif as string ?? "",
      })) as Transaction[]);
    } catch {
      // Supabase non accessible
    } finally {
      setLoadingTx(false);
    }
  }, [user, profile]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  function handleSaved(tx: Transaction) {
    setTransactions((prev) => [tx, ...prev.filter((t) => t.id !== tx.id)]);
  }

  // Filtrage par période historique
  const filteredByDate = useMemo(() => {
    if (datePeriod === "today") {
      return transactions.filter((t) => t.date === today);
    }
    if (datePeriod === "month") {
      const currentMonth = today.slice(0, 7);
      return transactions.filter((t) => (t.date ?? "").startsWith(currentMonth));
    }
    if (datePeriod === "custom") {
      return transactions.filter((t) => t.date === selectedCustomDate);
    }
    // 'all' : historique complet
    return transactions;
  }, [transactions, datePeriod, selectedCustomDate, today]);

  const periodLabel = useMemo(() => {
    if (datePeriod === "today") return `du jour (${todayLabel})`;
    if (datePeriod === "month") return "de ce mois-ci";
    if (datePeriod === "custom") {
      return `du ${new Date(selectedCustomDate).toLocaleDateString("fr-SN", { day: "numeric", month: "long", year: "numeric" })}`;
    }
    return "historique complet (toutes les dates)";
  }, [datePeriod, selectedCustomDate, todayLabel]);

  function handlePrint() {
    const logoUrl = window.location.origin + "/images/logo-douanes.png";

    // Résoudre les noms depuis le profil
    const brigadeName = profile?.brigadeId
      ? (BRIGADES.find((b) => b.id === profile.brigadeId)?.nom ?? profile.brigadeId)
      : "Brigade des Douanes";
    const subdivName = profile?.subdivisionId
      ? (SUBDIVISIONS.find((s) => s.id === profile.subdivisionId)?.nom ?? "")
      : "";
    const drName = profile?.directionRegionaleId
      ? (DIRECTIONS_REGIONALES.find((d) => d.id === profile.directionRegionaleId)?.nom ?? "")
      : "";
    const chefName = profile ? `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() : "";

    const FLAG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="48" viewBox="0 0 90 60">
      <rect x="0"  y="0" width="30" height="60" fill="#00853F"/>
      <rect x="30" y="0" width="30" height="60" fill="#FDEF42"/>
      <rect x="60" y="0" width="30" height="60" fill="#E31B23"/>
      <polygon points="45,20 47.4,26.8 54.5,26.9 48.8,31.2 50.9,38.1 45,34 39.1,38.1 41.2,31.2 35.5,26.9 42.6,26.8" fill="#00853F"/>
    </svg>`;

    const CSS = `
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:"Times New Roman",serif; font-size:11pt; color:#111; background:#fff; padding:18mm 15mm; }
      .header { margin-bottom:14px; }
      .header-top { display:flex; align-items:center; gap:16px; margin-bottom:10px; }
      .logo { width:70px; height:70px; object-fit:contain; flex-shrink:0; }
      .header-text { flex:1; text-align:center; }
      .flag-wrap { display:flex; justify-content:center; margin-bottom:6px; }
      .republic  { font-size:10pt; font-weight:bold; letter-spacing:.5px; }
      .ministry  { font-size:9pt; color:#444; margin-top:2px; }
      .service   { font-size:13pt; font-weight:bold; color:#4A5C2F; margin-top:4px; }
      .direction { font-size:9.5pt; color:#4A5C2F; font-weight:bold; margin-top:3px; }
      .brigade   { font-size:10pt; color:#555; margin-top:2px; }
      .divider   { border-top:2px solid #4A5C2F; }
      .report-title { text-align:center; margin:14px 0 6px; }
      .report-title h1 { font-size:14pt; font-weight:bold; text-transform:uppercase; letter-spacing:1.5px; color:#4A5C2F; }
      .report-title .period { font-size:10pt; color:#444; margin-top:4px; }
      table { width:100%; border-collapse:collapse; font-size:9pt; margin-top:16px; }
      thead tr { background:#4A5C2F; color:#fff; }
      thead th { padding:7px 9px; text-align:left; font-weight:bold; }
      tbody tr:nth-child(even){ background:#f8f8f4; }
      tbody td { padding:6px 9px; border-bottom:1px solid #e5e5e5; }
      tfoot td { font-weight:bold; background:#f0f4ea; border-top:2px solid #4A5C2F; padding:7px 9px; }
      .recette { color:#16a34a; }
      .depense { color:#dc2626; }
      .right { text-align:right; }
      .footer { margin-top:32px; display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid #ddd; padding-top:12px; }
      .footer-note { font-size:8pt; color:#888; }
      .signature { text-align:center; }
      .sig-line { border-top:1px solid #333; width:180px; margin:36px auto 6px; }
      .sig-title { font-size:9pt; font-weight:bold; }
      .sig-sub { font-size:8pt; color:#666; margin-top:2px; }
      @media print { @page { margin: 1.5cm; } }`;

    const rows = filteredByDate.map((tx) => `
      <tr>
        <td class="${tx.type === "recette" ? "recette" : "depense"}">${tx.type === "recette" ? "Recette" : "Dépense"}</td>
        <td>${tx.motif}</td>
        <td>${new Date(tx.date).toLocaleDateString("fr-SN", { day: "numeric", month: "short", year: "numeric" })}</td>
        <td class="right ${tx.type === "recette" ? "recette" : "depense"}">${tx.type === "recette" ? "+" : "−"} ${formatFCFA(tx.montant)} FCFA</td>
      </tr>`).join("");

    const printRecettes = filteredByDate.filter((t) => t.type === "recette").reduce((s, t) => s + t.montant, 0);
    const printDepenses  = filteredByDate.filter((t) => t.type === "depense").reduce((s, t) => s + t.montant, 0);
    const printSolde     = printRecettes - printDepenses;

    const win = window.open("", "_blank", "width=960,height=720");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<title>Rapport de Caisse — ${periodLabel}</title>
<style>${CSS}</style></head><body>
  <div class="header">
    <div class="header-top">
      <img src="${logoUrl}" alt="Logo Douanes" class="logo" />
      <div class="header-text">
        <div class="flag-wrap">${FLAG_SVG}</div>
        <p class="republic">REPUBLIQUE DU SENEGAL</p>
        <p class="ministry">Ministère des Finances et du Budget</p>
        <p class="service">DIRECTION GÉNÉRALE DES DOUANES</p>
        ${drName ? `<p class="direction">${drName}</p>` : ""}
        ${subdivName ? `<p class="brigade">${subdivName}</p>` : ""}
        <p class="brigade">${brigadeName}</p>
      </div>
    </div>
    <div class="divider"></div>
  </div>
  <div class="report-title">
    <h1>Rapport de Caisse</h1>
    <p class="period">Période : ${periodLabel}</p>
  </div>
  <table>
    <thead><tr><th>Type</th><th>Motif</th><th>Date</th><th class="right">Montant</th></tr></thead>
    <tbody>${rows.length ? rows : "<tr><td colspan='4' style='text-align:center;color:#aaa;padding:16px;font-style:italic'>Aucune transaction</td></tr>"}</tbody>
    <tfoot>
      <tr><td colspan="3">Total recettes</td><td class="right recette">+ ${formatFCFA(printRecettes)} FCFA</td></tr>
      <tr><td colspan="3">Total dépenses</td><td class="right depense">− ${formatFCFA(printDepenses)} FCFA</td></tr>
      <tr><td colspan="3"><strong>Solde net</strong></td><td class="right"><strong>${printSolde >= 0 ? "+" : ""}${formatFCFA(printSolde)} FCFA</strong></td></tr>
    </tfoot>
  </table>
  <div class="footer">
    <div class="footer-note">
      <p>Document généré le ${new Date().toLocaleDateString("fr-SN")} à ${new Date().toLocaleTimeString("fr-SN", { hour: "2-digit", minute: "2-digit" })}</p>
    </div>
    <div class="signature">
      <div class="sig-line"></div>
      <p class="sig-title">Le Chef de Brigade</p>
      ${chefName ? `<p class="sig-sub">${chefName}</p>` : `<p class="sig-sub">Signature et cachet</p>`}
    </div>
  </div>
</body></html>`);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 rounded-full border-4 border-[#4A5C2F] border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── Calculs ──
  const totalRecettes = filteredByDate.filter((t) => t.type === "recette").reduce((s, t) => s + t.montant, 0);
  const totalDepenses  = filteredByDate.filter((t) => t.type === "depense").reduce((s, t) => s + t.montant, 0);
  const soldeNet       = totalRecettes - totalDepenses;

  const txFiltrees = filter === "tous"
    ? filteredByDate
    : filteredByDate.filter((t) => t.type === filter);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shadow-sm shrink-0">
          <div>
            <h1 className="text-lg font-bold text-[#4A5C2F]">Caisse</h1>
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
              <button
                onClick={() => setModal("recette")}
                className="flex items-center gap-2 bg-[#4A5C2F] hover:bg-[#3b4a25] text-white
                  text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nouvelle recette
              </button>
              <button
                onClick={() => setModal("depense")}
                className="flex items-center gap-2 bg-white hover:bg-red-50 text-red-600
                  border border-red-200 hover:border-red-300
                  text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                </svg>
                Nouvelle dépense
              </button>
            </div>
          )}
          </div>
        </header>
        {isReadOnly && <ReadOnlyBanner />}

        <main className="flex-1 overflow-y-auto px-8 py-8 space-y-6">

          {/* Barre de sélection de la période d'historique */}
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#4A5C2F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Filtre Historique :</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                {([
                  { key: "all", label: "Toutes les dates" },
                  { key: "today", label: "Aujourd'hui" },
                  { key: "month", label: "Ce mois" },
                  { key: "custom", label: "Date précise" },
                ] as const).map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setDatePeriod(p.key)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      datePeriod === p.key
                        ? "bg-[#4A5C2F] text-white shadow-xs"
                        : "text-gray-600 hover:text-[#4A5C2F] hover:bg-gray-200/60"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {datePeriod === "custom" && (
                <input
                  type="date"
                  value={selectedCustomDate}
                  onChange={(e) => setSelectedCustomDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#4A5C2F]"
                />
              )}
            </div>
          </div>

          {/* Solde principal */}
          <div className="bg-[#4A5C2F] rounded-2xl p-8 shadow-lg relative overflow-hidden">
            {/* Cercles décoratifs */}
            <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
            <div className="absolute -bottom-16 -right-4 w-64 h-64 rounded-full bg-white/5" />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-[#C9A84C] flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                    viewBox="0 0 24 24" stroke="#4A5C2F" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <p className="text-white/70 text-sm font-medium">Solde net — {periodLabel}</p>
              </div>

              <p className={`text-5xl font-bold tracking-tight mb-1 ${soldeNet >= 0 ? "text-white" : "text-red-300"}`}>
                {formatFCFA(soldeNet)}
                <span className="text-2xl font-normal text-white/60 ml-2">FCFA</span>
              </p>
              <p className="text-white/50 text-xs mt-2">
                Basé sur {filteredByDate.length} transaction{filteredByDate.length > 1 ? "s" : ""} ({periodLabel})
              </p>
            </div>
          </div>

          {/* 3 cartes récap */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Recettes */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total recettes</p>
                <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-600" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-green-600">{formatFCFA(totalRecettes)}</p>
              <p className="text-xs text-gray-400 mt-1">FCFA encaissés</p>
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                {filteredByDate.filter((t) => t.type === "recette").length} opération(s)
              </div>
            </div>

            {/* Dépenses */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total dépenses</p>
                <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-500" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-red-600">{formatFCFA(totalDepenses)}</p>
              <p className="text-xs text-gray-400 mt-1">FCFA décaissés</p>
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                {filteredByDate.filter((t) => t.type === "depense").length} opération(s)
              </div>
            </div>

            {/* Solde */}
            <div className={`rounded-2xl border shadow-sm p-5 hover:shadow-md transition-shadow
              ${soldeNet >= 0 ? "bg-[#4A5C2F]/5 border-[#4A5C2F]/20" : "bg-red-50 border-red-200"}`}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Solde net</p>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center
                  ${soldeNet >= 0 ? "bg-[#C9A84C]/20" : "bg-red-100"}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${soldeNet >= 0 ? "text-[#C9A84C]" : "text-red-500"}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <p className={`text-2xl font-bold ${soldeNet >= 0 ? "text-[#4A5C2F]" : "text-red-600"}`}>
                {soldeNet >= 0 ? "+" : ""}{formatFCFA(soldeNet)}
              </p>
              <p className="text-xs text-gray-400 mt-1">FCFA net ({periodLabel})</p>
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                {filteredByDate.length} transaction(s) au total
              </div>
            </div>
          </div>

          {/* Tableau des transactions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div>
                <h3 className="font-bold text-gray-800">Historique des opérations</h3>
                <p className="text-xs text-gray-400 mt-0.5 capitalize">Affichage {periodLabel}</p>
              </div>
              {/* Filtres */}
              <div className="flex gap-1.5 bg-gray-100 p-1 rounded-xl">
                {(["tous", "recette", "depense"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all
                      ${filter === f
                        ? "bg-white text-gray-800 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"}`}>
                    {f === "tous" ? "Tout" : f === "recette" ? "Recettes" : "Dépenses"}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              {loadingTx ? (
                <div className="py-16 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border-4 border-[#4A5C2F] border-t-transparent animate-spin" />
                </div>
              ) : txFiltrees.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">
                  Aucune transaction
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Brigade</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Motif</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Date</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {txFiltrees.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full
                            ${tx.type === "recette"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none"
                              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d={tx.type === "recette" ? "M7 11l5-5m0 0l5 5m-5-5v12" : "M17 13l-5 5m0 0l-5-5m5 5V6"} />
                            </svg>
                            {tx.type === "recette" ? "Recette" : "Dépense"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-[#4A5C2F] whitespace-nowrap">
                          {BRIGADES.find((b) => b.id === tx.brigade_id)?.nom || tx.brigade_id || "—"}
                        </td>
                        <td className="px-6 py-4 text-gray-700 max-w-xs truncate">{tx.motif}</td>
                        <td className="px-6 py-4 text-gray-500 font-medium whitespace-nowrap">
                          {new Date(tx.date).toLocaleDateString("fr-SN", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`font-bold ${tx.type === "recette" ? "text-green-600" : "text-red-600"}`}>
                            {tx.type === "recette" ? "+" : "−"} {formatFCFA(tx.montant)}
                          </span>
                          <span className="text-xs text-gray-400 ml-1">FCFA</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Ligne de total */}
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-sm font-bold text-gray-700">
                        {filter === "tous" && `Solde net (${periodLabel})`}
                        {filter === "recette" && `Total recettes (${periodLabel})`}
                        {filter === "depense" && `Total dépenses (${periodLabel})`}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`text-base font-bold
                          ${filter === "depense" ? "text-red-600"
                          : filter === "recette" ? "text-green-600"
                          : soldeNet >= 0 ? "text-[#4A5C2F]" : "text-red-600"}`}>
                          {filter === "tous" && `${soldeNet >= 0 ? "+" : ""}${formatFCFA(soldeNet)}`}
                          {filter === "recette" && `+${formatFCFA(totalRecettes)}`}
                          {filter === "depense" && `−${formatFCFA(totalDepenses)}`}
                        </span>
                        <span className="text-xs text-gray-400 ml-1">FCFA</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>

        </main>
      </div>

      {/* Modal */}
      {modal && (
        <TransactionModal
          type={modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

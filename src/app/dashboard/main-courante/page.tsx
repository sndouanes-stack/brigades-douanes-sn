"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import ReadOnlyBanner from "@/components/ReadOnlyBanner";
import { useRole } from "@/lib/useRole";
import { BRIGADES, SUBDIVISIONS, DIRECTIONS_REGIONALES } from "@/lib/roles";

type Nature = "Incident" | "Contrôle" | "Saisie" | "Interpellation" | "Autre";

interface Evenement {
  id: string;
  heure: string;
  nature: Nature;
  description: string;
  lieu: string;
  agent: string;
  date: string;
}

const NATURES: Nature[] = ["Incident", "Contrôle", "Saisie", "Interpellation", "Autre"];

export default function MainCourantePage() {
  const { isReadOnly, profile } = useRole();
  const today = new Date().toISOString().split("T")[0];

  const [events, setEvents] = useState<Evenement[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Champs du formulaire
  const [heure, setHeure] = useState("");
  const [nature, setNature] = useState<Nature>("Contrôle");
  const [description, setDescription] = useState("");
  const [lieu, setLieu] = useState("");
  const [agent, setAgent] = useState("");

  // Charge les événements du jour
  const loadEvents = useCallback(async () => {
    const { data } = await supabase
      .from("main_courante")
      .select("*")
      .eq("date", today);
    const list = (data ?? []) as Evenement[];
    list.sort((a, b) => a.heure.localeCompare(b.heure));
    setEvents(list);
  }, [today]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  function openNew() {
    const d = new Date();
    setHeure(d.toTimeString().slice(0, 5));
    setNature("Contrôle");
    setDescription("");
    setLieu("");
    setAgent("");
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(ev: Evenement) {
    setHeure(ev.heure);
    setNature(ev.nature);
    setDescription(ev.description);
    setLieu(ev.lieu);
    setAgent(ev.agent);
    setEditingId(ev.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  async function handleSave() {
    if (!description.trim() || !lieu.trim() || !agent.trim()) return;
    setSaving(true);
    const payload = { heure, nature, description: description.trim(), lieu: lieu.trim(), agent: agent.trim() };

    if (editingId) {
      await supabase.from("main_courante").update(payload).eq("id", editingId);
    } else {
      await supabase.from("main_courante").insert({ ...payload, date: today });
    }
    // Re-fetch pour afficher les données réelles (évite les pb RLS sur select après insert)
    await loadEvents();
    closeForm();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from("main_courante").delete().eq("id", id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setConfirmDeleteId(null);
  }

  function handlePrint() {
    const win = window.open("", "_blank", "width=960,height=720");
    if (!win) return;

    const logoUrl = window.location.origin + "/images/logo-douanes.png";

    const brigadeName = profile?.brigadeId
      ? (BRIGADES.find((b) => b.id === profile.brigadeId)?.nom ?? profile.brigadeId)
      : "Brigade des Douanes";
    const subdivName = profile?.subdivisionId
      ? (SUBDIVISIONS.find((s) => s.id === profile.subdivisionId)?.nom ?? "")
      : "";
    const drName = profile?.directionRegionaleId
      ? (DIRECTIONS_REGIONALES.find((d) => d.id === profile.directionRegionaleId)?.nom ?? "")
      : "";

    const dateLabel = new Date().toLocaleDateString("fr-SN", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    const rows = events.map((ev) => `
      <tr>
        <td class="mono">${ev.heure}</td>
        <td><span class="badge">${ev.nature}</span></td>
        <td>${ev.lieu}</td>
        <td>${ev.description}</td>
        <td>${ev.agent}</td>
      </tr>`).join("");

    win.document.write(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<title>Main Courante — ${today}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:"Times New Roman",serif;font-size:11pt;color:#111;padding:14mm 16mm;}
  .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
  .logo{width:65px;height:65px;object-fit:contain;}
  .hc{text-align:center;flex:1;padding:0 10px;}
  .republic{font-size:9.5pt;font-weight:bold;letter-spacing:.5px;}
  .motto{font-size:8pt;color:#555;margin:1px 0;}
  .ministry{font-size:8.5pt;font-weight:bold;margin-top:3px;}
  .dgd{font-size:10.5pt;font-weight:bold;color:#4A5C2F;margin-top:2px;}
  .dod{font-size:9pt;color:#4A5C2F;margin-top:1px;}
  .bar-gold{border-top:3px solid #C9A84C;margin:5px 0;}
  .bar-green{border-top:2px solid #4A5C2F;margin:3px 0;}
  .hier{background:#f5f7f0;border:1px solid #d4dcc4;padding:5px 10px;font-size:8.5pt;
    display:flex;justify-content:space-between;align-items:center;margin:5px 0;}
  .title-block{text-align:center;margin:10px 0 12px;}
  .doc-title{font-size:14pt;font-weight:bold;text-transform:uppercase;color:#4A5C2F;letter-spacing:1.5px;}
  .doc-date{font-size:10pt;color:#555;margin-top:4px;font-style:italic;}
  .doc-count{font-size:9pt;color:#888;margin-top:3px;}
  table{width:100%;border-collapse:collapse;}
  thead tr{background:#4A5C2F;color:#fff;}
  th{padding:7px 9px;text-align:left;font-size:9pt;text-transform:uppercase;letter-spacing:.05em;}
  tbody tr:nth-child(even){background:#f8f8f4;}
  td{padding:6px 9px;border-bottom:1px solid #eee;font-size:10pt;vertical-align:top;}
  .mono{font-family:monospace;font-weight:bold;color:#4A5C2F;white-space:nowrap;font-size:10pt;}
  .badge{background:#f5e9c8;color:#8B6914;border-radius:20px;padding:2px 9px;font-size:9pt;white-space:nowrap;border:1px solid #C9A84C55;}
  .footer{margin-top:28px;display:flex;justify-content:space-between;align-items:flex-end;
    border-top:1px solid #ddd;padding-top:10px;}
  .footer-note{font-size:8pt;color:#888;}
  .sign-block{text-align:center;}
  .sig-line{border-top:1px solid #333;width:180px;margin:34px auto 5px;}
  .sig-title{font-size:9pt;font-weight:bold;}
  .sig-sub{font-size:8pt;color:#666;margin-top:2px;}
  @media print{@page{margin:1.5cm;} body{padding:8mm 12mm;}}
</style></head><body>

<div class="header">
  <img src="${logoUrl}" class="logo" alt="Logo DGD"/>
  <div class="hc">
    <p class="republic">REPUBLIQUE DU SENEGAL</p>
    <p class="motto">Un Peuple — Un But — Une Foi</p>
    <p class="ministry">MINISTERE DES FINANCES ET DU BUDGET</p>
    <p class="dgd">DIRECTION GENERALE DES DOUANES</p>
    <p class="dod">Direction des Opérations Douanières</p>
  </div>
  <img src="${logoUrl}" class="logo" alt="Logo DGD"/>
</div>

<div class="bar-gold"></div>

<div class="hier">
  <span style="color:#444;">
    ${drName || "Direction Régionale"}
    ${subdivName ? " &rsaquo; " + subdivName : ""}
    ${brigadeName ? " &rsaquo; " + brigadeName : ""}
  </span>
  <span style="font-size:8pt;color:#888;">Douanes du Sénégal</span>
</div>

<div class="bar-green"></div>

<div class="title-block">
  <p class="doc-title">Journal de Main Courante</p>
  <p class="doc-date">${dateLabel}</p>
  <p class="doc-count">${events.length} événement(s) enregistré(s)</p>
</div>

<table>
  <thead><tr><th>Heure</th><th>Nature</th><th>Lieu</th><th>Description</th><th>Agent</th></tr></thead>
  <tbody>${rows.length ? rows : "<tr><td colspan='5' style='text-align:center;color:#aaa;padding:24px;font-style:italic'>Aucun événement enregistré</td></tr>"}</tbody>
</table>

<div class="footer">
  <div class="footer-note">
    <p>Imprimé le ${new Date().toLocaleDateString("fr-SN")} à ${new Date().toLocaleTimeString("fr-SN", { hour: "2-digit", minute: "2-digit" })}</p>
    <p style="margin-top:2px;">Document officiel — ${brigadeName}</p>
  </div>
  <div class="sign-block">
    <div class="sig-line"></div>
    <p class="sig-title">Le Chef de Brigade</p>
    <p class="sig-sub">Signature et Cachet</p>
  </div>
</div>

</body></html>`);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {isReadOnly && <ReadOnlyBanner />}

        <div className="flex-1 px-8 py-8 overflow-y-auto">

        {/* En-tête */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#4A5C2F]">Main Courante</h1>
            <p className="text-sm text-gray-400 mt-1">
              {new Date().toLocaleDateString("fr-SN", {
                weekday: "long", day: "numeric", month: "long", year: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimer
            </button>
            {!isReadOnly && (
              <button
                onClick={openNew}
                className="flex items-center gap-2 bg-[#4A5C2F] hover:bg-[#3b4a25] text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nouvel événement
              </button>
            )}
          </div>
        </div>

        {/* Formulaire création / modification */}
        {showForm && !isReadOnly && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <h2 className="font-bold text-gray-800 mb-5">
              {editingId ? "Modifier l'événement" : "Nouvel événement"}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Heure</label>
                <input
                  type="time"
                  value={heure}
                  onChange={(e) => setHeure(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A5C2F]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Nature</label>
                <select
                  value={nature}
                  onChange={(e) => setNature(e.target.value as Nature)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4A5C2F]"
                >
                  {NATURES.map((n) => <option key={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Lieu / Zone</label>
                <input
                  value={lieu}
                  onChange={(e) => setLieu(e.target.value)}
                  placeholder="Ex : Axe VDN, Port de Dakar…"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A5C2F]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Agent rapporteur</label>
                <input
                  value={agent}
                  onChange={(e) => setAgent(e.target.value)}
                  placeholder="Nom et prénom"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A5C2F]"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez l'événement…"
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#4A5C2F]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={closeForm}
                className="px-5 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !description.trim() || !lieu.trim() || !agent.trim()}
                className="px-6 py-2 text-sm font-semibold text-white bg-[#4A5C2F] hover:bg-[#3b4a25] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Enregistrement…" : editingId ? "Mettre à jour" : "Enregistrer"}
              </button>
            </div>
          </div>
        )}

        {/* Tableau */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mb-3 opacity-30" fill="none"
                viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm">Aucun événement enregistré aujourd&apos;hui</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Heure</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nature</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lieu</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-sm font-semibold text-[#4A5C2F]">{ev.heure}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-[#C9A84C]/15 text-[#8B6914] border border-[#C9A84C]/30">
                        {ev.nature}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{ev.lieu}</td>
                    <td className="px-5 py-3.5 text-gray-500 max-w-xs truncate">{ev.description}</td>
                    <td className="px-5 py-3.5 text-gray-600">{ev.agent}</td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      {!isReadOnly && (
                        <>
                          {/* Modifier */}
                          <button
                            onClick={() => openEdit(ev)}
                            title="Modifier"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-[#4A5C2F] hover:bg-[#4A5C2F]/10 transition-colors mr-1"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {/* Supprimer */}
                          <button
                            onClick={() => setConfirmDeleteId(ev.id)}
                            title="Supprimer"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        </div>{/* end px-8 py-8 */}
      </div>{/* end flex-1 flex-col */}

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
                <p className="font-bold text-gray-800">Supprimer cet événement ?</p>
                <p className="text-xs text-gray-500 mt-0.5">Cette action est irréversible.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-5 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/useUserProfile";
import { BRIGADES, DIRECTIONS_REGIONALES } from "@/lib/roles";
import Sidebar from "@/components/Sidebar";
import ReadOnlyBanner from "@/components/ReadOnlyBanner";
import { useRole } from "@/lib/useRole";

// ── Types Firestore ───────────────────────────────────────────────────────────

interface Montage {
  date: string;
  resume: { presents: number; patrouilles: number; barrages: number; permissionnaires: number; repos: number };
  statut: string;
  saisiPar?: string;
  saisi_par?: string;
}

interface Transaction {
  date: string;
  type: "recette" | "depense";
  montant: number;
  motif: string;
}

interface Evenement {
  date: string;
  heure: string;
  nature: string;
  description: string;
  lieu: string;
  agent: string;
}

interface Correspondance {
  date: string;
  type: "arrivee" | "depart";
  objet: string;
  interlocuteur?: string;
  structure?: string;
  numero?: string;
  urgence?: "Urgent" | "Normal";
  statut?: string;
}

interface Quittance {
  date: string;
  numero: string;
  nom: string;
  prenom: string;
  nature: string;
  montant: number;
  referenceAC?: string;
  brigade?: string;
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("fr-SN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("fr-SN", {
    month: "long", year: "numeric",
  });
}

function formatMontant(n: number) {
  return n.toLocaleString("fr-SN") + " FCFA";
}

// Drapeau SVG du Sénégal : 3 bandes verticales (vert, or, rouge) + étoile verte à 5 branches
const SENEGAL_FLAG_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="72" height="48" viewBox="0 0 90 60">
  <rect x="0"  y="0" width="30" height="60" fill="#00853F"/>
  <rect x="30" y="0" width="30" height="60" fill="#FDEF42"/>
  <rect x="60" y="0" width="30" height="60" fill="#E31B23"/>
  <polygon points="45,20 47.4,26.8 54.5,26.9 48.8,31.2 50.9,38.1 45,34 39.1,38.1 41.2,31.2 35.5,26.9 42.6,26.8" fill="#00853F"/>
</svg>`;

function buildHeader(brigadeName: string, logoUrl: string, directionRegionale?: string) {
  return `
  <div class="header">
    <div class="header-top">
      <img src="${logoUrl}" alt="Logo Douanes" class="logo" />
      <div class="header-text">
        <div class="flag-wrap">${SENEGAL_FLAG_SVG}</div>
        <p class="republic">REPUBLIQUE DU SENEGAL</p>
        <p class="ministry">Ministère des Finances et du Budget</p>
        <p class="service">DIRECTION GÉNÉRALE DES DOUANES</p>
        ${directionRegionale ? `<p class="direction-regionale">${directionRegionale}</p>` : ""}
        <p class="brigade">${brigadeName}</p>
      </div>
    </div>
    <div class="divider"></div>
  </div>`;
}

const FOOTER_HTML = `
  <div class="footer">
    <div class="footer-left">
      <p class="footer-note">Document généré le ${new Date().toLocaleDateString("fr-SN")} à ${new Date().toLocaleTimeString("fr-SN", { hour: "2-digit", minute: "2-digit" })}</p>
    </div>
    <div class="signature">
      <div class="sig-line"></div>
      <p class="sig-title">Le Chef de Brigade</p>
      <p class="sig-sub">Signature et cachet</p>
    </div>
  </div>`;

const BASE_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:"Times New Roman",serif; font-size:11pt; color:#111; background:#fff; padding:18mm 15mm; }
  .header { margin-bottom:16px; }
  .header-top { display:flex; align-items:center; gap:16px; margin-bottom:10px; }
  .logo { width:70px; height:70px; object-fit:contain; flex-shrink:0; }
  .header-text { flex:1; text-align:center; }
  .flag-wrap { display:flex; justify-content:center; margin-bottom:6px; }
  .republic  { font-size:10pt; font-weight:bold; letter-spacing:.5px; }
  .ministry  { font-size:9pt; color:#444; margin-top:2px; }
  .service   { font-size:13pt; font-weight:bold; color:#4A5C2F; margin-top:4px; }
  .direction-regionale { font-size:9.5pt; color:#4A5C2F; font-weight:bold; margin-top:3px; }
  .brigade   { font-size:10pt; color:#555; margin-top:2px; }
  .divider   { border-top:2px solid #4A5C2F; margin:0; }
  .report-title { text-align:center; margin:14px 0 4px; }
  .report-title h1 { font-size:14pt; font-weight:bold; text-transform:uppercase; letter-spacing:1.5px; color:#4A5C2F; }
  .report-title .period { font-size:10pt; color:#444; margin-top:4px; }
  .section { margin:18px 0 10px; }
  .section-title { font-size:11pt; font-weight:bold; color:#4A5C2F; border-bottom:1px solid #C9A84C; padding-bottom:4px; margin-bottom:8px; text-transform:uppercase; letter-spacing:.5px; }
  table { width:100%; border-collapse:collapse; font-size:9pt; margin-top:6px; }
  thead tr { background:#4A5C2F; color:#fff; }
  thead th { padding:6px 8px; text-align:left; font-weight:bold; }
  tbody tr:nth-child(even){background:#f8f8f4;}
  tbody td { padding:5px 8px; border-bottom:1px solid #e5e5e5; vertical-align:top; line-height:1.4; }
  .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:10px 0; }
  .kpi { background:#f8f9fa; border:1px solid #e5e5e5; border-radius:6px; padding:10px; text-align:center; }
  .kpi .val { font-size:20pt; font-weight:bold; color:#4A5C2F; }
  .kpi .lbl { font-size:8pt; color:#666; margin-top:2px; }
  .footer { margin-top:30px; display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid #ddd; padding-top:12px; }
  .footer-note { font-size:8pt; color:#888; }
  .signature { text-align:center; }
  .sig-line { border-top:1px solid #333; width:180px; margin:36px auto 6px; }
  .sig-title { font-size:9pt; font-weight:bold; }
  .sig-sub { font-size:8pt; color:#666; margin-top:2px; }
  .empty { text-align:center; color:#aaa; font-style:italic; padding:16px; font-size:9pt; }
  @media print { body { padding:10mm 12mm; } }`;

function openPrint(title: string, body: string, brigadeName: string, directionRegionale?: string) {
  const logoUrl = window.location.origin + "/images/logo-douanes.png";
  const win = window.open("", "_blank", "width=960,height=720");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html lang="fr"><head>
    <meta charset="UTF-8"><title>${title}</title>
    <style>${BASE_CSS}</style></head><body>
    ${buildHeader(brigadeName, logoUrl, directionRegionale)}${body}${FOOTER_HTML}
  </body></html>`);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

// ── Types de rapports ─────────────────────────────────────────────────────────

type ReportType = "journalier" | "mensuel" | "quittances" | "main-courante";

const REPORTS: { id: ReportType; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    id: "journalier",
    label: "Rapport journalier",
    desc: "Montage, caisse, main courante et correspondances du jour",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "mensuel",
    label: "Rapport mensuel",
    desc: "Bilan des montages, finances, événements et quittances du mois",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: "quittances",
    label: "Rapport quittances RS",
    desc: "Liste des amendes perçues sur une période choisie",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: "main-courante",
    label: "Rapport main courante",
    desc: "Événements classés par nature sur une période choisie",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
];

// ── Composant ─────────────────────────────────────────────────────────────────

export default function RapportsPage() {
  const todayStr = new Date().toISOString().split("T")[0];
  const currentMonth = todayStr.slice(0, 7); // YYYY-MM

  const { profile } = useUserProfile();
  const { isReadOnly } = useRole();

  // Nom de brigade : localStorage en priorité, sinon profil Firestore
  const defaultBrigadeName =
    BRIGADES.find((b) => b.id === profile?.brigadeId)?.nom ??
    profile?.brigadeId ??
    "";
  const [brigadeName, setBrigadeName] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("brigadeName") ?? "";
    }
    return "";
  });

  // Sync depuis le profil si localStorage vide
  useState(() => {
    if (!brigadeName && defaultBrigadeName) {
      setBrigadeName(defaultBrigadeName);
    }
  });

  function handleBrigadeNameChange(val: string) {
    setBrigadeName(val);
    localStorage.setItem("brigadeName", val);
  }

  const [directionRegionale, setDirectionRegionale] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("directionRegionale") ?? "";
    }
    return "";
  });

  function handleDirectionRegionaleChange(val: string) {
    setDirectionRegionale(val);
    localStorage.setItem("directionRegionale", val);
  }

  const [selected, setSelected] = useState<ReportType>("journalier");
  const [date, setDate] = useState(todayStr);
  const [month, setMonth] = useState(currentMonth);
  const [dateDebut, setDateDebut] = useState(todayStr.slice(0, 8) + "01");
  const [dateFin, setDateFin] = useState(todayStr);
  const [generating, setGenerating] = useState(false);

  // ── Génération journalier ────────────────────────────────────────────────
  async function genJournalier() {
    setGenerating(true);

    const [resMontage, resTx, resMC, resCorr] = await Promise.all([
      supabase.from("montages").select("*").eq("date", date),
      supabase.from("transactions").select("*").eq("date", date),
      supabase.from("main_courante").select("*").eq("date", date),
      supabase.from("correspondances").select("*").eq("date", date),
    ]);

    const montage = (resMontage.data ?? [])[0] as Montage | undefined;
    const transactions = (resTx.data ?? []) as Transaction[];
    const events = ((resMC.data ?? []) as Evenement[]).sort((a, b) => a.heure.localeCompare(b.heure));
    const corrs = (resCorr.data ?? []) as Correspondance[];

    const recettes  = transactions.filter((t) => t.type === "recette").reduce((s, t) => s + t.montant, 0);
    const depenses  = transactions.filter((t) => t.type === "depense").reduce((s, t) => s + t.montant, 0);

    const montageSection = montage ? `
      <div class="kpi-grid">
        <div class="kpi"><div class="val">${montage.resume.presents}</div><div class="lbl">Présents</div></div>
        <div class="kpi"><div class="val">${montage.resume.patrouilles}</div><div class="lbl">Patrouilles</div></div>
        <div class="kpi"><div class="val">${montage.resume.barrages}</div><div class="lbl">Barrages</div></div>
        <div class="kpi"><div class="val">${montage.resume.permissionnaires + montage.resume.repos}</div><div class="lbl">Absents</div></div>
      </div>
      <p style="font-size:9pt;color:#666;margin-top:4px">Statut du montage : <strong>${montage.statut}</strong>${(montage.saisiPar || montage.saisi_par) ? ` · Saisi par ${montage.saisiPar ?? montage.saisi_par}` : ""}</p>`
      : `<p class="empty">Aucun montage enregistré pour cette date.</p>`;

    const caisseRows = transactions.length
      ? transactions.map((t) => `<tr>
          <td>${t.motif ?? "—"}</td>
          <td style="color:${t.type === "recette" ? "#15803d" : "#dc2626"}">${t.type === "recette" ? "+" : "-"}${formatMontant(t.montant)}</td>
        </tr>`).join("")
      : `<tr><td colspan="2" class="empty">Aucune opération de caisse.</td></tr>`;

    const mcRows = events.length
      ? events.map((e) => `<tr>
          <td>${e.heure}</td><td>${e.nature}</td><td>${e.lieu}</td>
          <td>${e.description}</td><td>${e.agent}</td>
        </tr>`).join("")
      : `<tr><td colspan="5" class="empty">Aucun événement enregistré.</td></tr>`;

    const corrRows = corrs.length
      ? corrs.map((c) => `<tr>
          <td><span style="font-size:8pt;padding:2px 6px;border-radius:3px;background:${c.type === "arrivee" ? "#dbeafe" : "#dcfce7"};color:${c.type === "arrivee" ? "#1d4ed8" : "#15803d"}">${c.type === "arrivee" ? "Arrivée" : "Départ"}</span></td>
          <td>${c.numero ?? "—"}</td><td>${c.objet}</td>
          <td>${c.interlocuteur ?? c.structure ?? "—"}</td>
          <td>${c.urgence === "Urgent" ? "⚠ Urgent" : "Normal"}</td>
        </tr>`).join("")
      : `<tr><td colspan="5" class="empty">Aucune correspondance.</td></tr>`;

    const body = `
      <div class="report-title">
        <h1>Rapport Journalier de Brigade</h1>
        <p class="period">${formatDate(date)}</p>
      </div>

      <div class="section">
        <p class="section-title">1. Montage du jour</p>
        ${montageSection}
      </div>

      <div class="section">
        <p class="section-title">2. Situation de la caisse</p>
        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
          <div class="kpi"><div class="val" style="color:#15803d">${formatMontant(recettes)}</div><div class="lbl">Recettes</div></div>
          <div class="kpi"><div class="val" style="color:#dc2626">${formatMontant(depenses)}</div><div class="lbl">Dépenses</div></div>
          <div class="kpi"><div class="val">${formatMontant(recettes - depenses)}</div><div class="lbl">Solde net du jour</div></div>
        </div>
        <table><thead><tr><th>Libellé</th><th>Montant</th></tr></thead><tbody>${caisseRows}</tbody></table>
      </div>

      <div class="section">
        <p class="section-title">3. Main courante — ${events.length} événement(s)</p>
        <table><thead><tr><th>Heure</th><th>Nature</th><th>Lieu</th><th>Description</th><th>Agent</th></tr></thead>
        <tbody>${mcRows}</tbody></table>
      </div>

      <div class="section">
        <p class="section-title">4. Correspondances — ${corrs.length} courrier(s)</p>
        <table><thead><tr><th>Type</th><th>Référence</th><th>Objet</th><th>Expéditeur / Destinataire</th><th>Urgence</th></tr></thead>
        <tbody>${corrRows}</tbody></table>
      </div>`;

    openPrint(`Rapport journalier — ${date}`, body, brigadeName, directionRegionale);
    setGenerating(false);
  }

  // ── Génération mensuel ───────────────────────────────────────────────────
  async function genMensuel() {
    setGenerating(true);
    const [y, m] = month.split("-");
    const debut = `${month}-01`;
    const fin   = new Date(Number(y), Number(m), 0).toISOString().split("T")[0]; // dernier jour

    const [resMontages, resTx, resMC, resQ, resCorr] = await Promise.all([
      supabase.from("montages").select("*").gte("date", debut).lte("date", fin),
      supabase.from("transactions").select("*").gte("date", debut).lte("date", fin),
      supabase.from("main_courante").select("*").gte("date", debut).lte("date", fin),
      supabase.from("quittances").select("*").gte("date", debut).lte("date", fin),
      supabase.from("correspondances").select("*").gte("date", debut).lte("date", fin),
    ]);

    const montages        = (resMontages.data ?? []) as Montage[];
    const transactions    = (resTx.data ?? []) as Transaction[];
    const events          = (resMC.data ?? []) as Evenement[];
    const quittances      = (resQ.data ?? []) as Quittance[];
    const correspondances = (resCorr.data ?? []) as Correspondance[];

    const totM = montages.reduce((acc, m) => ({
      presents:      acc.presents + (m.resume?.presents ?? 0),
      patrouilles:   acc.patrouilles + (m.resume?.patrouilles ?? 0),
      barrages:      acc.barrages + (m.resume?.barrages ?? 0),
    }), { presents: 0, patrouilles: 0, barrages: 0 });

    const recettes = transactions.filter((t) => t.type === "recette").reduce((s, t) => s + t.montant, 0);
    const depenses = transactions.filter((t) => t.type === "depense").reduce((s, t) => s + t.montant, 0);
    const totalAmendes = quittances.reduce((s, q) => s + q.montant, 0);

    // ── Stats correspondances ──
    const corrArrivee     = correspondances.filter((c) => c.type === "arrivee");
    const corrDepart      = correspondances.filter((c) => c.type === "depart");
    const corrUrgentsArr  = corrArrivee.filter((c) => c.urgence === "Urgent");
    const corrUrgentsDep  = corrDepart.filter((c) => c.urgence === "Urgent");
    const STATUTS_TRAITES = ["Traité", "Envoyé"];
    const STATUTS_ATTENTE = ["En attente", "En attente d'envoi", "En cours"];
    const corrTraitesArr  = corrArrivee.filter((c) => STATUTS_TRAITES.includes(c.statut ?? ""));
    const corrTraitesDep  = corrDepart.filter((c) => STATUTS_TRAITES.includes(c.statut ?? ""));
    const corrAttenteArr  = corrArrivee.filter((c) => STATUTS_ATTENTE.includes(c.statut ?? ""));
    const corrAttenteDep  = corrDepart.filter((c) => STATUTS_ATTENTE.includes(c.statut ?? ""));

    const naturesCount: Record<string, number> = {};
    events.forEach((e) => { naturesCount[e.nature] = (naturesCount[e.nature] ?? 0) + 1; });

    const montagesRows = montages.length
      ? montages.sort((a, b) => a.date.localeCompare(b.date)).map((m) => `<tr>
          <td>${new Date(m.date + "T12:00:00").toLocaleDateString("fr-SN")}</td>
          <td>${m.resume?.presents ?? 0}</td><td>${m.resume?.patrouilles ?? 0}</td>
          <td>${m.resume?.barrages ?? 0}</td><td>${m.statut}</td>
        </tr>`).join("")
      : `<tr><td colspan="5" class="empty">Aucun montage ce mois.</td></tr>`;

    const naturesRows = Object.entries(naturesCount).map(([n, c]) =>
      `<tr><td>${n}</td><td>${c}</td><td>${Math.round(c / (events.length || 1) * 100)} %</td></tr>`
    ).join("") || `<tr><td colspan="3" class="empty">Aucun événement.</td></tr>`;

    const body = `
      <div class="report-title">
        <h1>Rapport Mensuel de Brigade</h1>
        <p class="period">${formatMonth(month)}</p>
      </div>

      <div class="section">
        <p class="section-title">1. Récapitulatif des montages (${montages.length} jours)</p>
        <div class="kpi-grid">
          <div class="kpi"><div class="val">${montages.length}</div><div class="lbl">Jours de montage</div></div>
          <div class="kpi"><div class="val">${Math.round(totM.presents / (montages.length || 1))}</div><div class="lbl">Présents / jour (moy.)</div></div>
          <div class="kpi"><div class="val">${totM.patrouilles}</div><div class="lbl">Total patrouilles</div></div>
          <div class="kpi"><div class="val">${totM.barrages}</div><div class="lbl">Total barrages</div></div>
        </div>
        <table><thead><tr><th>Date</th><th>Présents</th><th>Patrouilles</th><th>Barrages</th><th>Statut</th></tr></thead>
        <tbody>${montagesRows}</tbody></table>
      </div>

      <div class="section">
        <p class="section-title">2. Bilan financier</p>
        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
          <div class="kpi"><div class="val" style="color:#15803d">${formatMontant(recettes)}</div><div class="lbl">Total recettes</div></div>
          <div class="kpi"><div class="val" style="color:#dc2626">${formatMontant(depenses)}</div><div class="lbl">Total dépenses</div></div>
          <div class="kpi"><div class="val">${formatMontant(recettes - depenses)}</div><div class="lbl">Solde net</div></div>
        </div>
      </div>

      <div class="section">
        <p class="section-title">3. Statistiques main courante (${events.length} événements)</p>
        <table><thead><tr><th>Nature</th><th>Nombre</th><th>Part</th></tr></thead>
        <tbody>${naturesRows}</tbody></table>
      </div>

      <div class="section">
        <p class="section-title">4. Quittances RS (${quittances.length} émises)</p>
        <div class="kpi-grid" style="grid-template-columns:repeat(2,1fr)">
          <div class="kpi"><div class="val">${quittances.length}</div><div class="lbl">Quittances émises</div></div>
          <div class="kpi"><div class="val" style="color:#15803d">${formatMontant(totalAmendes)}</div><div class="lbl">Total amendes perçues</div></div>
        </div>
      </div>

      <div class="section">
        <p class="section-title">5. Correspondances (${correspondances.length} courrier${correspondances.length > 1 ? "s" : ""})</p>
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:10px">
          <div class="kpi"><div class="val">${corrArrivee.length}</div><div class="lbl">Arrivée</div></div>
          <div class="kpi"><div class="val">${corrDepart.length}</div><div class="lbl">Départ</div></div>
          <div class="kpi"><div class="val" style="color:#b45309">${corrUrgentsArr.length + corrUrgentsDep.length}</div><div class="lbl">Urgents</div></div>
          <div class="kpi"><div class="val" style="color:#d97706">${corrAttenteArr.length + corrAttenteDep.length}</div><div class="lbl">En attente</div></div>
        </div>
        ${correspondances.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th style="text-align:center">Nombre</th>
              <th style="text-align:center">Urgents</th>
              <th style="text-align:center">Traités</th>
              <th style="text-align:center">En attente</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Courriers Arrivée</td>
              <td style="text-align:center;font-weight:bold">${corrArrivee.length}</td>
              <td style="text-align:center;color:#b45309;font-weight:bold">${corrUrgentsArr.length}</td>
              <td style="text-align:center;color:#15803d;font-weight:bold">${corrTraitesArr.length}</td>
              <td style="text-align:center;color:#d97706;font-weight:bold">${corrAttenteArr.length}</td>
            </tr>
            <tr>
              <td>Courriers Départ</td>
              <td style="text-align:center;font-weight:bold">${corrDepart.length}</td>
              <td style="text-align:center;color:#b45309;font-weight:bold">${corrUrgentsDep.length}</td>
              <td style="text-align:center;color:#15803d;font-weight:bold">${corrTraitesDep.length}</td>
              <td style="text-align:center;color:#d97706;font-weight:bold">${corrAttenteDep.length}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="background:#4A5C2F;color:#fff;font-weight:bold">
              <td style="padding:6px 8px">TOTAL</td>
              <td style="padding:6px 8px;text-align:center">${correspondances.length}</td>
              <td style="padding:6px 8px;text-align:center">${corrUrgentsArr.length + corrUrgentsDep.length}</td>
              <td style="padding:6px 8px;text-align:center">${corrTraitesArr.length + corrTraitesDep.length}</td>
              <td style="padding:6px 8px;text-align:center">${corrAttenteArr.length + corrAttenteDep.length}</td>
            </tr>
          </tfoot>
        </table>` : `<p class="empty">Aucune correspondance enregistrée ce mois.</p>`}
      </div>`;

    openPrint(`Rapport mensuel — ${month}`, body, brigadeName, directionRegionale);
    setGenerating(false);
  }

  // ── Génération quittances ────────────────────────────────────────────────
  async function genQuittances() {
    setGenerating(true);

    const { data: qData } = await supabase
      .from("quittances")
      .select("*")
      .gte("date", dateDebut)
      .lte("date", dateFin);
    const quittances = ((qData ?? []) as Quittance[])
      .sort((a, b) => a.date.localeCompare(b.date));
    const total = quittances.reduce((s, q) => s + q.montant, 0);

    const rows = quittances.length
      ? quittances.map((q) => `<tr>
          <td>${new Date(q.date + "T12:00:00").toLocaleDateString("fr-SN")}</td>
          <td style="font-family:monospace">${q.numero}</td>
          <td>${q.prenom ?? ""} ${q.nom ?? ""}</td>
          <td style="font-family:monospace;font-size:0.85em">${q.referenceAC ?? "—"}</td>
          <td>${q.nature ?? "—"}</td>
          <td>${q.nature ?? "—"}</td>
          <td style="font-weight:bold">${formatMontant(q.montant)}</td>
        </tr>`).join("")
      : `<tr><td colspan="7" class="empty">Aucune quittance sur cette période.</td></tr>`;

    const body = `
      <div class="report-title">
        <h1>Rapport des Quittances RS</h1>
        <p class="period">Du ${formatDate(dateDebut)} au ${formatDate(dateFin)}</p>
      </div>
      <div class="kpi-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:14px">
        <div class="kpi"><div class="val">${quittances.length}</div><div class="lbl">Quittances émises</div></div>
        <div class="kpi"><div class="val" style="color:#15803d">${formatMontant(total)}</div><div class="lbl">Total amendes perçues</div></div>
      </div>
      <table>
        <thead><tr><th>Date</th><th>N° Quittance</th><th>Contrevenant</th><th>Référence A/C N°</th><th>Nature marchandise</th><th>Infraction</th><th>Montant</th></tr></thead>
        <tbody>${rows}</tbody>
        ${quittances.length ? `<tfoot><tr style="background:#4A5C2F;color:#fff;font-weight:bold">
          <td colspan="6" style="padding:6px 8px;text-align:right">TOTAL</td>
          <td style="padding:6px 8px">${formatMontant(total)}</td>
        </tr></tfoot>` : ""}
      </table>`;

    openPrint(`Rapport quittances — ${dateDebut} au ${dateFin}`, body, brigadeName, directionRegionale);
    setGenerating(false);
  }

  // ── Génération main courante ─────────────────────────────────────────────
  async function genMainCourante() {
    setGenerating(true);

    const { data: mcData } = await supabase
      .from("main_courante")
      .select("*")
      .gte("date", dateDebut)
      .lte("date", dateFin);
    const events = ((mcData ?? []) as Evenement[])
      .sort((a, b) => a.date.localeCompare(b.date) || a.heure.localeCompare(b.heure));

    const natures = [...new Set(events.map((e) => e.nature))].sort();

    const sections = natures.map((nature) => {
      const groupe = events.filter((e) => e.nature === nature);
      const rows = groupe.map((e) => `<tr>
        <td>${new Date(e.date + "T12:00:00").toLocaleDateString("fr-SN")}</td>
        <td>${e.heure}</td><td>${e.lieu}</td>
        <td>${e.description}</td><td>${e.agent}</td>
      </tr>`).join("");
      return `<div class="section">
        <p class="section-title">${nature} (${groupe.length})</p>
        <table><thead><tr><th>Date</th><th>Heure</th><th>Lieu</th><th>Description</th><th>Agent</th></tr></thead>
        <tbody>${rows}</tbody></table>
      </div>`;
    }).join("") || `<p class="empty" style="margin-top:20px">Aucun événement sur cette période.</p>`;

    const body = `
      <div class="report-title">
        <h1>Rapport de Main Courante</h1>
        <p class="period">Du ${formatDate(dateDebut)} au ${formatDate(dateFin)}</p>
      </div>
      <div class="kpi-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:6px">
        <div class="kpi"><div class="val">${events.length}</div><div class="lbl">Total événements</div></div>
        <div class="kpi"><div class="val">${natures.length}</div><div class="lbl">Natures différentes</div></div>
      </div>
      ${sections}`;

    openPrint(`Rapport main courante — ${dateDebut} au ${dateFin}`, body, brigadeName, directionRegionale);
    setGenerating(false);
  }

  function handleGenerate() {
    if (selected === "journalier")    genJournalier();
    else if (selected === "mensuel")  genMensuel();
    else if (selected === "quittances") genQuittances();
    else genMainCourante();
  }

  // ── Rendu ────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {isReadOnly && <ReadOnlyBanner />}
        <div className="flex-1 px-8 py-8 overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#4A5C2F]">Rapports</h1>
          <p className="text-sm text-gray-400 mt-1">Génération de rapports PDF officiels</p>
        </div>

        {/* Direction Régionale + Nom de la brigade */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 mb-3 flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-[#4A5C2F]/10 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#4A5C2F]" fill="none"
              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 004 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Direction Régionale (affiché dans tous les PDF)
            </label>
            <select
              value={directionRegionale}
              onChange={(e) => handleDirectionRegionaleChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A5C2F] bg-white"
            >
              <option value="">— Aucune —</option>
              {DIRECTIONS_REGIONALES.map((dr) => (
                <option key={dr.id} value={dr.nom}>{dr.nom}</option>
              ))}
            </select>
          </div>
          {directionRegionale && (
            <span className="text-xs text-green-600 font-medium whitespace-nowrap flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Sauvegardé
            </span>
          )}
        </div>

        {/* Nom de la brigade */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 mb-6 flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-[#4A5C2F]/10 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#4A5C2F]" fill="none"
              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Nom de la brigade (affiché dans tous les PDF)
            </label>
            <input
              value={brigadeName}
              onChange={(e) => handleBrigadeNameChange(e.target.value)}
              placeholder="Ex : Brigade Mobile des Douanes Gouloumbou"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A5C2F]"
            />
          </div>
          {brigadeName && (
            <span className="text-xs text-green-600 font-medium whitespace-nowrap flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Sauvegardé
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Sélection du type */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {REPORTS.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r.id)}
                className={`text-left p-5 rounded-2xl border-2 transition-all
                  ${selected === r.id
                    ? "border-[#4A5C2F] bg-[#4A5C2F]/5 shadow-md"
                    : "border-gray-100 bg-white hover:border-[#4A5C2F]/30 shadow-sm"}`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3
                  ${selected === r.id ? "bg-[#4A5C2F] text-white" : "bg-gray-100 text-gray-500"}`}>
                  {r.icon}
                </div>
                <p className={`font-bold text-sm mb-1 ${selected === r.id ? "text-[#4A5C2F]" : "text-gray-800"}`}>
                  {r.label}
                </p>
                <p className="text-xs text-gray-400 leading-relaxed">{r.desc}</p>
              </button>
            ))}
          </div>

          {/* Panneau de configuration */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-5">
            <div>
              <p className="font-bold text-gray-800 text-sm mb-0.5">
                {REPORTS.find((r) => r.id === selected)?.label}
              </p>
              <p className="text-xs text-gray-400">
                {REPORTS.find((r) => r.id === selected)?.desc}
              </p>
            </div>

            <div className="border-t border-gray-100 pt-5 space-y-4">
              {/* Rapport journalier : sélecteur de jour */}
              {selected === "journalier" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A5C2F]"
                  />
                </div>
              )}

              {/* Rapport mensuel : sélecteur de mois */}
              {selected === "mensuel" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Mois</label>
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A5C2F]"
                  />
                </div>
              )}

              {/* Rapports par période */}
              {(selected === "quittances" || selected === "main-courante") && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date de début</label>
                    <input
                      type="date"
                      value={dateDebut}
                      onChange={(e) => setDateDebut(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A5C2F]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date de fin</label>
                    <input
                      type="date"
                      value={dateFin}
                      onChange={(e) => setDateFin(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A5C2F]"
                    />
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="mt-auto flex items-center justify-center gap-2 w-full bg-[#4A5C2F] hover:bg-[#3b4a25]
                text-white font-semibold py-3 rounded-xl text-sm transition-colors
                disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Génération…
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Générer le rapport PDF
                </>
              )}
            </button>
          </div>
        </div>
        </div>{/* end flex-1 px-8 py-8 */}
      </div>{/* end flex-1 flex-col */}
    </div>
  );
}

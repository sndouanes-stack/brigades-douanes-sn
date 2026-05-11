"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import ReadOnlyBanner from "@/components/ReadOnlyBanner";
import { useRole } from "@/lib/useRole";

// ── Types ─────────────────────────────────────────────────────────────────────

type StatutSaisie = "En instance" | "Transféré" | "Détruit" | "Vendu";
type Unite = "kg" | "litres" | "cartons" | "pièces" | "tonnes" | "mètres" | "sacs";

const STATUTS: StatutSaisie[] = ["En instance", "Transféré", "Détruit", "Vendu"];
const UNITES: Unite[] = ["kg", "litres", "cartons", "pièces", "tonnes", "mètres", "sacs"];

const STATUT_STYLES: Record<StatutSaisie, string> = {
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
}

interface FormState {
  date: string;
  heure: string;
  nature: string;
  description: string;
  quantite: string;
  unite: Unite;
  valeur: string;
  lieu: string;
  proprietaire: string;
  numeroPV: string;
  agent: string;
  observations: string;
  statut: StatutSaisie;
}

const EMPTY_FORM: FormState = {
  date: "", heure: "", nature: "", description: "",
  quantite: "", unite: "kg", valeur: "",
  lieu: "", proprietaire: "", numeroPV: "", agent: "",
  observations: "", statut: "En instance",
};

// ── Types Règlement Transactionnel ────────────────────────────────────────────

interface RTFormState {
  agents: string;
  prenom: string;
  nom: string;
  dateNaissance: string;
  lieuNaissance: string;
  adresse: string;
  profession: string;
  role: string;
  infraction: string;
  articles: string;
  montant: string;
  montantLettres: string;
  numeroQuittance: string;
  mainlevee: string;
  directeurRegional: string;
  chefSubdivision: string;
  directionRegionale: string;
  subdivision: string;
  brigade: string;
  referenceAC: string;
  decisionNumero: string;
  decisionDate: string;
  lieu: string;
  date: string;
}

const EMPTY_RT_FORM: RTFormState = {
  agents: "", prenom: "", nom: "", dateNaissance: "", lieuNaissance: "",
  adresse: "", profession: "", role: "responsable principal",
  infraction: "", articles: "21, 279, 280, 330, 396, 390",
  montant: "", montantLettres: "", numeroQuittance: "",
  mainlevee: "Mainlevée de la marchandise",
  directeurRegional: "", chefSubdivision: "",
  directionRegionale: "Direction Régionale du Sud-Est",
  subdivision: "", brigade: "", referenceAC: "",
  decisionNumero: "", decisionDate: "", lieu: "", date: "",
};

// ── Types PV de Saisie (complet) ─────────────────────────────────────────────

interface PVFormState {
  directionRegionale: string;
  subdivision: string;
  brigade: string;
  numeroDossier: string;
  numeroAC: string;
  // Délits
  delitContrebande: string;
  delitOpposition: string;
  delitFausseDeclaration: string;
  delitSansDeclaration: string;
  delitDetentionIllicite: string;
  delitAutre: string;
  // Texte légal
  articles: string;
  referencesLegislatives: string;
  // Prévenu
  nomPrevenu: string;
  prenomPrevenu: string;
  professionPrevenu: string;
  adressePrevenu: string;
  // Agents
  agentsVerbalisateurs: string;
  // Rapport
  rapport: string;
  // Sanctions
  sanctionAmende: string;
  sanctionConfiscation: string;
  sanctionEmprisonnement: string;
  // Déclarations
  declarationsInteresse: string;
  // Clôture
  dateCloture: string;
  lieuCloture: string;
}

const EMPTY_PV_FORM: PVFormState = {
  directionRegionale: "", subdivision: "", brigade: "",
  numeroDossier: "", numeroAC: "",
  delitContrebande: "", delitOpposition: "", delitFausseDeclaration: "",
  delitSansDeclaration: "", delitDetentionIllicite: "", delitAutre: "",
  articles: "203, 204, 215, 217, 218",
  referencesLegislatives: "Loi n° 2014-10 du 28 février 2014 portant Code des Douanes",
  nomPrevenu: "", prenomPrevenu: "", professionPrevenu: "", adressePrevenu: "",
  agentsVerbalisateurs: "",
  rapport: "",
  sanctionAmende: "", sanctionConfiscation: "", sanctionEmprisonnement: "",
  declarationsInteresse: "",
  dateCloture: "", lieuCloture: "",
};

// ── Numérotation ─────────────────────────────────────────────────────────────

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

// ── Impression PV ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function printPV(saisie: Saisie) {
  const logoUrl = window.location.origin + "/images/logo-douanes.png";
  const dateF = new Date(saisie.date + "T12:00:00").toLocaleDateString("fr-SN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const html = `<!DOCTYPE html><html lang="fr"><head>
    <meta charset="UTF-8">
    <title>PV de Saisie — ${saisie.numero}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:"Times New Roman",serif; font-size:11pt; color:#111; padding:20mm 18mm; }
      .header { display:flex; align-items:center; gap:16px; margin-bottom:12px; }
      .logo { width:70px; height:70px; object-fit:contain; }
      .header-text { flex:1; text-align:center; }
      .republic { font-size:10pt; font-weight:bold; letter-spacing:.5px; }
      .ministry { font-size:9pt; color:#444; margin-top:2px; }
      .service  { font-size:13pt; font-weight:bold; color:#4A5C2F; margin-top:4px; }
      .divider  { border-top:2.5px solid #4A5C2F; margin:10px 0 16px; }
      .title-block { text-align:center; margin-bottom:18px; }
      .pv-title { font-size:16pt; font-weight:bold; text-transform:uppercase; letter-spacing:2px; color:#4A5C2F; }
      .pv-num   { font-size:10pt; color:#555; margin-top:4px; }
      .section  { margin-bottom:14px; }
      .section-title { font-size:10pt; font-weight:bold; color:#4A5C2F; text-transform:uppercase;
        border-bottom:1px solid #C9A84C; padding-bottom:3px; margin-bottom:8px; letter-spacing:.5px; }
      .grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 20px; }
      .field { display:flex; flex-direction:column; gap:2px; }
      .field label { font-size:8pt; color:#777; text-transform:uppercase; letter-spacing:.3px; }
      .field span { font-size:10pt; font-weight:600; color:#111; }
      .desc-box { background:#f8f8f4; border:1px solid #e0e0d8; border-radius:4px; padding:8px 10px;
        font-size:10pt; line-height:1.5; margin-top:2px; }
      .statut { display:inline-block; padding:3px 10px; border-radius:20px; font-size:9pt; font-weight:bold;
        background:#fff3cd; color:#856404; border:1px solid #ffc107; }
      .footer { margin-top:30px; display:grid; grid-template-columns:1fr 1fr; gap:20px; }
      .sign-block { text-align:center; }
      .sign-line { border-top:1px solid #333; margin:36px auto 6px; }
      .sign-label { font-size:9pt; font-weight:bold; }
      .sign-sub   { font-size:8pt; color:#666; margin-top:2px; }
      .bottom-note { margin-top:20px; font-size:8pt; color:#888; text-align:center;
        border-top:1px solid #ddd; padding-top:8px; }
      @media print { body { padding:12mm 14mm; } }
    </style>
  </head><body>
    <div class="header">
      <img src="${logoUrl}" alt="Logo Douanes" class="logo" />
      <div class="header-text">
        <p class="republic">REPUBLIQUE DU SENEGAL</p>
        <p class="ministry">Ministère des Finances et du Budget</p>
        <p class="service">DIRECTION GÉNÉRALE DES DOUANES</p>
      </div>
      <img src="${logoUrl}" alt="Logo Douanes" class="logo" />
    </div>
    <div class="divider"></div>
    <div class="title-block">
      <p class="pv-title">Procès-Verbal de Saisie</p>
      <p class="pv-num">N° ${saisie.numeroPV || "—"} &nbsp;·&nbsp; Référence : ${saisie.numero}</p>
    </div>
    <div class="section">
      <p class="section-title">1. Identification de la saisie</p>
      <div class="grid">
        <div class="field"><label>Date</label><span>${dateF}</span></div>
        <div class="field"><label>Heure</label><span>${saisie.heure}</span></div>
        <div class="field"><label>Lieu / Zone</label><span>${saisie.lieu}</span></div>
        <div class="field"><label>Agent verbalisateur</label><span>${saisie.agent}</span></div>
        <div class="field"><label>Statut</label><span class="statut">${saisie.statut}</span></div>
        <div class="field"><label>N° Procès-Verbal</label><span>${saisie.numeroPV || "—"}</span></div>
      </div>
    </div>
    <div class="section">
      <p class="section-title">2. Marchandise saisie</p>
      <div class="grid">
        <div class="field"><label>Nature</label><span>${saisie.nature}</span></div>
        <div class="field"><label>Quantité</label><span>${saisie.quantite} ${saisie.unite}</span></div>
        <div class="field" style="grid-column:1/-1"><label>Valeur estimée</label>
          <span style="font-size:13pt;color:#4A5C2F">${Number(saisie.valeur).toLocaleString("fr-SN")} FCFA</span></div>
      </div>
      <div class="field" style="margin-top:8px">
        <label>Description détaillée</label>
        <div class="desc-box">${saisie.description || "—"}</div>
      </div>
    </div>
    <div class="section">
      <p class="section-title">3. Propriétaire / Contrevenant</p>
      <div class="field"><label>Nom et adresse</label><span>${saisie.proprietaire}</span></div>
    </div>
    ${saisie.observations ? `
    <div class="section">
      <p class="section-title">4. Observations</p>
      <div class="desc-box">${saisie.observations}</div>
    </div>` : ""}
    <div class="footer">
      <div class="sign-block">
        <div class="sign-line" style="width:180px"></div>
        <p class="sign-label">L'Agent Verbalisateur</p>
        <p class="sign-sub">${saisie.agent}</p>
        <p class="sign-sub">Signature et matricule</p>
      </div>
      <div class="sign-block">
        <div class="sign-line" style="width:180px"></div>
        <p class="sign-label">Le Chef de Brigade</p>
        <p class="sign-sub">Signature et cachet</p>
      </div>
    </div>
    <p class="bottom-note">
      Document établi le ${new Date().toLocaleDateString("fr-SN")} à ${new Date().toLocaleTimeString("fr-SN", { hour: "2-digit", minute: "2-digit" })}
      &nbsp;—&nbsp; Brigade Mobile des Douanes du Sénégal
    </p>
  </body></html>`;

  const win = window.open("", "_blank", "width=900,height=720");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

// ── Impression PV de Saisie Complet ──────────────────────────────────────────

function printPVDetailed(saisie: Saisie, pv: PVFormState) {
  const logoUrl = window.location.origin + "/images/logo-douanes.png";
  const dateF = saisie.date
    ? new Date(saisie.date + "T12:00:00").toLocaleDateString("fr-SN", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })
    : "—";
  const dateCloF = pv.dateCloture
    ? new Date(pv.dateCloture + "T12:00:00").toLocaleDateString("fr-SN", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "—";

  const cb = (v: string) =>
    `<span style="display:inline-block;width:13px;height:13px;border:1px solid #333;
      vertical-align:middle;text-align:center;line-height:13px;font-size:10px;
      font-weight:bold;margin-right:4px;">${v === "true" ? "✓" : "&nbsp;"}</span>`;

  const html = `<!DOCTYPE html><html lang="fr"><head>
  <meta charset="UTF-8">
  <title>PV de Saisie — ${pv.numeroDossier || saisie.numero}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:"Times New Roman",serif;font-size:11pt;color:#111;padding:14mm 18mm;}
    .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
    .logo{width:65px;height:65px;object-fit:contain;}
    .hc{text-align:center;flex:1;padding:0 12px;}
    .republic{font-size:9.5pt;font-weight:bold;letter-spacing:.5px;}
    .motto{font-size:8pt;color:#555;margin:1px 0;}
    .ministry{font-size:8.5pt;font-weight:bold;margin-top:3px;}
    .dgd{font-size:10.5pt;font-weight:bold;color:#4A5C2F;margin-top:2px;}
    .dod{font-size:9pt;color:#4A5C2F;margin-top:1px;}
    .bar-gold{border-top:3px solid #C9A84C;margin:6px 0;}
    .bar-green{border-top:2px solid #4A5C2F;margin:3px 0;}
    .hier{background:#f5f7f0;border:1px solid #d4dcc4;padding:5px 10px;font-size:8.5pt;
      display:flex;justify-content:space-between;align-items:center;margin:5px 0;}
    .title-block{text-align:center;margin:12px 0 6px;}
    .pv-title{font-size:14pt;font-weight:bold;text-transform:uppercase;color:#4A5C2F;letter-spacing:2px;}
    .pv-ref{font-size:9pt;color:#666;margin-top:4px;border:1px solid #C9A84C;
      display:inline-block;padding:2px 12px;}
    .mandate{text-align:center;font-size:10pt;font-style:italic;color:#333;margin:8px 0 14px;}
    .sec{margin-bottom:11px;}
    .sec-title{font-size:9pt;font-weight:bold;color:#4A5C2F;text-transform:uppercase;
      border-left:3px solid #C9A84C;padding-left:6px;margin-bottom:5px;letter-spacing:.3px;}
    .fl{display:flex;align-items:baseline;margin-bottom:4px;font-size:10pt;}
    .lbl{color:#555;min-width:52mm;flex-shrink:0;font-size:9pt;}
    .val{font-weight:600;flex:1;border-bottom:0.5px dotted #bbb;padding-bottom:1px;}
    .cb-row{display:flex;flex-wrap:wrap;gap:6px 22px;margin:4px 0;font-size:10pt;line-height:1.8;}
    .tbox{background:#f8f8f4;border:1px solid #e0e0d8;padding:7px 10px;
      font-size:10pt;line-height:1.6;min-height:36px;}
    .hl{background:#f0f3e8;border:1px solid #c8d4b0;border-left:3px solid #4A5C2F;
      padding:7px 11px;margin:4px 0;font-size:10pt;line-height:1.6;}
    .sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;margin-top:22px;}
    .sb{text-align:center;}
    .sb-title{font-size:9pt;font-weight:bold;}
    .sb-sub{font-size:8pt;color:#555;margin-bottom:2px;}
    .sb-line{border-top:1px solid #333;width:75%;margin:34px auto 5px;}
    .sb-note{font-size:7.5pt;color:#888;margin-top:3px;}
    .fn{margin-top:16px;padding-top:6px;border-top:1px solid #ddd;
      text-align:center;font-size:7.5pt;color:#aaa;}
    @media print{body{padding:10mm 14mm;}@page{margin:1.5cm;}}
  </style>
</head><body>

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
    ${pv.directionRegionale || "Direction Régionale"}
    ${pv.subdivision ? " &rsaquo; " + pv.subdivision : ""}
    ${pv.brigade ? " &rsaquo; " + pv.brigade : ""}
  </span>
  <span style="font-weight:bold;color:#4A5C2F;">
    N° Dossier : ${pv.numeroDossier || "—"} &nbsp;|&nbsp; A/C N° : ${pv.numeroAC || "—"}
  </span>
</div>

<div class="bar-green"></div>

<div class="title-block">
  <p class="pv-title">Procès-Verbal de Saisie</p>
  <p class="pv-ref">Référence saisie : ${saisie.numero} &nbsp;·&nbsp; PV N° : ${saisie.numeroPV || "—"}</p>
</div>

<p class="mandate">Rédigé à la requête du Directeur Général des Douanes</p>

<!-- 1. DATE ET LIEU -->
<div class="sec">
  <p class="sec-title">1. Date et lieu de la saisie</p>
  <div class="fl"><span class="lbl">Date :</span><span class="val">${dateF}</span></div>
  <div class="fl"><span class="lbl">Heure :</span><span class="val">${saisie.heure || "—"}</span></div>
  <div class="fl"><span class="lbl">Lieu / Zone :</span><span class="val">${saisie.lieu}</span></div>
</div>

<!-- 2. DÉLITS -->
<div class="sec">
  <p class="sec-title">2. Nature du délit</p>
  <div class="cb-row">
    <span>${cb(pv.delitContrebande)} Contrebande</span>
    <span>${cb(pv.delitOpposition)} Opposition aux fonctions</span>
    <span>${cb(pv.delitFausseDeclaration)} Fausse déclaration</span>
    <span>${cb(pv.delitSansDeclaration)} Import./Export. sans déclaration</span>
    <span>${cb(pv.delitDetentionIllicite)} Détention illicite de marchandises</span>
  </div>
  ${pv.delitAutre ? `<div style="margin-top:5px;font-size:10pt;"><strong>Autre :</strong> ${pv.delitAutre}</div>` : ""}
</div>

<!-- 3. ARTICLES -->
<div class="sec">
  <p class="sec-title">3. Articles du Code des Douanes et références législatives</p>
  <div class="fl"><span class="lbl">Articles :</span><span class="val">${pv.articles}</span></div>
  <div class="fl"><span class="lbl">Références :</span><span class="val">${pv.referencesLegislatives}</span></div>
</div>

<!-- 4. PERSONNES CONCERNÉES -->
<div class="sec">
  <p class="sec-title">4. Personne(s) concernée(s)</p>
  <div class="fl"><span class="lbl">Nom &amp; Prénom :</span><span class="val">${pv.nomPrevenu} ${pv.prenomPrevenu}</span></div>
  <div class="fl"><span class="lbl">Profession :</span><span class="val">${pv.professionPrevenu || "—"}</span></div>
  <div class="fl"><span class="lbl">Adresse :</span><span class="val">${pv.adressePrevenu || "—"}</span></div>
</div>

<!-- 5. AGENTS VERBALISATEURS -->
<div class="sec">
  <p class="sec-title">5. Agents verbalisateurs (Nom, grade, fonction)</p>
  <div class="tbox">${pv.agentsVerbalisateurs || "—"}</div>
</div>

<!-- 6. RAPPORT -->
<div class="sec">
  <p class="sec-title">6. Rapport</p>
  <div class="tbox" style="min-height:60px;">${pv.rapport || "—"}</div>
</div>

<!-- 7. OBJETS SAISIS -->
<div class="sec">
  <p class="sec-title">7. Objets saisis avec valeurs estimées</p>
  <div class="hl">
    <strong>Nature :</strong> ${saisie.nature}<br>
    <strong>Quantité :</strong> ${saisie.quantite} ${saisie.unite}<br>
    ${saisie.description ? "<strong>Description :</strong> " + saisie.description + "<br>" : ""}
    <strong>Valeur estimée :</strong>
    <span style="color:#4A5C2F;font-weight:bold;">${Number(saisie.valeur).toLocaleString("fr-SN")} FCFA</span>
  </div>
</div>

<!-- 8. SANCTIONS ENCOURUES -->
<div class="sec">
  <p class="sec-title">8. Sanctions encourues</p>
  <div class="fl"><span class="lbl">Amende :</span><span class="val">${pv.sanctionAmende || "Selon barème en vigueur"}</span></div>
  <div class="fl"><span class="lbl">Confiscation :</span><span class="val">${pv.sanctionConfiscation === "oui" ? "Oui — confiscation des marchandises saisies" : "Non"}</span></div>
  <div class="fl"><span class="lbl">Emprisonnement :</span><span class="val">${pv.sanctionEmprisonnement || "—"}</span></div>
</div>

<!-- 9. DÉCLARATIONS DE L'INTÉRESSÉ -->
<div class="sec">
  <p class="sec-title">9. Déclarations de l'intéressé</p>
  <div class="tbox" style="min-height:44px;">${pv.declarationsInteresse || "—"}</div>
</div>

<!-- 10. FORMALITÉS DE CLÔTURE -->
<div class="sec">
  <p class="sec-title">10. Formalités de clôture</p>
  <div class="fl"><span class="lbl">Date de clôture :</span><span class="val">${dateCloF}</span></div>
  <div class="fl"><span class="lbl">Lieu :</span><span class="val">${pv.lieuCloture || saisie.lieu}</span></div>
</div>

<!-- SIGNATURES -->
<div class="sigs">
  <div class="sb">
    <p class="sb-title">Le Prévenu</p>
    <p class="sb-sub">${pv.nomPrevenu} ${pv.prenomPrevenu}</p>
    <div class="sb-line"></div>
    <p class="sb-note">Lu et approuvé — Signature</p>
  </div>
  <div class="sb">
    <p class="sb-title">Les Agents Verbalisateurs</p>
    <div class="sb-line"></div>
    <p class="sb-note">Signatures et matricules</p>
  </div>
  <div class="sb">
    <p class="sb-title">Le Chef de Brigade</p>
    <div class="sb-line"></div>
    <p class="sb-note">Signature et cachet officiel</p>
  </div>
</div>

<p class="fn">
  Document établi le ${new Date().toLocaleDateString("fr-SN")} à ${new Date().toLocaleTimeString("fr-SN", { hour: "2-digit", minute: "2-digit" })}
  &nbsp;—&nbsp; Douanes de la République du Sénégal
  ${pv.brigade ? " — " + pv.brigade : ""}
</p>

</body></html>`;

  const win = window.open("", "_blank", "width=940,height=760");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

// ── Impression Règlement Transactionnel ───────────────────────────────────────

function printRT(saisie: Saisie, rt: RTFormState) {
  const logoUrl = window.location.origin + "/images/logo-douanes.png";
  const dateF = rt.date
    ? new Date(rt.date + "T12:00:00").toLocaleDateString("fr-SN", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })
    : "—";
  const decisionDateF = rt.decisionDate
    ? new Date(rt.decisionDate + "T12:00:00").toLocaleDateString("fr-SN", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "—";
  const montantFormatted = (parseFloat(rt.montant) || 0).toLocaleString("fr-SN");

  const html = `<!DOCTYPE html><html lang="fr"><head>
    <meta charset="UTF-8">
    <title>Règlement Transactionnel — ${saisie.numero}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:"Times New Roman",serif; font-size:10.5pt; color:#111; padding:14mm 18mm; }

      .header { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
      .logo { width:62px; height:62px; object-fit:contain; }
      .header-center { text-align:center; flex:1; padding:0 12px; }
      .republic { font-size:9.5pt; font-weight:bold; letter-spacing:.5px; }
      .motto { font-size:8pt; color:#555; margin:1px 0; }
      .ministry { font-size:9pt; font-weight:bold; margin-top:3px; }
      .dgd { font-size:10.5pt; font-weight:bold; color:#4A5C2F; margin-top:2px; letter-spacing:.3px; }

      .ref-block { background:#f5f7f0; border:1px solid #d4dcc4; padding:5px 10px; margin:5px 0;
        font-size:8.5pt; display:flex; justify-content:space-between; align-items:center; }
      .ref-hierarchy { color:#444; }
      .ref-ac { font-weight:bold; color:#4A5C2F; }

      .bar-gold  { border-top:3px solid #C9A84C; margin:5px 0; }
      .bar-green { border-top:2px solid #4A5C2F; margin:3px 0; }

      .title-block { text-align:center; margin:10px 0 12px; }
      .doc-title { font-size:13.5pt; font-weight:bold; text-transform:uppercase;
        color:#4A5C2F; letter-spacing:1.5px; line-height:1.3; }
      .doc-ref { display:inline-block; margin-top:4px; font-size:8.5pt; color:#666;
        border:1px solid #C9A84C; padding:2px 10px; }

      .section { margin-bottom:10px; }
      .sec-title { font-size:9pt; font-weight:bold; color:#4A5C2F; text-transform:uppercase;
        border-left:3px solid #C9A84C; padding-left:6px; margin-bottom:6px; letter-spacing:.3px; }

      .body-text { font-size:10pt; line-height:1.65; text-align:justify; }

      .hl-box { background:#f0f3e8; border:1px solid #c8d4b0; border-left:3px solid #4A5C2F;
        padding:7px 11px; margin:5px 0; font-size:10pt; line-height:1.6; }

      .fl { display:flex; align-items:baseline; margin-bottom:3.5px; font-size:10pt; }
      .fl-lbl { color:#555; min-width:50mm; flex-shrink:0; font-size:9pt; }
      .fl-val { font-weight:bold; flex:1; border-bottom:0.5px dotted #bbb; padding-bottom:1px; }

      .amount-box { background:#fdf8ec; border:1px solid #e8d9a0; border-left:3px solid #C9A84C;
        padding:8px 12px; margin:7px 0; }
      .amount-num { font-size:13pt; font-weight:bold; color:#4A5C2F; }
      .amount-ltr { font-size:9pt; color:#555; font-style:italic; margin-top:2px; }

      .legal-box { font-size:9pt; line-height:1.65; color:#333; text-align:justify;
        background:#fafafa; border:1px solid #e8e8e8; padding:8px 10px; }

      .signatures { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:18px; }
      .sign-block { text-align:center; }
      .sign-title { font-size:9pt; font-weight:bold; }
      .sign-sub { font-size:8pt; color:#555; margin-bottom:20px; }
      .sign-line { border-top:1px solid #333; width:72%; margin:0 auto; }
      .sign-note { font-size:7.5pt; color:#888; margin-top:3px; }

      .footer-note { margin-top:14px; padding-top:6px; border-top:1px solid #ddd;
        text-align:center; font-size:7.5pt; color:#aaa; }

      @media print { body { padding:10mm 14mm; } }
    </style>
  </head><body>

    <div class="header">
      <img src="${logoUrl}" alt="Logo" class="logo" />
      <div class="header-center">
        <p class="republic">REPUBLIQUE DU SENEGAL</p>
        <p class="motto">Un Peuple — Un But — Une Foi</p>
        <p class="ministry">MINISTERE DES FINANCES ET DU BUDGET</p>
        <p class="dgd">DIRECTION GENERALE DES DOUANES</p>
      </div>
      <img src="${logoUrl}" alt="Logo" class="logo" />
    </div>

    <div class="bar-gold"></div>

    <div class="ref-block">
      <span class="ref-hierarchy">
        ${rt.directionRegionale || "Direction Régionale"}
        ${rt.subdivision ? " &rsaquo; " + rt.subdivision : ""}
        ${rt.brigade ? " &rsaquo; " + rt.brigade : ""}
      </span>
      <span class="ref-ac">Réf. : AC N° ${rt.referenceAC || "___/DGD/DOD/DRSE/SDT/BMG"}</span>
    </div>

    <div class="bar-green"></div>

    <div class="title-block">
      <p class="doc-title">Règlement Transactionnel<br>Avant ou Après Jugement</p>
      <p class="doc-ref">
        Saisie N° ${saisie.numero} &nbsp;·&nbsp; PV N° ${saisie.numeroPV || "—"}
      </p>
    </div>

    <!-- 1. EXPOSÉ DES FAITS -->
    <div class="section">
      <p class="sec-title">1. Exposé sommaire des faits</p>
      <p class="body-text">
        Nous soussignés, <strong>${rt.agents || "agents verbalisateurs des Douanes"}</strong>,
        avons procédé le <strong>${dateF}</strong> à <strong>${saisie.heure || "—"}</strong>,
        au niveau de <strong>${rt.lieu || saisie.lieu}</strong>, à un contrôle douanier
        au cours duquel nous avons constaté et procédé à la saisie des marchandises ci-après :
      </p>
      <div class="hl-box" style="margin-top:6px;">
        <strong>Nature :</strong> ${saisie.nature}<br>
        <strong>Quantité :</strong> ${saisie.quantite} ${saisie.unite}<br>
        ${saisie.description ? "<strong>Description :</strong> " + saisie.description + "<br>" : ""}
        <strong>Valeur estimée :</strong> <span style="color:#4A5C2F;font-weight:bold;">${Number(saisie.valeur).toLocaleString("fr-SN")} FCFA</span>
      </div>
    </div>

    <!-- 2. QUALIFICATION DE L'INFRACTION -->
    <div class="section">
      <p class="sec-title">2. Qualification précise de l'infraction</p>
      <div class="hl-box">
        <strong>Nature de l'infraction :</strong> ${rt.infraction || saisie.nature}<br>
        <strong>Articles du Code des Douanes violés :</strong> Articles ${rt.articles}
      </div>
    </div>

    <!-- 3. L'INTÉRESSÉ -->
    <div class="section">
      <p class="sec-title">3. L'intéressé</p>
      <div class="fl"><span class="fl-lbl">Nom et prénom :</span><span class="fl-val">${rt.nom} ${rt.prenom}</span></div>
      <div class="fl"><span class="fl-lbl">Date de naissance :</span><span class="fl-val">${rt.dateNaissance || "—"}</span></div>
      <div class="fl"><span class="fl-lbl">Lieu de naissance :</span><span class="fl-val">${rt.lieuNaissance || "—"}</span></div>
      <div class="fl"><span class="fl-lbl">Adresse :</span><span class="fl-val">${rt.adresse || "—"}</span></div>
      <div class="fl"><span class="fl-lbl">Profession :</span><span class="fl-val">${rt.profession || "—"}</span></div>
      <div class="fl"><span class="fl-lbl">Qualité :</span><span class="fl-val">${rt.role}</span></div>
    </div>

    <!-- 4. AUTORITÉ COMPÉTENTE -->
    <div class="section">
      <p class="sec-title">4. Autorité compétente</p>
      <p class="body-text">
        M. <strong>${rt.directeurRegional || "Le Directeur Régional"}</strong>,
        Directeur Régional des Douanes de la
        <strong>${rt.directionRegionale || "Direction Régionale concernée"}</strong>.
      </p>
    </div>

    <!-- 5. DÉCISION -->
    <div class="section">
      <p class="sec-title">5. Décision statuant à titre définitif</p>
      <div class="fl"><span class="fl-lbl">Numéro de décision :</span><span class="fl-val">${rt.decisionNumero || "—"}</span></div>
      <div class="fl"><span class="fl-lbl">Date :</span><span class="fl-val">${decisionDateF}</span></div>
    </div>

    <!-- 6. AUTORITÉ QUI FAIT SOUSCRIRE -->
    <div class="section">
      <p class="sec-title">6. Autorité qui fait souscrire l'acte</p>
      <p class="body-text">
        M. <strong>${rt.chefSubdivision || "Le Chef de Subdivision"}</strong>,
        Chef de la Subdivision des Douanes${rt.subdivision ? " de <strong>" + rt.subdivision + "</strong>" : ""}.
      </p>
    </div>

    <!-- 7. CONDITIONS DE RÈGLEMENT -->
    <div class="section">
      <p class="sec-title">7. Conditions de règlement</p>
      <p class="body-text">
        En application des dispositions de l'article 279 du Code des Douanes, il est proposé
        à l'intéressé de régler transactionnellement les infractions relevées contre lui,
        aux conditions suivantes :
      </p>
      <div class="amount-box">
        <p style="font-size:8.5pt;color:#888;margin-bottom:4px;">Montant de l'amende transactionnelle :</p>
        <p class="amount-num">${montantFormatted} FCFA</p>
        ${rt.montantLettres ? '<p class="amount-ltr">(' + rt.montantLettres + ')</p>' : ""}
      </div>
      <p class="body-text">
        Le règlement de la présente transaction donne lieu à la délivrance de la quittance RS
        N° <strong>${rt.numeroQuittance || "—"}</strong> et emporte
        <strong>${rt.mainlevee}</strong> de la marchandise saisie décrite au paragraphe 1 ci-dessus.
      </p>
    </div>

    <!-- 8. CLAUSES PARTICULIÈRES -->
    <div class="section">
      <p class="sec-title">8. Clauses particulières au règlement transactionnel provisoire</p>
      <p class="legal-box">
        La présente transaction est conclue sous réserve des droits du Trésor et ne constitue pas
        un aveu de culpabilité de la part de l'intéressé. Elle n'est définitive qu'après approbation
        par l'autorité compétente conformément à l'article 280 du Code des Douanes. En cas de
        non-paiement dans les délais impartis, la présente transaction devient caduque de plein droit
        et les poursuites reprennent leur cours sans qu'il soit besoin d'aucune formalité préalable.
        L'intéressé reconnaît avoir pris connaissance des infractions qui lui sont reprochées et
        accepte sans réserve les conditions du présent règlement transactionnel.
      </p>
    </div>

    <!-- SIGNATURES -->
    <div class="signatures">
      <div class="sign-block">
        <p class="sign-title">L'Intéressé</p>
        <p class="sign-sub">${rt.nom} ${rt.prenom}</p>
        <div class="sign-line"></div>
        <p class="sign-note">Lu et approuvé — Signature</p>
      </div>
      <div class="sign-block">
        <p class="sign-title">Pour le Chef de Subdivision</p>
        <p class="sign-sub">Le Chef de Brigade</p>
        <div class="sign-line"></div>
        <p class="sign-note">Signature et cachet officiel</p>
      </div>
    </div>

    <p class="footer-note">
      Document établi le ${new Date().toLocaleDateString("fr-SN")} —
      Douanes de la République du Sénégal — ${rt.brigade || "Brigade des Douanes"}
    </p>

  </body></html>`;

  const win = window.open("", "_blank", "width=940,height=760");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function SaisiesPage() {
  const { isReadOnly, user } = useRole();
  const [saisies, setSaisies] = useState<Saisie[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Règlement Transactionnel
  const [rtSaisie, setRtSaisie] = useState<Saisie | null>(null);
  const [rtForm, setRtForm] = useState<RTFormState>(EMPTY_RT_FORM);
  const [rtSaving, setRtSaving] = useState(false);

  // PV de Saisie complet
  const [pvSaisie, setPvSaisie] = useState<Saisie | null>(null);
  const [pvForm, setPvForm] = useState<PVFormState>(EMPTY_PV_FORM);
  const [pvSaving, setPvSaving] = useState(false);

  // Mois courant
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Charger toutes les saisies du mois en cours
  useEffect(() => {
    async function load() {
      const firstDay = `${currentMonth}-01`;
      const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString().split("T")[0];
      const { data } = await supabase
        .from("saisies")
        .select("*")
        .gte("date", firstDay)
        .lte("date", lastDay);
      const list = (data ?? []).map((d) => ({
        ...d,
        numeroPV: d.numero_pv ?? d.numeroPV ?? "",
        createdBy: d.created_by ?? d.createdBy ?? "",
      })) as Saisie[];
      list.sort((a, b) => b.date.localeCompare(a.date) || b.heure.localeCompare(a.heure));
      setSaisies(list);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Saisie CRUD ──────────────────────────────────────────────────────────────

  function openNew() {
    const d = new Date();
    setForm({
      ...EMPTY_FORM,
      date:  d.toISOString().split("T")[0],
      heure: d.toTimeString().slice(0, 5),
    });
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(s: Saisie) {
    setForm({
      date: s.date, heure: s.heure, nature: s.nature,
      description: s.description, quantite: s.quantite,
      unite: s.unite, valeur: String(s.valeur),
      lieu: s.lieu, proprietaire: s.proprietaire,
      numeroPV: s.numeroPV, agent: s.agent,
      observations: s.observations, statut: s.statut,
    });
    setEditingId(s.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  const f = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  async function handleSave() {
    if (!form.nature.trim() || !form.lieu.trim() || !form.agent.trim() || !form.proprietaire.trim()) return;
    setSaving(true);
    const payload = {
      date: form.date, heure: form.heure,
      nature: form.nature.trim(), description: form.description.trim(),
      quantite: form.quantite.trim(), unite: form.unite,
      valeur: parseFloat(form.valeur) || 0,
      lieu: form.lieu.trim(), proprietaire: form.proprietaire.trim(),
      numeroPV: form.numeroPV.trim(), agent: form.agent.trim(),
      observations: form.observations.trim(), statut: form.statut,
    };

    try {
      if (editingId) {
        const { numeroPV: pvNum, ...updateRest } = payload;
        const { error } = await supabase
          .from("saisies")
          .update({ ...updateRest, numero_pv: pvNum })
          .eq("id", editingId);
        if (error) throw error;
        setSaisies((prev) => prev.map((s) => s.id === editingId ? { ...s, ...payload } : s));
      } else {
        const year = new Date(form.date).getFullYear();
        const numero = await getNextNumero(year);
        const { numeroPV, ...rest } = payload;
        const { data: newRow, error } = await supabase
          .from("saisies")
          .insert({ ...rest, numero, numero_pv: numeroPV, created_by: profile?.id ?? "", brigade_id: profile?.brigadeId ?? null })
          .select()
          .single();
        if (error) throw error;
        if (newRow) setSaisies((prev) => [{ id: newRow.id, numero, ...payload }, ...prev]);
      }
      closeForm();
    } catch (error) {
      console.error("[Saisies] Erreur sauvegarde:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from("saisies").delete().eq("id", id);
      if (error) { console.error("[Saisies] Erreur suppression:", error); return; }
      setSaisies((prev) => prev.filter((s) => s.id !== id));
    } catch (error) {
      console.error("[Saisies] Erreur suppression:", error);
    } finally {
      setConfirmDeleteId(null);
    }
  }

  // ── Règlement Transactionnel ─────────────────────────────────────────────────

  function openRT(s: Saisie) {
    const d = new Date();
    setRtForm({
      ...EMPTY_RT_FORM,
      agents: s.agent,
      nom: s.proprietaire,
      prenom: "",
      infraction: s.nature,
      lieu: s.lieu,
      date: s.date || d.toISOString().split("T")[0],
    });
    setRtSaisie(s);
    setShowForm(false);
  }

  function closeRT() {
    setRtSaisie(null);
  }

  const rf = (k: keyof RTFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setRtForm((p) => ({ ...p, [k]: e.target.value }));

  async function handleSaveRT() {
    if (!rtSaisie) return;
    setRtSaving(true);
    await supabase.from("reglements_transactionnels").insert({
      saisie_id: rtSaisie.id,
      saisie_numero: rtSaisie.numero,
      ...rtForm,
      montant: parseFloat(rtForm.montant) || 0,
      montant_lettres: rtForm.montantLettres,
      reference_ac: rtForm.referenceAC,
    });
    printRT(rtSaisie, rtForm);
    setRtSaving(false);
    closeRT();
  }

  // ── PV de Saisie complet ─────────────────────────────────────────────────────

  function openPV(s: Saisie) {
    setPvForm({
      ...EMPTY_PV_FORM,
      agentsVerbalisateurs: s.agent,
      nomPrevenu: s.proprietaire,
      lieuCloture: s.lieu,
      dateCloture: s.date || new Date().toISOString().split("T")[0],
    });
    setPvSaisie(s);
    setShowForm(false);
  }

  function closePV() {
    setPvSaisie(null);
  }

  const pf = (k: keyof PVFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setPvForm((p) => ({ ...p, [k]: e.target.value }));

  const pfCheck = (k: keyof PVFormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setPvForm((p) => ({ ...p, [k]: e.target.checked ? "true" : "" }));

  async function handleSavePV() {
    if (!pvSaisie) return;
    setPvSaving(true);
    await supabase.from("pv_saisies").insert({
      saisie_id: pvSaisie.id,
      saisie_numero: pvSaisie.numero,
      ...pvForm,
    });
    printPVDetailed(pvSaisie, pvForm);
    setPvSaving(false);
    closePV();
  }

  // ── Stats ────────────────────────────────────────────────────────────────────

  const totalValeur = saisies.reduce((s, x) => s + x.valeur, 0);
  const enInstance  = saisies.filter((s) => s.statut === "En instance").length;

  // ── Styles helpers ────────────────────────────────────────────────────────────

  const inputCls = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A5C2F]";
  const labelCls = "block text-xs font-semibold text-gray-500 uppercase mb-1.5";
  const selectCls = inputCls + " bg-white";

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 px-8 py-8 overflow-y-auto">

        {/* En-tête */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#4A5C2F]">Saisies et Règlement</h1>
            <p className="text-sm text-gray-400 mt-1">Registre des saisies et règlements transactionnels</p>
          </div>
          {!isReadOnly && (
            <button onClick={openNew}
              className="flex items-center gap-2 bg-[#4A5C2F] hover:bg-[#3b4a25] text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Nouvelle saisie
            </button>
          )}
        </div>
        {isReadOnly && <ReadOnlyBanner />}

        {/* Statistiques */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Saisies ce mois", value: saisies.length, color: "text-[#4A5C2F]" },
            { label: "Valeur totale", value: totalValeur.toLocaleString("fr-SN") + " FCFA", color: "text-[#C9A84C]" },
            { label: "En instance", value: enInstance, color: "text-orange-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Formulaire saisie */}
        {showForm && !isReadOnly && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <h2 className="font-bold text-gray-800 mb-5 text-base">
              {editingId ? "Modifier la saisie" : "Nouvelle saisie"}
            </h2>
            <div className="grid grid-cols-3 gap-4">

              <div>
                <label className={labelCls}>Date</label>
                <input type="date" value={form.date} onChange={f("date")} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Heure</label>
                <input type="time" value={form.heure} onChange={f("heure")} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>N° Procès-Verbal</label>
                <input value={form.numeroPV} onChange={f("numeroPV")} placeholder="PV-2026-001" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Nature de la marchandise *</label>
                <input value={form.nature} onChange={f("nature")} placeholder="Ex : Carburant, Cigarettes…" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Quantité</label>
                <input value={form.quantite} onChange={f("quantite")} placeholder="Ex : 500" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Unité</label>
                <select value={form.unite} onChange={f("unite")} className={selectCls}>
                  {UNITES.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>Valeur estimée (FCFA)</label>
                <input type="number" value={form.valeur} onChange={f("valeur")} placeholder="0" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Lieu / Zone *</label>
                <input value={form.lieu} onChange={f("lieu")} placeholder="Ex : Axe RN1, Poste frontière…" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Agent verbalisateur *</label>
                <input value={form.agent} onChange={f("agent")} placeholder="Nom et prénom" className={inputCls} />
              </div>

              <div className="col-span-2">
                <label className={labelCls}>Propriétaire / Contrevenant *</label>
                <input value={form.proprietaire} onChange={f("proprietaire")} placeholder="Nom complet et adresse" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Statut</label>
                <select value={form.statut} onChange={f("statut")} className={selectCls}>
                  {STATUTS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div className="col-span-3">
                <label className={labelCls}>Description détaillée</label>
                <textarea value={form.description} onChange={f("description")}
                  placeholder="Description précise des marchandises saisies…"
                  rows={2} className={inputCls + " resize-none"} />
              </div>
              <div className="col-span-3">
                <label className={labelCls}>Observations</label>
                <textarea value={form.observations} onChange={f("observations")}
                  placeholder="Observations complémentaires…"
                  rows={2} className={inputCls + " resize-none"} />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button onClick={closeForm}
                className="px-5 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Annuler
              </button>
              <button onClick={handleSave}
                disabled={saving || !form.nature.trim() || !form.lieu.trim() || !form.agent.trim() || !form.proprietaire.trim()}
                className="px-6 py-2 text-sm font-semibold text-white bg-[#4A5C2F] hover:bg-[#3b4a25] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? "Enregistrement…" : editingId ? "Mettre à jour" : "Enregistrer"}
              </button>
            </div>
          </div>
        )}

        {/* Tableau */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              <div className="w-6 h-6 border-2 border-[#4A5C2F] border-t-transparent rounded-full animate-spin mr-3" />
              Chargement…
            </div>
          ) : saisies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mb-3 opacity-30" fill="none"
                viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-sm">Aucune saisie enregistrée ce mois</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["N°", "Date", "Nature", "Quantité", "Valeur FCFA", "Lieu", "Contrevenant", "Agent", "Statut", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {saisies.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-[#4A5C2F] whitespace-nowrap">{s.numero}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      <p>{new Date(s.date + "T12:00:00").toLocaleDateString("fr-SN", { day: "numeric", month: "short" })}</p>
                      <p className="text-xs text-gray-400">{s.heure}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{s.nature}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.quantite} {s.unite}</td>
                    <td className="px-4 py-3 font-semibold text-[#4A5C2F] whitespace-nowrap">
                      {Number(s.valeur).toLocaleString("fr-SN")}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[110px] truncate">{s.lieu}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[110px] truncate">{s.proprietaire}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.agent}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${STATUT_STYLES[s.statut]}`}>
                        {s.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">

                      {/* Rédiger / Imprimer PV complet — toujours visible */}
                      <button onClick={() => openPV(s)} title="Procès-Verbal de Saisie"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-[#4A5C2F] hover:bg-[#4A5C2F]/10 transition-colors mr-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                          viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                      </button>

                      {!isReadOnly && (
                        <>
                          {/* Règlement Transactionnel */}
                          <button onClick={() => openRT(s)} title="Règlement Transactionnel"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-colors mr-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>

                          {/* Modifier */}
                          <button onClick={() => openEdit(s)} title="Modifier"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-[#4A5C2F] hover:bg-[#4A5C2F]/10 transition-colors mr-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>

                          {/* Supprimer */}
                          <button onClick={() => setConfirmDeleteId(s.id)} title="Supprimer"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
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
      </div>

      {/* ── Modal PV de Saisie complet ─────────────────────────────────────────── */}
      {pvSaisie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closePV} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#4A5C2F] text-white shrink-0">
              <div>
                <p className="font-bold text-base tracking-wide">Procès-Verbal de Saisie</p>
                <p className="text-white/70 text-xs mt-0.5">Saisie {pvSaisie.numero} — {pvSaisie.nature}</p>
              </div>
              <button onClick={closePV}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors text-white/80 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Corps */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

              {/* Références hiérarchiques */}
              <section>
                <p className="text-xs font-bold text-[#4A5C2F] uppercase tracking-wider mb-3 border-b border-[#C9A84C] pb-1">
                  Références hiérarchiques
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Direction Régionale</label>
                    <input value={pvForm.directionRegionale} onChange={pf("directionRegionale")}
                      placeholder="Ex : Direction Régionale du Sud-Est" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Subdivision</label>
                    <input value={pvForm.subdivision} onChange={pf("subdivision")}
                      placeholder="Ex : Subdivision de Tambacounda" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Brigade</label>
                    <input value={pvForm.brigade} onChange={pf("brigade")}
                      placeholder="Ex : Brigade Mobile de Goudiry" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>N° Dossier</label>
                    <input value={pvForm.numeroDossier} onChange={pf("numeroDossier")}
                      placeholder="Ex : DOS-2026-042" className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Référence AC N°</label>
                    <input value={pvForm.numeroAC} onChange={pf("numeroAC")}
                      placeholder="Ex : 001/DGD/DOD/DRSE/SDT/BMG" className={inputCls} />
                  </div>
                </div>
              </section>

              {/* 1. Date et lieu */}
              <section>
                <p className="text-xs font-bold text-[#4A5C2F] uppercase tracking-wider mb-3 border-b border-[#C9A84C] pb-1">
                  1. Date et lieu de la saisie
                </p>
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600 border border-gray-100">
                  <span className="font-semibold text-gray-800">Date :</span>{" "}
                  {pvSaisie.date ? new Date(pvSaisie.date + "T12:00:00").toLocaleDateString("fr-SN", { day: "numeric", month: "long", year: "numeric" }) : "—"}
                  {" · "}
                  <span className="font-semibold text-gray-800">Heure :</span> {pvSaisie.heure || "—"}
                  {" · "}
                  <span className="font-semibold text-gray-800">Lieu :</span> {pvSaisie.lieu}
                </div>
              </section>

              {/* 2. Nature du délit */}
              <section>
                <p className="text-xs font-bold text-[#4A5C2F] uppercase tracking-wider mb-3 border-b border-[#C9A84C] pb-1">
                  2. Nature du délit
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {[
                    { key: "delitContrebande" as keyof PVFormState, label: "Contrebande" },
                    { key: "delitOpposition" as keyof PVFormState, label: "Opposition aux fonctions" },
                    { key: "delitFausseDeclaration" as keyof PVFormState, label: "Fausse déclaration" },
                    { key: "delitSansDeclaration" as keyof PVFormState, label: "Import./Export. sans déclaration" },
                    { key: "delitDetentionIllicite" as keyof PVFormState, label: "Détention illicite de marchandises" },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={pvForm[key] === "true"}
                        onChange={pfCheck(key)}
                        className="w-4 h-4 accent-[#4A5C2F] rounded"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <div className="mt-3">
                  <label className={labelCls}>Autre délit (préciser)</label>
                  <input value={pvForm.delitAutre} onChange={pf("delitAutre")}
                    placeholder="Description de l'autre délit" className={inputCls} />
                </div>
              </section>

              {/* 3. Articles */}
              <section>
                <p className="text-xs font-bold text-[#4A5C2F] uppercase tracking-wider mb-3 border-b border-[#C9A84C] pb-1">
                  3. Articles du Code des Douanes et références législatives
                </p>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className={labelCls}>Articles du Code des Douanes</label>
                    <input value={pvForm.articles} onChange={pf("articles")}
                      placeholder="Ex : 203, 204, 215, 217, 218" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Références législatives</label>
                    <input value={pvForm.referencesLegislatives} onChange={pf("referencesLegislatives")}
                      placeholder="Ex : Loi n° 2014-10 du 28 février 2014 portant Code des Douanes" className={inputCls} />
                  </div>
                </div>
              </section>

              {/* 4. Personnes concernées */}
              <section>
                <p className="text-xs font-bold text-[#4A5C2F] uppercase tracking-wider mb-3 border-b border-[#C9A84C] pb-1">
                  4. Personne(s) concernée(s)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Nom *</label>
                    <input value={pvForm.nomPrevenu} onChange={pf("nomPrevenu")}
                      placeholder="Nom de famille" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Prénom *</label>
                    <input value={pvForm.prenomPrevenu} onChange={pf("prenomPrevenu")}
                      placeholder="Prénom(s)" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Profession</label>
                    <input value={pvForm.professionPrevenu} onChange={pf("professionPrevenu")}
                      placeholder="Ex : Commerçant" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Adresse</label>
                    <input value={pvForm.adressePrevenu} onChange={pf("adressePrevenu")}
                      placeholder="Adresse complète" className={inputCls} />
                  </div>
                </div>
              </section>

              {/* 5. Agents verbalisateurs */}
              <section>
                <p className="text-xs font-bold text-[#4A5C2F] uppercase tracking-wider mb-3 border-b border-[#C9A84C] pb-1">
                  5. Agents verbalisateurs
                </p>
                <textarea value={pvForm.agentsVerbalisateurs} onChange={pf("agentsVerbalisateurs")}
                  placeholder="Ex : Brig. Ibrahima SOW, Agent de constatation ; Lt Amadou FALL, Chef de Poste"
                  rows={3} className={inputCls + " resize-none"} />
              </section>

              {/* 6. Rapport */}
              <section>
                <p className="text-xs font-bold text-[#4A5C2F] uppercase tracking-wider mb-3 border-b border-[#C9A84C] pb-1">
                  6. Rapport (circonstances de la saisie)
                </p>
                <textarea value={pvForm.rapport} onChange={pf("rapport")}
                  placeholder="Décrivez les circonstances dans lesquelles la saisie a été effectuée…"
                  rows={4} className={inputCls + " resize-none"} />
              </section>

              {/* 7. Objets saisis — lecture seule depuis la saisie */}
              <section>
                <p className="text-xs font-bold text-[#4A5C2F] uppercase tracking-wider mb-3 border-b border-[#C9A84C] pb-1">
                  7. Objets saisis avec valeurs estimées
                </p>
                <div className="bg-[#f5f7f0] border border-[#d4dcc4] rounded-lg px-4 py-3 text-sm space-y-1">
                  <p><span className="font-semibold text-gray-700">Nature :</span> {pvSaisie.nature}</p>
                  <p><span className="font-semibold text-gray-700">Quantité :</span> {pvSaisie.quantite} {pvSaisie.unite}</p>
                  {pvSaisie.description && <p><span className="font-semibold text-gray-700">Description :</span> {pvSaisie.description}</p>}
                  <p><span className="font-semibold text-gray-700">Valeur estimée :</span>{" "}
                    <span className="font-bold text-[#4A5C2F]">{Number(pvSaisie.valeur).toLocaleString("fr-SN")} FCFA</span>
                  </p>
                </div>
              </section>

              {/* 8. Sanctions encourues */}
              <section>
                <p className="text-xs font-bold text-[#4A5C2F] uppercase tracking-wider mb-3 border-b border-[#C9A84C] pb-1">
                  8. Sanctions encourues
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Amende (montant ou formule)</label>
                    <input value={pvForm.sanctionAmende} onChange={pf("sanctionAmende")}
                      placeholder="Ex : Selon barème en vigueur — art. 218 CDC" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Confiscation</label>
                    <select value={pvForm.sanctionConfiscation} onChange={pf("sanctionConfiscation")} className={selectCls}>
                      <option value="">Non</option>
                      <option value="oui">Oui — confiscation des marchandises</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Emprisonnement</label>
                    <input value={pvForm.sanctionEmprisonnement} onChange={pf("sanctionEmprisonnement")}
                      placeholder="Ex : De 1 à 3 ans (art. 218)" className={inputCls} />
                  </div>
                </div>
              </section>

              {/* 9. Déclarations de l'intéressé */}
              <section>
                <p className="text-xs font-bold text-[#4A5C2F] uppercase tracking-wider mb-3 border-b border-[#C9A84C] pb-1">
                  9. Déclarations de l&apos;intéressé
                </p>
                <textarea value={pvForm.declarationsInteresse} onChange={pf("declarationsInteresse")}
                  placeholder="Déclarations faites par le prévenu, ou « Refuse de signer et de déclarer »"
                  rows={3} className={inputCls + " resize-none"} />
              </section>

              {/* 10. Formalités de clôture */}
              <section>
                <p className="text-xs font-bold text-[#4A5C2F] uppercase tracking-wider mb-3 border-b border-[#C9A84C] pb-1">
                  10. Formalités de clôture
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Date de clôture</label>
                    <input type="date" value={pvForm.dateCloture} onChange={pf("dateCloture")} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Lieu de clôture</label>
                    <input value={pvForm.lieuCloture} onChange={pf("lieuCloture")}
                      placeholder={pvSaisie.lieu} className={inputCls} />
                  </div>
                </div>
              </section>

            </div>

            {/* Footer */}
            <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0">
              <p className="text-xs text-gray-400">
                Le PV sera enregistré et imprimé automatiquement.
              </p>
              <div className="flex gap-3">
                <button onClick={closePV}
                  className="px-5 py-2 text-sm text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg transition-colors">
                  Annuler
                </button>
                <button
                  onClick={handleSavePV}
                  disabled={pvSaving || !pvForm.nomPrevenu.trim()}
                  className="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-[#4A5C2F] hover:bg-[#3b4a25] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  {pvSaving ? "Enregistrement…" : "Enregistrer & Imprimer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Règlement Transactionnel ─────────────────────────────────────── */}
      {rtSaisie && !isReadOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeRT} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">

            {/* Header modal */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#4A5C2F] text-white shrink-0">
              <div>
                <p className="font-bold text-base tracking-wide">Règlement Transactionnel</p>
                <p className="text-white/70 text-xs mt-0.5">Saisie {rtSaisie.numero} — {rtSaisie.nature}</p>
              </div>
              <button onClick={closeRT}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors text-white/80 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Corps du formulaire */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

              {/* Références hiérarchiques */}
              <section>
                <p className="text-xs font-bold text-[#4A5C2F] uppercase tracking-wider mb-3 border-b border-[#C9A84C] pb-1">
                  Références hiérarchiques
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Référence AC N°</label>
                    <input value={rtForm.referenceAC} onChange={rf("referenceAC")}
                      placeholder="001/DGD/DOD/DRSE/SDT/BMG" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Direction Régionale</label>
                    <input value={rtForm.directionRegionale} onChange={rf("directionRegionale")}
                      placeholder="Ex : Direction Régionale du Sud-Est" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Subdivision</label>
                    <input value={rtForm.subdivision} onChange={rf("subdivision")}
                      placeholder="Ex : Subdivision de Tambacounda" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Brigade</label>
                    <input value={rtForm.brigade} onChange={rf("brigade")}
                      placeholder="Ex : Brigade Mobile de Goudiry" className={inputCls} />
                  </div>
                </div>
              </section>

              {/* Exposé des faits */}
              <section>
                <p className="text-xs font-bold text-[#4A5C2F] uppercase tracking-wider mb-3 border-b border-[#C9A84C] pb-1">
                  1. Exposé sommaire des faits
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Agents verbalisateurs (grade, nom, fonction)</label>
                    <textarea value={rtForm.agents} onChange={rf("agents")}
                      placeholder="Ex : Lt Amadou FALL, Chef de Poste ; Brig. Ibrahima SOW, Agent de constatation"
                      rows={2} className={inputCls + " resize-none"} />
                  </div>
                  <div>
                    <label className={labelCls}>Lieu du contrôle</label>
                    <input value={rtForm.lieu} onChange={rf("lieu")}
                      placeholder={rtSaisie.lieu} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Date du contrôle</label>
                    <input type="date" value={rtForm.date} onChange={rf("date")} className={inputCls} />
                  </div>
                </div>
              </section>

              {/* Qualification de l'infraction */}
              <section>
                <p className="text-xs font-bold text-[#4A5C2F] uppercase tracking-wider mb-3 border-b border-[#C9A84C] pb-1">
                  2. Qualification de l&apos;infraction
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Nature de l&apos;infraction</label>
                    <input value={rtForm.infraction} onChange={rf("infraction")}
                      placeholder={rtSaisie.nature} className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Articles du Code des Douanes violés</label>
                    <input value={rtForm.articles} onChange={rf("articles")}
                      placeholder="Ex : 21, 279, 280, 330, 396, 390" className={inputCls} />
                  </div>
                </div>
              </section>

              {/* L'intéressé */}
              <section>
                <p className="text-xs font-bold text-[#4A5C2F] uppercase tracking-wider mb-3 border-b border-[#C9A84C] pb-1">
                  3. L&apos;intéressé
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Nom *</label>
                    <input value={rtForm.nom} onChange={rf("nom")} placeholder="Nom de famille" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Prénom *</label>
                    <input value={rtForm.prenom} onChange={rf("prenom")} placeholder="Prénom(s)" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Date de naissance</label>
                    <input type="date" value={rtForm.dateNaissance} onChange={rf("dateNaissance")} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Lieu de naissance</label>
                    <input value={rtForm.lieuNaissance} onChange={rf("lieuNaissance")} placeholder="Ville, Pays" className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Adresse</label>
                    <input value={rtForm.adresse} onChange={rf("adresse")} placeholder="Adresse complète" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Profession</label>
                    <input value={rtForm.profession} onChange={rf("profession")} placeholder="Ex : Commerçant" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Rôle / Qualité</label>
                    <select value={rtForm.role} onChange={rf("role")} className={selectCls}>
                      <option>responsable principal</option>
                      <option>complice</option>
                      <option>transporteur</option>
                      <option>propriétaire de la marchandise</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Autorités */}
              <section>
                <p className="text-xs font-bold text-[#4A5C2F] uppercase tracking-wider mb-3 border-b border-[#C9A84C] pb-1">
                  4 – 6. Autorités compétentes
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Nom du Directeur Régional</label>
                    <input value={rtForm.directeurRegional} onChange={rf("directeurRegional")}
                      placeholder="Prénom NOM" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Nom du Chef de Subdivision</label>
                    <input value={rtForm.chefSubdivision} onChange={rf("chefSubdivision")}
                      placeholder="Prénom NOM" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>N° de décision définitive</label>
                    <input value={rtForm.decisionNumero} onChange={rf("decisionNumero")}
                      placeholder="Ex : DEC-2026-042" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Date de la décision</label>
                    <input type="date" value={rtForm.decisionDate} onChange={rf("decisionDate")} className={inputCls} />
                  </div>
                </div>
              </section>

              {/* Conditions de règlement */}
              <section>
                <p className="text-xs font-bold text-[#4A5C2F] uppercase tracking-wider mb-3 border-b border-[#C9A84C] pb-1">
                  7. Conditions de règlement
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Montant de la transaction (FCFA) *</label>
                    <input type="number" value={rtForm.montant} onChange={rf("montant")}
                      placeholder="0" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>N° Quittance RS</label>
                    <input value={rtForm.numeroQuittance} onChange={rf("numeroQuittance")}
                      placeholder="Ex : RS-2026-0042" className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Montant en lettres</label>
                    <input value={rtForm.montantLettres} onChange={rf("montantLettres")}
                      placeholder="Ex : Cinq cent mille francs CFA" className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Décision de mainlevée / saisie</label>
                    <select value={rtForm.mainlevee} onChange={rf("mainlevee")} className={selectCls}>
                      <option>Mainlevée de la marchandise</option>
                      <option>Mainlevée de la marchandise pour la réexportation</option>
                      <option>Saisie de la marchandise</option>
                    </select>
                  </div>
                </div>
              </section>

            </div>

            {/* Footer modal */}
            <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0">
              <p className="text-xs text-gray-400">
                Le document sera enregistré et imprimé automatiquement.
              </p>
              <div className="flex gap-3">
                <button onClick={closeRT}
                  className="px-5 py-2 text-sm text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg transition-colors">
                  Annuler
                </button>
                <button
                  onClick={handleSaveRT}
                  disabled={rtSaving || !rtForm.nom.trim() || !rtForm.montant.trim()}
                  className="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-[#C9A84C] hover:bg-[#b8963e] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  {rtSaving ? "Enregistrement…" : "Enregistrer & Imprimer"}
                </button>
              </div>
            </div>
          </div>
        </div>
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
                <p className="font-bold text-gray-800">Supprimer cette saisie ?</p>
                <p className="text-xs text-gray-500 mt-0.5">Cette action est irréversible.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteId(null)}
                className="px-5 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Annuler
              </button>
              <button onClick={() => handleDelete(confirmDeleteId)}
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

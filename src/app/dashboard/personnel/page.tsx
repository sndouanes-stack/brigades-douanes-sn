"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/useUserProfile";
import Sidebar from "@/components/Sidebar";
import ReadOnlyBanner from "@/components/ReadOnlyBanner";
import MontageModal, { type MontageRecord } from "@/components/MontageModal";
import {
  AgentDynamic, STATUTS, STATUT_STYLES, STATUT_DOT, type Statut,
} from "@/lib/agents";
import { BRIGADES, SUBDIVISIONS, DIRECTIONS_REGIONALES } from "@/lib/roles";

// ── Types ────────────────────────────────────────────────────────────────────
type PageView = "agents" | "historique" | "detail";

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(date: string) {
  return new Date(date).toLocaleDateString("fr-SN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}
function fmtShort(date: string) {
  return new Date(date).toLocaleDateString("fr-SN", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

type ResumeKey = "presents" | "patrouilles" | "barrages" | "permissionnaires" | "repos";

const RESUME_ITEMS: { key: ResumeKey; label: string; statut: Statut; color: string; dot: string }[] = [
  { key: "presents",         label: "Présents",          statut: "Présent",           color: "text-green-600",  dot: "bg-green-500"  },
  { key: "patrouilles",      label: "En patrouille",     statut: "En patrouille",     color: "text-[#4A5C2F]",  dot: "bg-[#4A5C2F]"  },
  { key: "barrages",         label: "Barrage sur route", statut: "Barrage sur route", color: "text-blue-600",   dot: "bg-blue-500"   },
  { key: "permissionnaires", label: "Permissionnaires",  statut: "Permissionnaire",   color: "text-orange-600", dot: "bg-orange-500" },
  { key: "repos",            label: "En repos",          statut: "Repos",             color: "text-gray-500",   dot: "bg-gray-400"   },
];

// Couleurs des grands boutons statut
const STATUT_BIG: Record<Statut, { active: string; inactive: string; dot: string }> = {
  "Présent":           { active: "bg-green-500 text-white border-green-500 shadow-green-200",   inactive: "bg-green-50  text-green-700  border-green-200  hover:bg-green-100",  dot: "bg-green-500"   },
  "En patrouille":     { active: "bg-[#4A5C2F] text-white border-[#4A5C2F] shadow-[#4A5C2F]/20", inactive: "bg-[#4A5C2F]/10 text-[#4A5C2F] border-[#4A5C2F]/20 hover:bg-[#4A5C2F]/20", dot: "bg-[#4A5C2F]"  },
  "Barrage sur route": { active: "bg-blue-500  text-white border-blue-500  shadow-blue-200",    inactive: "bg-blue-50   text-blue-700   border-blue-200   hover:bg-blue-100",   dot: "bg-blue-500"    },
  "Permissionnaire":   { active: "bg-orange-500 text-white border-orange-500 shadow-orange-200", inactive: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100", dot: "bg-orange-500"  },
  "Repos":             { active: "bg-gray-500  text-white border-gray-500  shadow-gray-200",    inactive: "bg-gray-100  text-gray-600   border-gray-200   hover:bg-gray-200",   dot: "bg-gray-500"    },
  "Exécution conforme à l'ordre de service": { active: "bg-purple-500 text-white border-purple-500 shadow-purple-200", inactive: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100", dot: "bg-purple-500" },
};

// ── Composant ─────────────────────────────────────────────────────────────────
export default function PersonnelPage() {
  const { user, profile, loading } = useUserProfile();
  const router = useRouter();

  // Rôle — insensible à la casse ("agent" ou "AGENT")
  const isAgent = profile?.role?.toUpperCase() === "AGENT";
  const isReadOnly = profile?.role?.toUpperCase() === "CHEF_SUBDIVISION" || profile?.role?.toUpperCase() === "DIRECTEUR_REGIONAL" || profile?.role?.toUpperCase() === "ADMIN";

  // Clé utilisée dans statuts{} du montage : matricule ou user id
  const myStatutKey = profile?.matricule ?? user?.id ?? null;

  // Infos d'affichage pour l'agent connecté
  const myNomComplet = profile
    ? `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim()
    : null;
  const myMatricule = profile?.matricule ?? null;

  // Agents dynamiques
  const [agents, setAgents] = useState<AgentDynamic[]>([]);

  // Vues
  const [view, setView] = useState<PageView>("agents");
  const [selectedMontage, setSelectedMontage] = useState<MontageRecord | null>(null);

  // Données montages
  const [allMontages, setAllMontages] = useState<MontageRecord[]>([]);
  const [todayStatuts, setTodayStatuts] = useState<Record<string, Statut>>({});
  const [montageDate, setMontageDate]   = useState<string | null>(null);
  const [loadingMontages, setLoadingMontages] = useState(true);

  // UI
  const [showModal,    setShowModal]    = useState(false);
  const [search,       setSearch]       = useState("");
  const [filterStatut, setFilterStatut] = useState<Statut | "Tous">("Tous");
  const [selfSaving,   setSelfSaving]   = useState(false);
  const [savedConfirm, setSavedConfirm] = useState(false);

  // Gestion montage — statut, suppression, édition historique
  const [statutMontageEnCours, setStatutMontageEnCours] = useState<string | null>(null);
  const [confirmDeleteMontage, setConfirmDeleteMontage] = useState<MontageRecord | null>(null);
  const [deletingMontage, setDeletingMontage] = useState(false);
  const [editingMontage, setEditingMontage] = useState<MontageRecord | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const todayLabel = fmt(today);

  // Statut actuel de l'agent connecté
  const myCurrentStatut: Statut | undefined = myStatutKey
    ? todayStatuts[myStatutKey] as Statut | undefined
    : undefined;

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  // ── Charger tous les montages ─────────────────────────────────────────────
  const fetchMontages = useCallback(async () => {
    if (!user) return;
    setLoadingMontages(true);
    try {
      const { data: rows } = await supabase.from("montages").select("*");
      const data = (rows ?? []).map((r) => ({
        ...r,
        saisiPar: r.saisi_par ?? r.saisiPar ?? "",
      })) as MontageRecord[];
      data.sort((a, b) => b.date.localeCompare(a.date));
      setAllMontages(data);
      const todayDoc = data.find((m) => m.date === today);
      if (todayDoc) {
        setTodayStatuts(todayDoc.statuts);
        setMontageDate(todayDoc.date);
      }
    } catch (err) {
      console.error("Erreur fetch montages:", err);
    } finally {
      setLoadingMontages(false);
    }
  }, [user, today]);

  useEffect(() => { fetchMontages(); }, [fetchMontages]);

  // ── Charger les agents de la brigade ─────────────────────────────────────
  const fetchAgents = useCallback(async () => {
    if (!user || !profile) return;
    try {
      let q = supabase.from("agents").select("*");
      if (profile.brigadeId) q = q.eq("brigade_id", profile.brigadeId);
      const { data } = await q;
      setAgents((data ?? []) as AgentDynamic[]);
    } catch (err) {
      console.error("Erreur fetch agents:", err);
    }
  }, [user, profile]);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  function handleAgentAdded(agent: AgentDynamic) {
    setAgents((prev) => [...prev, agent]);
  }

  // ── Sauvegarde montage complet (chef de brigade) ──────────────────────────
  function handleSaved(record: MontageRecord) {
    setTodayStatuts(record.statuts);
    setMontageDate(today);
    setAllMontages((prev) => {
      const without = prev.filter((m) => m.date !== today);
      return [record, ...without].sort((a, b) => b.date.localeCompare(a.date));
    });
  }

  // ── Suppression / mise à jour agent (depuis le modal) ─────────────────────
  function handleAgentDeleted(_agentId: string, matricule: string) {
    setAgents((prev) => prev.filter((a) => a.matricule !== matricule));
    setTodayStatuts((prev) => {
      const copy = { ...prev };
      delete copy[matricule];
      return copy;
    });
  }

  function handleAgentUpdated(updated: AgentDynamic) {
    setAgents((prev) => prev.map((a) => a.id === updated.id ? updated : a));
  }

  // ── Changement de statut d'un montage (tout montage, pas seulement aujourd'hui) ──
  async function handleChangeStatutMontage(montage: MontageRecord, newStatut: string) {
    if (!montage.id) return;
    setStatutMontageEnCours(newStatut);
    try {
      await supabase.from("montages").update({ statut: newStatut }).eq("id", montage.id);
      setAllMontages((prev) =>
        prev.map((m) =>
          m.id === montage.id ? { ...m, statut: newStatut as MontageRecord["statut"] } : m
        )
      );
      // Mettre à jour le selectedMontage si c'est celui affiché en détail
      setSelectedMontage((prev) =>
        prev?.id === montage.id ? ({ ...prev, statut: newStatut as MontageRecord["statut"] } as MontageRecord) : prev
      );
    } finally {
      setStatutMontageEnCours(null);
    }
  }

  // ── Suppression d'un montage (tout montage) ───────────────────────────────
  async function handleDeleteMontage(montage: MontageRecord) {
    if (!montage.id) return;
    setDeletingMontage(true);
    try {
      await supabase.from("montages").delete().eq("id", montage.id);
      setAllMontages((prev) => prev.filter((m) => m.id !== montage.id));
      if (montage.date === today) {
        setTodayStatuts({});
        setMontageDate(null);
      }
      setConfirmDeleteMontage(null);
      // Retour à l'historique si on était en vue détail
      if (view === "detail" && selectedMontage?.id === montage.id) {
        setView("historique");
        setSelectedMontage(null);
      }
    } finally {
      setDeletingMontage(false);
    }
  }

  // ── Mise à jour du propre statut (agent) ─────────────────────────────────
  async function handleSelfStatut(newStatut: Statut) {
    if (!myStatutKey || !user) return;
    setSelfSaving(true);
    setSavedConfirm(false);

    // Optimistic update
    setTodayStatuts((prev) => ({ ...prev, [myStatutKey]: newStatut }));

    try {
      const { data: existing } = await supabase
        .from("montages")
        .select("id, statuts")
        .eq("date", today)
        .limit(1);

      if (existing && existing.length > 0) {
        const existingId = existing[0].id;
        const mergedStatuts = { ...(existing[0].statuts ?? {}), [myStatutKey]: newStatut };
        await supabase.from("montages").update({ statuts: mergedStatuts }).eq("id", existingId);
        setAllMontages((prev) =>
          prev.map((m) =>
            m.date === today
              ? { ...m, statuts: { ...m.statuts, [myStatutKey]: newStatut } }
              : m
          )
        );
      } else {
        // Aucun montage du jour — créer un brouillon
        const defaultStatuts = Object.fromEntries(
          agents.map((a) => [a.matricule, "Présent" as Statut])
        );
        const statuts: Record<string, Statut> = { ...defaultStatuts, [myStatutKey]: newStatut };
        const resume = {
          presents:         Object.values(statuts).filter((s) => s === "Présent").length,
          patrouilles:      Object.values(statuts).filter((s) => s === "En patrouille").length,
          barrages:         Object.values(statuts).filter((s) => s === "Barrage sur route").length,
          permissionnaires: Object.values(statuts).filter((s) => s === "Permissionnaire").length,
          repos:            Object.values(statuts).filter((s) => s === "Repos").length,
        };
        const { data: newRow } = await supabase
          .from("montages")
          .insert({
            date: today,
            statuts,
            resume,
            saisi_par: user.email ?? user.id,
            statut: "Brouillon",
          })
          .select()
          .single();
        const newRecord: MontageRecord = {
          id: newRow?.id, date: today, statuts, resume,
          saisiPar: user.email ?? user.id, statut: "Brouillon",
        };
        setMontageDate(today);
        setAllMontages((prev) => [newRecord, ...prev]);
      }

      setSavedConfirm(true);
      setTimeout(() => setSavedConfirm(false), 3000);
    } catch (err) {
      console.error("Erreur maj statut:", err);
    } finally {
      setSelfSaving(false);
    }
  }

  // ── Calculs ── (uniquement sur les agents réellement saisis)
  const agentMatricules = new Set(agents.map((a) => a.matricule));
  const statutsAgentsReels = Object.fromEntries(
    Object.entries(todayStatuts).filter(([matricule]) => agentMatricules.has(matricule))
  );

  const todayCounts = {
    presents:         Object.values(statutsAgentsReels).filter((s) => s === "Présent").length,
    patrouilles:      Object.values(statutsAgentsReels).filter((s) => s === "En patrouille").length,
    barrages:         Object.values(statutsAgentsReels).filter((s) => s === "Barrage sur route").length,
    permissionnaires: Object.values(statutsAgentsReels).filter((s) => s === "Permissionnaire").length,
    repos:            Object.values(statutsAgentsReels).filter((s) => s === "Repos").length,
  };

  const lastMontage = allMontages.find((m) => m.date < today) ?? null;

  function handlePrint() {
    const win = window.open("", "_blank", "width=960,height=720");
    if (!win) return;

    const logoUrl = window.location.origin + "/images/logo-douanes.png";

    const todayMontage = allMontages.find((m) => m.date === today);
    const montageStatut = todayMontage?.statut ?? "—";

    const brigadeName = profile?.brigadeId
      ? (BRIGADES.find((b) => b.id === profile.brigadeId)?.nom ?? profile.brigadeId)
      : "Brigade des Douanes";
    const subdivName = profile?.subdivisionId
      ? (SUBDIVISIONS.find((s) => s.id === profile.subdivisionId)?.nom ?? "")
      : "";
    const drName = profile?.directionRegionaleId
      ? (DIRECTIONS_REGIONALES.find((d) => d.id === profile.directionRegionaleId)?.nom ?? "")
      : "";

    const statutColor =
      montageStatut === "Validé" ? "#16a34a" :
      montageStatut === "Exécution conforme à l'ordre de service" ? "#7c3aed" :
      "#d97706";

    const dateLabel = new Date().toLocaleDateString("fr-SN", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    const FLAG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="48" viewBox="0 0 90 60">
      <rect x="0"  y="0" width="30" height="60" fill="#00853F"/>
      <rect x="30" y="0" width="30" height="60" fill="#FDEF42"/>
      <rect x="60" y="0" width="30" height="60" fill="#E31B23"/>
      <polygon points="45,20 47.4,26.8 54.5,26.9 48.8,31.2 50.9,38.1 45,34 39.1,38.1 41.2,31.2 35.5,26.9 42.6,26.8" fill="#00853F"/>
    </svg>`;

    const rows = agents.map((agent) => {
      const statut = statutsAgentsReels[agent.matricule] as Statut | undefined;
      return `<tr>
        <td class="mono">${agent.matricule}</td>
        <td><strong>${agent.nom}</strong> ${agent.prenom}</td>
        <td>${agent.grade}</td>
        <td>${statut ?? "<span style='color:#aaa;font-style:italic'>Non renseigné</span>"}</td>
      </tr>`;
    }).join("");

    const resumeCells = RESUME_ITEMS.map((item) =>
      `<td style="text-align:center;padding:8px 6px;">
        <div style="font-size:20px;font-weight:bold;color:#4A5C2F;">${todayCounts[item.key]}</div>
        <div style="font-size:9px;color:#888;margin-top:2px;">${item.label}</div>
      </td>`
    ).join("");

    win.document.write(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<title>Montage Journalier — ${today}</title>
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
  .title-block{text-align:center;margin:10px 0 6px;}
  .doc-title{font-size:14pt;font-weight:bold;text-transform:uppercase;color:#4A5C2F;letter-spacing:1.5px;}
  .doc-date{font-size:10pt;color:#555;margin-top:4px;font-style:italic;}
  .statut-badge{display:inline-block;padding:3px 14px;border-radius:20px;font-size:9pt;
    font-weight:bold;border:1px solid;margin-top:6px;}
  .meta{font-size:9pt;color:#666;text-align:center;margin-bottom:12px;}
  .resume-table{width:100%;border-collapse:collapse;margin-bottom:16px;
    background:#f0f4ea;border-radius:6px;overflow:hidden;}
  .resume-table td{border-right:1px solid #d4dcc4;}
  .resume-table td:last-child{border-right:none;}
  table.agents{width:100%;border-collapse:collapse;}
  table.agents thead tr{background:#4A5C2F;color:#fff;}
  table.agents th{padding:7px 9px;text-align:left;font-size:9pt;text-transform:uppercase;letter-spacing:.05em;}
  table.agents tbody tr:nth-child(even){background:#f8f8f4;}
  table.agents td{padding:6px 9px;border-bottom:1px solid #eee;font-size:10pt;}
  .mono{font-family:monospace;font-size:9.5pt;}
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
    <div style="display:flex;justify-content:center;margin-bottom:4px;">${FLAG_SVG}</div>
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
  <p class="doc-title">Montage Journalier du Personnel</p>
  <p class="doc-date">${dateLabel}</p>
  <span class="statut-badge" style="color:${statutColor};border-color:${statutColor};background:${statutColor}18;">
    ${montageStatut}
  </span>
</div>

<p class="meta">Saisi par <strong>Le Chef de Brigade</strong></p>

<table class="resume-table">
  <tr>${resumeCells}</tr>
</table>

<table class="agents">
  <thead><tr>
    <th>Matricule</th>
    <th>Nom &amp; Prénom</th>
    <th>Grade</th>
    <th>Statut du jour</th>
  </tr></thead>
  <tbody>${rows.length ? rows : "<tr><td colspan='4' style='text-align:center;color:#aaa;padding:16px;font-style:italic'>Aucun agent enregistré</td></tr>"}</tbody>
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

  const agentsFiltres = useMemo(() => {
    const terme = search.toLowerCase();
    return agents.filter((a) => {
      const matchSearch =
        terme === "" ||
        a.nom.toLowerCase().includes(terme) ||
        a.prenom.toLowerCase().includes(terme) ||
        a.matricule.toLowerCase().includes(terme) ||
        a.grade.toLowerCase().includes(terme);
      const matchStatut =
        filterStatut === "Tous" || todayStatuts[a.matricule] === filterStatut;
      return matchSearch && matchStatut;
    });
  }, [agents, search, filterStatut, todayStatuts]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 rounded-full border-4 border-[#4A5C2F] border-t-transparent animate-spin" />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            {view !== "agents" && (
              <button
                onClick={() => { setView(view === "detail" ? "historique" : "agents"); setSelectedMontage(null); }}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#4A5C2F] transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                {view === "detail" ? "Historique" : "Personnel"}
              </button>
            )}
            <div>
              <h1 className="text-lg font-bold text-[#4A5C2F]">
                {view === "agents"      ? "Personnel"
                : view === "historique" ? "Historique des montages"
                : `Montage du ${fmtShort(selectedMontage?.date ?? "")}`}
              </h1>
              <p className="text-xs text-gray-400 capitalize mt-0.5">{todayLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {view === "agents" && (
              <>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Imprimer montage
                </button>
                <button
                  onClick={() => setView("historique")}
                  className="flex items-center gap-2 bg-white hover:bg-gray-50 text-[#4A5C2F]
                    border border-[#4A5C2F]/30 hover:border-[#4A5C2F]
                    text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Historique des montages
                </button>
                {!isAgent && !isReadOnly && (
                  <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-[#4A5C2F] hover:bg-[#3b4a25] text-white
                      text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    Saisir le montage du jour
                  </button>
                )}
              </>
            )}
          </div>
        </header>
        {isReadOnly && <ReadOnlyBanner />}

        <main className="flex-1 overflow-y-auto px-8 py-8 space-y-6">

          {/* ════════════ VUE AGENTS ════════════ */}
          {view === "agents" && (
            <>
              {/* Bandeau dernier montage */}
              {lastMontage && (
                <div
                  onClick={() => { setSelectedMontage(lastMontage); setView("detail"); }}
                  className="flex items-center gap-3 bg-[#4A5C2F]/5 border border-[#4A5C2F]/20
                    rounded-xl px-5 py-3 cursor-pointer hover:bg-[#4A5C2F]/10 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#4A5C2F] shrink-0" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-[#4A5C2F] font-medium">
                    Dernier montage :{" "}
                    <span className="font-bold capitalize">{fmtShort(lastMontage.date)}</span>
                    {" — "}
                    {lastMontage.resume.presents} présents
                    {lastMontage.resume.patrouilles > 0 && `, ${lastMontage.resume.patrouilles} en patrouille`}
                    {lastMontage.resume.barrages > 0 && `, ${lastMontage.resume.barrages} en barrage`}
                    {lastMontage.resume.permissionnaires > 0 && `, ${lastMontage.resume.permissionnaires} permissionnaire(s)`}
                    {lastMontage.resume.repos > 0 && `, ${lastMontage.resume.repos} en repos`}
                  </p>
                  <span className="ml-auto text-xs text-[#4A5C2F]/60 flex items-center gap-1">
                    Voir le détail
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
                      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              )}

              {/* Statut montage du jour (bannière chef uniquement) */}
              {!isAgent && (
                montageDate === today ? (
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-600 shrink-0" fill="none"
                        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-gray-700 font-medium">Montage du jour enregistré</p>
                      <div className="ml-auto flex items-center gap-2">
                        <button onClick={() => setShowModal(true)}
                          className="text-xs text-[#4A5C2F] hover:underline font-semibold">
                          Modifier / Gérer agents
                        </button>
                      </div>
                    </div>
                    {/* Gestion statut + suppression */}
                    {!isReadOnly && (
                      <div className="flex items-center gap-4 px-5 py-2.5 bg-gray-50">
                        <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide shrink-0">Statut :</span>
                        <div className="flex gap-2 flex-wrap">
                          {(["Brouillon", "Validé", "Exécution conforme à l'ordre de service"] as const).map((s) => {
                            const todayM = allMontages.find((m) => m.date === today);
                            const isCurrent = todayM?.statut === s;
                            return (
                              <button key={s} onClick={() => { const m = allMontages.find(x => x.date === today); if (m) handleChangeStatutMontage(m, s); }}
                                disabled={statutMontageEnCours !== null || isCurrent}
                                className={`text-xs px-3 py-1 rounded-full border font-semibold transition-all
                                  ${isCurrent
                                    ? s === "Validé" ? "bg-green-100 text-green-700 border-green-300"
                                    : s === "Exécution conforme à l'ordre de service" ? "bg-purple-100 text-purple-700 border-purple-300"
                                    : "bg-amber-100 text-amber-700 border-amber-300"
                                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"}
                                  disabled:cursor-not-allowed`}>
                                {statutMontageEnCours === s ? "…" : s}
                              </button>
                            );
                          })}
                        </div>
                        <button onClick={() => { const m = allMontages.find(x => x.date === today); if (m) setConfirmDeleteMontage(m); }}
                          className="ml-auto flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Supprimer le montage
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-600 shrink-0" fill="none"
                      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    <p className="text-sm text-amber-700 font-medium">Montage du jour non encore saisi</p>
                    <button onClick={() => setShowModal(true)}
                      className="ml-auto text-xs text-amber-600 hover:underline font-medium">
                      Saisir maintenant
                    </button>
                  </div>
                )
              )}

              {/* Cartes récap aujourd'hui */}
              <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
                {RESUME_ITEMS.map((item) => (
                  <button key={item.key}
                    onClick={() => setFilterStatut(filterStatut === item.statut ? "Tous" : item.statut)}
                    className={`rounded-2xl p-5 text-left border transition-all duration-150
                      ${filterStatut === item.statut
                        ? "border-[#4A5C2F] shadow-md bg-[#4A5C2F]/5"
                        : "bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm"}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${item.dot}`} />
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider leading-tight">
                        {item.label}
                      </span>
                    </div>
                    <p className={`text-3xl font-bold ${item.color}`}>
                      {loadingMontages ? "—" : todayCounts[item.key]}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">sur {agents.length} agents</p>
                  </button>
                ))}
              </div>

              {/* ══ SECTION MON STATUT AUJOURD'HUI (agent uniquement) ══ */}
              {isAgent && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* En-tête identité */}
                  <div className="bg-[#4A5C2F] px-6 py-5 flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/logo-douanes.png" alt="Logo Douanes SN" width={40} height={40} style={{ objectFit: "contain", flexShrink: 0 }} />
                    <div>
                      <p className="text-white font-bold text-base leading-tight">
                        {myNomComplet || user.email}
                      </p>
                      {myMatricule && (
                        <p className="text-[#C9A84C] text-xs font-mono mt-0.5">{myMatricule}</p>
                      )}
                      {profile?.grade && (
                        <p className="text-white/60 text-xs mt-0.5">{profile.grade}</p>
                      )}
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-white/50 text-xs uppercase tracking-widest">Mon statut aujourd&apos;hui</p>
                      {myCurrentStatut ? (
                        <p className="text-[#C9A84C] font-bold text-sm mt-0.5">{myCurrentStatut}</p>
                      ) : (
                        <p className="text-white/40 text-sm mt-0.5 italic">Non renseigné</p>
                      )}
                    </div>
                  </div>

                  {/* Boutons de statut */}
                  <div className="p-6">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
                      Choisissez votre statut
                    </p>

                    {!myStatutKey && (
                      <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
                        Votre matricule n&apos;est pas configuré dans votre profil. Contactez un administrateur.
                      </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                      {STATUTS.map((s) => {
                        const isCurrent = myCurrentStatut === s;
                        const cfg = STATUT_BIG[s];
                        return (
                          <button
                            key={s}
                            onClick={() => handleSelfStatut(s)}
                            disabled={selfSaving || !myStatutKey}
                            className={`relative flex flex-col items-center justify-center py-5 px-3 rounded-xl border-2
                              font-semibold transition-all duration-150 select-none
                              disabled:cursor-not-allowed disabled:opacity-60
                              ${isCurrent
                                ? cfg.active + " shadow-lg scale-[1.03]"
                                : cfg.inactive}
                            `}
                          >
                            {/* Coche sélectionné */}
                            {isCurrent && (
                              <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-white/30 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none"
                                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                            )}
                            {/* Point couleur */}
                            <span className={`w-4 h-4 rounded-full mb-2 ${isCurrent ? "bg-white/80" : cfg.dot}`} />
                            {/* Label */}
                            <span className="text-xs text-center leading-tight font-bold uppercase tracking-wide">
                              {s}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Feedback */}
                    <div className="mt-4 h-6 flex items-center">
                      {selfSaving && (
                        <span className="flex items-center gap-1.5 text-sm text-gray-400">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Sauvegarde en cours…
                        </span>
                      )}
                      {savedConfirm && !selfSaving && (
                        <span className="flex items-center gap-1.5 text-sm text-green-600 font-semibold">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Statut mis à jour ✓
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Recherche */}
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <svg xmlns="http://www.w3.org/2000/svg"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
                  </svg>
                  <input
                    type="text" autoComplete="off" spellCheck={false}
                    placeholder="Rechercher par nom, prénom, matricule ou grade…"
                    value={search} onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 text-sm border border-gray-200 rounded-xl
                      focus:outline-none focus:ring-2 focus:ring-[#4A5C2F]
                      bg-white text-gray-800 placeholder-gray-400"
                  />
                  {search && (
                    <button onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {filterStatut !== "Tous" && (
                  <button onClick={() => setFilterStatut("Tous")}
                    className="flex items-center gap-2 text-sm text-gray-500 bg-white border border-gray-200
                      rounded-xl px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Effacer le filtre
                  </button>
                )}
              </div>

              {/* Tableau agents */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-bold text-gray-800">
                    Liste des agents
                    <span className="ml-2 text-sm font-normal text-gray-400">
                      ({agentsFiltres.length} / {agents.length})
                    </span>
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Matricule</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nom & Prénom</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Grade</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut du jour</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {agentsFiltres.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-gray-400 text-sm">
                            Aucun agent trouvé
                          </td>
                        </tr>
                      ) : agentsFiltres.map((agent) => {
                        const statut = todayStatuts[agent.matricule] as Statut | undefined;
                        const isSelf = isAgent && agent.matricule === myStatutKey;
                        return (
                          <tr key={agent.matricule}
                            className={`transition-colors ${isSelf ? "bg-[#4A5C2F]/5" : "hover:bg-gray-50"}`}>
                            <td className="px-6 py-4">
                              <span className={`font-mono text-xs px-2 py-1 rounded ${
                                isSelf ? "bg-[#4A5C2F]/20 text-[#4A5C2F] font-bold" : "bg-gray-100 text-gray-600"
                              }`}>
                                {agent.matricule}
                              </span>
                              {isSelf && <span className="ml-2 text-xs text-[#4A5C2F] font-semibold">Moi</span>}
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-semibold text-gray-800">
                                {agent.nom} <span className="font-normal text-gray-600">{agent.prenom}</span>
                              </p>
                            </td>
                            <td className="px-6 py-4 text-gray-500 hidden md:table-cell">{agent.grade}</td>
                            <td className="px-6 py-4">
                              {loadingMontages ? (
                                <div className="h-6 w-24 bg-gray-100 rounded-full animate-pulse" />
                              ) : statut ? (
                                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${STATUT_STYLES[statut]}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${STATUT_DOT[statut]}`} />
                                  {statut}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400 italic">Non renseigné</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ════════════ VUE HISTORIQUE ════════════ */}
          {view === "historique" && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-gray-800">Tous les montages</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{allMontages.length} montage(s) enregistré(s)</p>
                  </div>
                  {isAgent && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">Lecture seule</span>
                  )}
                </div>
                {loadingMontages ? (
                  <div className="py-16 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-4 border-[#4A5C2F] border-t-transparent animate-spin" />
                  </div>
                ) : allMontages.length === 0 ? (
                  <div className="py-16 text-center text-gray-400 text-sm">
                    Aucun montage enregistré pour le moment
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {allMontages.map((montage) => {
                      const isToday = montage.date === today;
                      return (
                        <button key={montage.date}
                          onClick={() => { setSelectedMontage(montage); setView("detail"); }}
                          className="w-full flex items-center gap-6 px-6 py-4 hover:bg-gray-50 transition-colors text-left group">
                          <div className="w-28 shrink-0">
                            <p className={`text-sm font-bold ${isToday ? "text-[#4A5C2F]" : "text-gray-800"}`}>
                              {fmtShort(montage.date)}
                            </p>
                            {isToday && (
                              <span className="text-xs bg-[#4A5C2F] text-white px-2 py-0.5 rounded-full">Aujourd&apos;hui</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 flex-1">
                            {RESUME_ITEMS.map((item) => {
                              const val = montage.resume[item.key];
                              if (val === 0) return null;
                              return (
                                <span key={item.key}
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                                  <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
                                  {val} {item.label.toLowerCase()}
                                </span>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
                              ${montage.statut === "Validé" ? "bg-green-100 text-green-700"
                              : montage.statut === "Exécution conforme à l'ordre de service" ? "bg-purple-100 text-purple-700"
                              : "bg-amber-100 text-amber-700"}`}>
                              {montage.statut ?? "Validé"}
                            </span>
                            {montage.saisiPar && (
                              <span className="text-xs text-gray-400 hidden lg:block">par {montage.saisiPar}</span>
                            )}
                            <svg xmlns="http://www.w3.org/2000/svg"
                              className="w-4 h-4 text-gray-300 group-hover:text-[#4A5C2F] transition-colors"
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════ VUE DÉTAIL ════════════ */}
          {view === "detail" && selectedMontage && (
            <div className="space-y-6">
              <div className="bg-[#4A5C2F] rounded-2xl p-6 shadow-lg relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-[#C9A84C] text-xs font-semibold uppercase tracking-widest mb-1">Montage journalier</p>
                      <h2 className="text-white text-2xl font-bold capitalize">{fmt(selectedMontage.date)}</h2>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full
                        ${selectedMontage.statut === "Validé" ? "bg-green-400/20 text-green-300"
                        : selectedMontage.statut === "Exécution conforme à l'ordre de service" ? "bg-purple-400/20 text-purple-300"
                        : "bg-amber-400/20 text-amber-300"}`}>
                        {selectedMontage.statut ?? "Validé"}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-4">
                    {RESUME_ITEMS.map((item) => (
                      <div key={item.key} className="bg-white/10 rounded-xl px-4 py-3 text-center">
                        <p className="text-2xl font-bold text-white">{selectedMontage.resume[item.key]}</p>
                        <p className="text-white/60 text-xs mt-0.5">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions chef de brigade sur n'importe quel montage */}
              {!isAgent && !isReadOnly && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-100">
                    <button
                      onClick={() => setEditingMontage(selectedMontage)}
                      className="flex items-center gap-1.5 text-sm font-semibold text-[#4A5C2F] hover:underline">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Modifier (agents &amp; statuts)
                    </button>
                    <button
                      onClick={() => setConfirmDeleteMontage(selectedMontage)}
                      className="ml-auto flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Supprimer ce montage
                    </button>
                  </div>
                  <div className="flex items-center gap-3 px-5 py-2.5 bg-gray-50">
                    <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide shrink-0">Statut :</span>
                    <div className="flex gap-2 flex-wrap">
                      {(["Brouillon", "Validé", "Exécution conforme à l'ordre de service"] as const).map((s) => {
                        const isCurrent = selectedMontage.statut === s;
                        return (
                          <button key={s}
                            onClick={() => handleChangeStatutMontage(selectedMontage, s)}
                            disabled={statutMontageEnCours !== null || isCurrent}
                            className={`text-xs px-3 py-1 rounded-full border font-semibold transition-all
                              ${isCurrent
                                ? s === "Validé" ? "bg-green-100 text-green-700 border-green-300"
                                : s === "Exécution conforme à l'ordre de service" ? "bg-purple-100 text-purple-700 border-purple-300"
                                : "bg-amber-100 text-amber-700 border-amber-300"
                                : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"}
                              disabled:cursor-not-allowed`}>
                            {statutMontageEnCours === s ? "…" : s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h3 className="font-bold text-gray-800">Détail des {agents.length} agents</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Matricule</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nom & Prénom</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Grade</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {agents.map((agent) => {
                        const statut = selectedMontage.statuts[agent.matricule] as Statut | undefined;
                        const isSelf = isAgent && agent.matricule === myStatutKey;
                        return (
                          <tr key={agent.matricule}
                            className={`transition-colors ${isSelf ? "bg-[#4A5C2F]/5" : "hover:bg-gray-50"}`}>
                            <td className="px-6 py-4">
                              <span className={`font-mono text-xs px-2 py-1 rounded ${isSelf ? "bg-[#4A5C2F]/20 text-[#4A5C2F] font-bold" : "bg-gray-100 text-gray-600"}`}>
                                {agent.matricule}
                              </span>
                              {isSelf && <span className="ml-2 text-xs text-[#4A5C2F] font-semibold">Moi</span>}
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-semibold text-gray-800">
                                {agent.nom} <span className="font-normal text-gray-600">{agent.prenom}</span>
                              </p>
                            </td>
                            <td className="px-6 py-4 text-gray-500 hidden md:table-cell">{agent.grade}</td>
                            <td className="px-6 py-4">
                              {statut ? (
                                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${STATUT_STYLES[statut]}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${STATUT_DOT[statut]}`} />
                                  {statut}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400 italic">Non renseigné</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal montage — nouveau ou édition depuis aujourd'hui */}
      {showModal && !isAgent && !isReadOnly && (
        <MontageModal
          userEmail={user.email ?? ""}
          brigadeId={profile?.brigadeId}
          agents={agents}
          onAgentAdded={handleAgentAdded}
          onAgentDeleted={handleAgentDeleted}
          onAgentUpdated={handleAgentUpdated}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
          savedToday={montageDate === today ? todayStatuts : null}
        />
      )}

      {/* Modal montage — édition d'un montage historique */}
      {editingMontage && !isAgent && !isReadOnly && (
        <MontageModal
          userEmail={user.email ?? ""}
          brigadeId={profile?.brigadeId}
          agents={agents}
          onAgentAdded={handleAgentAdded}
          onAgentDeleted={handleAgentDeleted}
          onAgentUpdated={handleAgentUpdated}
          onClose={() => setEditingMontage(null)}
          onSaved={(record) => {
            handleSaved(record);
            // Mettre à jour selectedMontage si on vient de modifier celui affiché
            setSelectedMontage((prev) =>
              prev?.date === record.date ? { ...prev, ...record } : prev
            );
            setEditingMontage(null);
          }}
          savedToday={editingMontage.statuts}
          date={editingMontage.date}
          initialStatut={editingMontage.statut}
        />
      )}

      {/* Dialog confirmation suppression montage */}
      {confirmDeleteMontage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDeleteMontage(null)} />
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
                <p className="font-bold text-gray-800">Supprimer ce montage ?</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Montage du {fmtShort(confirmDeleteMontage.date)} — action irréversible.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteMontage(null)}
                className="px-5 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Annuler
              </button>
              <button onClick={() => handleDeleteMontage(confirmDeleteMontage)} disabled={deletingMontage}
                className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-60">
                {deletingMontage ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

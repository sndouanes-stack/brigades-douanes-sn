"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  STATUTS, STATUT_STYLES, GRADES,
  type Statut, type AgentDynamic,
} from "@/lib/agents";

export type StatutMontage = "Brouillon" | "Validé" | "Exécution conforme à l'ordre de service";

export interface MontageRecord {
  id?: string;
  date: string;
  statuts: Record<string, Statut>;
  resume: {
    presents: number;
    patrouilles: number;
    barrages: number;
    permissionnaires: number;
    repos: number;
  };
  saisiPar: string;
  saisiA?: unknown;
  statut: StatutMontage;
}

type NewAgentState = { matricule: string; nom: string; prenom: string; grade: string; statut: Statut };
const EMPTY_AGENT: NewAgentState = { matricule: "", nom: "", prenom: "", grade: GRADES[0], statut: "Présent" };

interface Props {
  userEmail: string;
  brigadeId?: string;
  agents: AgentDynamic[];
  onAgentAdded: (agent: AgentDynamic) => void;
  onAgentDeleted?: (agentId: string, matricule: string) => void;
  onAgentUpdated?: (agent: AgentDynamic) => void;
  onClose: () => void;
  onSaved: (record: MontageRecord) => void;
  savedToday: Record<string, Statut> | null;
  date?: string;
  initialStatut?: StatutMontage;
}

export default function MontageModal({ userEmail, brigadeId, agents, onAgentAdded, onAgentDeleted, onAgentUpdated, onClose, onSaved, savedToday, date: dateProp, initialStatut }: Props) {
  const today = new Date().toISOString().split("T")[0];
  const targetDate = dateProp ?? today;

  const [statuts, setStatuts] = useState<Record<string, Statut>>(
    Object.fromEntries(
      agents.map((a) => [a.matricule, savedToday?.[a.matricule] ?? ("Présent" as Statut)])
    )
  );
  const [statutMontage, setStatutMontage] = useState<StatutMontage>(initialStatut ?? "Validé");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [addingAgent, setAddingAgent] = useState(false);
  const [newAgent, setNewAgent] = useState<NewAgentState>(EMPTY_AGENT);
  const [addingError, setAddingError] = useState("");
  const [addingSaving, setAddingSaving] = useState(false);

  const [confirmDeleteAgent, setConfirmDeleteAgent] = useState<AgentDynamic | null>(null);
  const [deletingAgent, setDeletingAgent] = useState(false);

  const [editingAgent, setEditingAgent] = useState<AgentDynamic | null>(null);
  const [editAgentForm, setEditAgentForm] = useState<NewAgentState>(EMPTY_AGENT);
  const [editingSaving, setEditingSaving] = useState(false);
  const [editingError, setEditingError] = useState("");

  function handleChange(matricule: string, statut: Statut) {
    setStatuts((prev) => ({ ...prev, [matricule]: statut }));
  }

  async function handleAddAgent() {
    if (!newAgent.matricule.trim() || !newAgent.nom.trim()) {
      setAddingError("Le matricule et le nom sont obligatoires.");
      return;
    }
    setAddingError("");
    setAddingSaving(true);
    try {
      const agentData = {
        matricule: newAgent.matricule.trim().toUpperCase(),
        nom: newAgent.nom.trim(),
        prenom: newAgent.prenom.trim(),
        grade: newAgent.grade,
        ...(brigadeId ? { brigade_id: brigadeId } : {}),
      };
      const { data, error: dbError } = await supabase
        .from("agents")
        .insert(agentData)
        .select()
        .single();
      if (dbError) throw dbError;
      const saved: AgentDynamic = { ...agentData, id: data.id };
      onAgentAdded(saved);
      setStatuts((prev) => ({ ...prev, [saved.matricule]: newAgent.statut }));
      setNewAgent(EMPTY_AGENT);
      setAddingAgent(false);
    } catch {
      setAddingError("Erreur lors de l'ajout. Vérifiez votre connexion.");
    } finally {
      setAddingSaving(false);
    }
  }

  async function handleDeleteAgent() {
    if (!confirmDeleteAgent) return;
    setDeletingAgent(true);
    try {
      if (confirmDeleteAgent.id) {
        await supabase.from("agents").delete().eq("id", confirmDeleteAgent.id);
      }
      setStatuts((prev) => {
        const copy = { ...prev };
        delete copy[confirmDeleteAgent.matricule];
        return copy;
      });
      onAgentDeleted?.(confirmDeleteAgent.id ?? "", confirmDeleteAgent.matricule);
    } finally {
      setDeletingAgent(false);
      setConfirmDeleteAgent(null);
    }
  }

  function openEditAgent(agent: AgentDynamic) {
    setEditingAgent(agent);
    setEditAgentForm({ matricule: agent.matricule, nom: agent.nom, prenom: agent.prenom, grade: agent.grade, statut: "Présent" });
    setEditingError("");
  }

  async function handleSaveEditAgent() {
    if (!editingAgent || !editAgentForm.matricule.trim() || !editAgentForm.nom.trim()) {
      setEditingError("Le matricule et le nom sont obligatoires.");
      return;
    }
    setEditingSaving(true);
    setEditingError("");
    try {
      const oldMatricule = editingAgent.matricule;
      const newMatricule = editAgentForm.matricule.trim().toUpperCase();
      const updated: AgentDynamic = {
        ...editingAgent,
        matricule: newMatricule,
        nom: editAgentForm.nom.trim(),
        prenom: editAgentForm.prenom.trim(),
        grade: editAgentForm.grade,
      };
      if (editingAgent.id) {
        const { error: dbError } = await supabase
          .from("agents")
          .update({
            matricule: updated.matricule,
            nom: updated.nom,
            prenom: updated.prenom,
            grade: updated.grade,
          })
          .eq("id", editingAgent.id);
        if (dbError) throw dbError;
      }
      if (oldMatricule !== newMatricule) {
        setStatuts((prev) => {
          const copy = { ...prev };
          const val = copy[oldMatricule];
          delete copy[oldMatricule];
          copy[newMatricule] = val ?? "Présent";
          return copy;
        });
      }
      onAgentUpdated?.(updated);
      setEditingAgent(null);
    } catch {
      setEditingError("Erreur lors de la mise à jour.");
    } finally {
      setEditingSaving(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const resume = {
        presents:         Object.values(statuts).filter((s) => s !== "Permissionnaire").length,
        patrouilles:      Object.values(statuts).filter((s) => s === "En patrouille").length,
        barrages:         Object.values(statuts).filter((s) => s === "Barrage sur route").length,
        permissionnaires: Object.values(statuts).filter((s) => s === "Permissionnaire").length,
        repos:            Object.values(statuts).filter((s) => s === "Repos").length,
      };

      const payload = {
        date: targetDate,
        statuts,
        resume,
        saisi_par: userEmail,
        statut: statutMontage,
        ...(brigadeId ? { brigade_id: brigadeId } : {}),
      };

      // Check if montage already exists for this date + brigade
      let query = supabase.from("montages").select("id").eq("date", targetDate);
      if (brigadeId) query = query.eq("brigade_id", brigadeId);
      const { data: existing } = await query.maybeSingle();

      let docId: string;
      if (existing) {
        docId = existing.id;
        await supabase.from("montages").update(payload).eq("id", docId);
      } else {
        const { data, error: dbError } = await supabase
          .from("montages")
          .insert(payload)
          .select()
          .single();
        if (dbError) throw dbError;
        docId = data.id;
      }

      onSaved({ ...payload, id: docId, saisiPar: userEmail, saisiA: new Date().toISOString() });
      onClose();
    } catch {
      setError("Erreur lors de la sauvegarde. Vérifiez votre connexion.");
    } finally {
      setSaving(false);
    }
  }

  const counts: Record<Statut, number> = Object.fromEntries(
    STATUTS.map((s) => [s, Object.values(statuts).filter((v) => v === s).length])
  ) as Record<Statut, number>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-[#4A5C2F] px-6 py-5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">
              {targetDate === today ? "Montage du jour" : `Montage du ${new Date(targetDate + "T12:00:00").toLocaleDateString("fr-SN", { day: "numeric", month: "long", year: "numeric" })}`}
            </h2>
            <p className="text-[#C9A84C] text-xs mt-0.5 capitalize">
              {new Date(targetDate + "T12:00:00").toLocaleDateString("fr-SN", {
                weekday: "long", day: "numeric", month: "long", year: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={statutMontage}
              onChange={(e) => setStatutMontage(e.target.value as StatutMontage)}
              className="text-xs font-semibold bg-white/10 text-white border border-white/20
                rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]
                appearance-none cursor-pointer">
              <option value="Brouillon" className="text-gray-800 bg-white">Brouillon</option>
              <option value="Validé" className="text-gray-800 bg-white">Validé</option>
              <option value="Exécution conforme à l'ordre de service" className="text-gray-800 bg-white">
                Exécution conforme à l&apos;ordre de service
              </option>
            </select>
            <button onClick={onClose}
              className="text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Compteurs */}
        <div className="grid grid-cols-5 divide-x divide-gray-100 border-b border-gray-100 shrink-0">
          {STATUTS.map((s) => (
            <div key={s} className="px-2 py-3 text-center">
              <p className="text-xl font-bold text-gray-800">{counts[s]}</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-tight">{s}</p>
            </div>
          ))}
        </div>

        {/* Liste agents */}
        <div className="overflow-y-auto flex-1">
          {agents.length === 0 && !addingAgent ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-8">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-gray-300 mb-4" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 100-8 4 4 0 000 8zm6 0a3 3 0 100-6 3 3 0 000 6zM3 14a3 3 0 100-6 3 3 0 000 6z" />
              </svg>
              <p className="text-gray-500 font-semibold mb-1">Aucun agent enregistré</p>
              <p className="text-gray-400 text-sm mb-4">Ajoutez les agents de la brigade pour saisir le montage.</p>
              <button onClick={() => setAddingAgent(true)}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-[#4A5C2F] hover:bg-[#3b4a25] rounded-xl transition-colors">
                + Ajouter un agent
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Matricule</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Grade</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {agents.map((agent) => (
                  editingAgent?.id === agent.id ? (
                    <tr key={agent.matricule} className="bg-[#4A5C2F]/5">
                      <td colSpan={4} className="px-5 py-3">
                        <div className="grid grid-cols-4 gap-2 mb-2">
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Matricule *</label>
                            <input type="text" value={editAgentForm.matricule}
                              onChange={(e) => setEditAgentForm((p) => ({ ...p, matricule: e.target.value }))}
                              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A5C2F]" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Nom *</label>
                            <input type="text" value={editAgentForm.nom}
                              onChange={(e) => setEditAgentForm((p) => ({ ...p, nom: e.target.value }))}
                              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A5C2F]" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Prénom</label>
                            <input type="text" value={editAgentForm.prenom}
                              onChange={(e) => setEditAgentForm((p) => ({ ...p, prenom: e.target.value }))}
                              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A5C2F]" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Grade</label>
                            <select value={editAgentForm.grade}
                              onChange={(e) => setEditAgentForm((p) => ({ ...p, grade: e.target.value }))}
                              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A5C2F] bg-white">
                              {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                            </select>
                          </div>
                        </div>
                        {editingError && <p className="text-red-500 text-xs mb-2">{editingError}</p>}
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingAgent(null)}
                            className="px-3 py-1 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                            Annuler
                          </button>
                          <button onClick={handleSaveEditAgent} disabled={editingSaving}
                            className="px-4 py-1 text-xs font-semibold text-white bg-[#4A5C2F] hover:bg-[#3b4a25] rounded-lg transition-colors disabled:opacity-60">
                            {editingSaving ? "Sauvegarde…" : "Enregistrer"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                  <tr key={agent.matricule} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{agent.matricule}</td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-gray-800">{agent.nom} {agent.prenom}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-500 hidden sm:table-cell">{agent.grade}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {STATUTS.map((s) => (
                          <button key={s} onClick={() => handleChange(agent.matricule, s)}
                            className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all duration-100
                              ${statuts[agent.matricule] === s
                                ? STATUT_STYLES[s] + " shadow-sm scale-105"
                                : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"}`}>
                            {s}
                          </button>
                        ))}
                        <button onClick={() => openEditAgent(agent)} title="Modifier"
                          className="ml-1 inline-flex items-center justify-center w-6 h-6 rounded text-gray-300 hover:text-[#4A5C2F] hover:bg-[#4A5C2F]/10 transition-colors opacity-0 group-hover:opacity-100">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => setConfirmDeleteAgent(agent)} title="Supprimer"
                          className="inline-flex items-center justify-center w-6 h-6 rounded text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                ))}
              </tbody>
            </table>
          )}

          {/* Formulaire ajout agent */}
          {addingAgent && (
            <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Nouvel agent</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Matricule *</label>
                  <input
                    type="text" autoComplete="off" placeholder="ex: DK-0412"
                    value={newAgent.matricule}
                    onChange={(e) => setNewAgent((p) => ({ ...p, matricule: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                      focus:outline-none focus:ring-2 focus:ring-[#4A5C2F] bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Grade *</label>
                  <select
                    value={newAgent.grade}
                    onChange={(e) => setNewAgent((p) => ({ ...p, grade: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                      focus:outline-none focus:ring-2 focus:ring-[#4A5C2F] bg-white">
                    {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Nom *</label>
                  <input
                    type="text" autoComplete="off" placeholder="Nom de famille"
                    value={newAgent.nom}
                    onChange={(e) => setNewAgent((p) => ({ ...p, nom: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                      focus:outline-none focus:ring-2 focus:ring-[#4A5C2F] bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Prénom</label>
                  <input
                    type="text" autoComplete="off" placeholder="Prénom"
                    value={newAgent.prenom}
                    onChange={(e) => setNewAgent((p) => ({ ...p, prenom: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                      focus:outline-none focus:ring-2 focus:ring-[#4A5C2F] bg-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Statut du jour *</label>
                  <div className="flex flex-wrap gap-2">
                    {STATUTS.map((s) => (
                      <button
                        key={s} type="button"
                        onClick={() => setNewAgent((p) => ({ ...p, statut: s }))}
                        className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all
                          ${newAgent.statut === s
                            ? STATUT_STYLES[s] + " scale-105 shadow-sm"
                            : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {addingError && <p className="text-red-500 text-xs mb-2">{addingError}</p>}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setAddingAgent(false); setNewAgent(EMPTY_AGENT); setAddingError(""); }}
                  className="px-4 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                  Annuler
                </button>
                <button onClick={handleAddAgent} disabled={addingSaving}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#4A5C2F] hover:bg-[#3b4a25] rounded-lg transition-colors disabled:opacity-60">
                  {addingSaving ? "Ajout…" : "Ajouter"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dialog confirmation suppression agent */}
        {confirmDeleteAgent && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-2xl">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-gray-800">Supprimer cet agent ?</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {confirmDeleteAgent.nom} {confirmDeleteAgent.prenom} ({confirmDeleteAgent.matricule}) sera retiré de la brigade et du montage.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setConfirmDeleteAgent(null)}
                  className="px-5 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                  Annuler
                </button>
                <button onClick={handleDeleteAgent} disabled={deletingAgent}
                  className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-60">
                  {deletingAgent ? "Suppression…" : "Supprimer"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            {error
              ? <p className="text-red-500 text-xs">{error}</p>
              : <p className="text-xs text-gray-400">{agents.length} agent(s) · Saisi par <span className="font-medium">{userEmail}</span></p>
            }
            {!addingAgent && (
              <button onClick={() => setAddingAgent(true)}
                className="text-xs text-[#4A5C2F] hover:underline font-medium flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Ajouter un agent
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-5 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2 text-sm font-semibold text-white bg-[#4A5C2F] hover:bg-[#3b4a25]
                rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2">
              {saving ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Sauvegarde…
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Valider le montage
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

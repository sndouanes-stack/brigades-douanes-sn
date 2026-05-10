"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export type TypeCourrier   = "arrivee" | "depart";
export type Urgence        = "Normal" | "Urgent";
export type StatutCourrier =
  | "En attente" | "En cours" | "Traité"
  | "Envoyé"     | "En attente d'envoi";

export interface Courrier {
  id?: string;
  numero: string;
  type: TypeCourrier;
  date: string;
  interlocuteur: string;
  structure: string;
  objet: string;
  urgence: Urgence;
  statut: StatutCourrier;
  observations: string;
}

export const STATUTS_ARRIVEE: StatutCourrier[] = ["En attente", "En cours", "Traité"];
export const STATUTS_DEPART:  StatutCourrier[] = ["En attente d'envoi", "Envoyé"];

interface Props {
  type: TypeCourrier;
  nextNumero: string;
  editingCourrier?: Courrier;
  onClose: () => void;
  onSaved:   (c: Courrier) => void;
  onUpdated: (c: Courrier) => void;
}

export default function CourrierModal({
  type, nextNumero, editingCourrier, onClose, onSaved, onUpdated,
}: Props) {
  const isArrivee = type === "arrivee";
  const isEditing = !!editingCourrier;
  const today = new Date().toISOString().split("T")[0];

  const defaultStatut: StatutCourrier = isArrivee ? "En attente" : "En attente d'envoi";
  const statutOptions = isArrivee ? STATUTS_ARRIVEE : STATUTS_DEPART;

  const [date,          setDate]         = useState(editingCourrier?.date          ?? today);
  const [interlocuteur, setInterlocuteur]= useState(editingCourrier?.interlocuteur ?? "");
  const [structure,     setStructure]    = useState(editingCourrier?.structure      ?? "");
  const [objet,         setObjet]        = useState(editingCourrier?.objet         ?? "");
  const [urgence,       setUrgence]      = useState<Urgence>(editingCourrier?.urgence ?? "Normal");
  const [statut,        setStatut]       = useState<StatutCourrier>(editingCourrier?.statut ?? defaultStatut);
  const [observations,  setObservations] = useState(editingCourrier?.observations  ?? "");
  const [saving,        setSaving]       = useState(false);
  const [error,         setError]        = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!interlocuteur.trim()) { setError("Ce champ est obligatoire."); return; }
    if (!objet.trim())         { setError("L'objet est obligatoire."); return; }

    setSaving(true);
    setError("");
    try {
      const payload = {
        numero:        editingCourrier?.numero ?? nextNumero,
        type,
        date,
        interlocuteur: interlocuteur.trim(),
        structure:     structure.trim(),
        objet:         objet.trim(),
        urgence,
        statut,
        observations:  observations.trim(),
      };

      const isSeed = editingCourrier?.id?.startsWith("s");
      if (isEditing && editingCourrier?.id && !isSeed) {
        const { error: dbError } = await supabase
          .from("correspondances")
          .update(payload)
          .eq("id", editingCourrier.id);
        if (dbError) throw dbError;
        onUpdated({ ...editingCourrier, ...payload });
      } else {
        const { data, error: dbError } = await supabase
          .from("correspondances")
          .insert(payload)
          .select()
          .single();
        if (dbError) throw dbError;
        onSaved({ ...payload, id: data.id });
      }
      onClose();
    } catch {
      setError("Erreur lors de la sauvegarde. Vérifiez votre connexion.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = `w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900
    text-sm focus:outline-none focus:ring-2 focus:ring-[#4A5C2F] focus:border-transparent transition-all`;

  const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-[#4A5C2F] px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#C9A84C] flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
                viewBox="0 0 24 24" stroke="#4A5C2F" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d={isArrivee
                    ? "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    : "M12 19l9 2-9-18-9 18 9-2zm0 0v-8"} />
              </svg>
            </div>
            <div>
              <h2 className="text-white font-bold text-base">
                {isEditing
                  ? "Modifier le courrier"
                  : isArrivee
                  ? "Nouveau courrier arrivée"
                  : "Nouveau courrier départ"}
              </h2>
              <p className="text-[#C9A84C] text-xs mt-0.5 font-mono">
                {editingCourrier?.numero ?? nextNumero}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Formulaire */}
        <div className="overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">

            {/* Numéro + Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Numéro</label>
                <input readOnly value={editingCourrier?.numero ?? nextNumero}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50
                    text-gray-500 font-mono text-sm cursor-not-allowed" />
              </div>
              <div>
                <label className={labelCls}>{isArrivee ? "Date de réception" : "Date d'envoi"}</label>
                <input type="date" required value={date}
                  onChange={(e) => setDate(e.target.value)} className={inputCls} />
              </div>
            </div>

            {/* Interlocuteur + Structure */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  {isArrivee ? "Nom de l'expéditeur" : "Nom du destinataire"}
                </label>
                <input type="text" required value={interlocuteur}
                  onChange={(e) => setInterlocuteur(e.target.value)}
                  placeholder={isArrivee ? "Ex : Col. Amadou Fall" : "Ex : M. Ibrahima Sow"}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Structure / Organisation</label>
                <input type="text" value={structure}
                  onChange={(e) => setStructure(e.target.value)}
                  placeholder={isArrivee ? "Ex : DGD, Inspection…" : "Ex : Brigade de Thiès…"}
                  className={inputCls} />
              </div>
            </div>

            {/* Objet */}
            <div>
              <label className={labelCls}>Objet du courrier</label>
              <textarea required rows={3} value={objet}
                onChange={(e) => setObjet(e.target.value)}
                placeholder="Objet du courrier…"
                className={inputCls + " resize-none"} />
            </div>

            {/* Urgence + Statut */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Niveau d&apos;urgence</label>
                <div className="flex gap-2">
                  {(["Normal", "Urgent"] as Urgence[]).map((u) => (
                    <button key={u} type="button" onClick={() => setUrgence(u)}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all
                        ${urgence === u
                          ? u === "Urgent"
                            ? "bg-red-600 border-red-600 text-white"
                            : "bg-[#4A5C2F] border-[#4A5C2F] text-white"
                          : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                      {u === "Urgent" && <span className="mr-1">🔴</span>}
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Statut</label>
                <select value={statut} onChange={(e) => setStatut(e.target.value as StatutCourrier)}
                  className={inputCls + " bg-white"}>
                  {statutOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Observations */}
            <div>
              <label className={labelCls}>Observations</label>
              <textarea rows={2} value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Notes ou observations complémentaires…"
                className={inputCls + " resize-none"} />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2.5 text-sm text-gray-600 bg-white border border-gray-200
                  rounded-lg hover:bg-gray-50 transition-colors font-medium">
                Annuler
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-[#4A5C2F]
                  hover:bg-[#3b4a25] rounded-lg transition-colors disabled:opacity-60
                  disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Enregistrement…
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                    {isEditing ? "Mettre à jour" : "Enregistrer"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

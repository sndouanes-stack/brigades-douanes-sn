"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export type TypeTransaction = "recette" | "depense";

interface Props {
  type: TypeTransaction;
  onClose: () => void;
  onSaved: (tx: Transaction) => void;
}

export interface Transaction {
  id?: string;
  type: TypeTransaction;
  montant: number;
  motif: string;
  date: string;
}

export default function TransactionModal({ type, onClose, onSaved }: Props) {
  const today = new Date().toISOString().split("T")[0];
  const [montant, setMontant] = useState("");
  const [motif, setMotif] = useState("");
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isRecette = type === "recette";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const montantNum = parseFloat(montant.replace(/\s/g, "").replace(",", "."));
    if (!montantNum || montantNum <= 0) {
      setError("Veuillez saisir un montant valide.");
      return;
    }
    if (!motif.trim()) {
      setError("Le motif est obligatoire.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      // Récupérer l'utilisateur connecté
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Récupérer le profil pour avoir brigade_id
      const { data: profile } = await supabase
        .from("users")
        .select("brigade_id")
        .eq("id", user.id)
        .single();

      const payload = {
        type,
        montant: montantNum,
        libelle: motif.trim(),   // ← colonne correcte dans Supabase
        date,
        brigade_id: profile?.brigade_id ?? null,
        created_by: user.id,
      };

      const { data, error: dbError } = await supabase
        .from("transactions")
        .insert(payload)
        .select()
        .single();

      if (dbError) {
        console.error("[TransactionModal] Erreur Supabase:", dbError);
        throw dbError;
      }

      onSaved({ type, montant: montantNum, motif: motif.trim(), date, id: data.id });
      onClose();
    } catch (err) {
      console.error("[TransactionModal] Erreur sauvegarde:", err);
      setError("Erreur lors de la sauvegarde. Vérifiez votre connexion.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className={`px-6 py-5 flex items-center justify-between ${isRecette ? "bg-[#4A5C2F]" : "bg-red-700"}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isRecette ? "bg-[#C9A84C]" : "bg-red-200"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
                viewBox="0 0 24 24" stroke={isRecette ? "#4A5C2F" : "#991b1b"} strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d={isRecette ? "M12 4v16m8-8H4" : "M20 12H4"} />
              </svg>
            </div>
            <div>
              <h2 className="text-white font-bold text-base">
                {isRecette ? "Nouvelle recette" : "Nouvelle dépense"}
              </h2>
              <p className={`text-xs mt-0.5 ${isRecette ? "text-[#C9A84C]" : "text-red-200"}`}>
                Saisie de caisse
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

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Montant (FCFA)</label>
            <div className="relative">
              <input type="text" inputMode="numeric" required value={montant}
                onChange={(e) => setMontant(e.target.value)} placeholder="0"
                className={`w-full px-4 py-3 pr-16 rounded-lg border text-gray-900 text-lg font-bold
                  placeholder-gray-300 focus:outline-none focus:ring-2 focus:border-transparent transition-all
                  ${isRecette ? "focus:ring-[#4A5C2F] border-gray-300" : "focus:ring-red-500 border-gray-300"}`} />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">FCFA</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Motif</label>
            <input type="text" required value={motif} onChange={(e) => setMotif(e.target.value)}
              placeholder={isRecette ? "ex: Recouvrement de droits" : "ex: Achat fournitures"}
              className={`w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900
                placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all
                ${isRecette ? "focus:ring-[#4A5C2F]" : "focus:ring-red-500"}`} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)}
              className={`w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900
                text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all
                ${isRecette ? "focus:ring-[#4A5C2F]" : "focus:ring-red-500"}`} />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm text-gray-600 bg-white border border-gray-200
                rounded-lg hover:bg-gray-50 transition-colors font-medium">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className={`flex-1 px-4 py-2.5 text-sm font-semibold text-white rounded-lg
                transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2
                ${isRecette ? "bg-[#4A5C2F] hover:bg-[#3b4a25]" : "bg-red-600 hover:bg-red-700"}`}>
              {saving ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Enregistrement…
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Économiser
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

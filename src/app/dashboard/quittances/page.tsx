"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/useUserProfile";
import Sidebar from "@/components/Sidebar";
import ReadOnlyBanner from "@/components/ReadOnlyBanner";
import { useRole } from "@/lib/useRole";
import QuittanceReceipt from "@/components/QuittanceReceipt";
import { nombreEnLettres } from "@/lib/nombreEnLettres";
import { type QuittanceData, type NaturePaiement } from "./types";

// ── Utilitaires ───────────────────────────────────────────────────────────────
function buildNextNumero(existing: QuittanceData[]): string {
  const nums = existing
    .map((q) => parseInt(q.numero.replace("RS-", ""), 10))
    .filter((n) => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return "RS-" + String(next).padStart(6, "0");
}

const NATURES: NaturePaiement[] = ["Amende", "Droits de douane", "Pénalité"];

const EMPTY_FORM: Omit<QuittanceData, "id" | "numero" | "montantLettres" | "createdAt"> = {
  brigade: "Brigade Mobile de Dakar-Pikine",
  nom: "",
  prenom: "",
  adresse: "",
  pieceIdentite: "",
  profession: "",
  montant: 0,
  nature: "Amende",
  referenceAC: "",
  lieu: "Dakar",
  date: new Date().toISOString().split("T")[0],
  chefBrigade: "",
};

// ── Composant ─────────────────────────────────────────────────────────────────
export default function QuittancesPage() {
  const { user, profile, loading } = useUserProfile();
  const { isReadOnly } = useRole();
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);

  const [quittances, setQuittances] = useState<QuittanceData[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [montantStr, setMontantStr] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<QuittanceData | null>(null);
  const [view, setView] = useState<"form" | "liste">("form");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNumero, setEditingNumero] = useState<string | null>(null);

  const todayLabel = new Date().toLocaleDateString("fr-SN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  // Charger les quittances — tri client-side par date desc
  const fetchQuittances = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const { data, error: err } = await supabase.from("quittances").select("*");
      if (err) {
        console.error("Erreur fetch quittances :", err);
        return;
      }
      const list = (data ?? []).map((q: Record<string, unknown>) => {
        const fullContrib = (q.contribuable as string) || "";
        const parts = fullContrib.trim().split(" ");
        const prenom = (q.prenom as string) || (parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] || "");
        const nom = (q.nom as string) || (parts.length > 1 ? parts[parts.length - 1] : "");
        const amount = typeof q.montant === "number" ? q.montant : parseFloat(String(q.montant ?? 0));
        return {
          id: String(q.id ?? ""),
          numero: String(q.numero ?? ""),
          date: String(q.date ?? ""),
          nom,
          prenom,
          adresse: String(q.adresse ?? ""),
          pieceIdentite: String(q.piece_identite ?? q.pieceIdentite ?? ""),
          profession: String(q.profession ?? ""),
          montant: amount,
          montantLettres: String(q.montant_lettres ?? q.montantLettres ?? nombreEnLettres(amount)),
          nature: (q.nature as NaturePaiement) || (q.motif as NaturePaiement) || "Amende",
          referenceAC: String(q.reference_ac ?? q.referenceAC ?? ""),
          lieu: String(q.lieu ?? "Dakar"),
          chefBrigade: String(q.chef_brigade ?? q.chefBrigade ?? ""),
          brigade: String(q.brigade ?? "Brigade Mobile"),
          createdAt: q.created_at,
        } as QuittanceData;
      });

      list.sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return b.numero.localeCompare(a.numero);
      });
      setQuittances(list);
    } catch (err) {
      console.error("Erreur Supabase quittances :", err);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  // Chargement initial
  useEffect(() => { fetchQuittances(); }, [fetchQuittances]);

  // Re-fetch à chaque ouverture de l'onglet "Historique"
  useEffect(() => {
    if (view === "liste") fetchQuittances();
  }, [view, fetchQuittances]);

  // Montant en lettres auto
  const montantLettres = montantStr
    ? nombreEnLettres(parseInt(montantStr.replace(/\s/g, ""), 10) || 0)
    : "";

  const nextNumero = buildNextNumero(quittances);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function buildData(): QuittanceData {
    return {
      ...form,
      id: editingId || "",
      numero: editingNumero || nextNumero,
      montant: parseInt(montantStr.replace(/\s/g, ""), 10) || 0,
      montantLettres,
    };
  }

  function handlePreview() {
    setError("");
    const montant = parseInt(montantStr.replace(/\s/g, ""), 10) || 0;
    if (!form.nom.trim() || !form.prenom.trim()) { setError("Le nom et prénom du redevable sont obligatoires."); return; }
    if (montant <= 0) { setError("Le montant doit être supérieur à zéro."); return; }
    if (!form.chefBrigade.trim()) { setError("Le nom du Chef de Brigade est obligatoire."); return; }
    setPreview(buildData());
  }

  function handleEdit(q: QuittanceData) {
    setEditingId(q.id);
    setEditingNumero(q.numero);
    setForm({
      brigade: q.brigade || "Brigade Mobile de Dakar-Pikine",
      nom: q.nom || "",
      prenom: q.prenom || "",
      adresse: q.adresse || "",
      pieceIdentite: q.pieceIdentite || "",
      profession: q.profession || "",
      montant: q.montant || 0,
      nature: q.nature || "Amende",
      referenceAC: q.referenceAC || "",
      lieu: q.lieu || "Dakar",
      date: q.date || new Date().toISOString().split("T")[0],
      chefBrigade: q.chefBrigade || "",
    });
    setMontantStr(q.montant > 0 ? String(q.montant) : "");
    setPreview(null);
    setError("");
    setView("form");
  }

  async function handleSaveAndPrint() {
    if (!preview) return;
    setSaving(true);
    setError("");
    try {
      const dbPayload = {
        numero: preview.numero,
        date: preview.date,
        contribuable: `${preview.prenom} ${preview.nom}`.trim(),
        montant: preview.montant,
        motif: preview.nature,
        brigade_id: profile?.brigadeId || null,
        created_by: profile?.email || user?.email || "",
      };

      if (editingId) {
        const { error: saveErr } = await supabase
          .from("quittances")
          .update(dbPayload)
          .eq("id", editingId);

        if (saveErr) {
          console.error("Erreur mise à jour quittance :", saveErr);
          setError(`Erreur lors de la mise à jour : ${saveErr.message}`);
          setSaving(false);
          return;
        }

        const updated: QuittanceData = { ...preview, id: editingId };
        setQuittances((prev) => prev.map((q) => (q.id === editingId ? updated : q)));
        setEditingId(null);
        setEditingNumero(null);
      } else {
        const { data: newRow, error: saveErr } = await supabase
          .from("quittances")
          .insert(dbPayload)
          .select()
          .single();

        if (saveErr) {
          console.error("Erreur sauvegarde quittance :", saveErr);
          setError(`Erreur lors de l'enregistrement dans la base de données : ${saveErr.message}`);
          setSaving(false);
          return;
        }

        const saved: QuittanceData = { ...preview, id: newRow?.id ?? "" };
        setQuittances((prev) => {
          const withoutDupe = prev.filter((q) => q.id !== saved.id);
          const updated = [saved, ...withoutDupe];
          updated.sort((a, b) => {
            if (b.date !== a.date) return b.date.localeCompare(a.date);
            return b.numero.localeCompare(a.numero);
          });
          return updated;
        });
      }

      handlePrint();
    } catch (err) {
      console.error("Exception sauvegarde Supabase :", err);
      setError(`Erreur imprévue : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  function handlePrint() {
    if (!printRef.current) return;
    // Rendre les URLs d'images absolues pour la fenêtre d'impression
    const base = window.location.origin;
    const content = printRef.current.innerHTML
      .replace(/src="\/images\//g, `src="${base}/images/`);
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Quittance ${preview?.numero}</title>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: white; font-family: Georgia, 'Times New Roman', serif; }
            .print-page {
              display: flex;
              flex-direction: column;
              align-items: center;
              padding: 10mm;
              gap: 8mm;
            }
            .separator-cut {
              width: 100%;
              border: none;
              border-top: 1.5px dashed #666;
              position: relative;
              margin: 2mm 0;
            }
            .separator-cut::after {
              content: "✂ Ligne de découpe";
              position: absolute;
              top: -8px;
              left: 50%;
              transform: translateX(-50%);
              background: white;
              padding: 0 4mm;
              font-size: 7pt;
              color: #888;
              font-family: Arial, sans-serif;
            }
            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
              @page { size: A4; margin: 10mm; }
            }
          </style>
        </head>
        <body>
          <div class="print-page">
            ${content}
            <hr class="separator-cut" />
          </div>
          <script>window.onload = () => { window.print(); window.close(); }<\/script>
        </body>
      </html>
    `);
    win.document.close();
  }

  function handleReset() {
    setPreview(null);
    setEditingId(null);
    setEditingNumero(null);
    setForm(EMPTY_FORM);
    setMontantStr("");
    setError("");
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 rounded-full border-4 border-[#4A5C2F] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shadow-sm shrink-0">
          <div>
            <h1 className="text-lg font-bold text-[#4A5C2F]">Quittances RS</h1>
            <p className="text-xs text-gray-400 capitalize mt-0.5">{todayLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            {!isReadOnly && (
              <span className="font-mono text-sm bg-[#4A5C2F]/10 text-[#4A5C2F] px-3 py-1.5 rounded-lg font-bold">
                {editingNumero ? `Édition : ${editingNumero}` : `Prochain : ${nextNumero}`}
              </span>
            )}
            {!isReadOnly && (
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                {(["form", "liste"] as const).map((v) => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all
                      ${view === v ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                    {v === "form" ? (editingId ? "Édition quittance" : "Nouvelle quittance") : "Historique"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>
        {isReadOnly && <ReadOnlyBanner />}

        <main className="flex-1 overflow-y-auto px-8 py-8">

          {/* ── VUE FORMULAIRE + APERÇU ── */}
          {view === "form" && !isReadOnly && (
            <div className="flex gap-8 items-start">

              {/* Formulaire */}
              <div className="w-full max-w-lg shrink-0">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="bg-[#4A5C2F] px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#C9A84C] flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                          viewBox="0 0 24 24" stroke="#4A5C2F" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm">
                          {editingId ? "Modification de quittance" : "Saisie de quittance"}
                        </p>
                        <p className="text-[#C9A84C] text-xs font-mono">{editingNumero || nextNumero}</p>
                      </div>
                    </div>
                    {editingId && (
                      <button
                        onClick={handleReset}
                        className="text-xs bg-white/20 hover:bg-white/30 text-white font-medium px-2.5 py-1 rounded transition-colors"
                      >
                        Annuler l'édition
                      </button>
                    )}
                  </div>

                  <div className="p-6 space-y-4">
                    {/* Brigade */}
                    <Field label="Brigade / Bureau">
                      <input name="brigade" value={form.brigade} onChange={handleChange}
                        placeholder="Brigade Mobile de Dakar-Pikine"
                        className={inputCls} />
                    </Field>

                    {/* Redevable */}
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Nom">
                        <input name="nom" value={form.nom} onChange={handleChange}
                          placeholder="DIOP" className={inputCls} required />
                      </Field>
                      <Field label="Prénom">
                        <input name="prenom" value={form.prenom} onChange={handleChange}
                          placeholder="Moussa" className={inputCls} required />
                      </Field>
                    </div>

                    <Field label="Adresse">
                      <input name="adresse" value={form.adresse} onChange={handleChange}
                        placeholder="Dakar, Sénégal" className={inputCls} />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Pièce d'identité N°">
                        <input name="pieceIdentite" value={form.pieceIdentite} onChange={handleChange}
                          placeholder="1 234 567 89" className={inputCls} />
                      </Field>
                      <Field label="Profession">
                        <input name="profession" value={form.profession} onChange={handleChange}
                          placeholder="Commerçant" className={inputCls} />
                      </Field>
                    </div>

                    {/* Montant */}
                    <Field label="Montant (FCFA)">
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={montantStr}
                          onChange={(e) => setMontantStr(e.target.value)}
                          placeholder="0"
                          className={`${inputCls} pr-16 text-lg font-bold`}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">
                          FCFA
                        </span>
                      </div>
                    </Field>

                    {/* Montant en lettres (auto) */}
                    {montantLettres && (
                      <div className="bg-[#f8f9f5] border border-[#c8d4b0] rounded-lg px-4 py-3">
                        <p className="text-xs text-gray-500 mb-1">En lettres :</p>
                        <p className="text-sm font-medium text-[#2d3c1a] italic">{montantLettres}</p>
                      </div>
                    )}

                    {/* Nature */}
                    <Field label="Nature du paiement">
                      <select name="nature" value={form.nature} onChange={handleChange} className={inputCls}>
                        {NATURES.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </Field>

                    {/* Référence */}
                    <Field label="Référence A/C N°">
                      <input name="referenceAC" value={form.referenceAC} onChange={handleChange}
                        placeholder="ex: AC-2026-00142" className={inputCls} />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Lieu">
                        <input name="lieu" value={form.lieu} onChange={handleChange}
                          placeholder="Dakar" className={inputCls} />
                      </Field>
                      <Field label="Date">
                        <input type="date" name="date" value={form.date} onChange={handleChange}
                          className={inputCls} />
                      </Field>
                    </div>

                    {/* Chef de Brigade */}
                    <Field label="Nom du Chef de Brigade">
                      <input name="chefBrigade" value={form.chefBrigade} onChange={handleChange}
                        placeholder="Insp. Ndiaye Ibrahima" className={inputCls} required />
                    </Field>

                    {error && (
                      <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                        <p className="text-red-600 text-sm">{error}</p>
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={handleReset}
                        className="flex-1 px-4 py-2.5 text-sm text-gray-600 bg-white border border-gray-200
                          rounded-lg hover:bg-gray-50 transition-colors font-medium">
                        Réinitialiser
                      </button>
                      <button type="button" onClick={handlePreview}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
                          text-sm font-semibold text-white bg-[#4A5C2F] hover:bg-[#3b4a25]
                          rounded-lg transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                          viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Aperçu
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Aperçu + impression */}
              <div className="flex-1 min-w-0">
                {preview ? (
                  <div className="space-y-5">
                    {/* Actions */}
                    <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">
                          Quittance {preview.numero} prête
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Vérifiez les informations puis enregistrez et imprimez
                        </p>
                      </div>
                      <button onClick={() => setPreview(null)}
                        className="px-4 py-2 text-sm text-gray-500 border border-gray-200
                          rounded-lg hover:bg-gray-50 transition-colors">
                        Modifier la saisie
                      </button>
                      <button onClick={handleSaveAndPrint} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 text-sm font-semibold
                          text-white bg-[#C9A84C] hover:bg-[#b8943b] rounded-lg transition-colors
                          disabled:opacity-60 disabled:cursor-not-allowed shadow-sm">
                        {saving ? (
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                        )}
                        {editingId ? "Mettre à jour & Imprimer" : "Enregistrer & Imprimer"}
                      </button>
                    </div>

                    {/* Les deux exemplaires */}
                    <div ref={printRef} className="flex flex-col items-center gap-6">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 text-center">
                          Exemplaire B — Redevable
                        </p>
                        <div className="shadow-lg">
                          <QuittanceReceipt data={preview} exemplaire="B" />
                        </div>
                      </div>
                      <div className="w-full max-w-sm border-t-2 border-dashed border-gray-300 pt-4 text-center">
                        <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full">
                          ✂ Ligne de découpe
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 text-center">
                          Souche — Brigade
                        </p>
                        <div className="shadow-lg">
                          <QuittanceReceipt data={preview} exemplaire="Souche" />
                        </div>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="h-full min-h-[300px] flex flex-col items-center justify-center
                    bg-white rounded-2xl border-2 border-dashed border-gray-200 text-center px-8 py-16">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-14 h-14 text-gray-200 mb-4" fill="none"
                      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-400 text-sm font-medium">
                      Remplissez le formulaire et cliquez sur<br />&quot;Aperçu&quot; pour prévisualiser la quittance
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── VUE HISTORIQUE ── */}
          {view === "liste" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-gray-800">Historique des quittances</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{quittances.length} quittance(s) émise(s)</p>
                </div>
                {!isReadOnly && (
                  <button onClick={() => { handleReset(); setView("form"); }}
                    className="flex items-center gap-2 bg-[#4A5C2F] hover:bg-[#3b4a25] text-white
                      text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
                    Nouvelle quittance
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                {loadingData ? (
                  <div className="py-16 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-4 border-[#4A5C2F] border-t-transparent animate-spin" />
                  </div>
                ) : quittances.length === 0 ? (
                  <div className="py-16 text-center text-gray-400 text-sm">
                    Aucune quittance émise pour le moment
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {["N° Quittance", "Date", "Redevable", "Nature", "Montant (FCFA)", "Chef Brigade", "Actions"].map((h) => (
                          <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {quittances.map((q) => (
                        <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-mono text-xs font-bold bg-[#4A5C2F]/10 text-[#4A5C2F] px-2.5 py-1 rounded">
                              {q.numero}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-500">
                            {new Date(q.date).toLocaleDateString("fr-SN", {
                              day: "numeric", month: "short", year: "numeric",
                            })}
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-800">
                            {q.prenom} {q.nom}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
                              ${q.nature === "Amende"          ? "bg-red-100 text-red-700"
                              : q.nature === "Droits de douane" ? "bg-[#4A5C2F]/10 text-[#4A5C2F]"
                              : "bg-orange-100 text-orange-700"}`}>
                              {q.nature}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-[#4A5C2F]">
                            {new Intl.NumberFormat("fr-SN").format(q.montant)}
                          </td>
                          <td className="px-6 py-4 text-gray-600">{q.chefBrigade}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {!isReadOnly && (
                                <button
                                  onClick={() => handleEdit(q)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#4A5C2F] bg-[#4A5C2F]/10 hover:bg-[#4A5C2F]/20 rounded-lg transition-colors"
                                  title="Modifier cette quittance"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  Modifier
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setPreview(q);
                                  setView("form");
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                title="Voir / Imprimer"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                Imprimer
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const inputCls = `w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm
  placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4A5C2F] focus:border-transparent
  transition-all bg-white`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

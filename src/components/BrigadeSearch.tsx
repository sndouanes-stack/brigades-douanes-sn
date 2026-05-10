"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { BRIGADES, SUBDIVISIONS, DIRECTIONS_REGIONALES } from "@/lib/roles";

interface BrigadeItem {
  id: string;
  nom: string;
  subdivision_id?: string;
  direction_regionale_id?: string;
  localite?: string;
  chef_brigade?: string;
}

function subdivNomFn(subdivisions: { id: string; nom: string }[], id?: string) {
  return subdivisions.find((s) => s.id === id)?.nom ?? "—";
}
function dirNomFn(id?: string) {
  return DIRECTIONS_REGIONALES.find((d) => d.id === id)?.nom ?? "—";
}

export default function BrigadeSearch() {
  const [query, setQuery] = useState("");
  const [brigades, setBrigades] = useState<BrigadeItem[]>([]);
  const [subdivisions, setSubdivisions] = useState<{ id: string; nom: string }[]>([]);
  const [selected, setSelected] = useState<BrigadeItem | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("brigades").select("id, nom, subdivision_id, direction_regionale_id, localite, chef_brigade");
      setBrigades(
        data && data.length > 0
          ? data as BrigadeItem[]
          : BRIGADES.map((b) => ({ id: b.id, nom: b.nom, subdivision_id: b.subdivisionId }))
      );
    })();

    void (async () => {
      const { data } = await supabase.from("subdivisions").select("id, nom");
      setSubdivisions(
        data && data.length > 0
          ? data as { id: string; nom: string }[]
          : SUBDIVISIONS.map((s) => ({ id: s.id, nom: s.nom }))
      );
    })();
  }, []);

  const q = query.toLowerCase().trim();

  const filtered = q.length < 2
    ? []
    : brigades.filter((b) => {
        const sub = subdivNomFn(subdivisions, b.subdivision_id).toLowerCase();
        const dr = dirNomFn(b.direction_regionale_id).toLowerCase();
        return (
          b.nom.toLowerCase().includes(q) ||
          sub.includes(q) ||
          dr.includes(q) ||
          (b.localite ?? "").toLowerCase().includes(q)
        );
      });

  return (
    <div className="mb-8">
      {/* Champ de recherche */}
      <div className="relative">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
          placeholder="Rechercher une brigade par nom, subdivision ou direction régionale…"
          className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm
            focus:outline-none focus:ring-2 focus:ring-[#4A5C2F] bg-white shadow-sm"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setSelected(null); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Résultats de recherche */}
      {q.length >= 2 && !selected && (
        <div className="mt-2 bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">
              Aucune brigade trouvée pour &quot;{query}&quot;
            </p>
          ) : (
            <ul className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {filtered.map((b) => (
                <li key={b.id}>
                  <button
                    onClick={() => setSelected(b)}
                    className="w-full px-5 py-3 flex items-center gap-3 hover:bg-[#4A5C2F]/5 text-left transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#4A5C2F]/10 flex items-center justify-center shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#4A5C2F]" fill="none"
                        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-800 truncate">{b.nom}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {subdivNomFn(subdivisions, b.subdivision_id)}
                        {b.direction_regionale_id && ` · ${dirNomFn(b.direction_regionale_id)}`}
                      </p>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-300 ml-auto shrink-0"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Fiche brigade sélectionnée (lecture seule) */}
      {selected && (
        <div className="mt-2 bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden">
          {/* Header fiche */}
          <div className="bg-[#4A5C2F] px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-sm">{selected.nom}</p>
                <p className="text-[#C9A84C] text-xs">Consultation — Lecture seule</p>
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-white/50 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Corps fiche */}
          <div className="px-5 py-5 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Nom</p>
              <p className="text-sm font-semibold text-gray-800">{selected.nom}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Subdivision</p>
              <p className="text-sm text-gray-700">{subdivNomFn(subdivisions, selected.subdivision_id)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Direction Régionale</p>
              <span className="inline-block text-xs bg-[#4A5C2F]/10 text-[#4A5C2F] px-2.5 py-1 rounded-full font-medium">
                {dirNomFn(selected.direction_regionale_id)}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Localité</p>
              <p className="text-sm text-gray-700">{selected.localite || "—"}</p>
            </div>
            {selected.chef_brigade && (
              <div className="col-span-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Chef de Brigade</p>
                <p className="text-sm text-gray-700">{selected.chef_brigade}</p>
              </div>
            )}
          </div>

          {/* Badge lecture seule */}
          <div className="px-5 pb-4">
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Mode consultation — aucune modification autorisée
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

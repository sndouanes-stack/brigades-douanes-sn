"use client";

export default function ReadOnlyBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-8 py-2.5 flex items-center gap-3 shrink-0">
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-600 shrink-0" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <p className="text-sm text-amber-800 font-semibold">Mode consultation — Lecture seule</p>
      <span className="ml-auto text-xs text-amber-600 font-medium bg-amber-100 px-2.5 py-1 rounded-full">
        Aucune modification autorisée
      </span>
    </div>
  );
}

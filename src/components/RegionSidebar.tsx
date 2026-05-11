"use client";

import { memo, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/useUserProfile";
import { DIRECTIONS_REGIONALES } from "@/lib/roles";

const NAV_ITEMS = [
  {
    label: "Tableau de bord",
    vue: "dashboard",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: "Subdivisions",
    vue: "subdivisions",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    label: "Brigades",
    vue: "brigades",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    label: "Personnel",
    vue: "personnel",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 100-8 4 4 0 000 8zm6 0a3 3 0 100-6 3 3 0 000 6zM3 14a3 3 0 100-6 3 3 0 000 6z" />
      </svg>
    ),
  },
  {
    label: "Montages du jour",
    vue: "montages",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    label: "Caisse",
    vue: "caisse",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    label: "Correspondances",
    vue: "correspondances",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: "Saisies et Règlements",
    vue: "saisies",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    label: "Rapports",
    vue: "rapports",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

const LOGO_STYLE: React.CSSProperties = { objectFit: "contain", flexShrink: 0 };

function RegionSidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useUserProfile();

  const currentVue = searchParams.get("vue") ?? "dashboard";
  const direction = DIRECTIONS_REGIONALES.find((d) => d.id === profile?.directionRegionaleId);

  async function handleLogout() {
    await supabase.auth.signOut();
    document.cookie = "session=; path=/; max-age=0";
    document.cookie = "role=; path=/; max-age=0";
    router.push("/login");
  }

  return (
    <>
      {/* Direction name */}
      {direction && (
        <div className="px-6 py-3 border-b border-white/10 bg-white/5">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-0.5">Directeur Régional</p>
          <p className="text-white text-xs font-semibold leading-tight">{direction.nom}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === "/region" && currentVue === item.vue;
          return (
            <Link
              key={item.vue}
              href={`/region?vue=${item.vue}`}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 group
                ${isActive
                  ? "bg-[#C9A84C] text-[#4A5C2F] shadow-md"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
            >
              <span className={isActive ? "text-[#4A5C2F]" : "text-white/60 group-hover:text-white"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="px-4 py-4 border-t border-white/10">
        {profile && (
          <div className="px-2 mb-3">
            <p className="text-white text-xs font-semibold truncate">
              {profile.prenom} <span className="uppercase">{profile.nom}</span>
            </p>
            <p className="text-white/40 text-xs truncate">{profile.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-white/60 hover:bg-white/10 hover:text-white text-xs font-medium transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Déconnexion
        </button>
        <p className="text-white/20 text-xs text-center mt-3">
          DGD Sénégal © {new Date().getFullYear()}
        </p>
      </div>
    </>
  );
}

const RegionSidebar = memo(function RegionSidebar() {
  return (
    <aside className="w-64 shrink-0 min-h-screen bg-[#4A5C2F] flex flex-col shadow-xl">

      {/* Logo — outside Suspense so it never disappears on navigation */}
      <div className="px-6 py-7 border-b border-white/10">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo-douanes.png"
            alt="Logo Douanes SN"
            width={50}
            height={50}
            style={LOGO_STYLE}
          />
          <div>
            <p className="text-white font-bold text-sm leading-tight">Douanes SN</p>
            <p className="text-[#C9A84C] text-xs tracking-widest uppercase">Direction Rég.</p>
          </div>
        </div>
      </div>

      {/* Nav (uses useSearchParams) — inside Suspense */}
      <Suspense fallback={<div className="flex-1" />}>
        <RegionSidebarNav />
      </Suspense>
    </aside>
  );
});

export default RegionSidebar;

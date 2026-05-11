"use client";

import { memo, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useUserProfile } from "@/lib/useUserProfile";

// ── Constantes stable (module-level) ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NAV_ITEMS_AGENT: { label: string; href: string; tab: string | null; icon: React.ReactNode }[] = [
  {
    label: "Tableau de bord",
    href: "/agent",
    tab: null,
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
    label: "Mon Statut du jour",
    href: "/agent?tab=statut",
    tab: "statut",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    label: "Personnel",
    href: "/agent?tab=personnel",
    tab: "personnel",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 100-8 4 4 0 000 8zm6 0a3 3 0 100-6 3 3 0 000 6zM3 14a3 3 0 100-6 3 3 0 000 6z" />
      </svg>
    ),
  },
  {
    label: "Rapports",
    href: "/agent?tab=rapports",
    tab: "rapports",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: "Saisies et Règlements",
    href: "/agent?tab=saisies",
    tab: "saisies",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
];

const NAV_ITEMS: { label: string; href: string; icon: React.ReactNode }[] = [
  {
    label: "Tableau de bord",
    href: "/dashboard",
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
    label: "Personnel",
    href: "/dashboard/personnel",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 100-8 4 4 0 000 8zm6 0a3 3 0 100-6 3 3 0 000 6zM3 14a3 3 0 100-6 3 3 0 000 6z" />
      </svg>
    ),
  },
  {
    label: "Caisse",
    href: "/dashboard/caisse",
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
    href: "/dashboard/correspondances",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: "Quittances RS",
    href: "/dashboard/quittances",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: "Rapports",
    href: "/dashboard/rapports",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: "Main Courante",
    href: "/dashboard/main-courante",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    label: "Saisies et Règlement",
    href: "/dashboard/saisies",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
];

// ── Style stable pour le logo ─────────────────────────────────────────────────
const LOGO_STYLE: React.CSSProperties = { objectFit: "contain", flexShrink: 0 };

// ── Partie dynamique (useSearchParams nécessite Suspense) ─────────────────────

function SidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile } = useUserProfile();

  const roleUpper = profile?.role?.toUpperCase() ?? "";
  const isAdmin = roleUpper === "ADMIN";
  const isAgent = roleUpper === "AGENT";
  const currentTab = searchParams.get("tab");
  const visibleNavItems = isAgent ? NAV_ITEMS_AGENT : NAV_ITEMS;

  return (
    <>
      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {visibleNavItems.map((item) => {
          const isActive = isAgent && "tab" in item
            ? pathname === "/agent" && currentTab === item.tab
            : pathname === item.href.split("?")[0];
          return (
            <Link
              key={item.href}
              href={item.href}
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

      {/* Administration (admins uniquement) */}
      {isAdmin && (
        <div className="px-3 pb-3">
          <div className="border-t border-white/10 pt-3">
            <p className="text-white/30 text-xs uppercase tracking-widest px-4 mb-1">Admin</p>
            <Link
              href="/admin/utilisateurs"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 group
                ${pathname === "/admin/utilisateurs"
                  ? "bg-[#C9A84C] text-[#4A5C2F] shadow-md"
                  : "text-white/70 hover:bg-white/10 hover:text-white"}`}
            >
              <span className={pathname === "/admin/utilisateurs" ? "text-[#4A5C2F]" : "text-white/60 group-hover:text-white"}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              Utilisateurs
            </Link>
            <Link
              href="/admin/structure"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 group
                ${pathname === "/admin/structure"
                  ? "bg-[#C9A84C] text-[#4A5C2F] shadow-md"
                  : "text-white/70 hover:bg-white/10 hover:text-white"}`}
            >
              <span className={pathname === "/admin/structure" ? "text-[#4A5C2F]" : "text-white/60 group-hover:text-white"}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 6h3m0 0V4a1 1 0 011-1h4a1 1 0 011 1v2m-5 0h5m0 0h3M6 6v12m0 0h12M6 18H4a1 1 0 01-1-1V9a1 1 0 011-1h2" />
                  <rect x="14" y="8" width="6" height="4" rx="1" />
                  <rect x="14" y="16" width="6" height="4" rx="1" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 12v4" />
                </svg>
              </span>
              Structure
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

// ── Composant exporté ─────────────────────────────────────────────────────────

const Sidebar = memo(function Sidebar() {
  return (
    <aside className="w-64 shrink-0 min-h-screen bg-[#4A5C2F] flex flex-col shadow-xl">

      {/* Logo — HORS du Suspense pour ne jamais disparaître lors des re-renders */}
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
            <p className="text-[#C9A84C] text-xs tracking-widest uppercase">Brigades</p>
          </div>
        </div>
      </div>

      {/* Navigation + Admin — dans Suspense car useSearchParams l'exige */}
      <Suspense fallback={<div className="flex-1" />}>
        <SidebarNav />
      </Suspense>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/10">
        <p className="text-white/30 text-xs text-center" suppressHydrationWarning>
          DGD Sénégal © {new Date().getFullYear()}
        </p>
      </div>
    </aside>
  );
});

export default Sidebar;

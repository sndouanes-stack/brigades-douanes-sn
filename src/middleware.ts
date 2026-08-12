import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ROLE_ALLOWED_PREFIXES, ROLE_HOME, normalizeRole } from "@/lib/roles";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico"
  ) {
    return supabaseResponse;
  }

  // Vérifier la présence des cookies de session et de rôle
  const sessionCookie = request.cookies.get("session")?.value;
  const rawRole = request.cookies.get("role")?.value;
  const roleCookie = rawRole ? normalizeRole(rawRole) : null;

  // Vérifie la session Supabase (rafraîchit le token si nécessaire)
  const { data: { user } } = await supabase.auth.getUser();

  const isAuthenticated = !!user || !!sessionCookie;

  if (!isAuthenticated) {
    if (pathname === "/login") {
      return supabaseResponse;
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const home = roleCookie ? ROLE_HOME[roleCookie] : "/dashboard";

  // Si l'utilisateur est connecté et consulte /login, le rediriger vers son espace
  if (pathname === "/login") {
    return NextResponse.redirect(new URL(home, request.url));
  }

  // Si le rôle est connu et que l'utilisateur accède à une route non autorisée pour son rôle
  if (roleCookie && ROLE_ALLOWED_PREFIXES[roleCookie]) {
    const allowed = ROLE_ALLOWED_PREFIXES[roleCookie].some((prefix) => pathname.startsWith(prefix));
    if (!allowed) {
      return NextResponse.redirect(new URL(home, request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

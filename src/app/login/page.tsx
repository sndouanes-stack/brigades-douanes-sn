"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { ROLE_HOME } from "@/lib/roles";

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          setError("Email ou mot de passe incorrect.");
        } else if (authError.message.includes("Email not confirmed")) {
          setError("Votre email n'est pas confirmé.");
        } else {
          setError("Erreur d'authentification. Veuillez réessayer.");
        }
        setLoading(false);
        return;
      }

      if (!data.user) { setError("Erreur d'authentification."); setLoading(false); return; }

      // Cookie session
      document.cookie = `session=${data.session!.access_token}; path=/; max-age=3600; SameSite=Strict`;

      // Lire le profil pour vérifier activation et rôle
      const { data: profileData } = await supabase
        .from("users")
        .select("role, actif")
        .eq("id", data.user.id)
        .single();

      const role = profileData?.role?.toUpperCase() ?? "";

      if (profileData?.actif === false && role !== "ADMIN") {
        await supabase.auth.signOut();
        document.cookie = "session=; path=/; max-age=0";
        setError("Votre compte a été désactivé. Contactez votre administrateur.");
        setLoading(false);
        return;
      }

      document.cookie = `role=${role}; path=/; max-age=3600; SameSite=Strict`;

      // Redirection selon le rôle
      const home = ROLE_HOME[role as keyof typeof ROLE_HOME] ?? "/dashboard";
      router.push(home);
    } catch {
      setError("Erreur d'authentification. Veuillez réessayer.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#4A5C2F] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-[#4A5C2F] px-8 py-10 text-center">
            <div className="mx-auto mb-5 w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-lg ring-4 ring-[#C9A84C]/30 overflow-hidden">
              <Image src="/images/logo-douanes.png" alt="Logo Douanes Sénégal" width={88} height={88} className="object-contain" />
            </div>
            <h1 className="text-white text-2xl font-bold tracking-wide leading-tight">Douanes SN</h1>
            <p className="text-[#C9A84C] text-xs font-semibold mt-1 tracking-[0.2em] uppercase">Brigades Mobiles</p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <div className="h-px w-10 bg-[#C9A84C]/40" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />
              <div className="h-px w-10 bg-[#C9A84C]/40" />
            </div>
          </div>

          <div className="px-8 py-8">
            <h2 className="text-[#4A5C2F] text-base font-semibold mb-6 text-center">Connexion à votre espace</h2>
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Adresse email</label>
                <input id="email" type="email" autoComplete="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A5C2F] focus:border-transparent transition-all duration-150" />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
                <input id="password" type="password" autoComplete="current-password" required value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A5C2F] focus:border-transparent transition-all duration-150" />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2">
                  <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}
              <button type="submit" disabled={loading}
                className="w-full bg-[#4A5C2F] hover:bg-[#3b4a25] active:bg-[#2d381c] text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#4A5C2F] focus:ring-offset-2">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Connexion en cours…
                  </span>
                ) : "Se connecter"}
              </button>
            </form>
          </div>

          <div className="px-8 pb-7 text-center">
            <p className="text-xs text-gray-400 leading-relaxed">
              Accès réservé au personnel autorisé<br />des Douanes de la République du Sénégal
            </p>
          </div>
        </div>
        <p className="text-center text-white/40 text-xs mt-6">
          © {new Date().getFullYear()} Direction Générale des Douanes — Sénégal
        </p>
      </div>
    </main>
  );
}

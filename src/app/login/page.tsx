"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ROLE_HOME, normalizeRole } from "@/lib/roles";
import { LOGO_DATA_URI } from "@/lib/logoDataUri";

export default function LoginPage() {
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState("");
  const [loading,      setLoading]      = useState(false);

  // Modal Mot de passe oublié
  const [showResetModal,   setShowResetModal]   = useState(false);
  const [resetPhone,       setResetPhone]       = useState("");
  const [resetLoading,     setResetLoading]     = useState(false);
  const [resetError,       setResetError]       = useState("");
  const [resetSuccess,     setResetSuccess]     = useState("");
  const [foundUser,        setFoundUser]        = useState<{ userId: string; nom: string; prenom: string; email: string } | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });

      if (authError) {
        console.error("Auth error:", authError);
        const msg = (authError.message ?? "").toLowerCase();
        if (msg.includes("invalid") || msg.includes("credentials") || msg.includes("wrong")) {
          setError("Email ou mot de passe incorrect.");
        } else if (msg.includes("email not confirmed")) {
          setError("Votre email n'est pas confirmé.");
        } else {
          setError(`Erreur d'authentification : ${authError.message}`);
        }
        setLoading(false);
        return;
      }

      if (!data.user) { setError("Erreur d'authentification."); setLoading(false); return; }

      // Cookie session
      document.cookie = `session=${data.session!.access_token}; path=/; max-age=3600; SameSite=Lax`;

      // Lire le profil pour vérifier activation et rôle
      const { data: profileData } = await supabase
        .from("users")
        .select("role, actif")
        .eq("id", data.user.id)
        .single();

      // Fallback sur les métadonnées Auth si la table users est inaccessible (RLS)
      const rawRole = profileData?.role
        ?? (data.user.user_metadata?.role as string | undefined)
        ?? "CHEF_BRIGADE";

      const role = normalizeRole(rawRole);

      if (profileData?.actif === false && role !== "ADMIN") {
        await supabase.auth.signOut();
        document.cookie = "session=; path=/; max-age=0; SameSite=Lax";
        document.cookie = "role=; path=/; max-age=0; SameSite=Lax";
        setError("Votre compte a été désactivé. Contactez votre administrateur.");
        setLoading(false);
        return;
      }

      document.cookie = `role=${role}; path=/; max-age=3600; SameSite=Lax`;

      // Redirection selon le rôle
      const home = ROLE_HOME[role] ?? "/dashboard";
      window.location.href = home;
    } catch (err) {
      console.error("Submit exception:", err);
      setError(`Erreur de connexion : ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
    }
  }

  async function handleSearchAccount(e: React.FormEvent) {
    e.preventDefault();
    setResetError("");
    setResetLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: resetPhone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur lors de la recherche.");

      if (json.found && json.accountInfo) {
        setFoundUser({
          userId: json.userId,
          nom: json.accountInfo.nom,
          prenom: json.accountInfo.prenom,
          email: json.accountInfo.email,
        });
      } else {
        setResetError(json.message || "Aucun compte associé à ce numéro.");
      }
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Erreur de recherche.");
    } finally {
      setResetLoading(false);
    }
  }

  async function handleResetPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResetError("");
    setResetSuccess("");
    setResetLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: resetPhone,
          userId: foundUser?.userId,
          newPassword: resetNewPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur lors du changement de mot de passe.");

      setResetSuccess(json.message || "Mot de passe réinitialisé avec succès !");
      setTimeout(() => {
        setShowResetModal(false);
        setFoundUser(null);
      }, 2500);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Erreur de réinitialisation.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#4A5C2F] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-[#4A5C2F] px-8 py-10 text-center">
            <div className="mx-auto mb-5 w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-lg ring-4 ring-[#C9A84C]/30 overflow-hidden p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO_DATA_URI} alt="Logo Douanes Sénégal" className="w-full h-full object-contain" />
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
                <div className="flex items-center gap-2">
                  <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password}
                    onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                    className="flex-1 min-w-0 px-4 py-3 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A5C2F] focus:border-transparent transition-all duration-150" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="px-3.5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-[#4A5C2F] border border-gray-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4A5C2F]"
                    title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPassword ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#4A5C2F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" />
                        </svg>
                        <span className="text-xs">Cacher</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span className="text-xs">Voir</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    onClick={() => { setShowResetModal(true); setResetError(""); setResetSuccess(""); setFoundUser(null); setResetPhone(""); setResetNewPassword(""); }}
                    className="text-xs text-[#4A5C2F] hover:underline font-semibold focus:outline-none"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
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
            <p className="text-gray-400 text-xs">Accès réservé au personnel autorisé</p>
            <p className="text-gray-400 text-xs mt-0.5">des Douanes de la République du Sénégal</p>
          </div>
        </div>
        <p className="text-center text-white/40 text-xs mt-6">
          © {new Date().getFullYear()} Direction Générale des Douanes — Sénégal
        </p>
      </div>

      {/* Modal Récupération Mot de passe */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setShowResetModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-[#4A5C2F] px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#C9A84C] flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#4A5C2F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">Récupération de mot de passe</h3>
                  <p className="text-xs text-[#C9A84C]">Recherche par numéro de téléphone</p>
                </div>
              </div>
              <button onClick={() => setShowResetModal(false)} className="text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-6 space-y-5">
              {!foundUser ? (
                <form onSubmit={handleSearchAccount} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Numéro de téléphone</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">+221</span>
                      <input
                        type="tel"
                        required
                        value={resetPhone}
                        onChange={(e) => setResetPhone(e.target.value)}
                        placeholder="77 000 00 00"
                        className="w-full pl-14 pr-4 py-3 rounded-lg border border-gray-300 text-gray-900 text-sm font-semibold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4A5C2F]"
                      />
                    </div>
                  </div>

                  {resetError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-xs font-medium">
                      {resetError}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowResetModal(false)}
                      className="flex-1 px-4 py-2.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="flex-1 px-4 py-2.5 text-xs font-semibold text-white bg-[#4A5C2F] hover:bg-[#3b4a25] rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {resetLoading ? "Recherche…" : "Rechercher mon compte"}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-xs text-green-800 font-semibold mb-1">Compte identifié :</p>
                    <p className="text-sm font-bold text-green-900">{foundUser.prenom} {foundUser.nom}</p>
                    <p className="text-xs text-green-700 mt-0.5">{foundUser.email}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nouveau mot de passe</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      placeholder="Nouveau mot de passe (min 6 caractères)"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A5C2F]"
                    />
                  </div>

                  {resetError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-xs font-medium">
                      {resetError}
                    </div>
                  )}

                  {resetSuccess && (
                    <div className="bg-green-100 border border-green-300 rounded-lg p-3 text-green-800 text-xs font-semibold">
                      {resetSuccess}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setFoundUser(null)}
                      className="flex-1 px-4 py-2.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      Retour
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="flex-1 px-4 py-2.5 text-xs font-semibold text-white bg-[#4A5C2F] hover:bg-[#3b4a25] rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {resetLoading ? "Enregistrement…" : "Changer le mot de passe"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

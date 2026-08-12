"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  type Role, type UserProfile,
  ROLE_LABELS, ROLE_COLORS,
  DIRECTIONS_REGIONALES,
  BRIGADES, SUBDIVISIONS,
} from "@/lib/roles";
import { useUserProfile } from "@/lib/useUserProfile";
import BrigadeSearch from "@/components/BrigadeSearch";

interface FsBrigade { id: string; nom: string; subdivisionId?: string; directionRegionaleId?: string; }
interface FsSubdivision { id: string; nom: string; directionRegionaleId?: string; }

const ROLES_ORDER: Role[] = ["AGENT", "CHEF_BRIGADE", "CHEF_SUBDIVISION", "DIRECTEUR_REGIONAL", "ADMIN"];

interface FormState {
  email: string;
  password: string;
  nom: string;
  prenom: string;
  role: Role;
  brigadeId: string;
  subdivisionId: string;
  regionId: string;
  directionRegionaleId: string;
  matricule: string;
  telephone: string;
}

const DEFAULT_FORM: FormState = {
  email: "", password: "", nom: "", prenom: "",
  role: "AGENT", brigadeId: "", subdivisionId: "", regionId: "", directionRegionaleId: "", matricule: "", telephone: "",
};

function generatePassword(): string {
  const year = new Date().getFullYear();
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `Douanes${year}${rand}!`;
}

const inputCls = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A5C2F]";
const labelCls = "block text-xs font-semibold text-gray-700 mb-1.5";

export default function AdminUtilisateursPage() {
  const { profile: myProfile } = useUserProfile();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  // Initialise avec les données statiques pour garantir des listes non-vides dès le premier rendu.
  // Les données Firestore (collections brigades/subdivisions) remplacent les statiques quand disponibles.
  const [fsBrigades, setFsBrigades] = useState<FsBrigade[]>(
    BRIGADES.map((b) => ({ id: b.id, nom: b.nom, subdivisionId: b.subdivisionId }))
  );
  const [fsSubdivisions, setFsSubdivisions] = useState<FsSubdivision[]>(
    SUBDIVISIONS.map((s) => ({ id: s.id, nom: s.nom, directionRegionaleId: s.directionRegionaleId }))
  );

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [generatedPwd, setGeneratedPwd] = useState("");

  // Edit modal
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState<Omit<FormState, "email" | "password"> & { newPassword: string }>({
    nom: "", prenom: "", role: "AGENT", brigadeId: "", subdivisionId: "", regionId: "", directionRegionaleId: "", matricule: "", telephone: "", newPassword: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Quick password modal
  const [passwordUser, setPasswordUser] = useState<UserProfile | null>(null);
  const [quickPassword, setQuickPassword] = useState("");
  const [quickPwdSaving, setQuickPwdSaving] = useState(false);
  const [quickPwdError, setQuickPwdError] = useState("");
  const [quickPwdSuccess, setQuickPwdSuccess] = useState("");

  const [search, setSearch] = useState("");

  // Delete modal
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("users").select("*");
    const list = (data ?? []).map((d) => ({
      uid: d.id,
      email: d.email,
      nom: d.nom,
      prenom: d.prenom,
      role: d.role,
      actif: d.actif,
      brigadeId: d.brigade_id ?? undefined,
      subdivisionId: d.subdivision_id ?? undefined,
      directionRegionaleId: d.direction_regionale_id ?? undefined,
      matricule: d.matricule ?? undefined,
      grade: d.grade ?? undefined,
      telephone: d.telephone ?? undefined,
    } as UserProfile));
    list.sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom));
    setUsers(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
    // Charge les brigades/subdivisions depuis Supabase et écrase les statiques si des données existent.
    void supabase.from("brigades").select("id, nom, subdivision_id, direction_regionale_id").then(({ data }) => {
      if (data && data.length > 0) {
        setFsBrigades(data.map((d) => ({ id: d.id, nom: d.nom, subdivisionId: d.subdivision_id, directionRegionaleId: d.direction_regionale_id })));
      }
    });
    void supabase.from("subdivisions").select("id, nom, direction_regionale_id").then(({ data }) => {
      if (data && data.length > 0) {
        setFsSubdivisions(data.map((d) => ({ id: d.id, nom: d.nom, directionRegionaleId: d.direction_regionale_id })));
      }
    });
  }, [fetchUsers]);

  // ── Create form ─────────────────────────────────────────────────────────────
  function openCreate() {
    const pwd = generatePassword();
    setGeneratedPwd(pwd);
    setForm({ ...DEFAULT_FORM, password: pwd });
    setCreateError("");
    setShowCreate(true);
  }

  function handleFormChange(field: keyof FormState, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "role") {
        next.brigadeId = "";
        next.subdivisionId = "";
        next.regionId = "";
        next.directionRegionaleId = "";
        next.matricule = "";
      }
      if (field === "directionRegionaleId") {
        next.subdivisionId = "";
        next.brigadeId = "";
      }
      if (field === "subdivisionId") {
        next.brigadeId = "";
      }
      return next;
    });
  }

  function refreshPassword() {
    const pwd = generatePassword();
    setGeneratedPwd(pwd);
    setForm((prev) => ({ ...prev, password: pwd }));
  }

  async function handleCreate() {
    setCreateError("");
    if (!form.email || !form.password || !form.nom || !form.prenom) {
      setCreateError("Remplissez tous les champs obligatoires.");
      return;
    }
    if ((form.role === "AGENT" || form.role === "CHEF_BRIGADE") && !form.brigadeId) {
      setCreateError("Sélectionnez la brigade.");
      return;
    }
    if (form.role === "CHEF_SUBDIVISION" && !form.subdivisionId) {
      setCreateError("Sélectionnez la subdivision.");
      return;
    }
    if (form.role === "DIRECTEUR_REGIONAL" && !form.directionRegionaleId) {
      setCreateError("Sélectionnez la Direction Régionale.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          nom: form.nom.trim(),
          prenom: form.prenom.trim(),
          role: form.role,
          brigade_id: form.brigadeId || null,
          subdivision_id: form.subdivisionId || null,
          direction_regionale_id: form.directionRegionaleId || null,
          matricule: form.matricule.trim() || null,
          telephone: form.telephone.trim() || null,
          actif: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.error?.includes("already")) {
          setCreateError("Un compte avec cet email existe déjà.");
        } else {
          setCreateError(json.error ?? "Erreur lors de la création du compte.");
        }
        setSaving(false);
        return;
      }
      setShowCreate(false);
      await fetchUsers();
    } catch (err: unknown) {
      console.error(err);
      setCreateError("Erreur inattendue. Vérifiez votre connexion.");
    } finally {
      setSaving(false);
    }
  }

  // ── Edit form ────────────────────────────────────────────────────────────────
  function openEdit(user: UserProfile) {
    setEditingUser(user);
    setEditForm({
      nom: user.nom,
      prenom: user.prenom,
      role: user.role,
      brigadeId: user.brigadeId ?? "",
      subdivisionId: user.subdivisionId ?? "",
      regionId: user.regionId ?? "",
      directionRegionaleId: user.directionRegionaleId ?? "",
      matricule: user.matricule ?? "",
      telephone: user.telephone ?? "",
      newPassword: "",
    });
    setEditError("");
  }

  function handleEditChange(field: keyof typeof editForm, value: string) {
    setEditForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "role") {
        next.brigadeId = "";
        next.subdivisionId = "";
        next.regionId = "";
        next.directionRegionaleId = "";
        next.matricule = "";
      }
      if (field === "directionRegionaleId") {
        next.subdivisionId = "";
        next.brigadeId = "";
      }
      if (field === "subdivisionId") {
        next.brigadeId = "";
      }
      return next;
    });
  }

  async function handleUpdate() {
    if (!editingUser) return;
    setEditError("");
    if (!editForm.nom || !editForm.prenom) {
      setEditError("Nom et prénom sont obligatoires.");
      return;
    }
    if ((editForm.role === "AGENT" || editForm.role === "CHEF_BRIGADE") && !editForm.brigadeId) {
      setEditError("Sélectionnez la brigade.");
      return;
    }
    if (editForm.role === "CHEF_SUBDIVISION" && !editForm.subdivisionId) {
      setEditError("Sélectionnez la subdivision.");
      return;
    }
    if (editForm.role === "DIRECTEUR_REGIONAL" && !editForm.directionRegionaleId) {
      setEditError("Sélectionnez la Direction Régionale.");
      return;
    }

    setEditSaving(true);
    try {
      const res = await fetch("/api/admin/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: editingUser.uid,
          nom: editForm.nom.trim(),
          prenom: editForm.prenom.trim(),
          role: editForm.role,
          brigade_id: editForm.brigadeId || null,
          subdivision_id: editForm.subdivisionId || null,
          direction_regionale_id: editForm.directionRegionaleId || null,
          matricule: editForm.matricule.trim() || null,
          telephone: editForm.telephone.trim() || null,
          password: editForm.newPassword.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur lors de la mise à jour.");

      setUsers((prev) =>
        prev.map((u) => u.uid === editingUser.uid ? {
          ...u,
          nom: editForm.nom.trim(), prenom: editForm.prenom.trim(), role: editForm.role,
          brigadeId: editForm.brigadeId || undefined,
          subdivisionId: editForm.subdivisionId || undefined,
          directionRegionaleId: editForm.directionRegionaleId || undefined,
          matricule: editForm.matricule.trim() || undefined,
          telephone: editForm.telephone.trim() || undefined,
        } : u)
      );
      setEditingUser(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Erreur lors de la mise à jour.");
    } finally {
      setEditSaving(false);
    }
  }

  // ── Quick password change modal handlers ──────────────────────────────────
  function openPasswordModal(user: UserProfile) {
    setPasswordUser(user);
    const pwd = generatePassword();
    setQuickPassword(pwd);
    setQuickPwdError("");
    setQuickPwdSuccess("");
  }

  async function handleQuickPasswordSave() {
    if (!passwordUser) return;
    setQuickPwdError("");
    setQuickPwdSuccess("");
    if (!quickPassword || quickPassword.trim().length < 6) {
      setQuickPwdError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setQuickPwdSaving(true);
    try {
      const res = await fetch("/api/admin/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: passwordUser.uid,
          password: quickPassword.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur lors du changement de mot de passe.");
      setQuickPwdSuccess("Mot de passe mis à jour avec succès !");
      setTimeout(() => {
        setPasswordUser(null);
      }, 1800);
    } catch (err) {
      setQuickPwdError(err instanceof Error ? err.message : "Erreur lors du changement de mot de passe.");
    } finally {
      setQuickPwdSaving(false);
    }
  }

  // ── Toggle actif ─────────────────────────────────────────────────────────────
  async function toggleActif(user: UserProfile) {
    await supabase.from("users").update({ actif: !user.actif }).eq("id", user.uid);
    setUsers((prev) =>
      prev.map((u) => u.uid === user.uid ? { ...u, actif: !u.actif } : u)
    );
  }

  // ── Supprimer utilisateur ─────────────────────────────────────────────────────
  async function handleDeleteUser(user: UserProfile) {
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid }),
      });
      const json = await res.json();
      if (!res.ok) {
        setDeleteError(json.error ?? "Erreur lors de la suppression.");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      setConfirmDeleteUser(null);
    } catch {
      setDeleteError("Erreur inattendue. Vérifiez votre connexion.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      q === "" ||
      u.nom.toLowerCase().includes(q) ||
      u.prenom.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      ROLE_LABELS[u.role].toLowerCase().includes(q)
    );
  });

  function showMatricule(roleVal: Role) {
    return roleVal === "AGENT" || roleVal === "CHEF_BRIGADE";
  }

  // ── Reusable affectation label ─────────────────────────────────────────────
  function affectationLabel(user: UserProfile) {
    const brigade = fsBrigades.find((b) => b.id === user.brigadeId);
    const subdivision = fsSubdivisions.find((s) => s.id === user.subdivisionId);
    const direction = DIRECTIONS_REGIONALES.find((d) => d.id === user.directionRegionaleId);
    return brigade?.nom ?? subdivision?.nom ?? direction?.nom ?? "—";
  }

  function directionLabel(user: UserProfile) {
    return DIRECTIONS_REGIONALES.find((d) => d.id === user.directionRegionaleId)?.nom ?? null;
  }

  /**
   * Cascade DR → Subdivision → Brigade selon le rôle :
   *   DIRECTEUR_REGIONAL  → sélection DR uniquement
   *   CHEF_SUBDIVISION    → DR puis Subdivision (filtrée par DR)
   *   CHEF_BRIGADE/AGENT  → DR puis Subdivision puis Brigade
   *   ADMIN               → rien
   */
  function AffectationFields({
    roleVal, directionRegionaleId, subdivisionId, brigadeId,
    onDR, onSubdiv, onBrigade,
  }: {
    roleVal: Role;
    directionRegionaleId: string;
    subdivisionId: string;
    brigadeId: string;
    onDR: (v: string) => void;
    onSubdiv: (v: string) => void;
    onBrigade: (v: string) => void;
  }) {
    if (roleVal === "ADMIN") return null;

    const subdivisionsForDR = directionRegionaleId
      ? fsSubdivisions.filter((s) => s.directionRegionaleId === directionRegionaleId)
      : fsSubdivisions;

    const brigadesForSub = subdivisionId
      ? fsBrigades.filter((b) => b.subdivisionId === subdivisionId)
      : directionRegionaleId
      ? fsBrigades.filter((b) => {
          const sub = fsSubdivisions.find((s) => s.id === b.subdivisionId);
          return sub?.directionRegionaleId === directionRegionaleId;
        })
      : fsBrigades;

    return (
      <>
        {/* Direction Régionale — tous sauf ADMIN */}
        <div>
          <label className={labelCls}>
            Direction Régionale {roleVal === "DIRECTEUR_REGIONAL" ? "*" : ""}
          </label>
          <select value={directionRegionaleId} onChange={(e) => onDR(e.target.value)}
            className={inputCls + " bg-white"}>
            <option value="">— Sélectionner —</option>
            {DIRECTIONS_REGIONALES.map((dr) => (
              <option key={dr.id} value={dr.id}>{dr.nom}</option>
            ))}
          </select>
        </div>

        {/* Subdivision — Chef de Subdivision, Chef de Brigade, Agent */}
        {(roleVal === "CHEF_SUBDIVISION" || roleVal === "CHEF_BRIGADE" || roleVal === "AGENT") && (
          <div>
            <label className={labelCls}>
              Subdivision {roleVal === "CHEF_SUBDIVISION" ? "*" : ""}
            </label>
            <select value={subdivisionId} onChange={(e) => onSubdiv(e.target.value)}
              className={inputCls + " bg-white"}>
              <option value="">— Sélectionner —</option>
              {subdivisionsForDR.map((s) => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
            </select>
          </div>
        )}

        {/* Brigade — Chef de Brigade et Agent */}
        {(roleVal === "CHEF_BRIGADE" || roleVal === "AGENT") && (
          <div>
            <label className={labelCls}>Brigade *</label>
            <select value={brigadeId} onChange={(e) => onBrigade(e.target.value)}
              className={inputCls + " bg-white"}>
              <option value="">— Sélectionner —</option>
              {brigadesForSub.map((b) => (
                <option key={b.id} value={b.id}>{b.nom}</option>
              ))}
            </select>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#4A5C2F] px-8 py-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-white text-xl font-bold">Gestion des utilisateurs</h1>
            <p className="text-[#C9A84C] text-xs mt-0.5 uppercase tracking-widest">Administration</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-[#C9A84C] hover:bg-[#b8943f] text-[#4A5C2F] font-semibold
              px-5 py-2.5 rounded-xl text-sm transition-colors shadow-md"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nouvel utilisateur
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">

        {/* Recherche de brigades */}
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Recherche de brigades
          </h2>
          <BrigadeSearch />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          {ROLES_ORDER.map((role) => {
            const count = users.filter((u) => u.role === role).length;
            return (
              <div key={role} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-2xl font-bold text-gray-800">{count}</p>
                <p className="text-xs text-gray-500 mt-1">{ROLE_LABELS[role]}</p>
                <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[role]}`}>
                  {role}
                </span>
              </div>
            );
          })}
        </div>

        {/* Search */}
        <div className="mb-4 relative max-w-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            autoComplete="off"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4A5C2F]"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mb-3 opacity-30" fill="none"
                viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 100-8 4 4 0 000 8z" />
              </svg>
              <p className="text-sm">Aucun utilisateur trouvé</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Utilisateur</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rôle</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Affectation</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((user) => (
                  <tr key={user.uid} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-800">{user.prenom} <span className="uppercase">{user.nom}</span></p>
                      <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
                      {user.telephone && (
                        <p className="text-xs text-[#4A5C2F] font-semibold mt-0.5 flex items-center gap-1">
                          <span>📱</span> {user.telephone}
                        </p>
                      )}
                      {user.matricule && (
                        <p className="text-xs font-mono text-gray-400 mt-0.5">{user.matricule}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS[user.role]}`}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <p className="text-xs text-gray-500">{affectationLabel(user)}</p>
                      {directionLabel(user) && (
                        <p className="text-xs text-[#4A5C2F]/70 mt-0.5">{directionLabel(user)}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        user.actif ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                      }`}>
                        {user.actif ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* Changer mot de passe */}
                        <button
                          onClick={() => openPasswordModal(user)}
                          title="Changer le mot de passe"
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                        </button>
                        {/* Modifier */}
                        <button
                          onClick={() => openEdit(user)}
                          title="Modifier les informations"
                          className="p-1.5 text-gray-400 hover:text-[#4A5C2F] hover:bg-[#4A5C2F]/10 rounded-lg transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {/* Désactiver / Activer */}
                        <button
                          onClick={() => toggleActif(user)}
                          title={user.actif ? "Désactiver" : "Activer"}
                          className={`p-1.5 rounded-lg transition-colors ${
                            user.actif
                              ? "text-orange-400 hover:text-orange-600 hover:bg-orange-50"
                              : "text-green-500 hover:text-green-700 hover:bg-green-50"
                          }`}
                        >
                          {user.actif ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        {/* Supprimer — interdit sur son propre compte */}
                        {user.uid !== myProfile?.uid && (
                          <button
                            onClick={() => { setConfirmDeleteUser(user); setDeleteError(""); }}
                            title="Supprimer"
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Modal Créer ─────────────────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">

            <div className="bg-[#4A5C2F] px-6 py-5 flex items-center justify-between shrink-0">
              <h2 className="text-white font-bold text-base">Créer un utilisateur</h2>
              <button onClick={() => setShowCreate(false)}
                className="text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-6 space-y-4">
              {/* Rôle */}
              <div>
                <label className={labelCls}>Rôle *</label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES_ORDER.map((r) => (
                    <button key={r} onClick={() => handleFormChange("role", r)}
                      className={`text-xs py-2 px-3 rounded-lg border font-medium transition-all
                        ${form.role === r
                          ? "bg-[#4A5C2F] text-white border-[#4A5C2F]"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nom / Prénom */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Prénom *</label>
                  <input value={form.prenom} onChange={(e) => handleFormChange("prenom", e.target.value)}
                    placeholder="Moussa" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Nom *</label>
                  <input value={form.nom} onChange={(e) => handleFormChange("nom", e.target.value)}
                    placeholder="Diallo" className={inputCls} />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className={labelCls}>Email *</label>
                <input value={form.email} onChange={(e) => handleFormChange("email", e.target.value)}
                  type="email" placeholder="agent@douanes.sn" className={inputCls} />
              </div>

              {/* Numéro de téléphone */}
              <div>
                <label className={labelCls}>Numéro de téléphone (pour mot de passe oublié)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">+221</span>
                  <input
                    type="tel"
                    value={form.telephone}
                    onChange={(e) => handleFormChange("telephone", e.target.value)}
                    placeholder="77 000 00 00"
                    className={inputCls + " pl-12"}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Permet la récupération autonome du mot de passe en cas d&apos;oubli.
                </p>
              </div>

              {/* Mot de passe */}
              <div>
                <label className={labelCls}>Mot de passe temporaire *</label>
                <div className="flex gap-2">
                  <input value={form.password} onChange={(e) => handleFormChange("password", e.target.value)}
                    type="text" placeholder="••••••••"
                    className={inputCls + " font-mono flex-1"} />
                  <button
                    onClick={refreshPassword}
                    title="Générer un nouveau mot de passe"
                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-[#4A5C2F] transition-colors text-xs whitespace-nowrap"
                  >
                    Générer
                  </button>
                </div>
                {generatedPwd && (
                  <p className="text-xs text-gray-400 mt-1">
                    Mot de passe à communiquer à l&apos;utilisateur.
                  </p>
                )}
              </div>

              {/* Matricule */}
              {showMatricule(form.role) && (
                <div>
                  <label className={labelCls}>Matricule</label>
                  <input value={form.matricule} onChange={(e) => handleFormChange("matricule", e.target.value)}
                    placeholder="SN-0001" className={inputCls} />
                </div>
              )}

              {/* Affectation : DR → Subdivision → Brigade */}
              <AffectationFields
                roleVal={form.role}
                directionRegionaleId={form.directionRegionaleId}
                subdivisionId={form.subdivisionId}
                brigadeId={form.brigadeId}
                onDR={(v) => handleFormChange("directionRegionaleId", v)}
                onSubdiv={(v) => handleFormChange("subdivisionId", v)}
                onBrigade={(v) => handleFormChange("brigadeId", v)}
              />

              {createError && (
                <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg border border-red-100">{createError}</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowCreate(false)}
                className="px-5 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                Annuler
              </button>
              <button onClick={handleCreate} disabled={saving}
                className="px-6 py-2 text-sm font-semibold text-white bg-[#4A5C2F] hover:bg-[#3b4a25]
                  rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2">
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Création…
                  </>
                ) : "Créer l'utilisateur"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Modifier ───────────────────────────────────────────────────────── */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditingUser(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">

            <div className="bg-[#4A5C2F] px-6 py-5 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-white font-bold text-base">Modifier l&apos;utilisateur</h2>
                <p className="text-[#C9A84C] text-xs mt-0.5">{editingUser.prenom} <span className="uppercase">{editingUser.nom}</span></p>
              </div>
              <button onClick={() => setEditingUser(null)}
                className="text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-6 space-y-4">
              {/* Rôle */}
              <div>
                <label className={labelCls}>Rôle *</label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES_ORDER.map((r) => (
                    <button key={r} onClick={() => handleEditChange("role", r)}
                      className={`text-xs py-2 px-3 rounded-lg border font-medium transition-all
                        ${editForm.role === r
                          ? "bg-[#4A5C2F] text-white border-[#4A5C2F]"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nom / Prénom */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Prénom *</label>
                  <input value={editForm.prenom} onChange={(e) => handleEditChange("prenom", e.target.value)}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Nom *</label>
                  <input value={editForm.nom} onChange={(e) => handleEditChange("nom", e.target.value)}
                    className={inputCls} />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className={labelCls}>Email</label>
                <input value={editingUser.email} readOnly
                  className={inputCls + " bg-gray-50 text-gray-400 cursor-not-allowed"} />
              </div>

              {/* Numéro de téléphone */}
              <div>
                <label className={labelCls}>Numéro de téléphone (pour mot de passe oublié)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">+221</span>
                  <input
                    type="tel"
                    value={editForm.telephone}
                    onChange={(e) => handleEditChange("telephone", e.target.value)}
                    placeholder="77 000 00 00"
                    className={inputCls + " pl-12"}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Permet la récupération autonome du mot de passe en cas d&apos;oubli.
                </p>
              </div>

              {/* Changer le mot de passe (optionnel) */}
              <div className="pt-2 border-t border-gray-100">
                <label className={labelCls}>Changer le mot de passe (optionnel)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editForm.newPassword}
                    onChange={(e) => handleEditChange("newPassword", e.target.value)}
                    placeholder="Laissez vide pour conserver le mot de passe actuel"
                    className={inputCls + " font-mono flex-1 text-xs"}
                  />
                  <button
                    type="button"
                    onClick={() => handleEditChange("newPassword", generatePassword())}
                    title="Générer un mot de passe aléatoire"
                    className="px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-[#4A5C2F] text-xs font-semibold whitespace-nowrap"
                  >
                    Générer
                  </button>
                </div>
                {editForm.newPassword && (
                  <p className="text-xs text-[#4A5C2F] font-semibold mt-1">
                    Nouveau mot de passe prêt à être enregistré.
                  </p>
                )}
              </div>

              {/* Matricule */}
              {showMatricule(editForm.role) && (
                <div>
                  <label className={labelCls}>Matricule</label>
                  <input value={editForm.matricule} onChange={(e) => handleEditChange("matricule", e.target.value)}
                    placeholder="SN-0001" className={inputCls} />
                </div>
              )}

              {/* Affectation : DR → Subdivision → Brigade */}
              <AffectationFields
                roleVal={editForm.role}
                directionRegionaleId={editForm.directionRegionaleId}
                subdivisionId={editForm.subdivisionId}
                brigadeId={editForm.brigadeId}
                onDR={(v) => handleEditChange("directionRegionaleId", v)}
                onSubdiv={(v) => handleEditChange("subdivisionId", v)}
                onBrigade={(v) => handleEditChange("brigadeId", v)}
              />

              {editError && (
                <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg border border-red-100">{editError}</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setEditingUser(null)}
                className="px-5 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                Annuler
              </button>
              <button onClick={handleUpdate} disabled={editSaving}
                className="px-6 py-2 text-sm font-semibold text-white bg-[#4A5C2F] hover:bg-[#3b4a25]
                  rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2">
                {editSaving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Mise à jour…
                  </>
                ) : "Enregistrer les modifications"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Changement Rapide de Mot de Passe ──────────────────────────────── */}
      {passwordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setPasswordUser(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-[#4A5C2F] px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#C9A84C] flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#4A5C2F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">Changer le mot de passe</h3>
                  <p className="text-xs text-[#C9A84C]">{passwordUser.prenom} <span className="uppercase">{passwordUser.nom}</span></p>
                </div>
              </div>
              <button onClick={() => setPasswordUser(null)} className="text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-6 space-y-4">
              <div>
                <label className={labelCls}>Email de l&apos;utilisateur</label>
                <input value={passwordUser.email} readOnly className={inputCls + " bg-gray-50 text-gray-500 cursor-not-allowed"} />
              </div>

              <div>
                <label className={labelCls}>Nouveau mot de passe *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={quickPassword}
                    onChange={(e) => setQuickPassword(e.target.value)}
                    placeholder="Au moins 6 caractères"
                    className={inputCls + " font-mono flex-1"}
                  />
                  <button
                    type="button"
                    onClick={() => setQuickPassword(generatePassword())}
                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-[#4A5C2F] text-xs font-semibold whitespace-nowrap"
                  >
                    Générer
                  </button>
                </div>
              </div>

              {quickPwdError && (
                <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg border border-red-100">{quickPwdError}</p>
              )}

              {quickPwdSuccess && (
                <p className="text-green-700 text-sm bg-green-50 px-3 py-2 rounded-lg border border-green-200 font-semibold">{quickPwdSuccess}</p>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => setPasswordUser(null)}
                  className="px-5 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100"
                >
                  Annuler
                </button>
                <button
                  onClick={handleQuickPasswordSave}
                  disabled={quickPwdSaving}
                  className="px-6 py-2 text-sm font-semibold text-white bg-[#4A5C2F] hover:bg-[#3b4a25] rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2"
                >
                  {quickPwdSaving ? "Enregistrement…" : "Changer le mot de passe"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Supprimer ──────────────────────────────────────────────────────── */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setConfirmDeleteUser(null); setDeleteError(""); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-600" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-gray-800">Supprimer cet utilisateur ?</p>
                <p className="text-sm text-gray-600 mt-0.5">
                  {confirmDeleteUser.prenom} <span className="uppercase">{confirmDeleteUser.nom}</span>
                </p>
              </div>
            </div>
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 mb-4">
              Cette action est <strong>irréversible</strong>. Le compte sera supprimé de l&apos;authentification et de la base de données.
            </p>
            {deleteError && (
              <p className="text-xs text-red-500 mb-3">{deleteError}</p>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => { setConfirmDeleteUser(null); setDeleteError(""); }}
                className="px-5 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Annuler
              </button>
              <button onClick={() => handleDeleteUser(confirmDeleteUser)} disabled={deleting}
                className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2">
                {deleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Suppression…
                  </>
                ) : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

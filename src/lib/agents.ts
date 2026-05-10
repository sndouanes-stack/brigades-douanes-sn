export type Grade =
  | "Préposé des Douanes"
  | "Adjoint des Douanes"
  | "Agent de Constatation"
  | "Contrôleur des Douanes"
  | "Inspecteur des Douanes";

export const GRADES: Grade[] = [
  "Préposé des Douanes",
  "Adjoint des Douanes",
  "Agent de Constatation",
  "Contrôleur des Douanes",
  "Inspecteur des Douanes",
];

export interface AgentDynamic {
  id?: string;
  matricule: string;
  nom: string;
  prenom: string;
  grade: string;
  brigadeId?: string;
}

export type Statut =
  | "Présent"
  | "En patrouille"
  | "Barrage sur route"
  | "Permissionnaire"
  | "Repos"
  | "Exécution conforme à l'ordre de service";


/** Statuts visibles par tous les rôles (agents, chefs de subdivision, directeurs…) */
export const STATUTS: Statut[] = ["Présent", "En patrouille", "Barrage sur route", "Permissionnaire", "Repos"];

/** Statuts réservés au Chef de Brigade (inclut le statut confidentiel) */
export const STATUTS_CHEF_BRIGADE: Statut[] = [
  "Présent",
  "En patrouille",
  "Barrage sur route",
  "Permissionnaire",
  "Repos",
  "Exécution conforme à l'ordre de service",
];

export const STATUT_STYLES: Record<Statut, string> = {
  "Présent":                                  "bg-green-100 text-green-700 border-green-200",
  "En patrouille":                            "bg-[#4A5C2F]/10 text-[#4A5C2F] border-[#4A5C2F]/20",
  "Barrage sur route":                        "bg-blue-100 text-blue-700 border-blue-200",
  "Permissionnaire":                          "bg-orange-100 text-orange-700 border-orange-200",
  "Repos":                                    "bg-gray-100 text-gray-600 border-gray-200",
  "Exécution conforme à l'ordre de service":  "bg-purple-100 text-purple-700 border-purple-200",
};

export const STATUT_DOT: Record<Statut, string> = {
  "Présent":                                  "bg-green-500",
  "En patrouille":                            "bg-[#4A5C2F]",
  "Barrage sur route":                        "bg-blue-500",
  "Permissionnaire":                          "bg-orange-500",
  "Repos":                                    "bg-gray-400",
  "Exécution conforme à l'ordre de service":  "bg-purple-500",
};

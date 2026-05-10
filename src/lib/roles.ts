export type Role =
  | "AGENT"
  | "CHEF_BRIGADE"
  | "CHEF_SUBDIVISION"
  | "DIRECTEUR_REGIONAL"
  | "ADMIN";

export interface UserProfile {
  uid: string;
  email: string;
  nom: string;
  prenom: string;
  role: Role;
  brigadeId?: string;
  subdivisionId?: string;
  regionId?: string;             // kept for backward compat
  directionRegionaleId?: string;
  matricule?: string;
  grade?: string;
  actif: boolean;
  createdAt?: unknown;
}

// ── 8 Directions Régionales officielles de la DGD ───────────────────────────
export interface DirectionRegionale {
  id: string;
  nom: string;
}

export const DIRECTIONS_REGIONALES: DirectionRegionale[] = [
  { id: "dakar-port",       nom: "Direction Régionale de Dakar Port"          },
  { id: "ouest",            nom: "Direction Régionale de l'Ouest"              },
  { id: "hydrocarbures",    nom: "Direction Régionale des Hydrocarbures"       },
  { id: "unites-maritimes", nom: "Direction Régionale des Unités Maritimes"    },
  { id: "centre",           nom: "Direction Régionale du Centre"               },
  { id: "sud",              nom: "Direction Régionale du Sud"                  },
  { id: "sud-est",          nom: "Direction Régionale du Sud-Est"              },
  { id: "nord",             nom: "Direction Régionale du Nord"                 },
];

// ── Labels lisibles ──────────────────────────────────────────────────────────
export const ROLE_LABELS: Record<Role, string> = {
  AGENT:               "Agent",
  CHEF_BRIGADE:        "Chef de Brigade",
  CHEF_SUBDIVISION:    "Chef de Subdivision",
  DIRECTEUR_REGIONAL:  "Directeur Régional",
  ADMIN:               "Administrateur",
};

export const ROLE_COLORS: Record<Role, string> = {
  AGENT:               "bg-gray-100 text-gray-700",
  CHEF_BRIGADE:        "bg-[#4A5C2F]/10 text-[#4A5C2F]",
  CHEF_SUBDIVISION:    "bg-blue-100 text-blue-700",
  DIRECTEUR_REGIONAL:  "bg-purple-100 text-purple-700",
  ADMIN:               "bg-[#C9A84C]/20 text-[#8B6914]",
};

// ── Destination après connexion ──────────────────────────────────────────────
export const ROLE_HOME: Record<Role, string> = {
  AGENT:               "/agent",
  CHEF_BRIGADE:        "/dashboard",
  CHEF_SUBDIVISION:    "/subdivision",
  DIRECTEUR_REGIONAL:  "/region",
  ADMIN:               "/admin/utilisateurs",
};

// ── Préfixes de routes autorisés par rôle ────────────────────────────────────
export const ROLE_ALLOWED_PREFIXES: Record<Role, string[]> = {
  AGENT:               ["/agent"],
  CHEF_BRIGADE:        ["/dashboard"],
  CHEF_SUBDIVISION:    ["/subdivision"],
  DIRECTEUR_REGIONAL:  ["/region"],
  ADMIN:               ["/admin", "/dashboard", "/agent", "/subdivision", "/region"],
};

export function canAccess(role: Role, pathname: string): boolean {
  return ROLE_ALLOWED_PREFIXES[role].some((prefix) => pathname.startsWith(prefix));
}

// ── Structure géographique ────────────────────────────────────────────────────
export interface Brigade {
  id: string;
  nom: string;
  subdivisionId: string;
}

export interface Subdivision {
  id: string;
  nom: string;
  directionRegionaleId: string;
}

// ── 16 Subdivisions ─────────────────────────────────────────────────────────
export const SUBDIVISIONS: Subdivision[] = [
  // Direction Régionale de Dakar Port
  { id: "sub-dakar-port",       nom: "Subdivision Dakar-Port",        directionRegionaleId: "dakar-port"       },
  { id: "sub-dakar-ports-secs", nom: "Subdivision Dakar Ports-Secs",  directionRegionaleId: "dakar-port"       },
  // Direction Régionale de l'Ouest
  { id: "sub-aibd",             nom: "Subdivision AIBD",              directionRegionaleId: "ouest"            },
  { id: "sub-dakar-exterieur",  nom: "Subdivision Dakar Extérieur",   directionRegionaleId: "ouest"            },
  // Direction Régionale des Hydrocarbures
  { id: "sub-hydrocarbures",    nom: "Subdivision des Hydrocarbures", directionRegionaleId: "hydrocarbures"    },
  // Direction Régionale des Unités Maritimes
  { id: "sub-littoral-nord",    nom: "Subdivision Littoral Nord",     directionRegionaleId: "unites-maritimes" },
  { id: "sub-littoral-sud",     nom: "Subdivision Littoral Sud",      directionRegionaleId: "unites-maritimes" },
  { id: "sub-portuaire",        nom: "Subdivision Portuaire",         directionRegionaleId: "unites-maritimes" },
  // Direction Régionale du Centre
  { id: "sub-kaolack",          nom: "Subdivision de Kaolack",        directionRegionaleId: "centre"           },
  { id: "sub-diourbel",         nom: "Subdivision Diourbel",          directionRegionaleId: "centre"           },
  // Direction Régionale du Sud
  { id: "sub-ziguinchor",       nom: "Subdivision de Ziguinchor",     directionRegionaleId: "sud"              },
  { id: "sub-kolda",            nom: "Subdivision de Kolda",          directionRegionaleId: "sud"              },
  // Direction Régionale du Sud-Est
  { id: "sub-tambacounda",      nom: "Subdivision Tambacounda",       directionRegionaleId: "sud-est"          },
  { id: "sub-kedougou",         nom: "Subdivision de Kédougou",       directionRegionaleId: "sud-est"          },
  // Direction Régionale du Nord
  { id: "sub-saint-louis",      nom: "Subdivision de Saint-Louis",    directionRegionaleId: "nord"             },
  { id: "sub-matam",            nom: "Subdivision de Matam",          directionRegionaleId: "nord"             },
];

// ── 80 Brigades ──────────────────────────────────────────────────────────────
export const BRIGADES: Brigade[] = [
  // ── Subdivision Dakar-Port ──
  { id: "b-mole1-belair",        nom: "Brigade commerciale Môle 1 et Bel Air",                    subdivisionId: "sub-dakar-port"       },
  { id: "b-produits-pondereux",  nom: "Brigade des Produits pondéreux",                           subdivisionId: "sub-dakar-port"       },
  { id: "b-scanning",            nom: "Unité de scanning des Conteneurs",                         subdivisionId: "sub-dakar-port"       },
  { id: "b-magasins-portuaire",  nom: "Magasins et Aires de dédouanement (enceinte portuaire)",   subdivisionId: "sub-dakar-port"       },
  // ── Subdivision Dakar Ports-Secs ──
  { id: "b-diamniadio-com",      nom: "Brigade commerciale de Diamniadio",                        subdivisionId: "sub-dakar-ports-secs" },
  { id: "b-icd",                 nom: "Brigade commerciale ICD",                                   subdivisionId: "sub-dakar-ports-secs" },
  { id: "b-plateforme-dist",     nom: "Brigade commerciale de la Plateforme de Distribution",     subdivisionId: "sub-dakar-ports-secs" },
  { id: "b-magasins-ext",        nom: "Magasins et aires de dédouanement (extérieur enceinte)",   subdivisionId: "sub-dakar-ports-secs" },
  // ── Subdivision AIBD ──
  { id: "b-aibd-speciale",       nom: "Brigade spéciale AIBD",                                    subdivisionId: "sub-aibd"             },
  { id: "b-aibd-commerciale",    nom: "Brigade Commerciale AIBD",                                 subdivisionId: "sub-aibd"             },
  { id: "b-tourisme",            nom: "Brigade de tourisme",                                      subdivisionId: "sub-aibd"             },
  // ── Subdivision Dakar Extérieur ──
  { id: "b-dakar-ext-speciale",  nom: "Brigade spéciale Dakar Extérieur",                         subdivisionId: "sub-dakar-exterieur"  },
  { id: "b-dakar-n1",            nom: "Brigade n°1",                                              subdivisionId: "sub-dakar-exterieur"  },
  { id: "b-dakar-n2",            nom: "Brigade n°2",                                              subdivisionId: "sub-dakar-exterieur"  },
  { id: "b-dakar-n3",            nom: "Brigade n°3",                                              subdivisionId: "sub-dakar-exterieur"  },
  { id: "b-banlieue",            nom: "Brigade Banlieue (Pikine, Thiaroye, Diamniadio)",          subdivisionId: "sub-dakar-exterieur"  },
  // ── Subdivision des Hydrocarbures ──
  { id: "b-dakar-hydro",         nom: "Brigade de Dakar Hydrocarbures",                           subdivisionId: "sub-hydrocarbures"    },
  { id: "b-stlouis-hydro",       nom: "Brigade de Saint-Louis Hydrocarbures",                     subdivisionId: "sub-hydrocarbures"    },
  { id: "b-sangomar-hydro",      nom: "Brigade de Sangomar Hydrocarbures",                        subdivisionId: "sub-hydrocarbures"    },
  // ── Subdivision Littoral Nord ──
  { id: "b-lompoul",             nom: "Brigade de Lompoul",                                       subdivisionId: "sub-littoral-nord"    },
  { id: "b-kayar",               nom: "Brigade de Kayar",                                         subdivisionId: "sub-littoral-nord"    },
  { id: "b-rufisque",            nom: "Brigade de Rufisque",                                      subdivisionId: "sub-littoral-nord"    },
  { id: "b-fluviale-stlouis",    nom: "Brigade fluviale de Saint-Louis",                          subdivisionId: "sub-littoral-nord"    },
  // ── Subdivision Littoral Sud ──
  { id: "b-mbour",               nom: "Brigade de Mbour",                                         subdivisionId: "sub-littoral-sud"     },
  { id: "b-djiferre",            nom: "Brigade de Djiferre",                                      subdivisionId: "sub-littoral-sud"     },
  { id: "b-fimela",              nom: "Brigade de Fimela",                                        subdivisionId: "sub-littoral-sud"     },
  { id: "b-capskiring",          nom: "Brigade de Capskiring",                                    subdivisionId: "sub-littoral-sud"     },
  // ── Subdivision Portuaire ──
  { id: "b-surveillance-port",   nom: "Brigade de surveillance portuaire",                        subdivisionId: "sub-portuaire"        },
  { id: "b-haute-mer",           nom: "Brigade haute mer",                                        subdivisionId: "sub-portuaire"        },
  // ── Subdivision de Kaolack ──
  { id: "b-karang",              nom: "Brigade commerciale de Karang",                             subdivisionId: "sub-kaolack"          },
  { id: "b-keur-ayib",           nom: "Brigade commerciale de Keur-Ayib",                         subdivisionId: "sub-kaolack"          },
  { id: "b-kaolack-n1",          nom: "Brigade n°1 de Kaolack",                                   subdivisionId: "sub-kaolack"          },
  { id: "b-kaolack-n2",          nom: "Brigade n°2 de Kaolack",                                   subdivisionId: "sub-kaolack"          },
  { id: "b-pont-ssbm",           nom: "Brigade du Pont Serigne Bassirou Mbacké",                  subdivisionId: "sub-kaolack"          },
  { id: "b-nioro",               nom: "Brigade de Nioro",                                         subdivisionId: "sub-kaolack"          },
  { id: "b-fatick",              nom: "Brigade de Fatick",                                        subdivisionId: "sub-kaolack"          },
  { id: "b-foundiougne",         nom: "Brigade de Foundiougne",                                   subdivisionId: "sub-kaolack"          },
  { id: "b-keur-moussa",         nom: "Poste de Keur Moussa",                                     subdivisionId: "sub-kaolack"          },
  { id: "b-saboya",              nom: "Poste de Saboya",                                          subdivisionId: "sub-kaolack"          },
  // ── Subdivision Diourbel ──
  { id: "b-gossas",              nom: "Brigade de Gossas",                                        subdivisionId: "sub-diourbel"         },
  { id: "b-diourbel",            nom: "Brigade de Diourbel",                                      subdivisionId: "sub-diourbel"         },
  { id: "b-kaffrine",            nom: "Brigade de Kaffrine",                                      subdivisionId: "sub-diourbel"         },
  { id: "b-koungheul",           nom: "Brigade de Koungheul",                                     subdivisionId: "sub-diourbel"         },
  { id: "b-nganda",              nom: "Poste de Nganda",                                          subdivisionId: "sub-diourbel"         },
  { id: "b-maka-gouye",          nom: "Poste de Maka-Gouye",                                      subdivisionId: "sub-diourbel"         },
  // ── Subdivision de Ziguinchor ──
  { id: "b-ziguinchor",          nom: "Brigade de Ziguinchor",                                    subdivisionId: "sub-ziguinchor"       },
  { id: "b-bignona",             nom: "Brigade de Bignona",                                       subdivisionId: "sub-ziguinchor"       },
  { id: "b-oussouye",            nom: "Brigade de Oussouye",                                      subdivisionId: "sub-ziguinchor"       },
  { id: "b-selety",              nom: "Poste de Séléty",                                          subdivisionId: "sub-ziguinchor"       },
  { id: "b-senoba",              nom: "Poste de Sénoba",                                          subdivisionId: "sub-ziguinchor"       },
  { id: "b-pata",                nom: "Poste de Pata",                                            subdivisionId: "sub-ziguinchor"       },
  // ── Subdivision de Kolda ──
  { id: "b-kolda",               nom: "Brigade de Kolda",                                         subdivisionId: "sub-kolda"            },
  { id: "b-sedhiou",             nom: "Brigade de Sedhiou",                                       subdivisionId: "sub-kolda"            },
  { id: "b-velingara",           nom: "Brigade de Vélingara",                                     subdivisionId: "sub-kolda"            },
  { id: "b-medina-yf",           nom: "Poste de Médina Yoro Foulla",                              subdivisionId: "sub-kolda"            },
  { id: "b-salikenie",           nom: "Poste de Salikénié",                                       subdivisionId: "sub-kolda"            },
  { id: "b-nianaw",              nom: "Poste de Nianaw",                                          subdivisionId: "sub-kolda"            },
  { id: "b-manda",               nom: "Poste de Manda",                                           subdivisionId: "sub-kolda"            },
  // ── Subdivision Tambacounda ──
  { id: "b-kidira",              nom: "Brigade commerciale de Kidira",                             subdivisionId: "sub-tambacounda"      },
  { id: "b-bakel",               nom: "Brigade de Bakel",                                         subdivisionId: "sub-tambacounda"      },
  { id: "b-tambacounda",         nom: "Brigade de Tambacounda",                                   subdivisionId: "sub-tambacounda"      },
  { id: "b-gouloumbou",          nom: "Brigade mobile de Gouloumbou",                             subdivisionId: "sub-tambacounda"      },
  { id: "b-koumpentoum",         nom: "Brigade mobile de Koumpentoum",                            subdivisionId: "sub-tambacounda"      },
  { id: "b-guenoto",             nom: "Poste de Guénoto",                                         subdivisionId: "sub-tambacounda"      },
  // ── Subdivision de Kédougou ──
  { id: "b-kedougou",            nom: "Brigade mobile de Kédougou",                               subdivisionId: "sub-kedougou"         },
  { id: "b-moussala",            nom: "Brigade commerciale de Moussala",                          subdivisionId: "sub-kedougou"         },
  { id: "b-saraya",              nom: "Brigade mobile de Saraya",                                 subdivisionId: "sub-kedougou"         },
  { id: "b-salemata",            nom: "Brigade mobile de Salémata",                               subdivisionId: "sub-kedougou"         },
  // ── Subdivision de Saint-Louis ──
  { id: "b-rosso",               nom: "Brigade commerciale de Rosso",                             subdivisionId: "sub-saint-louis"      },
  { id: "b-saint-louis",         nom: "Brigade de Saint-Louis",                                   subdivisionId: "sub-saint-louis"      },
  { id: "b-louga",               nom: "Brigade de Louga",                                         subdivisionId: "sub-saint-louis"      },
  { id: "b-linguere",            nom: "Brigade de Linguère",                                      subdivisionId: "sub-saint-louis"      },
  { id: "b-ndioum",              nom: "Brigade de Ndioum",                                        subdivisionId: "sub-saint-louis"      },
  { id: "b-podor",               nom: "Brigade de Podor",                                         subdivisionId: "sub-saint-louis"      },
  { id: "b-diama",               nom: "Poste de Diama",                                           subdivisionId: "sub-saint-louis"      },
  { id: "b-demet",               nom: "Poste de Démet",                                           subdivisionId: "sub-saint-louis"      },
  // ── Subdivision de Matam ──
  { id: "b-matam",               nom: "Brigade de Matam",                                         subdivisionId: "sub-matam"            },
  { id: "b-semme",               nom: "Brigade de Semmé",                                         subdivisionId: "sub-matam"            },
  { id: "b-ranerou",             nom: "Brigade de Ranérou",                                       subdivisionId: "sub-matam"            },
  { id: "b-gourel-omar-ly",      nom: "Poste de Gourel Oumar Ly",                                 subdivisionId: "sub-matam"            },
];

/** Brigades d'une Direction Régionale (via ses subdivisions) */
export function getBrigadesByDirection(directionRegionaleId: string): Brigade[] {
  const subdivIds = new Set(
    SUBDIVISIONS.filter((s) => s.directionRegionaleId === directionRegionaleId).map((s) => s.id)
  );
  return BRIGADES.filter((b) => subdivIds.has(b.subdivisionId));
}

// Kept for backward compatibility
export interface Region {
  id: string;
  nom: string;
}
export const REGIONS: Region[] = [];

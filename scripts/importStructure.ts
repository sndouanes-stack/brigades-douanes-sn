/**
 * scripts/importStructure.ts
 * Importe la structure officielle DGD (16 subdivisions + 80 brigades)
 * dans Firestore en utilisant les IDs statiques de roles.ts.
 *
 * Utilisation :
 *   npx tsx scripts/importStructure.ts
 */

// ── Structure complète ────────────────────────────────────────────────────────

const DIRECTIONS = [
  { id: "dakar-port",       nom: "Direction Régionale de Dakar Port"          },
  { id: "ouest",            nom: "Direction Régionale de l'Ouest"              },
  { id: "hydrocarbures",    nom: "Direction Régionale des Hydrocarbures"       },
  { id: "unites-maritimes", nom: "Direction Régionale des Unités Maritimes"    },
  { id: "centre",           nom: "Direction Régionale du Centre"               },
  { id: "sud",              nom: "Direction Régionale du Sud"                  },
  { id: "sud-est",          nom: "Direction Régionale du Sud-Est"              },
  { id: "nord",             nom: "Direction Régionale du Nord"                 },
];

const SUBDIVISIONS = [
  { id: "sub-dakar-port",       nom: "Subdivision Dakar-Port",                directionRegionaleId: "dakar-port"       },
  { id: "sub-dakar-ports-secs", nom: "Subdivision Dakar Ports-Secs",          directionRegionaleId: "dakar-port"       },
  { id: "sub-aibd",             nom: "Subdivision AIBD",                      directionRegionaleId: "ouest"            },
  { id: "sub-dakar-exterieur",  nom: "Subdivision Dakar Extérieur",           directionRegionaleId: "ouest"            },
  { id: "sub-hydrocarbures",    nom: "Subdivision des Hydrocarbures",         directionRegionaleId: "hydrocarbures"    },
  { id: "sub-littoral-nord",    nom: "Subdivision Littoral Nord",             directionRegionaleId: "unites-maritimes" },
  { id: "sub-littoral-sud",     nom: "Subdivision Littoral Sud",              directionRegionaleId: "unites-maritimes" },
  { id: "sub-portuaire",        nom: "Subdivision Portuaire",                 directionRegionaleId: "unites-maritimes" },
  { id: "sub-kaolack",          nom: "Subdivision de Kaolack",                directionRegionaleId: "centre"           },
  { id: "sub-diourbel",         nom: "Subdivision Diourbel",                  directionRegionaleId: "centre"           },
  { id: "sub-ziguinchor",       nom: "Subdivision de Ziguinchor",             directionRegionaleId: "sud"              },
  { id: "sub-kolda",            nom: "Subdivision de Kolda",                  directionRegionaleId: "sud"              },
  { id: "sub-tambacounda",      nom: "Subdivision Tambacounda",               directionRegionaleId: "sud-est"          },
  { id: "sub-kedougou",         nom: "Subdivision de Kédougou",               directionRegionaleId: "sud-est"          },
  { id: "sub-saint-louis",      nom: "Subdivision de Saint-Louis",            directionRegionaleId: "nord"             },
  { id: "sub-matam",            nom: "Subdivision de Matam",                  directionRegionaleId: "nord"             },
];

const BRIGADES = [
  // Dakar-Port
  { id: "b-mole1-belair",       nom: "Brigade commerciale Môle 1 et Bel Air",                   subdivisionId: "sub-dakar-port"       },
  { id: "b-produits-pondereux", nom: "Brigade des Produits pondéreux",                          subdivisionId: "sub-dakar-port"       },
  { id: "b-scanning",           nom: "Unité de scanning des Conteneurs",                        subdivisionId: "sub-dakar-port"       },
  { id: "b-magasins-portuaire", nom: "Magasins et Aires de dédouanement (enceinte portuaire)",  subdivisionId: "sub-dakar-port"       },
  // Dakar Ports-Secs
  { id: "b-diamniadio-com",     nom: "Brigade commerciale de Diamniadio",                       subdivisionId: "sub-dakar-ports-secs" },
  { id: "b-icd",                nom: "Brigade commerciale ICD",                                  subdivisionId: "sub-dakar-ports-secs" },
  { id: "b-plateforme-dist",    nom: "Brigade commerciale de la Plateforme de Distribution",    subdivisionId: "sub-dakar-ports-secs" },
  { id: "b-magasins-ext",       nom: "Magasins et aires de dédouanement (extérieur enceinte)",  subdivisionId: "sub-dakar-ports-secs" },
  // AIBD
  { id: "b-aibd-speciale",      nom: "Brigade spéciale AIBD",                                   subdivisionId: "sub-aibd"             },
  { id: "b-aibd-commerciale",   nom: "Brigade Commerciale AIBD",                                subdivisionId: "sub-aibd"             },
  { id: "b-tourisme",           nom: "Brigade de tourisme",                                     subdivisionId: "sub-aibd"             },
  // Dakar Extérieur
  { id: "b-dakar-ext-speciale", nom: "Brigade spéciale Dakar Extérieur",                        subdivisionId: "sub-dakar-exterieur"  },
  { id: "b-dakar-n1",           nom: "Brigade n°1",                                             subdivisionId: "sub-dakar-exterieur"  },
  { id: "b-dakar-n2",           nom: "Brigade n°2",                                             subdivisionId: "sub-dakar-exterieur"  },
  { id: "b-dakar-n3",           nom: "Brigade n°3",                                             subdivisionId: "sub-dakar-exterieur"  },
  { id: "b-banlieue",           nom: "Brigade Banlieue (Pikine, Thiaroye, Diamniadio)",         subdivisionId: "sub-dakar-exterieur"  },
  // Hydrocarbures
  { id: "b-dakar-hydro",        nom: "Brigade de Dakar Hydrocarbures",                          subdivisionId: "sub-hydrocarbures"    },
  { id: "b-stlouis-hydro",      nom: "Brigade de Saint-Louis Hydrocarbures",                    subdivisionId: "sub-hydrocarbures"    },
  { id: "b-sangomar-hydro",     nom: "Brigade de Sangomar Hydrocarbures",                       subdivisionId: "sub-hydrocarbures"    },
  // Littoral Nord
  { id: "b-lompoul",            nom: "Brigade de Lompoul",                                      subdivisionId: "sub-littoral-nord"    },
  { id: "b-kayar",              nom: "Brigade de Kayar",                                        subdivisionId: "sub-littoral-nord"    },
  { id: "b-rufisque",           nom: "Brigade de Rufisque",                                     subdivisionId: "sub-littoral-nord"    },
  { id: "b-fluviale-stlouis",   nom: "Brigade fluviale de Saint-Louis",                         subdivisionId: "sub-littoral-nord"    },
  // Littoral Sud
  { id: "b-mbour",              nom: "Brigade de Mbour",                                        subdivisionId: "sub-littoral-sud"     },
  { id: "b-djiferre",           nom: "Brigade de Djiferre",                                     subdivisionId: "sub-littoral-sud"     },
  { id: "b-fimela",             nom: "Brigade de Fimela",                                       subdivisionId: "sub-littoral-sud"     },
  { id: "b-capskiring",         nom: "Brigade de Capskiring",                                   subdivisionId: "sub-littoral-sud"     },
  // Portuaire
  { id: "b-surveillance-port",  nom: "Brigade de surveillance portuaire",                       subdivisionId: "sub-portuaire"        },
  { id: "b-haute-mer",          nom: "Brigade haute mer",                                       subdivisionId: "sub-portuaire"        },
  // Kaolack
  { id: "b-karang",             nom: "Brigade commerciale de Karang",                           subdivisionId: "sub-kaolack"          },
  { id: "b-keur-ayib",          nom: "Brigade commerciale de Keur-Ayib",                        subdivisionId: "sub-kaolack"          },
  { id: "b-kaolack-n1",         nom: "Brigade n°1 de Kaolack",                                  subdivisionId: "sub-kaolack"          },
  { id: "b-kaolack-n2",         nom: "Brigade n°2 de Kaolack",                                  subdivisionId: "sub-kaolack"          },
  { id: "b-pont-ssbm",          nom: "Brigade du Pont Serigne Bassirou Mbacké",                 subdivisionId: "sub-kaolack"          },
  { id: "b-nioro",              nom: "Brigade de Nioro",                                        subdivisionId: "sub-kaolack"          },
  { id: "b-fatick",             nom: "Brigade de Fatick",                                       subdivisionId: "sub-kaolack"          },
  { id: "b-foundiougne",        nom: "Brigade de Foundiougne",                                  subdivisionId: "sub-kaolack"          },
  { id: "b-keur-moussa",        nom: "Poste de Keur Moussa",                                    subdivisionId: "sub-kaolack"          },
  { id: "b-saboya",             nom: "Poste de Saboya",                                         subdivisionId: "sub-kaolack"          },
  // Diourbel
  { id: "b-gossas",             nom: "Brigade de Gossas",                                       subdivisionId: "sub-diourbel"         },
  { id: "b-diourbel",           nom: "Brigade de Diourbel",                                     subdivisionId: "sub-diourbel"         },
  { id: "b-kaffrine",           nom: "Brigade de Kaffrine",                                     subdivisionId: "sub-diourbel"         },
  { id: "b-koungheul",          nom: "Brigade de Koungheul",                                    subdivisionId: "sub-diourbel"         },
  { id: "b-nganda",             nom: "Poste de Nganda",                                         subdivisionId: "sub-diourbel"         },
  { id: "b-maka-gouye",         nom: "Poste de Maka-Gouye",                                     subdivisionId: "sub-diourbel"         },
  // Ziguinchor
  { id: "b-ziguinchor",         nom: "Brigade de Ziguinchor",                                   subdivisionId: "sub-ziguinchor"       },
  { id: "b-bignona",            nom: "Brigade de Bignona",                                      subdivisionId: "sub-ziguinchor"       },
  { id: "b-oussouye",           nom: "Brigade de Oussouye",                                     subdivisionId: "sub-ziguinchor"       },
  { id: "b-selety",             nom: "Poste de Séléty",                                         subdivisionId: "sub-ziguinchor"       },
  { id: "b-senoba",             nom: "Poste de Sénoba",                                         subdivisionId: "sub-ziguinchor"       },
  { id: "b-pata",               nom: "Poste de Pata",                                           subdivisionId: "sub-ziguinchor"       },
  // Kolda
  { id: "b-kolda",              nom: "Brigade de Kolda",                                        subdivisionId: "sub-kolda"            },
  { id: "b-sedhiou",            nom: "Brigade de Sedhiou",                                      subdivisionId: "sub-kolda"            },
  { id: "b-velingara",          nom: "Brigade de Vélingara",                                    subdivisionId: "sub-kolda"            },
  { id: "b-medina-yf",          nom: "Poste de Médina Yoro Foulla",                             subdivisionId: "sub-kolda"            },
  { id: "b-salikenie",          nom: "Poste de Salikénié",                                      subdivisionId: "sub-kolda"            },
  { id: "b-nianaw",             nom: "Poste de Nianaw",                                         subdivisionId: "sub-kolda"            },
  { id: "b-manda",              nom: "Poste de Manda",                                          subdivisionId: "sub-kolda"            },
  // Tambacounda
  { id: "b-kidira",             nom: "Brigade commerciale de Kidira",                           subdivisionId: "sub-tambacounda"      },
  { id: "b-bakel",              nom: "Brigade de Bakel",                                        subdivisionId: "sub-tambacounda"      },
  { id: "b-tambacounda",        nom: "Brigade de Tambacounda",                                  subdivisionId: "sub-tambacounda"      },
  { id: "b-gouloumbou",         nom: "Brigade mobile de Gouloumbou",                            subdivisionId: "sub-tambacounda"      },
  { id: "b-koumpentoum",        nom: "Brigade mobile de Koumpentoum",                           subdivisionId: "sub-tambacounda"      },
  { id: "b-guenoto",            nom: "Poste de Guénoto",                                        subdivisionId: "sub-tambacounda"      },
  // Kédougou
  { id: "b-kedougou",           nom: "Brigade mobile de Kédougou",                              subdivisionId: "sub-kedougou"         },
  { id: "b-moussala",           nom: "Brigade commerciale de Moussala",                         subdivisionId: "sub-kedougou"         },
  { id: "b-saraya",             nom: "Brigade mobile de Saraya",                                subdivisionId: "sub-kedougou"         },
  { id: "b-salemata",           nom: "Brigade mobile de Salémata",                              subdivisionId: "sub-kedougou"         },
  // Saint-Louis
  { id: "b-rosso",              nom: "Brigade commerciale de Rosso",                            subdivisionId: "sub-saint-louis"      },
  { id: "b-saint-louis",        nom: "Brigade de Saint-Louis",                                  subdivisionId: "sub-saint-louis"      },
  { id: "b-louga",              nom: "Brigade de Louga",                                        subdivisionId: "sub-saint-louis"      },
  { id: "b-linguere",           nom: "Brigade de Linguère",                                     subdivisionId: "sub-saint-louis"      },
  { id: "b-ndioum",             nom: "Brigade de Ndioum",                                       subdivisionId: "sub-saint-louis"      },
  { id: "b-podor",              nom: "Brigade de Podor",                                        subdivisionId: "sub-saint-louis"      },
  { id: "b-diama",              nom: "Poste de Diama",                                          subdivisionId: "sub-saint-louis"      },
  { id: "b-demet",              nom: "Poste de Démet",                                          subdivisionId: "sub-saint-louis"      },
  // Matam
  { id: "b-matam",              nom: "Brigade de Matam",                                        subdivisionId: "sub-matam"            },
  { id: "b-semme",              nom: "Brigade de Semmé",                                        subdivisionId: "sub-matam"            },
  { id: "b-ranerou",            nom: "Brigade de Ranérou",                                      subdivisionId: "sub-matam"            },
  { id: "b-gourel-omar-ly",     nom: "Poste de Gourel Oumar Ly",                                subdivisionId: "sub-matam"            },
];

// ── Firebase Client SDK (pas d'Admin SDK requis) ──────────────────────────────

async function main() {
  // Charger les variables d'environnement depuis .env.local
  const { readFileSync } = await import("fs");
  const { resolve, dirname } = await import("path");
  const { fileURLToPath } = await import("url");

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(__dirname, "../.env.local");

  let env: Record<string, string> = {};
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
  } catch {
    console.error("Impossible de lire .env.local");
    process.exit(1);
  }

  // Initialiser Firebase avec le SDK client (fonctionne en Node.js)
  const { initializeApp: initClientApp, getApps: getClientApps } = await import("firebase/app");
  const {
    getFirestore: getClientFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    getDocs,
  } = await import("firebase/firestore");

  const firebaseConfig = {
    apiKey:            env["NEXT_PUBLIC_FIREBASE_API_KEY"],
    authDomain:        env["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"],
    projectId:         env["NEXT_PUBLIC_FIREBASE_PROJECT_ID"],
    storageBucket:     env["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"],
    messagingSenderId: env["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"],
    appId:             env["NEXT_PUBLIC_FIREBASE_APP_ID"],
  };

  const app = getClientApps().length === 0
    ? initClientApp(firebaseConfig)
    : getClientApps()[0];
  const db = getClientFirestore(app);

  console.log(`\n🔵 Connexion à Firebase : ${firebaseConfig.projectId}\n`);

  // ── Vérification état actuel ──────────────────────────────────────────────
  const [subSnap, brigSnap] = await Promise.all([
    getDocs(collection(db, "subdivisions")),
    getDocs(collection(db, "brigades")),
  ]);
  console.log(`État actuel : ${subSnap.size} subdivisions, ${brigSnap.size} brigades dans Firestore`);

  // ── Import subdivisions ───────────────────────────────────────────────────
  console.log(`\n📁 Import de ${SUBDIVISIONS.length} subdivisions…`);
  let subCreated = 0, subUpdated = 0;
  for (const sub of SUBDIVISIONS) {
    const ref = doc(db, "subdivisions", sub.id);
    const existing = await getDoc(ref);
    const data = {
      nom: sub.nom,
      directionRegionaleId: sub.directionRegionaleId,
      localite: existing.exists() ? (existing.data()?.localite ?? "") : "",
      createdAt: existing.exists() ? existing.data()?.createdAt : new Date().toISOString(),
    };
    await setDoc(ref, data, { merge: false });
    if (existing.exists()) { subUpdated++; } else { subCreated++; }
    process.stdout.write(".");
  }
  console.log(`\n   ✅ ${subCreated} créées, ${subUpdated} mises à jour`);

  // ── Import brigades ───────────────────────────────────────────────────────
  console.log(`\n🛡️  Import de ${BRIGADES.length} brigades…`);
  let brigCreated = 0, brigUpdated = 0;
  for (const b of BRIGADES) {
    const sub = SUBDIVISIONS.find((s) => s.id === b.subdivisionId);
    const drId = sub?.directionRegionaleId ?? "";
    const ref = doc(db, "brigades", b.id);
    const existing = await getDoc(ref);
    const data = {
      nom: b.nom,
      subdivisionId: b.subdivisionId,
      directionRegionaleId: drId,
      localite: existing.exists() ? (existing.data()?.localite ?? "") : "",
      chefBrigade: existing.exists() ? (existing.data()?.chefBrigade ?? "") : "",
      createdAt: existing.exists() ? existing.data()?.createdAt : new Date().toISOString(),
    };
    await setDoc(ref, data, { merge: false });
    if (existing.exists()) { brigUpdated++; } else { brigCreated++; }
    process.stdout.write(".");
  }
  console.log(`\n   ✅ ${brigCreated} créées, ${brigUpdated} mises à jour`);

  // ── Résumé ────────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(50));
  console.log(`✅ Import terminé !`);
  console.log(`   Subdivisions : ${SUBDIVISIONS.length} (${subCreated} créées, ${subUpdated} écrasées)`);
  console.log(`   Brigades     : ${BRIGADES.length} (${brigCreated} créées, ${brigUpdated} écrasées)`);
  console.log("─".repeat(50) + "\n");

  // Vérification finale
  const [finalSub, finalBrig] = await Promise.all([
    getDocs(collection(db, "subdivisions")),
    getDocs(collection(db, "brigades")),
  ]);
  console.log(`Vérification Firestore : ${finalSub.size} subdivisions, ${finalBrig.size} brigades`);

  if (finalSub.size >= SUBDIVISIONS.length && finalBrig.size >= BRIGADES.length) {
    console.log("✅ Toutes les données sont en place !\n");
  } else {
    console.log("⚠️  Certaines données manquent encore. Vérifiez les règles Firestore.\n");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erreur :", err);
  process.exit(1);
});

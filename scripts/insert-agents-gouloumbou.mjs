// Insert 14 agents Brigade Mobile de Gouloumbou → public.agents
// Usage : node scripts/insert-agents-gouloumbou.mjs

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL        = "https://uaendjgstasgnqitsfdx.supabase.co";
const SERVICE_ROLE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BRIGADE_ID          = "b-gouloumbou"; // Brigade mobile de Gouloumbou

if (!SERVICE_ROLE_KEY) {
  console.error("❌  SUPABASE_SERVICE_ROLE_KEY manquant dans l'environnement.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const AGENTS = [
  { matricule: "764.410/B", nom: "SENE",     prenom: "Babacar",               grade: "Préposé des Douanes"    },
  { matricule: "769.123/B", nom: "DIOP",     prenom: "Pape Saer",             grade: "Préposé des Douanes"    },
  { matricule: "679.765/D", nom: "DIOP",     prenom: "Abdou Salam",           grade: "Adjoint des Douanes"    },
  { matricule: "764.372/G", nom: "DIONE",    prenom: "Cheikh Ahmadou Bamba",  grade: "Préposé des Douanes"    },
  { matricule: "764.451/E", nom: "KAGNY",    prenom: "Ibrahima",              grade: "Préposé des Douanes"    },
  { matricule: "721.170/L", nom: "GAYE",     prenom: "Baye Saliou",           grade: "Agent de Constatation"  },
  { matricule: "764.414/B", nom: "CAMARA",   prenom: "Mathieu Souleymane",    grade: "Préposé des Douanes"    },
  { matricule: "721.190/A", nom: "DIONE",    prenom: "Magaye",                grade: "Agent de Constatation"  },
  { matricule: "764.559/D", nom: "DIATTA",   prenom: "Eliasse",               grade: "Préposé des Douanes"    },
  { matricule: "764.094/J", nom: "NDIAYE",   prenom: "Abdoul Moutalip",       grade: "Agent de Constatation"  },
  { matricule: "764.411/A", nom: "THIAM",    prenom: "Djibril",               grade: "Préposé des Douanes"    },
  { matricule: "679.933/A", nom: "DIOP",     prenom: "Talla",                 grade: "Agent de Constatation"  },
  { matricule: "759.175/L", nom: "TALL",     prenom: "Pape Ablaye",           grade: "Préposé des Douanes"    },
  { matricule: "764.488/A", nom: "GOUDIABY", prenom: "Sana",                  grade: "Préposé des Douanes"    },
];

// Vérifier que la brigade existe
const { data: brigade, error: brigadeErr } = await admin
  .from("brigades")
  .select("id, nom")
  .eq("id", BRIGADE_ID)
  .single();

if (brigadeErr || !brigade) {
  console.error("❌  Brigade introuvable :", brigadeErr?.message ?? "pas de données");
  process.exit(1);
}
console.log(`✓ Brigade trouvée : ${brigade.nom} (${brigade.id})\n`);

// Préparer les lignes à insérer
const rows = AGENTS.map((a) => ({ ...a, brigade_id: BRIGADE_ID }));

// Insérer avec ON CONFLICT DO UPDATE (idempotent sur matricule + brigade_id)
let ok = 0;
let err = 0;

for (const row of rows) {
  // Vérifier si l'agent existe déjà pour éviter les doublons
  const { data: existing } = await admin
    .from("agents")
    .select("id")
    .eq("matricule", row.matricule)
    .eq("brigade_id", BRIGADE_ID)
    .single();

  if (existing) {
    // Mettre à jour
    const { error: upErr } = await admin
      .from("agents")
      .update({ nom: row.nom, prenom: row.prenom, grade: row.grade })
      .eq("matricule", row.matricule)
      .eq("brigade_id", BRIGADE_ID);

    if (upErr) {
      console.error(`  ✗ ${row.matricule} ${row.nom} ${row.prenom} — MàJ échouée : ${upErr.message}`);
      err++;
    } else {
      console.log(`  ↻ ${row.matricule.padEnd(12)} ${row.prenom} ${row.nom} (mis à jour)`);
      ok++;
    }
  } else {
    // Insérer
    const { error: insErr } = await admin.from("agents").insert(row);
    if (insErr) {
      console.error(`  ✗ ${row.matricule} ${row.nom} ${row.prenom} — Insertion échouée : ${insErr.message}`);
      err++;
    } else {
      console.log(`  ✓ ${row.matricule.padEnd(12)} ${row.prenom} ${row.nom}`);
      ok++;
    }
  }
}

console.log(`\n────────────────────────────────`);
console.log(`  Insérés/mis à jour : ${ok}`);
console.log(`  Erreurs            : ${err}`);
console.log(`────────────────────────────────`);

if (err > 0) process.exit(1);

// Conversion nombre entier → lettres en français (FCFA)

const UNITES = [
  "", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];

const DIZAINES = [
  "", "", "vingt", "trente", "quarante", "cinquante",
  "soixante", "soixante", "quatre-vingt", "quatre-vingt",
];

function centaines(n: number): string {
  if (n === 0) return "";
  const c = Math.floor(n / 100);
  const reste = n % 100;
  let res = "";
  if (c === 1) res = "cent";
  else if (c > 1) res = UNITES[c] + " cent";
  if (reste === 0 && c > 1) return res + "s";
  if (reste > 0) res += (res ? " " : "") + dizaines(reste);
  return res;
}

function dizaines(n: number): string {
  if (n < 20) return UNITES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (d === 7) {
    return u === 1
      ? "soixante et onze"
      : "soixante-" + UNITES[10 + u];
  }
  if (d === 9) return "quatre-vingt-" + UNITES[10 + u];
  if (d === 8) return u === 0 ? "quatre-vingts" : "quatre-vingt-" + UNITES[u];
  const lien = (d === 2 || d === 3 || d === 4 || d === 5 || d === 6) && u === 1 ? " et " : "-";
  return u === 0 ? DIZAINES[d] : DIZAINES[d] + lien + UNITES[u];
}

function tranche(n: number): string {
  if (n === 0) return "";
  if (n < 100) return dizaines(n);
  return centaines(n);
}

export function nombreEnLettres(n: number): string {
  if (n === 0) return "zéro franc CFA";
  if (n < 0)   return "moins " + nombreEnLettres(-n);

  const milliards = Math.floor(n / 1_000_000_000);
  const millions  = Math.floor((n % 1_000_000_000) / 1_000_000);
  const milliers  = Math.floor((n % 1_000_000) / 1_000);
  const reste     = n % 1_000;

  const parts: string[] = [];

  if (milliards > 0) {
    parts.push(tranche(milliards) + (milliards > 1 ? " milliards" : " milliard"));
  }
  if (millions > 0) {
    parts.push(tranche(millions) + (millions > 1 ? " millions" : " million"));
  }
  if (milliers > 0) {
    if (milliers === 1) parts.push("mille");
    else parts.push(tranche(milliers) + " mille");
  }
  if (reste > 0) {
    parts.push(tranche(reste));
  }

  const lettres = parts.join(" ").trim();
  // Capitalise
  const result = lettres.charAt(0).toUpperCase() + lettres.slice(1);
  return result + " francs CFA";
}

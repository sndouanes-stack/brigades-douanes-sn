export type NaturePaiement = "Amende" | "Droits de douane" | "Pénalité";

export interface QuittanceData {
  id?: string;
  numero: string;
  brigade: string;
  nom: string;
  prenom: string;
  adresse: string;
  pieceIdentite: string;
  profession: string;
  montant: number;
  montantLettres: string;
  nature: NaturePaiement;
  referenceAC: string;
  lieu: string;
  date: string;
  chefBrigade: string;
  createdAt?: unknown;
}

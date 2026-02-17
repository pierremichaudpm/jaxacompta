export interface Category {
  id: number;
  nom: string;
  type: "dépense" | "revenu" | "neutre";
}

export interface Projet {
  id: number;
  code: string;
  nom: string;
  statut: string;
  compte_dedie: string | null;
  date_debut: string | null;
  date_fin: string | null;
  budget: number | null;
  revenus?: number;
  depenses?: number;
}

export interface Contact {
  id: number;
  nom: string;
  type: "client" | "fournisseur" | "les deux";
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  numero_tps: string | null;
  numero_tvq: string | null;
}

export interface LigneFacture {
  description: string;
  unite: number | null;
  cout_unitaire: number | null;
  montant: number;
  isHeader?: boolean;
}

export interface CompteBancaire {
  id: number;
  code: string;
  nom: string;
  institution: string;
  solde_initial: number;
  solde_actuel?: number;
}

export interface Transaction {
  id: number;
  date_transaction: string;
  type: "dépense" | "revenu" | "transfert";
  numero: string | null;
  description: string | null;
  categorie_id: number | null;
  projet_id: number | null;
  contact_id: number | null;
  compte_id: number | null;
  mode_paiement: string | null;
  montant_ht: number | null;
  tps: number;
  tvq: number;
  total_ttc: number;
  taxable: boolean;
  statut_facture: string | null;
  date_paiement: string | null;
  numero_facture: string | null;
  piece_jointe_url: string | null;
  ocr_source: boolean;
  ocr_confiance: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lignes_facture: string | null;
  // Joined fields
  categorie_nom?: string;
  projet_code?: string;
  projet_nom?: string;
  contact_nom?: string;
  contact_email?: string;
  contact_telephone?: string;
  contact_adresse?: string;
  compte_nom?: string;
}

export interface TransactionFormData {
  date_transaction: string;
  type: "dépense" | "revenu" | "transfert";
  numero?: string;
  description: string;
  categorie_id: number | null;
  projet_id: number | null;
  contact_id: number | null;
  compte_id: number | null;
  mode_paiement: string;
  montant_ht: number;
  tps: number;
  tvq: number;
  total_ttc: number;
  taxable: boolean;
  statut_facture?: string;
  numero_facture?: string;
  piece_jointe_url?: string;
  ocr_source: boolean;
  ocr_confiance?: number;
  notes?: string;
  projets_ids?: number[];
}

export interface OcrResult {
  date: string;
  fournisseur: string;
  description: string;
  montant_ht: number;
  tps: number;
  tvq: number;
  total_ttc: number;
  mode_paiement: string;
  numero_recu: string;
  confiance: number;
}

export interface DashboardData {
  mois: {
    revenus: number;
    depenses: number;
  };
  soldes: CompteBancaire[];
  evolution: {
    mois: string;
    revenus: number;
    depenses: number;
  }[];
  projets: Projet[];
  factures_retard: Transaction[];
}

export interface PeriodeFiscale {
  id: number;
  periode: string;
  date_debut: string;
  date_fin: string;
  tps_percue: number;
  tps_payee: number;
  tvq_percue: number;
  tvq_payee: number;
  reference: string | null;
}

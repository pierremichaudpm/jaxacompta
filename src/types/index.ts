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
  adresses?: {label: string; adresse: string}[];
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
  branding?: "jaxa" | "micho";
  compte_destination_id: number | null;
  id_transfert: number | null;
  is_transfert: boolean;
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
  compte_destination_id: number | null;
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
  branding?: "jaxa" | "micho";
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

export interface Recurrence {
  id: number;
  type: "dépense" | "revenu" | "transfert";
  description: string | null;
  categorie_id: number | null;
  projet_id: number | null;
  contact_id: number | null;
  compte_id: number | null;
  mode_paiement: string | null;
  montant_ht: number;
  tps: number;
  tvq: number;
  total_ttc: number;
  taxable: boolean;
  notes: string | null;
  frequence: "hebdomadaire" | "mensuel" | "trimestriel" | "annuel";
  date_debut: string;
  date_fin: string | null;
  prochaine_date: string;
  actif: boolean;
  created_at: string;
  // Joined
  categorie_nom?: string;
  projet_code?: string;
  contact_nom?: string;
  compte_nom?: string;
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

// --- Paie employé ---

export interface Employe {
  id: number;
  prenom: string;
  nom: string;
  actionnaire: boolean;
  statut: "actif" | "inactif";
  date_embauche: string | null;
  poste: string | null;
  adresse: string | null;
  courriel: string | null;
  nas_derniers3: string | null;
  taux_horaire: number | null;
  heures_semaine: number | null;
  periodes_par_an: number;
  mpb_provincial: number | null;
  mpb_federal: number | null;
  assujetti_ae: boolean;
  assujetti_cnesst: boolean;
  taux_vacances: number;
  compte_bancaire_id: number | null;
  compte_nom?: string | null;
  notes: string | null;
  nb_paies?: number;
}

export type StatutPaie = "brouillon" | "validee" | "comptabilisee" | "das_payees";

export interface Paie {
  id: number;
  employe_id: number;
  prenom?: string;
  nom?: string;
  date_paie: string;
  periode_debut: string | null;
  periode_fin: string | null;
  heures: number | null;
  brut: number;
  ae: number;
  rqap: number;
  rrq: number;
  impot_federal: number;
  impot_provincial: number;
  fss: number;
  net_reference: number | null;
  net: number;
  rqap_employeur: number;
  rrq_employeur: number;
  ae_employeur: number;
  cnt: number;
  cnesst: number;
  vacances: number;
  das_federal: number;
  das_provincial: number;
  statut: StatutPaie;
  compte_bancaire_id: number | null;
  compte_nom?: string | null;
  piece_jointe_key: string | null;
  piece_jointe_nom: string | null;
  ecriture_id: number | null;
  transaction_id: number | null;
  notes: string | null;
}

export interface ParametresPaieAnnee {
  annee: number;
  rqap_taux_employe: number | null;
  rqap_taux_employeur: number;
  rqap_max_assurable: number;
  ae_taux_employe: number | null;
  ae_ratio_employeur: number;
  ae_max_assurable: number | null;
  rrq_taux: number | null;
  rrq_exemption: number | null;
  rrq_max_gains: number | null;
  fss_taux: number;
  cnt_taux: number;
  cnt_max_assurable: number;
  cnesst_taux: number;
  cnesst_max_assurable: number | null;
  mpb_provincial: number | null;
  mpb_federal: number | null;
}

export interface RemiseDAS {
  id: number;
  mois: string;
  palier: "federal" | "provincial";
  montant: number;
  detail: Record<string, number>;
  date_limite: string;
  date_paiement: string;
  compte_nom?: string | null;
  demande_par: string | null;
  approuve_par: string | null;
}

export interface PalierDAS {
  payable_a: string;
  detail: Record<string, number>;
  total: number;
  remise: RemiseDAS | null;
}

export interface MoisDAS {
  mois: string;
  date_limite: string;
  masse_salariale: number;
  nb_employes: number;
  nb_paies: number;
  nb_non_comptabilisees: number;
  dates_paie: string[];
  federal: PalierDAS;
  provincial: PalierDAS;
}

export interface EcriturePaie {
  id: number;
  date_ecriture: string;
  libelle: string;
  source: "paie" | "remise_das" | "annulation";
  annulee: boolean;
  annule_ecriture_id: number | null;
  created_by: string | null;
  created_at: string;
  lignes: { compte: string; nom: string; debit: number; credit: number; banque: string | null }[];
}

export interface ModificationPaie {
  id: number;
  table_nom: string;
  enregistrement_id: number | null;
  action: string;
  utilisateur: string | null;
  avant: Record<string, unknown> | null;
  apres: Record<string, unknown> | null;
  created_at: string;
}

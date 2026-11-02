import type { Employe, MoisDAS, Paie } from "@/types";

// Aides d'affichage de l'onglet Paie (hors composants, pour le rafraîchissement à chaud)

export const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(Number(n || 0));

export const nomEmploye = (p: { prenom?: string; nom?: string }) => `${p.prenom ?? ""} ${p.nom ?? ""}`.trim();

export const saisiePaie = (p: Paie) => ({
  brut: p.brut, ae: p.ae, rqap: p.rqap, rrq: p.rrq,
  impot_federal: p.impot_federal, impot_provincial: p.impot_provincial, fss: p.fss,
});

export function etatRemise(m: MoisDAS, palier: "federal" | "provincial") {
  const r = m[palier].remise;
  if (r) return { libelle: `Payée le ${r.date_paiement}`, ton: "ok" as const };
  if (m.nb_paies === 0) return { libelle: "Aucune paie comptabilisée", ton: "neutre" as const };
  if (new Date().toISOString().slice(0, 10) > m.date_limite) return { libelle: `En retard (limite ${m.date_limite})`, ton: "retard" as const };
  return { libelle: `À payer avant le ${m.date_limite}`, ton: "attente" as const };
}

export function ficheIncomplete(e: Employe) {
  return [
    !e.date_embauche && "date d'embauche",
    !e.adresse && "adresse",
    !e.nas_derniers3 && "NAS (3 derniers chiffres)",
    !e.compte_bancaire_id && "compte bancaire",
    !e.taux_horaire && "taux horaire",
  ].filter(Boolean) as string[];
}

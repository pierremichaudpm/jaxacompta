import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { ParametresPaieAnnee } from "@/types";
import type { DonneesPaie } from "./PaieEmploye";

// Les taux sont stockés en fraction (0,00602) et affichés en pourcentage (0,602 %)
const CHAMPS: { cle: keyof ParametresPaieAnnee; label: string; pct?: boolean; requis?: boolean; aide?: string }[] = [
  { cle: "rqap_taux_employe", label: "RQAP — taux employé (%)", pct: true },
  { cle: "rqap_taux_employeur", label: "RQAP — taux employeur (%)", pct: true, requis: true },
  { cle: "rqap_max_assurable", label: "RQAP — maximum assurable ($)", requis: true },
  { cle: "ae_taux_employe", label: "A-E — taux employé Québec (%)", pct: true },
  { cle: "ae_ratio_employeur", label: "A-E — ratio employeur (× employé)", requis: true },
  { cle: "ae_max_assurable", label: "A-E — maximum assurable ($)" },
  { cle: "fss_taux", label: "FSS — taux (%)", pct: true, requis: true, aide: "Selon la masse salariale totale" },
  { cle: "cnt_taux", label: "CNT — taux (%)", pct: true, requis: true },
  { cle: "cnt_max_assurable", label: "CNT — maximum assurable ($)", requis: true },
  { cle: "cnesst_taux", label: "CNESST — taux ($ par 100 $)", requis: true, aide: "Taux de l'avis de cotisation CNESST" },
  { cle: "cnesst_max_assurable", label: "CNESST — maximum assurable ($)" },
  { cle: "rrq_taux", label: "RRQ — taux (%)", pct: true, aide: "Réservé au calcul automatique futur" },
  { cle: "rrq_exemption", label: "RRQ — exemption ($)" },
  { cle: "rrq_max_gains", label: "RRQ — maximum des gains ($)" },
  { cle: "mpb_provincial", label: "Montant personnel de base Québec ($)" },
  { cle: "mpb_federal", label: "Montant personnel de base fédéral ($)" },
];

const affichage = (p: Partial<ParametresPaieAnnee> | undefined) =>
  Object.fromEntries(CHAMPS.map(({ cle, pct }) => {
    const v = p?.[cle];
    return [cle, v == null ? "" : pct ? String(Math.round(Number(v) * 1e7) / 1e5) : String(Number(v))];
  })) as Record<string, string>;

export default function ParametresPaie(d: DonneesPaie) {
  const existant = d.parametres.find((p) => p.annee === d.annee);
  const precedent = d.parametres.find((p) => p.annee === d.annee - 1);
  const [f, setF] = useState(() => affichage(existant ?? precedent));
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => setF(affichage(existant ?? precedent)), [existant, precedent]);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    const corps: Record<string, number | string | null> = { annee: d.annee };
    for (const { cle, pct } of CHAMPS) corps[cle] = f[cle] === "" ? null : pct ? Number(f[cle]) / 100 : Number(f[cle]);
    try {
      await api.put("/api/paie/parametres", corps);
      await d.recharger();
      alert(`Paramètres ${d.annee} enregistrés`);
    } catch (err) {
      alert(`Erreur : ${err instanceof Error ? err.message : err}`);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paramètres de paie {d.annee}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {existant ? "Taux en vigueur cette année." : precedent ? `Aucun paramètre pour ${d.annee} : valeurs de ${d.annee - 1} proposées, à mettre à jour avec les taux publiés.` : "Aucun paramètre pour cette année."}
          {" "}Les retenues de l'employé viennent toujours du calculateur ; ces taux servent à la part employeur et aux plafonds.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={enregistrer} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CHAMPS.map(({ cle, label, requis, aide }) => (
              <div key={cle} className="space-y-1">
                <Label htmlFor={cle}>{label}</Label>
                <Input id={cle} type="number" step="any" min="0" value={f[cle]} required={requis} disabled={d.readOnly}
                  onChange={(e) => setF((x) => ({ ...x, [cle]: e.target.value }))} />
                {aide && <p className="text-xs text-muted-foreground">{aide}</p>}
              </div>
            ))}
          </div>
          {!d.readOnly && (
            <div className="flex justify-end">
              <Button type="submit" disabled={envoi}>{envoi ? "Enregistrement…" : `Enregistrer ${d.annee}`}</Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

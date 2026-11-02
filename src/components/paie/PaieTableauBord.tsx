import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, BellRing, FileSpreadsheet, UserRoundPen } from "lucide-react";
import {
  COLONNES_SOMMAIRE, MOIS, recapitulatifAnnuel, sommaireAnnuelExcel, totauxMensuels,
} from "@/lib/generatePaieDocuments";
import type { DonneesPaie } from "./PaieEmploye";
import { etatRemise, ficheIncomplete, fmt } from "@/lib/paieAffichage";

const r2 = (n: number) => Math.round(n * 100) / 100;

export default function PaieTableauBord(d: DonneesPaie & { allerA: (onglet: string) => void }) {
  const { mois, total } = totauxMensuels(d.paies);
  const recap = recapitulatifAnnuel(d.paies, d.employes);
  const rappels = d.das.flatMap((m) =>
    (["federal", "provincial"] as const)
      .map((palier) => ({ m, palier, etat: etatRemise(m, palier) }))
      .filter((x) => x.etat.ton === "attente" || x.etat.ton === "retard"),
  );
  const brouillons = d.paies.filter((p) => p.statut === "brouillon" || p.statut === "validee").length;
  const incompletes = d.employes.filter((e) => e.statut === "actif" && ficheIncomplete(e).length);
  const params = d.parametres.find((p) => p.annee === d.annee);
  const comptabilisees = d.paies.filter((p) => p.statut !== "brouillon" && p.statut !== "validee");
  const somme = (k: "cnt" | "cnesst" | "vacances") => r2(comptabilisees.reduce((t, p) => t + p[k], 0));
  const cnesstPayee = r2(d.das.reduce((t, m) => t + (m.provincial.remise ? Number(m.provincial.remise.detail["2151"] ?? 0) : 0), 0));

  return (
    <div className="space-y-4">
      {(rappels.length > 0 || brouillons > 0 || incompletes.length > 0 || !params) && (
        <div className="space-y-2">
          {!params && (
            <Alert variant="destructive"><AlertDescription>Paramètres {d.annee} manquants : ajoutez-les dans l'onglet Paramètres avant la première paie.</AlertDescription></Alert>
          )}
          {rappels.map(({ m, palier, etat }) => (
            <Alert key={m.mois + palier} variant={etat.ton === "retard" ? "destructive" : "default"}>
              {etat.ton === "retard" ? <AlertTriangle className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  DAS {palier === "federal" ? "fédérales" : "provinciales"} de {MOIS[Number(m.mois.slice(5, 7)) - 1].toLowerCase()} : {fmt(m[palier].total)} — {etat.libelle.toLowerCase()}
                </span>
                <Button size="sm" variant="outline" onClick={() => d.allerA("das")}>Voir</Button>
              </AlertDescription>
            </Alert>
          ))}
          {brouillons > 0 && (
            <Alert>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                <span>{brouillons} paie(s) à valider ou comptabiliser</span>
                <Button size="sm" variant="outline" onClick={() => d.allerA("paies")}>Voir</Button>
              </AlertDescription>
            </Alert>
          )}
          {incompletes.map((e) => (
            <Alert key={e.id}>
              <UserRoundPen className="h-4 w-4" />
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                <span>Fiche de {e.prenom} {e.nom} à compléter : {ficheIncomplete(e).join(", ")}</span>
                <Button size="sm" variant="outline" onClick={() => d.allerA("employes")}>Compléter</Button>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Sommaire des paies {d.annee}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => sommaireAnnuelExcel(d.annee, d.paies, d.employes, d.das)}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Export Excel
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Mois</TableHead>
                {COLONNES_SOMMAIRE.map((c) => <TableHead key={c.cle} className="text-right whitespace-nowrap">{c.titre}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {mois.map((m, i) => (
                <TableRow key={i} className={m.brut ? "" : "text-muted-foreground"}>
                  <TableCell>{MOIS[i]}</TableCell>
                  {COLONNES_SOMMAIRE.map((c) => <TableCell key={c.cle} className="text-right font-mono">{m[c.cle] ? fmt(m[c.cle]) : "–"}</TableCell>)}
                </TableRow>
              ))}
              <TableRow className="font-semibold border-t-2">
                <TableCell>Total</TableCell>
                {COLONNES_SOMMAIRE.map((c) => <TableCell key={c.cle} className="text-right font-mono">{fmt(total[c.cle])}</TableCell>)}
              </TableRow>
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-2">Inclut toutes les paies saisies, y compris les brouillons.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Cumulatifs depuis le 1er janvier</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            {recap.length === 0 ? <p className="text-sm text-muted-foreground">Aucune paie.</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employé</TableHead>
                    <TableHead className="text-right">Salaire</TableHead>
                    <TableHead className="text-right">RRQ</TableHead>
                    <TableHead className="text-right">RQAP</TableHead>
                    <TableHead className="text-right">A-E</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recap.map((r) => {
                    const v = (t4: string) => r.cases.find((c) => c.t4 === t4)!.montant;
                    return (
                      <TableRow key={r.employe.id}>
                        <TableCell>{r.employe.prenom} {r.employe.nom}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(v("14"))}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(v("17"))}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(v("55"))}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(v("18"))}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            <p className="text-xs text-muted-foreground mt-2">Le formulaire de paie affiche les cumulatifs « avant cette période » à reporter dans Impot.net.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Provisions et cotisations annuelles</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-3">
            <div className="grid grid-cols-[1fr_auto] gap-y-1">
              <span>CNT provisionnée (2215)</span><span className="text-right font-mono">{fmt(somme("cnt"))}</span>
              <span className="text-xs text-muted-foreground col-span-2">À payer avec le Sommaire 1 (RL-1), au plus tard le dernier jour de février {d.annee + 1}.</span>
              <span>CNESST cotisée (2151)</span><span className="text-right font-mono">{fmt(somme("cnesst"))}</span>
              <span className="pl-3 text-muted-foreground">dont payée avec les DAS</span><span className="text-right font-mono text-muted-foreground">{fmt(cnesstPayee)}</span>
              <span>Vacances provisionnées (2160)</span><span className="text-right font-mono">{fmt(somme("vacances"))}</span>
            </div>
            <p className="text-xs text-muted-foreground">Montants des paies comptabilisées.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Récapitulatif de fin d'année — T4 et RL-1</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {recap.length === 0 && <p className="text-sm text-muted-foreground">Aucune paie.</p>}
          {recap.map((r) => (
            <div key={r.employe.id} className="rounded-md border p-3">
              <p className="font-medium mb-2">{r.employe.prenom} {r.employe.nom} <span className="text-muted-foreground text-sm">({r.nb_paies} paies)</span></p>
              <Table className="text-sm">
                <TableHeader>
                  <TableRow><TableHead>T4</TableHead><TableHead>RL-1</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Montant</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {r.cases.map((c) => (
                    <TableRow key={c.libelle}>
                      <TableCell>{c.t4}</TableCell><TableCell>{c.rl1}</TableCell><TableCell>{c.libelle}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(c.montant)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
          <p className="text-xs text-muted-foreground md:col-span-2">Cases à valider par le comptable. Les vacances provisionnées s'ajouteront aux revenus quand elles seront versées.</p>
        </CardContent>
      </Card>
    </div>
  );
}

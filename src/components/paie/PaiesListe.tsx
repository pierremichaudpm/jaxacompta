import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookCheck, CheckCircle2, FileText, Paperclip, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { api, ouvrirPiecePaie } from "@/lib/api";
import { ecriturePaie } from "@/lib/paieCalcul";
import type { Paie } from "@/types";
import type { DonneesPaie } from "./PaieEmploye";
import PaieForm from "./PaieForm";
import { fmt, nomEmploye, saisiePaie } from "@/lib/paieAffichage";
import { BadgeStatut, TableEcriture } from "./commun";

export default function PaiesListe(d: DonneesPaie) {
  const [edition, setEdition] = useState<Paie | null | "nouvelle">(null);
  const [ecriture, setEcriture] = useState<Paie | null>(null);
  const [occupe, setOccupe] = useState<number | null>(null);

  async function action(p: Paie, act: string, confirmation?: string) {
    if (confirmation && !confirm(confirmation)) return;
    setOccupe(p.id);
    try {
      await api.post("/api/paie", { id: p.id, action: act });
      await d.recharger();
    } catch (e) {
      alert(`Erreur : ${e instanceof Error ? e.message : e}`);
    } finally {
      setOccupe(null);
    }
  }

  async function supprimer(p: Paie) {
    if (!confirm(`Supprimer la paie du ${p.date_paie} ?`)) return;
    try {
      await api.delete(`/api/paie?id=${p.id}`);
      await d.recharger();
    } catch (e) {
      alert(`Erreur : ${e instanceof Error ? e.message : e}`);
    }
  }

  const banque = (p: Paie) => d.comptes.find((c) => c.id === p.compte_bancaire_id)?.nom ?? null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Paies {d.annee}</CardTitle>
        {!d.readOnly && (
          <Button size="sm" onClick={() => setEdition("nouvelle")} disabled={!d.employes.length}>
            <Plus className="h-4 w-4 mr-1" /> Nouvelle paie
          </Button>
        )}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {d.paies.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune paie pour {d.annee}.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Employé</TableHead>
                <TableHead className="text-right">Brut</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">DAS féd.</TableHead>
                <TableHead className="text-right">DAS prov.</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.paies.map((p) => {
                const modifiable = !d.readOnly && (p.statut === "brouillon" || p.statut === "validee");
                return (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap">{p.date_paie}</TableCell>
                    <TableCell>{nomEmploye(p)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(p.brut)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(p.net)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(p.das_federal)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(p.das_provincial)}</TableCell>
                    <TableCell><BadgeStatut statut={p.statut} /></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {p.piece_jointe_key && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title={p.piece_jointe_nom ?? "Pièce jointe"}
                            onClick={() => ouvrirPiecePaie(p.piece_jointe_key!).catch((e) => alert(e.message))}>
                            <Paperclip className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Écriture comptable" onClick={() => setEcriture(p)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                        {modifiable && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Modifier" onClick={() => setEdition(p)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Supprimer" onClick={() => supprimer(p)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {!d.readOnly && p.statut === "brouillon" && (
                          <Button variant="outline" size="sm" className="h-7" disabled={occupe === p.id} onClick={() => action(p, "valider")}>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Valider
                          </Button>
                        )}
                        {!d.readOnly && p.statut === "validee" && (
                          <Button size="sm" className="h-7" disabled={occupe === p.id}
                            onClick={() => action(p, "comptabiliser", `Comptabiliser la paie du ${p.date_paie} ? L'écriture sera publiée et le salaire net (${fmt(p.net)}) sortira de ${banque(p) ?? "la banque"}.`)}>
                            <BookCheck className="h-4 w-4 mr-1" /> Comptabiliser
                          </Button>
                        )}
                        {!d.readOnly && p.statut === "comptabilisee" && (
                          <Button variant="outline" size="sm" className="h-7" disabled={occupe === p.id}
                            onClick={() => action(p, "annuler", "Annuler la comptabilisation ? Une écriture d'annulation sera créée et la paie redeviendra un brouillon modifiable.")}>
                            <Undo2 className="h-4 w-4 mr-1" /> Annuler
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {edition && (
        <PaieForm d={d} paie={edition === "nouvelle" ? null : edition}
          onClose={(saved) => { setEdition(null); if (saved) d.recharger(); }} />
      )}

      <Dialog open={!!ecriture} onOpenChange={(o) => !o && setEcriture(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Écriture — paie du {ecriture?.date_paie}
              {ecriture && ecriture.statut !== "comptabilisee" && ecriture.statut !== "das_payees" && " (aperçu)"}
            </DialogTitle>
          </DialogHeader>
          {ecriture && <TableEcriture lignes={ecriturePaie({ ...saisiePaie(ecriture), ...ecriture })} banque={banque(ecriture)} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

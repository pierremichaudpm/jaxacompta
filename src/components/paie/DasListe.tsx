import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, FileSpreadsheet, Landmark, Undo2 } from "lucide-react";
import { api } from "@/lib/api";
import { MOIS, nomCompte, requisitionExcel, requisitionPDF } from "@/lib/generatePaieDocuments";
import type { MoisDAS } from "@/types";
import type { DonneesPaie } from "./PaieEmploye";
import { etatRemise, fmt } from "@/lib/paieAffichage";

type Palier = "federal" | "provincial";
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const nomMois = (m: string) => `${MOIS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

export default function DasListe(d: DonneesPaie) {
  const [paiement, setPaiement] = useState<{ m: MoisDAS; palier: Palier } | null>(null);
  const [signatures, setSignatures] = useState({ demande_par: "", approuve_par: "" });
  const [form, setForm] = useState({ date_paiement: aujourdhui(), compte_bancaire_id: "" });
  const [envoi, setEnvoi] = useState(false);

  async function payer() {
    if (!paiement) return;
    setEnvoi(true);
    try {
      await api.post("/api/paie/das", {
        action: "payer", mois: paiement.m.mois, palier: paiement.palier, ...form, ...signatures,
      });
      setPaiement(null);
      await d.recharger();
    } catch (e) {
      alert(`Erreur : ${e instanceof Error ? e.message : e}`);
    } finally {
      setEnvoi(false);
    }
  }

  async function annuler(id: number) {
    if (!confirm("Annuler ce paiement ? Une écriture d'annulation sera créée et la sortie de banque supprimée.")) return;
    try {
      await api.delete(`/api/paie/das?id=${id}`);
      await d.recharger();
    } catch (e) {
      alert(`Erreur : ${e instanceof Error ? e.message : e}`);
    }
  }

  const ouvrirPaiement = (m: MoisDAS, palier: Palier) => {
    const premier = d.paies.find((p) => p.date_paie.startsWith(m.mois.slice(0, 7)) && p.compte_bancaire_id);
    setForm({ date_paiement: aujourdhui(), compte_bancaire_id: premier ? String(premier.compte_bancaire_id) : "" });
    setPaiement({ m, palier });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="demande">Demandé par (réquisitions)</Label>
            <Input id="demande" value={signatures.demande_par} onChange={(e) => setSignatures((s) => ({ ...s, demande_par: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="approuve">Approuvé par</Label>
            <Input id="approuve" value={signatures.approuve_par} onChange={(e) => setSignatures((s) => ({ ...s, approuve_par: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      {d.das.length === 0 && <p className="text-sm text-muted-foreground">Aucune paie en {d.annee}.</p>}

      {[...d.das].reverse().map((m) => (
        <Card key={m.mois}>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>{nomMois(m.mois)}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {m.nb_paies} paie(s) · masse salariale {fmt(m.masse_salariale)} · {m.nb_employes} employé(s) · limite {m.date_limite}
              </p>
              {m.nb_non_comptabilisees > 0 && (
                <p className="text-sm text-amber-700">{m.nb_non_comptabilisees} paie(s) du mois pas encore comptabilisée(s)</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!m.nb_paies} onClick={() => requisitionExcel(m, signatures)}>
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {(["federal", "provincial"] as Palier[]).map((palier) => {
              const p = m[palier];
              const etat = etatRemise(m, palier);
              return (
                <div key={palier} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{palier === "federal" ? "Fédéral" : "Provincial"} — {p.payable_a}</p>
                    <Badge variant={etat.ton === "retard" ? "destructive" : etat.ton === "ok" ? "default" : "outline"}
                      className={etat.ton === "ok" ? "bg-green-700" : ""}>{etat.libelle}</Badge>
                  </div>
                  <div className="text-sm grid grid-cols-[1fr_auto] gap-y-0.5">
                    {Object.entries(p.detail).map(([compte, montant]) => (
                      <div key={compte} className="contents">
                        <span>{nomCompte(compte)}</span><span className="text-right font-mono">{fmt(montant)}</span>
                      </div>
                    ))}
                    <span className="font-semibold pt-1">Total</span><span className="text-right font-mono font-semibold pt-1">{fmt(p.total)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="outline" size="sm" disabled={!m.nb_paies} onClick={() => requisitionPDF(m, palier, signatures)}>
                      <FileDown className="h-4 w-4 mr-1" /> Réquisition PDF
                    </Button>
                    {!d.readOnly && !p.remise && m.nb_paies > 0 && (
                      <Button size="sm" disabled={m.nb_non_comptabilisees > 0} onClick={() => ouvrirPaiement(m, palier)}>
                        <Landmark className="h-4 w-4 mr-1" /> Marquer payée
                      </Button>
                    )}
                    {!d.readOnly && p.remise && (
                      <Button variant="ghost" size="sm" onClick={() => annuler(p.remise!.id)}>
                        <Undo2 className="h-4 w-4 mr-1" /> Annuler le paiement
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!paiement} onOpenChange={(o) => !o && setPaiement(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Paiement DAS {paiement?.palier === "federal" ? "fédéral" : "provincial"} — {paiement && nomMois(paiement.m.mois)}
            </DialogTitle>
          </DialogHeader>
          {paiement && (
            <div className="space-y-3">
              <p className="text-sm">
                {paiement.m[paiement.palier].payable_a} : <span className="font-mono font-semibold">{fmt(paiement.m[paiement.palier].total)}</span>
              </p>
              <div className="space-y-1">
                <Label htmlFor="date_paiement">Date du paiement</Label>
                <Input id="date_paiement" type="date" value={form.date_paiement} onChange={(e) => setForm((f) => ({ ...f, date_paiement: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Compte bancaire</Label>
                <Select value={form.compte_bancaire_id} onValueChange={(v) => setForm((f) => ({ ...f, compte_bancaire_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {d.comptes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Crée l'écriture (débit des comptes à payer, crédit Banque) et la sortie de banque. Quand les deux paliers du mois sont payés, les paies passent au statut « DAS payées ».
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPaiement(null)}>Annuler</Button>
                <Button onClick={payer} disabled={envoi || !form.compte_bancaire_id || !form.date_paiement}>
                  {envoi ? "Enregistrement…" : "Confirmer le paiement"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

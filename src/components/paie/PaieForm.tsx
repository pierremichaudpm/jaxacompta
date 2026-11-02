import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Paperclip } from "lucide-react";
import { api, televerserPiecePaie } from "@/lib/api";
import {
  calculerPaie, ecartReference, ecriturePaie, equilibre, fssSuggeree, type PaieParametres,
} from "@/lib/paieCalcul";
import type { Paie } from "@/types";
import type { DonneesPaie } from "./PaieEmploye";
import { fmt } from "@/lib/paieAffichage";

const RETENUES = [
  ["ae", "Assurance-emploi (A-E)"],
  ["rqap", "RQAP"],
  ["rrq", "RRQ"],
  ["impot_federal", "Impôt fédéral"],
  ["impot_provincial", "Impôt provincial"],
] as const;

type Cumuls = { brut: number; rrq: number; rqap: number; ae: number };

const vide = (d: DonneesPaie) => {
  const actifs = d.employes.filter((e) => e.statut === "actif");
  const e = actifs.length === 1 ? actifs[0] : null;
  return {
    employe_id: e ? String(e.id) : "",
    date_paie: "",
    periode_debut: "",
    periode_fin: "",
    heures: "",
    brut: "",
    ae: "0",
    rqap: "",
    rrq: "",
    impot_federal: "",
    impot_provincial: "",
    fss: "",
    net_reference: "",
    compte_bancaire_id: e?.compte_bancaire_id ? String(e.compte_bancaire_id) : "",
    piece_jointe_key: "",
    piece_jointe_nom: "",
    notes: "",
  };
};

type Formulaire = ReturnType<typeof vide>;

const depuisPaie = (p: Paie): Formulaire => ({
  employe_id: String(p.employe_id),
  date_paie: p.date_paie,
  periode_debut: p.periode_debut ?? "",
  periode_fin: p.periode_fin ?? "",
  heures: p.heures == null ? "" : String(p.heures),
  brut: String(p.brut),
  ae: String(p.ae),
  rqap: String(p.rqap),
  rrq: String(p.rrq),
  impot_federal: String(p.impot_federal),
  impot_provincial: String(p.impot_provincial),
  fss: String(p.fss),
  net_reference: p.net_reference == null ? "" : String(p.net_reference),
  compte_bancaire_id: p.compte_bancaire_id ? String(p.compte_bancaire_id) : "",
  piece_jointe_key: p.piece_jointe_key ?? "",
  piece_jointe_nom: p.piece_jointe_nom ?? "",
  notes: p.notes ?? "",
});

export default function PaieForm({ d, paie, onClose }: { d: DonneesPaie; paie: Paie | null; onClose: (saved: boolean) => void }) {
  const [f, setF] = useState<Formulaire>(() => (paie ? depuisPaie(paie) : vide(d)));
  const [cumuls, setCumuls] = useState<Cumuls | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const maj = (k: keyof Formulaire, v: string) => setF((x) => ({ ...x, [k]: v }));

  const employe = d.employes.find((e) => String(e.id) === f.employe_id) ?? null;
  const annee = Number(f.date_paie.slice(0, 4));
  const ligneParams = d.parametres.find((p) => p.annee === annee);
  const params: PaieParametres | null = ligneParams
    ? {
        rqap_taux_employeur: Number(ligneParams.rqap_taux_employeur),
        rqap_max_assurable: Number(ligneParams.rqap_max_assurable),
        ae_ratio_employeur: Number(ligneParams.ae_ratio_employeur),
        cnt_taux: Number(ligneParams.cnt_taux),
        cnt_max_assurable: Number(ligneParams.cnt_max_assurable),
        cnesst_taux: Number(ligneParams.cnesst_taux),
        cnesst_max_assurable: ligneParams.cnesst_max_assurable == null ? null : Number(ligneParams.cnesst_max_assurable),
        fss_taux: Number(ligneParams.fss_taux),
      }
    : null;

  useEffect(() => {
    if (!f.employe_id || !/^\d{4}-\d{2}-\d{2}$/.test(f.date_paie)) return setCumuls(null);
    const q = `employe_id=${f.employe_id}&date=${f.date_paie}${paie ? `&exclure=${paie.id}` : ""}`;
    api.get<Cumuls>(`/api/paie?cumulatifs=1&${q}`).then(setCumuls).catch(() => setCumuls(null));
  }, [f.employe_id, f.date_paie, paie]);

  useEffect(() => {
    if (employe && !employe.assujetti_ae) setF((x) => (x.ae === "0" ? x : { ...x, ae: "0" }));
    if (employe && !paie && !f.compte_bancaire_id && employe.compte_bancaire_id) {
      setF((x) => ({ ...x, compte_bancaire_id: String(employe.compte_bancaire_id) }));
    }
  }, [employe, paie, f.compte_bancaire_id]);

  const saisie = {
    brut: Number(f.brut || 0), ae: Number(f.ae || 0), rqap: Number(f.rqap || 0), rrq: Number(f.rrq || 0),
    impot_federal: Number(f.impot_federal || 0), impot_provincial: Number(f.impot_provincial || 0), fss: Number(f.fss || 0),
  };
  const calc = useMemo(
    () => (params && employe && cumuls
      ? calculerPaie(saisie, params, {
          cumul_brut_avant: cumuls.brut,
          assujetti_cnesst: employe.assujetti_cnesst,
          taux_vacances: Number(employe.taux_vacances),
        })
      : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(saisie), params?.rqap_taux_employeur, params?.cnesst_taux, employe, cumuls],
  );
  const ecart = calc ? ecartReference(calc.net, f.net_reference === "" ? null : Number(f.net_reference)) : null;
  const eq = calc ? equilibre(ecriturePaie({ ...saisie, ...calc })) : null;

  async function joindre(file: File | undefined) {
    if (!file) return;
    try {
      const { key, nom } = await televerserPiecePaie(file);
      setF((x) => ({ ...x, piece_jointe_key: key, piece_jointe_nom: nom }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur de téléversement");
    }
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    try {
      if (paie) await api.put("/api/paie", { ...f, id: paie.id });
      else await api.post("/api/paie", f);
      onClose(true);
    } catch (err) {
      alert(`Erreur : ${err instanceof Error ? err.message : err}`);
    } finally {
      setEnvoi(false);
    }
  }

  const champ = (k: keyof Formulaire, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1">
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} value={f[k]} onChange={(ev) => maj(k, ev.target.value)} {...props} />
    </div>
  );
  const argent = { type: "number", step: "0.01", min: "0", inputMode: "decimal" as const };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="sm:max-w-4xl w-[calc(100%-1rem)] max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{paie ? "Modifier la paie" : "Nouvelle paie"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={enregistrer} className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Employé</Label>
                <Select value={f.employe_id} onValueChange={(v) => maj("employe_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {d.employes.filter((e) => e.statut === "actif" || String(e.id) === f.employe_id).map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>{e.prenom} {e.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {champ("date_paie", "Date de paie", { type: "date", required: true })}
              {champ("periode_debut", "Période du", { type: "date" })}
              {champ("periode_fin", "au", { type: "date" })}
            </div>

            {cumuls && employe && (
              <div className="rounded-md border bg-slate-50 p-3 text-sm">
                <p className="font-medium mb-2">À reporter dans le calculateur (Impot.net)</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span>Nombre de périodes de paie</span><span className="text-right font-mono">{employe.periodes_par_an}</span>
                  <span>Montant de base provincial</span><span className="text-right font-mono">{fmt(employe.mpb_provincial ?? ligneParams?.mpb_provincial)}</span>
                  <span>Montant de base fédéral</span><span className="text-right font-mono">{fmt(employe.mpb_federal ?? ligneParams?.mpb_federal)}</span>
                  <span>Assujetti à l'assurance-emploi</span><span className="text-right">{employe.assujetti_ae ? "Oui (cocher)" : "Non (ne pas cocher)"}</span>
                  <span>Cumulatif RRQ avant cette période</span><span className="text-right font-mono">{fmt(cumuls.rrq)}</span>
                  <span>Cumulatif RQAP avant cette période</span><span className="text-right font-mono">{fmt(cumuls.rqap)}</span>
                  <span>Cumulatif PAE avant cette période</span><span className="text-right font-mono">{fmt(cumuls.ae)}</span>
                  <span>Cumulatif salaire avant cette période</span><span className="text-right font-mono">{fmt(cumuls.brut)}</span>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              {champ("heures", "Heures (facultatif)", { type: "number", step: "0.25", min: "0" })}
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="brut">Salaire brut</Label>
                <div className="flex gap-2">
                  <Input id="brut" value={f.brut} onChange={(ev) => maj("brut", ev.target.value)} required {...argent} />
                  {employe?.taux_horaire && f.heures && (
                    <Button type="button" variant="outline" size="sm" className="h-9 shrink-0"
                      onClick={() => maj("brut", (Math.round(Number(f.heures) * Number(employe.taux_horaire) * 100) / 100).toFixed(2))}>
                      Heures × {fmt(employe.taux_horaire)}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Retenues de l'employé (du calculateur)</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {RETENUES.map(([k, label]) =>
                  champ(k, label, { ...argent, required: true, disabled: k === "ae" && employe?.assujetti_ae === false }),
                )}
                <div className="space-y-1">
                  <Label htmlFor="fss">FSS (cotisation employeur)</Label>
                  <div className="flex gap-2">
                    <Input id="fss" value={f.fss} onChange={(ev) => maj("fss", ev.target.value)} required {...argent} />
                    {params && f.brut && (
                      <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" title="Brut × taux FSS de l'année"
                        onClick={() => maj("fss", fssSuggeree(Number(f.brut), params).toFixed(2))}>
                        Suggérer
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              {employe?.assujetti_ae === false && (
                <p className="text-xs text-muted-foreground mt-1">{employe.prenom} n'est pas assujetti(e) à l'assurance-emploi : A-E = 0.</p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {champ("net_reference", "Salaire net affiché par le calculateur", argent)}
              <div className="space-y-1">
                <Label>Compte bancaire du salaire net</Label>
                <Select value={f.compte_bancaire_id} onValueChange={(v) => maj("compte_bancaire_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {d.comptes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="piece">Calcul du calculateur (PDF)</Label>
              <div className="flex items-center gap-2">
                <Input id="piece" type="file" accept="application/pdf,image/*" onChange={(ev) => joindre(ev.target.files?.[0])} />
                {f.piece_jointe_nom && <span className="text-xs text-muted-foreground flex items-center gap-1"><Paperclip className="h-3 w-3" />{f.piece_jointe_nom}</span>}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={2} value={f.notes} onChange={(ev) => maj("notes", ev.target.value)} />
            </div>
          </div>

          <aside className="space-y-3 text-sm">
            {!params && f.date_paie && (
              <Alert variant="destructive"><AlertDescription>Paramètres {annee} manquants : ajoutez-les dans l'onglet Paramètres.</AlertDescription></Alert>
            )}
            {calc ? (
              <>
                <div className="rounded-md border p-3 space-y-1">
                  <p className="font-medium">Salaire net</p>
                  <p className="text-2xl font-mono">{fmt(calc.net)}</p>
                  {ecart && (
                    <p className={ecart.alerte ? "text-red-700 flex gap-1" : "text-muted-foreground"}>
                      {ecart.alerte && <AlertTriangle className="h-4 w-4 shrink-0" />}
                      Écart avec le calculateur : {fmt(ecart.ecart)}
                      {!ecart.alerte && ecart.ecart !== 0 && " (arrondi du calculateur, toléré)"}
                    </p>
                  )}
                </div>
                <div className="rounded-md border p-3 grid grid-cols-2 gap-y-1">
                  <span className="col-span-2 font-medium">Part employeur</span>
                  <span>RQAP</span><span className="text-right font-mono">{fmt(calc.rqap_employeur)}</span>
                  <span>RRQ</span><span className="text-right font-mono">{fmt(calc.rrq_employeur)}</span>
                  <span>A-E</span><span className="text-right font-mono">{fmt(calc.ae_employeur)}</span>
                  <span>FSS</span><span className="text-right font-mono">{fmt(saisie.fss)}</span>
                  <span>CNT</span><span className="text-right font-mono">{fmt(calc.cnt)}</span>
                  <span>CNESST</span><span className="text-right font-mono">{fmt(calc.cnesst)}</span>
                  <span>Vacances (provision)</span><span className="text-right font-mono">{fmt(calc.vacances)}</span>
                </div>
                <div className="rounded-md border p-3 grid grid-cols-2 gap-y-1">
                  <span className="font-medium">DAS fédéral</span><span className="text-right font-mono">{fmt(calc.das_federal)}</span>
                  <span className="font-medium">DAS provincial</span><span className="text-right font-mono">{fmt(calc.das_provincial)}</span>
                </div>
                {eq && (
                  <p className={eq.equilibre ? "text-muted-foreground" : "text-red-700"}>
                    Écriture : débits {fmt(eq.debit)} = crédits {fmt(eq.credit)}
                  </p>
                )}
                {params?.cnesst_taux === 0 && employe?.assujetti_cnesst && (
                  <p className="text-amber-700 text-xs">Taux CNESST à 0 : saisissez le taux de l'avis de cotisation dans Paramètres.</p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Choisissez l'employé et la date pour voir le calcul.</p>
            )}
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onClose(false)}>Annuler</Button>
              <Button type="submit" disabled={envoi || !calc}>{envoi ? "Enregistrement…" : "Enregistrer"}</Button>
            </div>
          </aside>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Employe } from "@/types";
import type { DonneesPaie } from "./PaieEmploye";
import { ficheIncomplete, fmt } from "@/lib/paieAffichage";

const FREQUENCES: Record<string, string> = {
  "26": "Aux 2 semaines (26)",
  "52": "Hebdomadaire (52)",
  "24": "Bimensuelle (24)",
  "12": "Mensuelle (12)",
};

const versFormulaire = (e: Employe | null, d: DonneesPaie) => {
  const p = d.parametres.find((x) => x.annee === d.annee);
  const s = (v: unknown) => (v == null ? "" : String(v));
  return {
    prenom: s(e?.prenom), nom: s(e?.nom), actionnaire: e?.actionnaire ?? false,
    statut: e?.statut ?? "actif", date_embauche: s(e?.date_embauche), poste: s(e?.poste),
    adresse: s(e?.adresse), courriel: s(e?.courriel), nas_derniers3: s(e?.nas_derniers3),
    taux_horaire: s(e?.taux_horaire), heures_semaine: s(e?.heures_semaine),
    periodes_par_an: s(e?.periodes_par_an ?? 26),
    mpb_provincial: s(e ? e.mpb_provincial : p?.mpb_provincial), mpb_federal: s(e ? e.mpb_federal : p?.mpb_federal),
    assujetti_ae: e?.assujetti_ae ?? true, assujetti_cnesst: e?.assujetti_cnesst ?? true,
    taux_vacances_pct: s(Math.round(Number(e?.taux_vacances ?? 0.04) * 10000) / 100),
    compte_bancaire_id: s(e?.compte_bancaire_id), notes: s(e?.notes),
  };
};

export default function EmployesListe(d: DonneesPaie) {
  const [edition, setEdition] = useState<Employe | null | "nouveau">(null);
  const [f, setF] = useState(() => versFormulaire(null, d));
  const [envoi, setEnvoi] = useState(false);
  const maj = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const ouvrir = (e: Employe | null) => {
    setF(versFormulaire(e, d));
    setEdition(e ?? "nouveau");
  };

  async function enregistrer(ev: React.FormEvent) {
    ev.preventDefault();
    setEnvoi(true);
    const { taux_vacances_pct, ...reste } = f;
    const corps = { ...reste, taux_vacances: Number(taux_vacances_pct) / 100 };
    try {
      if (edition && edition !== "nouveau") await api.put("/api/paie/employes", { ...corps, id: edition.id });
      else await api.post("/api/paie/employes", corps);
      setEdition(null);
      await d.recharger();
    } catch (e) {
      alert(`Erreur : ${e instanceof Error ? e.message : e}`);
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimer(e: Employe) {
    if (!confirm(`Supprimer la fiche de ${e.prenom} ${e.nom} ?`)) return;
    try {
      await api.delete(`/api/paie/employes?id=${e.id}`);
      await d.recharger();
    } catch (err) {
      alert(`Erreur : ${err instanceof Error ? err.message : err}`);
    }
  }

  const texte = (k: keyof typeof f, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1">
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} value={String(f[k])} onChange={(ev) => maj(k, ev.target.value as never)} disabled={d.readOnly} {...props} />
    </div>
  );
  const coche = (k: "actionnaire" | "assujetti_ae" | "assujetti_cnesst", label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={f[k]} onCheckedChange={(v) => maj(k, v === true)} disabled={d.readOnly} /> {label}
    </label>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Employés</CardTitle>
        {!d.readOnly && <Button size="sm" onClick={() => ouvrir(null)}><Plus className="h-4 w-4 mr-1" /> Nouvel employé</Button>}
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {d.employes.map((e) => {
          const manque = ficheIncomplete(e);
          return (
            <div key={e.id} className={`rounded-md border p-3 space-y-2 ${e.statut === "inactif" ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{e.prenom} {e.nom}</p>
                  <p className="text-sm text-muted-foreground">{e.poste || "Poste non précisé"}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" title={d.readOnly ? "Voir" : "Modifier"} onClick={() => ouvrir(e)}><Pencil className="h-4 w-4" /></Button>
                  {!d.readOnly && !e.nb_paies && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Supprimer" onClick={() => supprimer(e)}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {e.statut === "inactif" && <Badge variant="secondary">Inactif</Badge>}
                {e.actionnaire && <Badge variant="outline">Actionnaire</Badge>}
                <Badge variant="outline">{e.assujetti_ae ? "Assujetti A-E" : "Non assujetti A-E"}</Badge>
                <Badge variant="outline">{FREQUENCES[String(e.periodes_par_an)]}</Badge>
                {manque.length > 0 && <Badge className="bg-amber-600">Fiche à compléter</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {e.taux_horaire ? `${fmt(e.taux_horaire)}/h` : "Taux horaire ?"}
                {e.heures_semaine ? ` · ${e.heures_semaine} h/sem.` : ""}
                {e.compte_nom ? ` · ${e.compte_nom}` : ""}
              </p>
              {manque.length > 0 && <p className="text-xs text-amber-700">Manque : {manque.join(", ")}</p>}
            </div>
          );
        })}
      </CardContent>

      <Dialog open={!!edition} onOpenChange={(o) => !o && setEdition(null)}>
        <DialogContent className="sm:max-w-2xl w-[calc(100%-1rem)] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader><DialogTitle>{edition === "nouveau" ? "Nouvel employé" : "Fiche employé"}</DialogTitle></DialogHeader>
          <form onSubmit={enregistrer} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {texte("prenom", "Prénom", { required: true })}
              {texte("nom", "Nom", { required: true })}
              {texte("poste", "Poste")}
              {texte("date_embauche", "Date d'embauche", { type: "date" })}
              {texte("courriel", "Courriel", { type: "email" })}
              {texte("nas_derniers3", "NAS — 3 derniers chiffres", { inputMode: "numeric", maxLength: 3, pattern: "[0-9]{3}", placeholder: "123" })}
            </div>
            <div className="space-y-1">
              <Label htmlFor="adresse">Adresse (pour le T4 et le RL-1)</Label>
              <Textarea id="adresse" rows={2} value={f.adresse} onChange={(ev) => maj("adresse", ev.target.value)} disabled={d.readOnly} />
            </div>
            <p className="text-xs text-muted-foreground">Le NAS complet n'est jamais enregistré dans l'application.</p>

            <div className="grid gap-3 sm:grid-cols-3">
              {texte("taux_horaire", "Taux horaire", { type: "number", step: "0.01", min: "0" })}
              {texte("heures_semaine", "Heures par semaine", { type: "number", step: "0.25", min: "0" })}
              <div className="space-y-1">
                <Label>Fréquence de paie</Label>
                <Select value={f.periodes_par_an} onValueChange={(v) => maj("periodes_par_an", v)} disabled={d.readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(FREQUENCES).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {texte("mpb_provincial", "Montant de base provincial", { type: "number", step: "0.01", min: "0" })}
              {texte("mpb_federal", "Montant de base fédéral", { type: "number", step: "0.01", min: "0" })}
              {texte("taux_vacances_pct", "Vacances (%)", { type: "number", step: "0.01", min: "0", max: "20" })}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Compte bancaire du salaire</Label>
                <Select value={f.compte_bancaire_id} onValueChange={(v) => maj("compte_bancaire_id", v)} disabled={d.readOnly}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>{d.comptes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nom}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Statut</Label>
                <Select value={f.statut} onValueChange={(v) => maj("statut", v as "actif" | "inactif")} disabled={d.readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="actif">Actif</SelectItem><SelectItem value="inactif">Inactif</SelectItem></SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              {coche("actionnaire", "Employé actionnaire")}
              {coche("assujetti_ae", "Assujetti à l'assurance-emploi")}
              {f.actionnaire && f.assujetti_ae && (
                <p className="text-xs text-amber-700 pl-6">Un actionnaire qui contrôle plus de 40 % des actions votantes n'est généralement pas assujetti à l'A-E.</p>
              )}
              {coche("assujetti_cnesst", "Cotisation CNESST")}
            </div>

            <div className="space-y-1">
              <Label htmlFor="notes_employe">Notes</Label>
              <Textarea id="notes_employe" rows={2} value={f.notes} onChange={(ev) => maj("notes", ev.target.value)} disabled={d.readOnly} />
            </div>

            {!d.readOnly && (
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEdition(null)}>Annuler</Button>
                <Button type="submit" disabled={envoi}>{envoi ? "Enregistrement…" : "Enregistrer"}</Button>
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

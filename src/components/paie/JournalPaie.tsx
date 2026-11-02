import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import type { EcriturePaie, ModificationPaie } from "@/types";
import type { DonneesPaie } from "./PaieEmploye";
import { TableEcriture } from "./commun";

const SOURCES: Record<string, string> = { paie: "Paie", remise_das: "Remise DAS", annulation: "Annulation" };
const TABLES: Record<string, string> = { paies: "Paie", employes: "Employé", remises_das: "Remise DAS", paie_parametres: "Paramètres" };

function resume(m: ModificationPaie) {
  if (m.action === "modification" && m.avant && m.apres) {
    const changes = Object.keys(m.apres).filter((k) =>
      !["updated_at", "created_at"].includes(k) && String(m.avant![k] ?? "") !== String(m.apres![k] ?? "") &&
      Number(m.avant![k]) !== Number(m.apres![k]));
    return changes.length ? changes.map((k) => `${k} : ${m.avant![k] ?? "–"} → ${m.apres![k] ?? "–"}`).join(" · ") : "aucun changement de valeur";
  }
  const v = m.apres ?? m.avant;
  if (!v) return "";
  return ["date_paie", "prenom", "nom", "mois", "palier", "total", "statut", "brut"]
    .filter((k) => v[k] != null).map((k) => `${k} : ${v[k]}`).join(" · ");
}

export default function JournalPaie(d: DonneesPaie) {
  const [ecritures, setEcritures] = useState<EcriturePaie[] | null>(null);
  const [modifs, setModifs] = useState<ModificationPaie[] | null>(null);

  useEffect(() => {
    api.get<EcriturePaie[]>(`/api/paie/journal?annee=${d.annee}`).then(setEcritures).catch(() => setEcritures([]));
    api.get<ModificationPaie[]>("/api/paie/journal?modifications=1").then(setModifs).catch(() => setModifs([]));
  }, [d.annee, d.paies, d.das]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Écritures de paie {d.annee}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {ecritures === null && <p className="text-sm text-muted-foreground">Chargement…</p>}
          {ecritures?.length === 0 && <p className="text-sm text-muted-foreground">Aucune écriture comptabilisée.</p>}
          {ecritures?.map((e) => (
            <div key={e.id} className={`rounded-md border p-3 ${e.annulee ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-mono text-sm">#{e.id}</span>
                <span className="font-medium">{e.date_ecriture}</span>
                <Badge variant="outline">{SOURCES[e.source]}</Badge>
                {e.annulee && <Badge variant="destructive">Annulée</Badge>}
                <span className="text-sm">{e.libelle}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">Par {e.created_by ?? "?"} le {new Date(e.created_at).toLocaleString("fr-CA")}</p>
              <TableEcriture lignes={e.lignes.map(({ banque, ...l }) => ({ ...l, banqueNom: banque }))} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Journal des modifications</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {modifs?.length === 0 && <p className="text-sm text-muted-foreground">Aucune modification.</p>}
          {!!modifs?.length && (
            <Table className="text-sm">
              <TableHeader>
                <TableRow><TableHead>Date</TableHead><TableHead>Qui</TableHead><TableHead>Quoi</TableHead><TableHead>Action</TableHead><TableHead>Détail</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {modifs.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap">{new Date(m.created_at).toLocaleString("fr-CA")}</TableCell>
                    <TableCell>{m.utilisateur}</TableCell>
                    <TableCell className="whitespace-nowrap">{TABLES[m.table_nom] ?? m.table_nom}{m.enregistrement_id ? ` #${m.enregistrement_id}` : ""}</TableCell>
                    <TableCell>{m.action}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xl">{resume(m)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

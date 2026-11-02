import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { equilibre, NOMS_COMPTES, STATUTS_PAIE, type LigneEcriture } from "@/lib/paieCalcul";
import { fmt } from "@/lib/paieAffichage";
import type { StatutPaie } from "@/types";

const VARIANTES: Record<StatutPaie, "secondary" | "outline" | "default"> = {
  brouillon: "outline",
  validee: "secondary",
  comptabilisee: "default",
  das_payees: "default",
};

export function BadgeStatut({ statut }: { statut: StatutPaie }) {
  return (
    <Badge variant={VARIANTES[statut]} className={statut === "das_payees" ? "bg-green-700" : ""}>
      {STATUTS_PAIE[statut]}
    </Badge>
  );
}

export function TableEcriture({ lignes, banque }: { lignes: (LigneEcriture & { nom?: string; banqueNom?: string | null })[]; banque?: string | null }) {
  const eq = equilibre(lignes);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Compte</TableHead>
          <TableHead className="text-right">Débit</TableHead>
          <TableHead className="text-right">Crédit</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lignes.map((l, i) => (
          <TableRow key={i}>
            <TableCell className={l.credit ? "pl-8" : ""}>
              {l.compte} – {l.nom ?? NOMS_COMPTES[l.compte]}
              {l.compte === "1010" && (l.banqueNom ?? banque) && (
                <span className="text-xs text-muted-foreground"> ({l.banqueNom ?? banque})</span>
              )}
            </TableCell>
            <TableCell className="text-right font-mono">{l.debit ? fmt(l.debit) : ""}</TableCell>
            <TableCell className="text-right font-mono">{l.credit ? fmt(l.credit) : ""}</TableCell>
          </TableRow>
        ))}
        <TableRow className="font-semibold">
          <TableCell>
            Total {eq.equilibre ? "" : <span className="text-red-700">— déséquilibrée</span>}
          </TableCell>
          <TableCell className="text-right font-mono">{fmt(eq.debit)}</TableCell>
          <TableCell className="text-right font-mono">{fmt(eq.credit)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

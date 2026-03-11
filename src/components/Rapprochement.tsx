import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckSquare, Save, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { CompteBancaire } from "@/types";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(
    n,
  );

interface RapprocheTransaction {
  id: number;
  date_transaction: string;
  description: string;
  type: "dépense" | "revenu" | "transfert";
  total_ttc: number;
  rapproche: boolean;
  date_rapprochement: string | null;
  categorie_nom: string | null;
  projet_code: string | null;
  contact_nom: string | null;
}

interface Aggregates {
  credits_rapproches: number;
  debits_rapproches: number;
  credits_en_attente: number;
  debits_en_attente: number;
}

export default function Rapprochement() {
  const [comptes, setComptes] = useState<CompteBancaire[]>([]);
  const [compteId, setCompteId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [soldeReleve, setSoldeReleve] = useState<string>("");

  const [rows, setRows] = useState<RapprocheTransaction[]>([]);
  const [aggregates, setAggregates] = useState<Aggregates | null>(null);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<CompteBancaire[]>("/api/comptes").then(setComptes);
  }, []);

  const fetchData = async () => {
    if (!compteId || !dateFrom || !dateTo) return;
    setLoading(true);
    try {
      const data = await api.get<{
        rows: RapprocheTransaction[];
        aggregates: Aggregates;
      }>(
        `/api/rapprochement?compte_id=${compteId}&from=${dateFrom}&to=${dateTo}`,
      );
      setRows(data.rows);
      setAggregates(data.aggregates);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (compteId) fetchData();
  }, [compteId, dateFrom, dateTo]);

  const toggleRapproche = async (txId: number, currentValue: boolean) => {
    setToggling(txId);
    try {
      await api.put("/api/rapprochement", {
        transaction_id: txId,
        rapproche: !currentValue,
      });
      setRows((prev) =>
        prev.map((r) =>
          r.id === txId
            ? {
                ...r,
                rapproche: !currentValue,
                date_rapprochement: !currentValue
                  ? new Date().toISOString().split("T")[0]
                  : null,
              }
            : r,
        ),
      );
      // Recalculate aggregates locally
      setAggregates((prev) => {
        if (!prev) return prev;
        const tx = rows.find((r) => r.id === txId);
        if (!tx) return prev;
        const amount = Number(tx.total_ttc);
        const isRevenu = tx.type === "revenu";
        const wasRapproche = currentValue;

        if (wasRapproche) {
          // Un-reconciling
          return {
            ...prev,
            credits_rapproches: isRevenu
              ? Number(prev.credits_rapproches) - amount
              : Number(prev.credits_rapproches),
            debits_rapproches: !isRevenu
              ? Number(prev.debits_rapproches) - amount
              : Number(prev.debits_rapproches),
            credits_en_attente: isRevenu
              ? Number(prev.credits_en_attente) + amount
              : Number(prev.credits_en_attente),
            debits_en_attente: !isRevenu
              ? Number(prev.debits_en_attente) + amount
              : Number(prev.debits_en_attente),
          };
        } else {
          // Reconciling
          return {
            ...prev,
            credits_rapproches: isRevenu
              ? Number(prev.credits_rapproches) + amount
              : Number(prev.credits_rapproches),
            debits_rapproches: !isRevenu
              ? Number(prev.debits_rapproches) + amount
              : Number(prev.debits_rapproches),
            credits_en_attente: isRevenu
              ? Number(prev.credits_en_attente) - amount
              : Number(prev.credits_en_attente),
            debits_en_attente: !isRevenu
              ? Number(prev.debits_en_attente) - amount
              : Number(prev.debits_en_attente),
          };
        }
      });
    } finally {
      setToggling(null);
    }
  };

  const soldeReleveNum = soldeReleve !== "" ? parseFloat(soldeReleve) : null;
  const soldeRapproche = aggregates
    ? Number(aggregates.credits_rapproches) -
      Number(aggregates.debits_rapproches)
    : 0;
  const ecart = soldeReleveNum !== null ? soldeReleveNum - soldeRapproche : 0;

  const handleSaveSession = async () => {
    if (!compteId || soldeReleveNum === null) return;
    setSaving(true);
    try {
      await api.post("/api/rapprochement", {
        compte_id: Number(compteId),
        date_releve: dateTo,
        solde_releve: soldeReleveNum,
        solde_systeme: soldeRapproche,
        ecart,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Rapprochement bancaire
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label>Compte</Label>
              <Select value={compteId} onValueChange={setCompteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un compte..." />
                </SelectTrigger>
                <SelectContent>
                  {comptes.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Du</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Au</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Solde du relevé bancaire</Label>
              <Input
                type="number"
                step="0.01"
                value={soldeReleve}
                onChange={(e) => setSoldeReleve(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary bar */}
      {aggregates && compteId && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground">
                Crédits rapprochés
              </p>
              <p className="font-bold text-green-700">
                {fmt(Number(aggregates.credits_rapproches))}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground">Débits rapprochés</p>
              <p className="font-bold text-red-700">
                {fmt(Number(aggregates.debits_rapproches))}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground">Solde rapproché</p>
              <p className="font-bold">{fmt(soldeRapproche)}</p>
            </CardContent>
          </Card>
          <Card
            className={
              Math.abs(ecart) < 0.01 ? "border-green-300" : "border-red-300"
            }
          >
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground">Écart</p>
              <p
                className={`font-bold ${Math.abs(ecart) < 0.01 ? "text-green-700" : "text-red-700"}`}
              >
                {fmt(ecart)}
              </p>
              {Math.abs(ecart) < 0.01 && soldeReleveNum !== null && (
                <Badge variant="default" className="mt-1 bg-green-600">
                  Équilibré
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transaction table */}
      {compteId && (
        <Card>
          <CardContent className="pt-4">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">
                Chargement...
              </p>
            ) : rows.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                Aucune transaction pour cette période.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead className="text-right">Débit</TableHead>
                        <TableHead className="text-right">Crédit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((tx) => (
                        <TableRow
                          key={tx.id}
                          className={tx.rapproche ? "bg-green-50" : ""}
                        >
                          <TableCell>
                            {toggling === tx.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Checkbox
                                checked={tx.rapproche}
                                onCheckedChange={() =>
                                  toggleRapproche(tx.id, tx.rapproche)
                                }
                              />
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {tx.date_transaction}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {tx.description}
                            {tx.projet_code && (
                              <Badge variant="outline" className="ml-1 text-xs">
                                {tx.projet_code}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {tx.contact_nom}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-700">
                            {tx.type === "dépense"
                              ? fmt(Number(tx.total_ttc))
                              : ""}
                          </TableCell>
                          <TableCell className="text-right font-mono text-green-700">
                            {tx.type === "revenu"
                              ? fmt(Number(tx.total_ttc))
                              : ""}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {rows.filter((r) => r.rapproche).length} / {rows.length}{" "}
                    rapprochée(s)
                  </p>
                  <div className="flex items-center gap-2">
                    {saved && (
                      <span className="text-sm text-green-600">
                        Session enregistrée
                      </span>
                    )}
                    <Button
                      onClick={handleSaveSession}
                      disabled={saving || soldeReleveNum === null}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saving
                        ? "Enregistrement..."
                        : "Valider le rapprochement"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  Paperclip,
  Copy,
  CheckCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import type {
  Transaction,
  Category,
  Projet,
  CompteBancaire,
  LigneFacture,
} from "@/types";
import TransactionForm from "./TransactionForm";
import DuplicateReview from "./DuplicateReview";
import { generateFacturePDF } from "@/lib/generateFacturePDF";
import * as XLSX from "xlsx";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(
    n,
  );

const PAGE_SIZE = 25;

type SortField =
  | "date_transaction"
  | "total_ttc"
  | "projet_code"
  | "categorie_nom"
  | "description";
type SortDir = "asc" | "desc";

export default function TransactionList() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterProjet, setFilterProjet] = useState("");
  const [filterCategorie, setFilterCategorie] = useState("");
  const [filterCompte, setFilterCompte] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [projets, setProjets] = useState<Projet[]>([]);
  const [comptes, setComptes] = useState<CompteBancaire[]>([]);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [sortField, setSortField] = useState<SortField>("date_transaction");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    Promise.all([
      api.get<Category[]>("/api/categories"),
      api.get<Projet[]>("/api/projets"),
      api.get<CompteBancaire[]>("/api/comptes"),
    ]).then(([c, p, cpt]) => {
      setCategories(c);
      setProjets(p);
      setComptes(cpt);
    });
  }, []);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(
        field === "date_transaction" || field === "total_ttc" ? "desc" : "asc",
      );
    }
    setPage(0);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1" />
    );
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", PAGE_SIZE.toString());
    params.set("offset", (page * PAGE_SIZE).toString());
    if (search) params.set("q", search);
    if (filterProjet) params.set("projet", filterProjet);
    if (filterCategorie) params.set("categorie", filterCategorie);
    if (filterCompte) params.set("compte", filterCompte);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    params.set("sort", sortField);
    params.set("dir", sortDir);

    try {
      const data = await api.get<{ rows: Transaction[]; total: number }>(
        `/api/transactions?${params}`,
      );
      setRows(data.rows);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    search,
    filterProjet,
    filterCategorie,
    filterCompte,
    dateFrom,
    dateTo,
    sortField,
    sortDir,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (tx: Transaction) => {
    const message = tx.id_transfert
      ? "Cette transaction est un transfert : les DEUX écritures liées seront supprimées. Continuer ?"
      : "Supprimer cette transaction ?";
    if (!confirm(message)) return;
    await api.delete(`/api/transactions?id=${tx.id}`);
    fetchData();
  };

  const handleDownloadInvoice = (tx: Transaction) => {
    const lignes: LigneFacture[] = tx.lignes_facture
      ? JSON.parse(tx.lignes_facture)
      : [
          {
            description: tx.description || "Services",
            unite: 1,
            cout_unitaire: Number(tx.montant_ht) || 0,
            montant: Number(tx.montant_ht) || Number(tx.total_ttc),
          },
        ];
    const doc = generateFacturePDF({
      numero_facture: tx.numero_facture || `JAXA-${tx.id}`,
      date_facture: tx.date_transaction,
      client_nom: tx.contact_nom || "Client",
      client_adresse: tx.contact_adresse || null,
      client_telephone: tx.contact_telephone || null,
      projet_nom: tx.projet_nom || null,
      lignes,
      sous_total:
        Number(tx.montant_ht) ||
        Number(tx.total_ttc) - Number(tx.tps) - Number(tx.tvq),
      tps: Number(tx.tps),
      tvq: Number(tx.tvq),
      total_ttc: Number(tx.total_ttc),
    });
    doc.save(`Facture_${tx.numero_facture || tx.id}.pdf`);
  };

  const exportExcel = () => {
    const MONEY_FMT = '#,##0.00 $';
    const headers = [
      "Date", "N° pièce", "Type", "Description", "Catégorie", "Projet",
      "Fournisseur / Client", "Compte bancaire", "Revenus HT",
      "Dépenses HT", "TPS (5 %)", "TVQ (9,975 %)", "Total TTC",
      "Mode de paiement",
    ];
    const aoa: (string | number | null)[][] = [headers];
    const firstDataRow = 2;

    for (const r of rows) {
      const isRevenu = r.type === "revenu";
      const ht = Number(r.montant_ht) || 0;
      const tps = Number(r.tps) || 0;
      const tvq = Number(r.tvq) || 0;
      aoa.push([
        r.date_transaction?.slice(0, 10) || "",
        r.numero || "",
        r.type,
        r.description || "",
        r.categorie_nom || "",
        r.projet_code || "",
        r.contact_nom || "",
        r.compte_nom || "",
        isRevenu ? ht : null,
        !isRevenu ? ht : null,
        tps || null,
        tvq || null,
        0,
        r.mode_paiement || "",
      ]);
    }

    const lastDataRow = firstDataRow + rows.length - 1;
    const totalRow = lastDataRow + 2;

    aoa.push([]);
    aoa.push([
      "TOTAUX", null, null, null, null, null, null, null,
      0, 0, 0, 0, 0, null,
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    for (let i = 0; i < rows.length; i++) {
      const r = firstDataRow + i;
      ws[`M${r}`] = { t: "n", f: `N(I${r})+N(J${r})+N(K${r})+N(L${r})` };
    }

    ws[`I${totalRow}`] = { t: "n", f: `SUMIF(C${firstDataRow}:C${lastDataRow},"revenu",I${firstDataRow}:I${lastDataRow})` };
    ws[`J${totalRow}`] = { t: "n", f: `SUMIF(C${firstDataRow}:C${lastDataRow},"dépense",J${firstDataRow}:J${lastDataRow})` };
    ws[`K${totalRow}`] = { t: "n", f: `SUM(K${firstDataRow}:K${lastDataRow})` };
    ws[`L${totalRow}`] = { t: "n", f: `SUM(L${firstDataRow}:L${lastDataRow})` };
    ws[`M${totalRow}`] = { t: "n", f: `SUM(M${firstDataRow}:M${lastDataRow})` };

    for (const col of ["I", "J", "K", "L", "M"]) {
      for (let r = firstDataRow; r <= totalRow; r++) {
        const cell = ws[`${col}${r}`];
        if (cell && (cell.t === "n" || cell.f)) cell.z = MONEY_FMT;
      }
    }

    ws["!cols"] = [
      { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 55 }, { wch: 25 },
      { wch: 15 }, { wch: 30 }, { wch: 28 }, { wch: 14 }, { wch: 14 },
      { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(
      wb,
      `transactions_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <CardTitle>Transactions ({total})</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDuplicates(true)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Doublons
              </Button>
              <Button variant="outline" size="sm" onClick={exportExcel}>
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 min-w-0">
          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="relative col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                className="pl-9"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <Select
              value={filterProjet}
              onValueChange={(v) => {
                setFilterProjet(v === "all" ? "" : v);
                setPage(0);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Projet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les projets</SelectItem>
                {projets.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterCategorie}
              onValueChange={(v) => {
                setFilterCategorie(v === "all" ? "" : v);
                setPage(0);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(0);
              }}
              placeholder="Du"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(0);
              }}
              placeholder="Au"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => toggleSort("date_transaction")}
                  >
                    <span className="flex items-center">
                      Date
                      <SortIcon field="date_transaction" />
                    </span>
                  </TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => toggleSort("description")}
                  >
                    <span className="flex items-center">
                      Description
                      <SortIcon field="description" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => toggleSort("projet_code")}
                  >
                    <span className="flex items-center">
                      Projet
                      <SortIcon field="projet_code" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => toggleSort("categorie_nom")}
                  >
                    <span className="flex items-center">
                      Catégorie
                      <SortIcon field="categorie_nom" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none"
                    onClick={() => toggleSort("total_ttc")}
                  >
                    <span className="flex items-center justify-end">
                      Total TTC
                      <SortIcon field="total_ttc" />
                    </span>
                  </TableHead>
                  <TableHead>Compte</TableHead>
                  <TableHead className="w-[120px] min-w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Aucune transaction
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap">
                        {tx.date_transaction}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            tx.type === "revenu"
                              ? "default"
                              : tx.type === "dépense"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {tx.description}
                      </TableCell>
                      <TableCell>
                        {tx.projet_code && (
                          <Badge variant="outline">{tx.projet_code}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {tx.categorie_nom}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${tx.type === "revenu" ? "text-green-700" : "text-red-700"}`}
                      >
                        {fmt(Number(tx.total_ttc))}
                      </TableCell>
                      <TableCell className="text-sm">{tx.compte_nom}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex gap-1">
                          {(tx as Record<string, unknown>).rapproche && (
                            <CheckCircle
                              className="h-3.5 w-3.5 text-green-500"
                              title="Rapprochée"
                            />
                          )}
                          {tx.piece_jointe_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-amber-600"
                              title="Voir le reçu"
                              onClick={() =>
                                window.open(
                                  `/api/upload?key=${encodeURIComponent(tx.piece_jointe_url!)}`,
                                  "_blank",
                                )
                              }
                            >
                              <Paperclip className="h-3 w-3" />
                            </Button>
                          )}
                          {tx.type === "revenu" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-600"
                              title="Télécharger facture PDF"
                              onClick={() => handleDownloadInvoice(tx)}
                            >
                              <FileText className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditTx(tx)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-600"
                            onClick={() => handleDelete(tx)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {page + 1} / {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editTx} onOpenChange={() => setEditTx(null)}>
        <DialogContent className="sm:max-w-2xl w-[calc(100%-1rem)] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Modifier la transaction</DialogTitle>
          </DialogHeader>
          {editTx && (
            <TransactionForm
              embedded
              editId={editTx.id}
              initialData={{
                date_transaction: editTx.date_transaction,
                type: editTx.type,
                description: editTx.description || "",
                categorie_id: editTx.categorie_id,
                projet_id: editTx.projet_id,
                contact_id: editTx.contact_id,
                compte_id: editTx.compte_id,
                mode_paiement: editTx.mode_paiement || "Mastercard",
                montant_ht: Number(editTx.montant_ht) || 0,
                tps: Number(editTx.tps),
                tvq: Number(editTx.tvq),
                total_ttc: Number(editTx.total_ttc),
                taxable: editTx.taxable,
                numero_facture: editTx.numero_facture || "",
                notes: editTx.notes || "",
                ocr_source: editTx.ocr_source,
                piece_jointe_url: editTx.piece_jointe_url || "",
              }}
              onSaved={() => {
                setEditTx(null);
                fetchData();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Duplicate Review Dialog */}
      <Dialog open={showDuplicates} onOpenChange={setShowDuplicates}>
        <DialogContent className="sm:max-w-2xl w-[calc(100%-1rem)] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Détection de doublons</DialogTitle>
          </DialogHeader>
          {showDuplicates && (
            <DuplicateReview
              onClose={() => setShowDuplicates(false)}
              onDeleted={fetchData}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

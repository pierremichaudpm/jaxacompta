import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ChevronLeft, ChevronRight, Pencil, Trash2, Download } from 'lucide-react';
import { api } from '@/lib/api';
import type { Transaction, Category, Projet, CompteBancaire } from '@/types';
import TransactionForm from './TransactionForm';
import * as XLSX from 'xlsx';

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n);

const PAGE_SIZE = 25;

export default function TransactionList() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterProjet, setFilterProjet] = useState('');
  const [filterCategorie, setFilterCategorie] = useState('');
  const [filterCompte, setFilterCompte] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [projets, setProjets] = useState<Projet[]>([]);
  const [comptes, setComptes] = useState<CompteBancaire[]>([]);
  const [editTx, setEditTx] = useState<Transaction | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Category[]>('/api/categories'),
      api.get<Projet[]>('/api/projets'),
      api.get<CompteBancaire[]>('/api/comptes'),
    ]).then(([c, p, cpt]) => {
      setCategories(c);
      setProjets(p);
      setComptes(cpt);
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('limit', PAGE_SIZE.toString());
    params.set('offset', (page * PAGE_SIZE).toString());
    if (search) params.set('q', search);
    if (filterProjet) params.set('projet', filterProjet);
    if (filterCategorie) params.set('categorie', filterCategorie);
    if (filterCompte) params.set('compte', filterCompte);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);

    try {
      const data = await api.get<{ rows: Transaction[]; total: number }>(`/api/transactions?${params}`);
      setRows(data.rows);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterProjet, filterCategorie, filterCompte, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette transaction ?')) return;
    await api.delete(`/api/transactions?id=${id}`);
    fetchData();
  };

  const exportExcel = () => {
    const data = rows.map(r => ({
      Date: r.date_transaction,
      Type: r.type,
      Description: r.description,
      Catégorie: r.categorie_nom,
      Projet: r.projet_code,
      Contact: r.contact_nom,
      Compte: r.compte_nom,
      'Montant HT': r.montant_ht,
      TPS: r.tps,
      TVQ: r.tvq,
      'Total TTC': r.total_ttc,
      Paiement: r.mode_paiement,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, `transactions_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <CardTitle>Transactions ({total})</CardTitle>
            <Button variant="outline" size="sm" onClick={exportExcel}>
              <Download className="h-4 w-4 mr-2" />Export Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="relative col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." className="pl-9" value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }} />
            </div>
            <Select value={filterProjet} onValueChange={v => { setFilterProjet(v === 'all' ? '' : v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Projet" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les projets</SelectItem>
                {projets.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.code}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCategorie} onValueChange={v => { setFilterCategorie(v === 'all' ? '' : v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.nom}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} placeholder="Du" />
            <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} placeholder="Au" />
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Projet</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">Total TTC</TableHead>
                  <TableHead>Compte</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucune transaction</TableCell></TableRow>
                ) : rows.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell className="whitespace-nowrap">{tx.date_transaction}</TableCell>
                    <TableCell>
                      <Badge variant={tx.type === 'revenu' ? 'default' : tx.type === 'dépense' ? 'destructive' : 'secondary'}>
                        {tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{tx.description}</TableCell>
                    <TableCell>{tx.projet_code && <Badge variant="outline">{tx.projet_code}</Badge>}</TableCell>
                    <TableCell className="text-sm">{tx.categorie_nom}</TableCell>
                    <TableCell className={`text-right font-mono ${tx.type === 'revenu' ? 'text-green-700' : 'text-red-700'}`}>
                      {fmt(Number(tx.total_ttc))}
                    </TableCell>
                    <TableCell className="text-sm">{tx.compte_nom}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditTx(tx)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => handleDelete(tx.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editTx} onOpenChange={() => setEditTx(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier la transaction</DialogTitle>
          </DialogHeader>
          {editTx && (
            <TransactionForm
              editId={editTx.id}
              initialData={{
                date_transaction: editTx.date_transaction,
                type: editTx.type,
                description: editTx.description || '',
                categorie_id: editTx.categorie_id,
                projet_id: editTx.projet_id,
                contact_id: editTx.contact_id,
                compte_id: editTx.compte_id,
                mode_paiement: editTx.mode_paiement || 'Mastercard',
                montant_ht: Number(editTx.montant_ht) || 0,
                tps: Number(editTx.tps),
                tvq: Number(editTx.tvq),
                total_ttc: Number(editTx.total_ttc),
                taxable: editTx.taxable,
                numero_facture: editTx.numero_facture || '',
                notes: editTx.notes || '',
                ocr_source: editTx.ocr_source,
              }}
              onSaved={() => { setEditTx(null); fetchData(); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import type { Projet, Transaction } from '@/types';
import { FolderOpen } from 'lucide-react';

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n);

export default function ProjetList() {
  const [projets, setProjets] = useState<Projet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjet, setSelectedProjet] = useState<Projet | null>(null);
  const [projetTx, setProjetTx] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  useEffect(() => {
    api.get<Projet[]>('/api/projets').then(setProjets).finally(() => setLoading(false));
  }, []);

  const openProjet = async (p: Projet) => {
    setSelectedProjet(p);
    setLoadingTx(true);
    try {
      const data = await api.get<{ rows: Transaction[]; total: number }>(
        `/api/transactions?projet=${p.id}&limit=200`
      );
      setProjetTx(data.rows);
    } finally {
      setLoadingTx(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Chargement...</p></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Projets ({projets.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {projets.map(p => {
              const rev = Number(p.revenus || 0);
              const dep = Number(p.depenses || 0);
              const marge = rev - dep;
              const pct = rev > 0 ? (marge / rev) * 100 : 0;
              return (
                <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => openProjet(p)}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-lg">{p.code}</span>
                      <Badge variant={p.statut === 'En cours' ? 'default' : 'secondary'}>{p.statut}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{p.nom}</p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Revenus</p>
                        <p className="font-mono text-green-700">{fmt(rev)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Dépenses</p>
                        <p className="font-mono text-red-700">{fmt(dep)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Marge</p>
                        <p className={`font-mono ${marge >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {pct.toFixed(0)}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedProjet} onOpenChange={() => setSelectedProjet(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedProjet?.code} — {selectedProjet?.nom}</DialogTitle>
          </DialogHeader>
          {loadingTx ? (
            <p className="text-muted-foreground py-4">Chargement...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Total TTC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projetTx.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Aucune transaction</TableCell></TableRow>
                ) : projetTx.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell>{tx.date_transaction}</TableCell>
                    <TableCell>
                      <Badge variant={tx.type === 'revenu' ? 'default' : 'destructive'}>{tx.type}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{tx.description}</TableCell>
                    <TableCell>{tx.contact_nom}</TableCell>
                    <TableCell className={`text-right font-mono ${tx.type === 'revenu' ? 'text-green-700' : 'text-red-700'}`}>
                      {fmt(Number(tx.total_ttc))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, Download } from 'lucide-react';
import { api } from '@/lib/api';
import type { Transaction, Projet, CompteBancaire } from '@/types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n);

type ReportType = 'mensuel' | 'trimestriel-taxes' | 'projet' | 'annuel';

export default function Rapports() {
  const [reportType, setReportType] = useState<ReportType>('mensuel');
  const [mois, setMois] = useState(new Date().toISOString().slice(0, 7));
  const [trimestre, setTrimestre] = useState('Q1');
  const [annee, setAnnee] = useState(new Date().getFullYear().toString());
  const [projetId, setProjetId] = useState('');
  const [compte, setCompte] = useState('');
  const [projets, setProjets] = useState<Projet[]>([]);
  const [comptes, setComptes] = useState<CompteBancaire[]>([]);
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Projet[]>('/api/projets'),
      api.get<CompteBancaire[]>('/api/comptes'),
    ]).then(([p, c]) => { setProjets(p); setComptes(c); });
  }, []);

  const generate = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: reportType });
      if (reportType === 'mensuel') {
        params.set('mois', mois);
        if (compte) params.set('compte', compte);
      }
      if (reportType === 'trimestriel-taxes') {
        params.set('trimestre', trimestre);
        params.set('annee', annee);
      }
      if (reportType === 'projet') params.set('projet_id', projetId);
      if (reportType === 'annuel') params.set('annee', annee);

      const result = await api.get(`/api/rapports?${params}`);
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('JAXA Production Inc. — Rapport', 14, 20);
    doc.setFontSize(10);
    doc.text(`Type: ${reportType} | Généré le ${new Date().toLocaleDateString('fr-CA')}`, 14, 28);

    const d = data as Record<string, unknown>;

    if (d.rows && Array.isArray(d.rows)) {
      autoTable(doc, {
        startY: 35,
        head: [['Date', 'Description', 'Type', 'Catégorie', 'Total TTC']],
        body: (d.rows as Transaction[]).map(r => [
          r.date_transaction, r.description || '', r.type, r.categorie_nom || '', fmt(Number(r.total_ttc))
        ]),
      });
    }

    if (d.totaux) {
      const t = d.totaux as Record<string, number>;
      const y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 40;
      doc.setFontSize(11);
      if (t.revenus !== undefined) doc.text(`Revenus: ${fmt(Number(t.revenus))}`, 14, y + 10);
      if (t.depenses !== undefined) doc.text(`Dépenses: ${fmt(Number(t.depenses))}`, 14, y + 17);
      if (t.tps_percue !== undefined) {
        doc.text(`TPS perçue: ${fmt(Number(t.tps_percue))} | TPS payée: ${fmt(Number(t.tps_payee))}`, 14, y + 24);
        doc.text(`TVQ perçue: ${fmt(Number(t.tvq_percue))} | TVQ payée: ${fmt(Number(t.tvq_payee))}`, 14, y + 31);
        doc.text(`TPS nette: ${fmt(Number(t.tps_percue) - Number(t.tps_payee))}`, 14, y + 38);
        doc.text(`TVQ nette: ${fmt(Number(t.tvq_percue) - Number(t.tvq_payee))}`, 14, y + 45);
      }
    }

    doc.save(`rapport_${reportType}_${mois || annee}.pdf`);
  };

  const exportExcel = () => {
    if (!data) return;
    const d = data as Record<string, unknown>;
    const wb = XLSX.utils.book_new();

    if (d.rows && Array.isArray(d.rows)) {
      const ws = XLSX.utils.json_to_sheet((d.rows as Transaction[]).map(r => ({
        Date: r.date_transaction, Type: r.type, Description: r.description,
        Catégorie: r.categorie_nom, Contact: r.contact_nom,
        'Montant HT': r.montant_ht, TPS: r.tps, TVQ: r.tvq, 'Total TTC': r.total_ttc,
      })));
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    }

    if (d.parCategorie && Array.isArray(d.parCategorie)) {
      const ws = XLSX.utils.json_to_sheet(d.parCategorie as Record<string, unknown>[]);
      XLSX.utils.book_append_sheet(wb, ws, 'Par catégorie');
    }

    if (d.parMois && Array.isArray(d.parMois)) {
      const ws = XLSX.utils.json_to_sheet(d.parMois as Record<string, unknown>[]);
      XLSX.utils.book_append_sheet(wb, ws, 'Par mois');
    }

    XLSX.writeFile(wb, `rapport_${reportType}_${mois || annee}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Rapports
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="text-sm font-medium">Type</label>
              <Select value={reportType} onValueChange={v => setReportType(v as ReportType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensuel">Mensuel</SelectItem>
                  <SelectItem value="trimestriel-taxes">Trimestriel taxes</SelectItem>
                  <SelectItem value="projet">Par projet</SelectItem>
                  <SelectItem value="annuel">Annuel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reportType === 'mensuel' && (
              <>
                <div>
                  <label className="text-sm font-medium">Mois</label>
                  <Input type="month" value={mois} onChange={e => setMois(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium">Compte (optionnel)</label>
                  <Select value={compte} onValueChange={v => setCompte(v === 'all' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      {comptes.map(c => <SelectItem key={c.id} value={c.code}>{c.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {reportType === 'trimestriel-taxes' && (
              <>
                <div>
                  <label className="text-sm font-medium">Trimestre</label>
                  <Select value={trimestre} onValueChange={setTrimestre}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Q1">T1 (Jan-Mar)</SelectItem>
                      <SelectItem value="Q2">T2 (Avr-Jun)</SelectItem>
                      <SelectItem value="Q3">T3 (Jul-Sep)</SelectItem>
                      <SelectItem value="Q4">T4 (Oct-Déc)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Année</label>
                  <Input value={annee} onChange={e => setAnnee(e.target.value)} />
                </div>
              </>
            )}

            {reportType === 'projet' && (
              <div>
                <label className="text-sm font-medium">Projet</label>
                <Select value={projetId} onValueChange={setProjetId}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {projets.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.code} — {p.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {reportType === 'annuel' && (
              <div>
                <label className="text-sm font-medium">Année</label>
                <Input value={annee} onChange={e => setAnnee(e.target.value)} />
              </div>
            )}

            <Button onClick={generate} disabled={loading}>
              {loading ? 'Génération...' : 'Générer'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {data && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Résultats</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportPDF}>
                  <Download className="h-4 w-4 mr-2" />PDF
                </Button>
                <Button variant="outline" size="sm" onClick={exportExcel}>
                  <Download className="h-4 w-4 mr-2" />Excel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const d = data as Record<string, unknown>;

              // Totaux summary
              const totaux = d.totaux as Record<string, number> | undefined;

              return (
                <div className="space-y-4">
                  {totaux && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {totaux.revenus !== undefined && (
                        <div className="p-3 bg-green-50 rounded">
                          <p className="text-sm text-muted-foreground">Revenus</p>
                          <p className="text-lg font-bold text-green-700">{fmt(Number(totaux.revenus))}</p>
                        </div>
                      )}
                      {totaux.depenses !== undefined && (
                        <div className="p-3 bg-red-50 rounded">
                          <p className="text-sm text-muted-foreground">Dépenses</p>
                          <p className="text-lg font-bold text-red-700">{fmt(Number(totaux.depenses))}</p>
                        </div>
                      )}
                      {totaux.tps_percue !== undefined && (
                        <>
                          <div className="p-3 bg-blue-50 rounded">
                            <p className="text-sm text-muted-foreground">TPS nette</p>
                            <p className="text-lg font-bold">{fmt(Number(totaux.tps_percue) - Number(totaux.tps_payee))}</p>
                          </div>
                          <div className="p-3 bg-blue-50 rounded">
                            <p className="text-sm text-muted-foreground">TVQ nette</p>
                            <p className="text-lg font-bold">{fmt(Number(totaux.tvq_percue) - Number(totaux.tvq_payee))}</p>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {d.rows && Array.isArray(d.rows) && (d.rows as Transaction[]).length > 0 && (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Catégorie</TableHead>
                            <TableHead className="text-right">TTC</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(d.rows as Transaction[]).map((r) => (
                            <TableRow key={r.id}>
                              <TableCell>{r.date_transaction}</TableCell>
                              <TableCell><Badge variant={r.type === 'revenu' ? 'default' : 'destructive'}>{r.type}</Badge></TableCell>
                              <TableCell className="max-w-xs truncate">{r.description}</TableCell>
                              <TableCell>{r.categorie_nom}</TableCell>
                              <TableCell className={`text-right font-mono ${r.type === 'revenu' ? 'text-green-700' : 'text-red-700'}`}>
                                {fmt(Number(r.total_ttc))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {d.parCategorie && Array.isArray(d.parCategorie) && (
                    <div>
                      <h3 className="font-medium mb-2">Par catégorie</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Catégorie</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(d.parCategorie as { nom: string; type: string; total: number }[]).map((c, i) => (
                            <TableRow key={i}>
                              <TableCell>{c.nom}</TableCell>
                              <TableCell><Badge variant="outline">{c.type}</Badge></TableCell>
                              <TableCell className="text-right font-mono">{fmt(Number(c.total))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Check, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import { api } from '@/lib/api';
import type { Category, Projet, CompteBancaire, TransactionFormData } from '@/types';

interface CsvRow {
  [key: string]: string;
}

interface MappedRow {
  date_transaction: string;
  description: string;
  debit: number;
  credit: number;
  type: 'dépense' | 'revenu';
  categorie_id: number | null;
  projet_id: number | null;
  compte_id: number | null;
  selected: boolean;
}

export default function ImportCSV() {
  const [rawData, setRawData] = useState<CsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([]);
  const [colDate, setColDate] = useState('');
  const [colDesc, setColDesc] = useState('');
  const [colDebit, setColDebit] = useState('');
  const [colCredit, setColCredit] = useState('');
  const [selectedCompte, setSelectedCompte] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [projets, setProjets] = useState<Projet[]>([]);
  const [comptes, setComptes] = useState<CompteBancaire[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleFile = (file: File) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setRawData(results.data);
        const h = results.meta.fields || [];
        setHeaders(h);
        // Auto-detect columns
        const dateCols = h.filter(c => /date/i.test(c));
        const descCols = h.filter(c => /desc|libell|memo/i.test(c));
        const debitCols = h.filter(c => /debit|débit|retrait/i.test(c));
        const creditCols = h.filter(c => /credit|crédit|dépôt|depot/i.test(c));
        if (dateCols.length) setColDate(dateCols[0]);
        if (descCols.length) setColDesc(descCols[0]);
        if (debitCols.length) setColDebit(debitCols[0]);
        if (creditCols.length) setColCredit(creditCols[0]);
      },
    });
  };

  const applyMapping = () => {
    const mapped = rawData.map(row => {
      const debit = Math.abs(parseFloat(row[colDebit]?.replace(/[^0-9.-]/g, '') || '0'));
      const credit = Math.abs(parseFloat(row[colCredit]?.replace(/[^0-9.-]/g, '') || '0'));
      return {
        date_transaction: row[colDate] || '',
        description: row[colDesc] || '',
        debit,
        credit,
        type: (credit > 0 ? 'revenu' : 'dépense') as 'dépense' | 'revenu',
        categorie_id: null,
        projet_id: null,
        compte_id: selectedCompte ? Number(selectedCompte) : null,
        selected: true,
      };
    }).filter(r => r.date_transaction && (r.debit > 0 || r.credit > 0));
    setMappedRows(mapped);
  };

  const toggleRow = (idx: number) => {
    setMappedRows(prev => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r));
  };

  const updateRowField = (idx: number, field: keyof MappedRow, value: unknown) => {
    setMappedRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const handleImport = async () => {
    setImporting(true);
    const transactions: Partial<TransactionFormData>[] = mappedRows
      .filter(r => r.selected)
      .map(r => ({
        date_transaction: r.date_transaction,
        type: r.type,
        description: r.description,
        categorie_id: r.categorie_id,
        projet_id: r.projet_id,
        compte_id: r.compte_id,
        montant_ht: r.type === 'dépense' ? r.debit : r.credit,
        tps: 0,
        tvq: 0,
        total_ttc: r.type === 'dépense' ? r.debit : r.credit,
        taxable: false,
        mode_paiement: 'Virement',
      }));

    try {
      const res = await api.post<{ imported: number; errors: string[] }>('/api/import-csv', { transactions });
      setResult(res);
    } finally {
      setImporting(false);
    }
  };

  if (result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <Check className="h-5 w-5" />
            Import terminé
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p>{result.imported} transactions importées avec succès.</p>
          {result.errors.length > 0 && (
            <div>
              <p className="text-red-600 font-medium">{result.errors.length} erreurs :</p>
              {result.errors.map((e, i) => <p key={i} className="text-sm text-red-600">{e}</p>)}
            </div>
          )}
          <Button onClick={() => { setResult(null); setRawData([]); setMappedRows([]); }}>
            Importer un autre fichier
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Step 1: Upload */}
      {rawData.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importer un relevé CSV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <input ref={inputRef} type="file" accept=".csv" className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <Button onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />Choisir un fichier CSV
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {rawData.length > 0 && mappedRows.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mapper les colonnes ({rawData.length} lignes détectées)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="text-sm font-medium">Date</label>
                <Select value={colDate} onValueChange={setColDate}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Select value={colDesc} onValueChange={setColDesc}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Débit</label>
                <Select value={colDebit} onValueChange={setColDebit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Crédit</label>
                <Select value={colCredit} onValueChange={setColCredit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Compte</label>
                <Select value={selectedCompte} onValueChange={setSelectedCompte}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {comptes.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={applyMapping} disabled={!colDate || !colDesc}>Appliquer le mapping</Button>
              <Button variant="outline" onClick={() => setRawData([])}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview & Import */}
      {mappedRows.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Prévisualisation ({mappedRows.filter(r => r.selected).length}/{mappedRows.length} sélectionnées)</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMappedRows([])}>Retour au mapping</Button>
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Import...</> : <>
                    <Check className="h-4 w-4 mr-2" />Valider l'import</>}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Projet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappedRows.map((row, idx) => (
                    <TableRow key={idx} className={!row.selected ? 'opacity-40' : ''}>
                      <TableCell>
                        <input type="checkbox" checked={row.selected} onChange={() => toggleRow(idx)} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{row.date_transaction}</TableCell>
                      <TableCell className="max-w-xs truncate">{row.description}</TableCell>
                      <TableCell>
                        <Badge variant={row.type === 'revenu' ? 'default' : 'destructive'}>{row.type}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(row.type === 'dépense' ? row.debit : row.credit).toFixed(2)} $
                      </TableCell>
                      <TableCell>
                        <Select value={row.categorie_id?.toString() || ''}
                          onValueChange={v => updateRowField(idx, 'categorie_id', Number(v))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {categories.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.nom}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={row.projet_id?.toString() || ''}
                          onValueChange={v => updateRowField(idx, 'projet_id', Number(v))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {projets.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.code}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

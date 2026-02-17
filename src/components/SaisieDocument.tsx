import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUp, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { OcrResult, TransactionFormData } from '@/types';
import TransactionForm from './TransactionForm';

export default function SaisieDocument() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [ocrData, setOcrData] = useState<Partial<TransactionFormData> | null>(null);
  const [ocrConfidence, setOcrConfidence] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setFileName(file.name);
    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];

      try {
        const result = await api.post<OcrResult>('/api/ocr', {
          image: base64,
          mimeType: file.type,
        });
        setOcrData({
          date_transaction: result.date,
          description: `${result.fournisseur} — ${result.description}`,
          montant_ht: result.montant_ht,
          tps: result.tps,
          tvq: result.tvq,
          total_ttc: result.total_ttc,
          mode_paiement: result.mode_paiement,
          numero_facture: result.numero_recu,
          taxable: result.tps > 0 || result.tvq > 0,
          ocr_source: true,
          ocr_confiance: result.confiance,
          type: 'dépense',
        });
        setOcrConfidence(result.confiance);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur OCR");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const reset = () => {
    setFileName(null);
    setOcrData(null);
    setOcrConfidence(undefined);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {!ocrData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              Déposer un document
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={e => e.target.files?.[0] && processFile(e.target.files[0])}
                className="hidden"
              />
              <FileUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Glissez un PDF, JPG ou PNG ici, ou cliquez pour sélectionner
              </p>
            </div>

            {loading && (
              <div className="flex items-center gap-2 mt-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyse de {fileName}...
              </div>
            )}
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          </CardContent>
        </Card>
      )}

      {ocrData && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={reset}>Déposer un autre document</Button>
            {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
          </div>
          <TransactionForm initialData={ocrData} ocrConfidence={ocrConfidence} onSaved={reset} />
        </div>
      )}
    </div>
  );
}

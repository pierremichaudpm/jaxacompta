import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { OcrResult, TransactionFormData } from '@/types';
import TransactionForm from './TransactionForm';

export default function SaisiePhoto() {
  const [preview, setPreview] = useState<string | null>(null);
  const [ocrData, setOcrData] = useState<Partial<TransactionFormData> | null>(null);
  const [ocrConfidence, setOcrConfidence] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);

      const base64 = dataUrl.split(',')[1];
      const mimeType = file.type;

      setLoading(true);
      setError(null);
      try {
        const result = await api.post<OcrResult>('/api/ocr', { image: base64, mimeType });
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

  const reset = () => {
    setPreview(null);
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
              <Camera className="h-5 w-5" />
              Scanner un reçu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCapture}
              className="hidden"
              id="camera-input"
            />
            <div className="flex gap-3">
              <Button onClick={() => inputRef.current?.click()} disabled={loading}>
                <Camera className="h-4 w-4 mr-2" />
                Prendre une photo
              </Button>
              <Button variant="outline" onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (ev) => handleCapture(ev as unknown as React.ChangeEvent<HTMLInputElement>);
                input.click();
              }} disabled={loading}>
                Choisir depuis la galerie
              </Button>
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyse OCR en cours...
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {preview && (
              <img src={preview} alt="Reçu" className="max-w-sm rounded border" />
            )}
          </CardContent>
        </Card>
      )}

      {ocrData && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={reset}>Scanner un autre reçu</Button>
            {preview && <img src={preview} alt="Reçu" className="h-16 rounded border" />}
          </div>
          <TransactionForm initialData={ocrData} ocrConfidence={ocrConfidence} onSaved={reset} />
        </div>
      )}
    </div>
  );
}

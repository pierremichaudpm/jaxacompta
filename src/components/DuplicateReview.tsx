import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Trash2, X, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);

interface DuplicatePair {
  id1: number;
  date1: string;
  desc1: string;
  total1: number;
  type1: string;
  id2: number;
  date2: string;
  desc2: string;
  total2: number;
  type2: string;
}

interface Props {
  onClose: () => void;
  onDeleted?: () => void;
}

export default function DuplicateReview({ onClose, onDeleted }: Props) {
  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    api
      .get<DuplicatePair[]>("/api/duplicates?limit=50")
      .then(setPairs)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: number, pairIndex: number) => {
    if (!confirm("Supprimer cette transaction ?")) return;
    setDeleting(id);
    try {
      await api.delete(`/api/transactions?id=${id}`);
      setPairs((prev) => prev.filter((_, i) => i !== pairIndex));
      onDeleted?.();
    } finally {
      setDeleting(null);
    }
  };

  const handleIgnore = (pairIndex: number) => {
    setPairs((prev) => prev.filter((_, i) => i !== pairIndex));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Analyse en cours...</span>
      </div>
    );
  }

  if (pairs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Aucun doublon détecté.
        <div className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
      <p className="text-sm text-muted-foreground">
        <AlertTriangle className="h-4 w-4 inline mr-1 text-amber-500" />
        {pairs.length} paire(s) potentiellement en doublon
      </p>

      {pairs.map((pair, idx) => (
        <Card key={`${pair.id1}-${pair.id2}`} className="border-amber-200">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Transaction A */}
              <div className="space-y-1 p-3 rounded bg-slate-50">
                <div className="flex items-center justify-between">
                  <Badge variant={pair.type1 === "revenu" ? "default" : "destructive"}>
                    {pair.type1}
                  </Badge>
                  <span className="text-xs text-muted-foreground">#{pair.id1}</span>
                </div>
                <p className="text-sm font-medium">{pair.date1}</p>
                <p className="text-sm truncate">{pair.desc1}</p>
                <p className="font-mono font-bold">{fmt(Number(pair.total1))}</p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="mt-2 w-full"
                  disabled={deleting === pair.id1}
                  onClick={() => handleDelete(pair.id1, idx)}
                >
                  {deleting === pair.id1 ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Trash2 className="h-3 w-3 mr-1" />
                  )}
                  Supprimer A
                </Button>
              </div>

              {/* Transaction B */}
              <div className="space-y-1 p-3 rounded bg-slate-50">
                <div className="flex items-center justify-between">
                  <Badge variant={pair.type2 === "revenu" ? "default" : "destructive"}>
                    {pair.type2}
                  </Badge>
                  <span className="text-xs text-muted-foreground">#{pair.id2}</span>
                </div>
                <p className="text-sm font-medium">{pair.date2}</p>
                <p className="text-sm truncate">{pair.desc2}</p>
                <p className="font-mono font-bold">{fmt(Number(pair.total2))}</p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="mt-2 w-full"
                  disabled={deleting === pair.id2}
                  onClick={() => handleDelete(pair.id2, idx)}
                >
                  {deleting === pair.id2 ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Trash2 className="h-3 w-3 mr-1" />
                  )}
                  Supprimer B
                </Button>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full text-muted-foreground"
              onClick={() => handleIgnore(idx)}
            >
              <X className="h-3 w-3 mr-1" /> Ignorer cette paire
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

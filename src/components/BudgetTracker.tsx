import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, DollarSign } from "lucide-react";
import { api } from "@/lib/api";
import type { Category, Projet } from "@/types";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);

interface Budget {
  id: number;
  categorie_id: number;
  projet_id: number | null;
  annee: number;
  mois: number | null;
  montant: number;
  notes: string | null;
  categorie_nom: string;
  categorie_type: string;
  projet_code: string | null;
  projet_nom: string | null;
  depense_reelle: number;
}

const MOIS_NOMS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export default function BudgetTracker() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [annee, setAnnee] = useState(currentYear);
  const [mois, setMois] = useState<number | null>(currentMonth);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [projets, setProjets] = useState<Projet[]>([]);

  // Form state
  const [formCatId, setFormCatId] = useState<number | null>(null);
  const [formProjetId, setFormProjetId] = useState<number | null>(null);
  const [formMontant, setFormMontant] = useState(0);
  const [formNotes, setFormNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Category[]>("/api/categories"),
      api.get<Projet[]>("/api/projets"),
    ]).then(([c, p]) => {
      setCategories(c);
      setProjets(p);
    });
  }, []);

  const fetchBudgets = async () => {
    setLoading(true);
    const params = new URLSearchParams({ annee: annee.toString() });
    if (mois) params.set("mois", mois.toString());
    try {
      const data = await api.get<Budget[]>(`/api/budgets?${params}`);
      setBudgets(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, [annee, mois]);

  const handleAdd = async () => {
    if (!formCatId || !formMontant) return;
    setSaving(true);
    try {
      await api.post("/api/budgets", {
        categorie_id: formCatId,
        projet_id: formProjetId,
        annee,
        mois,
        montant: formMontant,
        notes: formNotes || null,
      });
      setShowAdd(false);
      setFormCatId(null);
      setFormProjetId(null);
      setFormMontant(0);
      setFormNotes("");
      fetchBudgets();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce budget ?")) return;
    await api.delete(`/api/budgets?id=${id}`);
    fetchBudgets();
  };

  const totalBudget = budgets.reduce((s, b) => s + Number(b.montant), 0);
  const totalDepense = budgets.reduce((s, b) => s + Number(b.depense_reelle), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Budgets
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={annee.toString()} onValueChange={(v) => setAnnee(Number(v))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={mois?.toString() || "annuel"}
                onValueChange={(v) => setMois(v === "annuel" ? null : Number(v))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annuel">Annuel</SelectItem>
                  {MOIS_NOMS.map((nom, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      {nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4 mr-1" /> Ajouter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary */}
          {budgets.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 rounded bg-slate-50">
                <p className="text-xs text-muted-foreground">Budget total</p>
                <p className="font-bold">{fmt(totalBudget)}</p>
              </div>
              <div className="text-center p-3 rounded bg-slate-50">
                <p className="text-xs text-muted-foreground">Dépensé</p>
                <p className="font-bold">{fmt(totalDepense)}</p>
              </div>
              <div className="text-center p-3 rounded bg-slate-50">
                <p className="text-xs text-muted-foreground">Restant</p>
                <p className={`font-bold ${totalBudget - totalDepense < 0 ? "text-red-600" : "text-green-600"}`}>
                  {fmt(totalBudget - totalDepense)}
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Chargement...</p>
          ) : budgets.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Aucun budget défini pour cette période.
            </p>
          ) : (
            <div className="space-y-3">
              {budgets.map((b) => {
                const pct = Number(b.montant) > 0
                  ? (Number(b.depense_reelle) / Number(b.montant)) * 100
                  : 0;
                const barColor =
                  pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-green-500";
                const reste = Number(b.montant) - Number(b.depense_reelle);

                return (
                  <div key={b.id} className="p-3 rounded border space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-sm">{b.categorie_nom}</span>
                        {b.projet_code && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({b.projet_code})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">
                          {fmt(Number(b.depense_reelle))} / {fmt(Number(b.montant))}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500"
                          onClick={() => handleDelete(b.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded overflow-hidden">
                      <div
                        className={`h-2 rounded ${barColor} transition-all`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{pct.toFixed(0)}%</span>
                      <span className={reste < 0 ? "text-red-600" : ""}>
                        Reste : {fmt(reste)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Budget Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Select
                value={formCatId?.toString() || ""}
                onValueChange={(v) => setFormCatId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Projet (optionnel)</Label>
              <Select
                value={formProjetId?.toString() || "none"}
                onValueChange={(v) => setFormProjetId(v === "none" ? null : Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous les projets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tous les projets</SelectItem>
                  {projets.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.code} — {p.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Montant budgété</Label>
              <Input
                type="number"
                step="0.01"
                value={formMontant || ""}
                onChange={(e) => setFormMontant(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Optionnel"
              />
            </div>
            <Button onClick={handleAdd} disabled={saving || !formCatId || !formMontant}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

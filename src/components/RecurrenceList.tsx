import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, Plus, Pencil, Trash2, Play, Pause } from "lucide-react";
import { api } from "@/lib/api";
import type { Recurrence, Category, Projet, Contact, CompteBancaire } from "@/types";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);

const FREQ_LABELS: Record<string, string> = {
  hebdomadaire: "Hebdomadaire",
  mensuel: "Mensuel",
  trimestriel: "Trimestriel",
  annuel: "Annuel",
};

const MODES_PAIEMENT = [
  "Mastercard",
  "Visa Wise",
  "Virement Interac",
  "Dépôt direct",
  "Débit",
  "Comptant",
  "Chèque",
];

export default function RecurrenceList() {
  const [recurrences, setRecurrences] = useState<Recurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<string | null>(null);

  // Dropdowns
  const [categories, setCategories] = useState<Category[]>([]);
  const [projets, setProjets] = useState<Projet[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [comptes, setComptes] = useState<CompteBancaire[]>([]);

  // Form state
  const [form, setForm] = useState({
    type: "dépense" as "dépense" | "revenu" | "transfert",
    description: "",
    categorie_id: null as number | null,
    projet_id: null as number | null,
    contact_id: null as number | null,
    compte_id: null as number | null,
    mode_paiement: "Mastercard",
    montant_ht: 0,
    tps: 0,
    tvq: 0,
    total_ttc: 0,
    taxable: true,
    notes: "",
    frequence: "mensuel" as Recurrence["frequence"],
    date_debut: new Date().toISOString().split("T")[0],
    date_fin: "",
    prochaine_date: new Date().toISOString().split("T")[0],
    actif: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Category[]>("/api/categories"),
      api.get<Projet[]>("/api/projets"),
      api.get<Contact[]>("/api/contacts"),
      api.get<CompteBancaire[]>("/api/comptes"),
    ]).then(([c, p, co, cb]) => {
      setCategories(c);
      setProjets(p);
      setContacts(co);
      setComptes(cb);
    });
  }, []);

  const fetchData = () => {
    setLoading(true);
    api
      .get<Recurrence[]>("/api/recurrences")
      .then(setRecurrences)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const updateField = (key: string, value: unknown) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "montant_ht" && next.taxable) {
        const ht = Number(value) || 0;
        next.tps = Math.round(ht * 0.05 * 100) / 100;
        next.tvq = Math.round(ht * 0.09975 * 100) / 100;
        next.total_ttc = Math.round((ht + next.tps + next.tvq) * 100) / 100;
      }
      if (key === "taxable" && !value) {
        next.tps = 0;
        next.tvq = 0;
        next.total_ttc = next.montant_ht;
      }
      if (key === "taxable" && value) {
        next.tps = Math.round(next.montant_ht * 0.05 * 100) / 100;
        next.tvq = Math.round(next.montant_ht * 0.09975 * 100) / 100;
        next.total_ttc = Math.round((next.montant_ht + next.tps + next.tvq) * 100) / 100;
      }
      if (key === "date_debut" && !editingId) {
        next.prochaine_date = value as string;
      }
      return next;
    });
  };

  const resetForm = () => {
    setForm({
      type: "dépense",
      description: "",
      categorie_id: null,
      projet_id: null,
      contact_id: null,
      compte_id: null,
      mode_paiement: "Mastercard",
      montant_ht: 0,
      tps: 0,
      tvq: 0,
      total_ttc: 0,
      taxable: true,
      notes: "",
      frequence: "mensuel",
      date_debut: new Date().toISOString().split("T")[0],
      date_fin: "",
      prochaine_date: new Date().toISOString().split("T")[0],
      actif: true,
    });
    setEditingId(null);
  };

  const openEdit = (r: Recurrence) => {
    setForm({
      type: r.type,
      description: r.description || "",
      categorie_id: r.categorie_id,
      projet_id: r.projet_id,
      contact_id: r.contact_id,
      compte_id: r.compte_id,
      mode_paiement: r.mode_paiement || "Mastercard",
      montant_ht: Number(r.montant_ht),
      tps: Number(r.tps),
      tvq: Number(r.tvq),
      total_ttc: Number(r.total_ttc),
      taxable: r.taxable,
      notes: r.notes || "",
      frequence: r.frequence,
      date_debut: r.date_debut,
      date_fin: r.date_fin || "",
      prochaine_date: r.prochaine_date,
      actif: r.actif,
    });
    setEditingId(r.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await api.put("/api/recurrences", { ...form, id: editingId });
      } else {
        await api.post("/api/recurrences", form);
      }
      setShowForm(false);
      resetForm();
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette récurrence ?")) return;
    await api.delete(`/api/recurrences?id=${id}`);
    fetchData();
  };

  const handleToggleActif = async (r: Recurrence) => {
    await api.put("/api/recurrences", {
      ...r,
      actif: !r.actif,
    });
    fetchData();
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateResult(null);
    try {
      const result = await api.post<{ generated: number }>("/api/recurrences", {
        action: "generate",
      });
      setGenerateResult(`${result.generated} transaction(s) générée(s)`);
      fetchData();
    } finally {
      setGenerating(false);
    }
  };

  const filteredCategories = categories.filter((c) =>
    form.type === "dépense"
      ? c.type === "dépense"
      : form.type === "revenu"
        ? c.type === "revenu"
        : true,
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Transactions récurrentes ({recurrences.length})
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {generateResult && (
                <span className="text-sm text-green-600">{generateResult}</span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={generating}
              >
                <Play className="h-4 w-4 mr-1" />
                {generating ? "Génération..." : "Générer maintenant"}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Nouvelle
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Chargement...</p>
          ) : recurrences.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Aucune transaction récurrente définie.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Fréquence</TableHead>
                    <TableHead className="text-right">Montant TTC</TableHead>
                    <TableHead>Prochaine date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recurrences.map((r) => (
                    <TableRow key={r.id} className={!r.actif ? "opacity-50" : ""}>
                      <TableCell>
                        <div>
                          <span className="text-sm">{r.description}</span>
                          {r.projet_code && (
                            <Badge variant="outline" className="ml-1 text-xs">
                              {r.projet_code}
                            </Badge>
                          )}
                        </div>
                        {r.contact_nom && (
                          <span className="text-xs text-muted-foreground">{r.contact_nom}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.type === "revenu"
                              ? "default"
                              : r.type === "dépense"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {r.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{FREQ_LABELS[r.frequence]}</TableCell>
                      <TableCell
                        className={`text-right font-mono ${r.type === "revenu" ? "text-green-700" : "text-red-700"}`}
                      >
                        {fmt(Number(r.total_ttc))}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{r.prochaine_date}</TableCell>
                      <TableCell>
                        <Badge variant={r.actif ? "default" : "secondary"}>
                          {r.actif ? "Actif" : "Pausé"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title={r.actif ? "Mettre en pause" : "Activer"}
                            onClick={() => handleToggleActif(r)}
                          >
                            {r.actif ? (
                              <Pause className="h-3 w-3" />
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(r)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-600"
                            onClick={() => handleDelete(r.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowForm(false);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl w-[calc(100%-1rem)] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Modifier la récurrence" : "Nouvelle récurrence"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Type + Fréquence */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => updateField("type", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dépense">Dépense</SelectItem>
                    <SelectItem value="revenu">Revenu</SelectItem>
                    <SelectItem value="transfert">Transfert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fréquence</Label>
                <Select
                  value={form.frequence}
                  onValueChange={(v) => updateField("frequence", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hebdomadaire">Hebdomadaire</SelectItem>
                    <SelectItem value="mensuel">Mensuel</SelectItem>
                    <SelectItem value="trimestriel">Trimestriel</SelectItem>
                    <SelectItem value="annuel">Annuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                rows={2}
                onChange={(e) => updateField("description", e.target.value)}
              />
            </div>

            {/* Catégorie + Projet */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Catégorie</Label>
                <Select
                  value={form.categorie_id?.toString() || ""}
                  onValueChange={(v) => updateField("categorie_id", Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Projet</Label>
                <Select
                  value={form.projet_id?.toString() || "none"}
                  onValueChange={(v) =>
                    updateField("projet_id", v === "none" ? null : Number(v))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {projets.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.code} — {p.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Contact + Compte */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contact</Label>
                <Select
                  value={form.contact_id?.toString() || "none"}
                  onValueChange={(v) =>
                    updateField("contact_id", v === "none" ? null : Number(v))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Compte bancaire</Label>
                <Select
                  value={form.compte_id?.toString() || "none"}
                  onValueChange={(v) =>
                    updateField("compte_id", v === "none" ? null : Number(v))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {comptes.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Mode paiement */}
            <div className="space-y-1.5">
              <Label>Mode de paiement</Label>
              <Select
                value={form.mode_paiement}
                onValueChange={(v) => updateField("mode_paiement", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODES_PAIEMENT.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Montants */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Label className="text-sm font-semibold">Montants</Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="rec-taxable"
                    checked={form.taxable}
                    onCheckedChange={(v) => updateField("taxable", v as boolean)}
                  />
                  <Label htmlFor="rec-taxable" className="text-sm">
                    Taxable
                  </Label>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Montant HT</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.montant_ht || ""}
                    onChange={(e) => updateField("montant_ht", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">TPS (5%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.tps || ""}
                    onChange={(e) => updateField("tps", Number(e.target.value))}
                    disabled={!form.taxable}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">TVQ (9,975%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.tvq || ""}
                    onChange={(e) => updateField("tvq", Number(e.target.value))}
                    disabled={!form.taxable}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Total TTC</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.total_ttc || ""}
                    className="font-bold"
                    readOnly
                  />
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Date de début</Label>
                <Input
                  type="date"
                  value={form.date_debut}
                  onChange={(e) => updateField("date_debut", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Date de fin (optionnel)</Label>
                <Input
                  type="date"
                  value={form.date_fin}
                  onChange={(e) => updateField("date_fin", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Prochaine date</Label>
                <Input
                  type="date"
                  value={form.prochaine_date}
                  onChange={(e) => updateField("prochaine_date", e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                rows={2}
                onChange={(e) => updateField("notes", e.target.value)}
              />
            </div>

            <Button onClick={handleSave} disabled={saving || !form.description || !form.montant_ht}>
              {saving
                ? "Enregistrement..."
                : editingId
                  ? "Mettre à jour"
                  : "Enregistrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

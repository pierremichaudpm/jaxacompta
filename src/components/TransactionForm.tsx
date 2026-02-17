import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type {
  TransactionFormData,
  Category,
  Projet,
  Contact,
  CompteBancaire,
} from "@/types";
import { Save } from "lucide-react";

type InputEvent = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;

const MODES_PAIEMENT = [
  "Mastercard",
  "Visa Wise",
  "Virement Interac",
  "Dépôt direct",
  "Débit",
  "Comptant",
  "Chèque",
];

interface Props {
  initialData?: Partial<TransactionFormData>;
  ocrConfidence?: number;
  onSaved?: () => void;
  editId?: number;
  /** Hide the Card wrapper (when used inside a Dialog that already has a header) */
  embedded?: boolean;
}

export default function TransactionForm({
  initialData,
  ocrConfidence,
  onSaved,
  editId,
  embedded,
}: Props) {
  const [form, setForm] = useState<TransactionFormData>({
    date_transaction: new Date().toISOString().split("T")[0],
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
    ocr_source: false,
    ...initialData,
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [projets, setProjets] = useState<Projet[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [comptes, setComptes] = useState<CompteBancaire[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Category[]>("/api/categories"),
      api.get<Projet[]>("/api/projets"),
      api.get<Contact[]>("/api/contacts"),
      api.get<CompteBancaire[]>("/api/comptes"),
    ]).then(([cat, proj, cont, cpt]) => {
      setCategories(cat);
      setProjets(proj);
      setContacts(cont);
      setComptes(cpt);
    });
  }, []);

  useEffect(() => {
    if (initialData) {
      setForm((prev) => ({ ...prev, ...initialData }));
    }
  }, [initialData]);

  const updateField = <K extends keyof TransactionFormData>(
    key: K,
    value: TransactionFormData[K],
  ) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-calcul taxes
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
        const ht = next.montant_ht;
        next.tps = Math.round(ht * 0.05 * 100) / 100;
        next.tvq = Math.round(ht * 0.09975 * 100) / 100;
        next.total_ttc = Math.round((ht + next.tps + next.tvq) * 100) / 100;
      }
      return next;
    });
    setSaved(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await api.put("/api/transactions", { ...form, id: editId });
      } else {
        await api.post("/api/transactions", form);
      }
      setSaved(true);
      if (!editId) {
        setForm((prev) => ({
          ...prev,
          description: "",
          montant_ht: 0,
          tps: 0,
          tvq: 0,
          total_ttc: 0,
          numero_facture: "",
          notes: "",
          ocr_source: false,
          ocr_confiance: undefined,
        }));
      }
      onSaved?.();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const filteredCategories = categories.filter((c) =>
    form.type === "dépense"
      ? c.type === "dépense"
      : form.type === "revenu"
        ? c.type === "revenu"
        : true,
  );

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Row 1: Date + Type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={form.date_transaction}
            onChange={(e) => updateField("date_transaction", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select
            value={form.type}
            onValueChange={(v) =>
              updateField("type", v as TransactionFormData["type"])
            }
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
      </div>

      {/* Row 2: Catégorie + Projet */}
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
            value={form.projet_id?.toString() || ""}
            onValueChange={(v) => updateField("projet_id", Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choisir..." />
            </SelectTrigger>
            <SelectContent>
              {projets.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.code} — {p.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={form.description}
          rows={2}
          onChange={(e) => updateField("description", e.target.value)}
          placeholder="Description de la transaction"
        />
      </div>

      {/* Row 3: Contact + Compte */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Contact / Fournisseur</Label>
          <Select
            value={form.contact_id?.toString() || ""}
            onValueChange={(v) => updateField("contact_id", Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choisir..." />
            </SelectTrigger>
            <SelectContent>
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
            value={form.compte_id?.toString() || ""}
            onValueChange={(v) => updateField("compte_id", Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choisir..." />
            </SelectTrigger>
            <SelectContent>
              {comptes.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>
                  {c.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 4: Paiement + Facture */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        <div className="space-y-1.5">
          <Label htmlFor="facture">N° Facture</Label>
          <Input
            id="facture"
            value={form.numero_facture || ""}
            onChange={(e) => updateField("numero_facture", e.target.value)}
          />
        </div>
      </div>

      {/* Montants — 2 cols mobile, 4 cols desktop */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Label className="text-sm font-semibold">Montants</Label>
          <div className="flex items-center gap-2">
            <Checkbox
              id="taxable"
              checked={form.taxable}
              onCheckedChange={(v) => updateField("taxable", v as boolean)}
            />
            <Label htmlFor="taxable" className="text-sm">
              Taxable
            </Label>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ht" className="text-xs text-muted-foreground">
              Montant HT
            </Label>
            <Input
              id="ht"
              type="number"
              step="0.01"
              value={form.montant_ht || ""}
              onChange={(e) =>
                updateField("montant_ht", Number(e.target.value))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tps" className="text-xs text-muted-foreground">
              TPS (5%)
            </Label>
            <Input
              id="tps"
              type="number"
              step="0.01"
              value={form.tps || ""}
              onChange={(e) => updateField("tps", Number(e.target.value))}
              disabled={!form.taxable}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tvq" className="text-xs text-muted-foreground">
              TVQ (9,975%)
            </Label>
            <Input
              id="tvq"
              type="number"
              step="0.01"
              value={form.tvq || ""}
              onChange={(e) => updateField("tvq", Number(e.target.value))}
              disabled={!form.taxable}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ttc" className="text-xs text-muted-foreground">
              Total TTC
            </Label>
            <Input
              id="ttc"
              type="number"
              step="0.01"
              value={form.total_ttc || ""}
              className="font-bold"
              readOnly
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={form.notes || ""}
          rows={2}
          onChange={(e) => updateField("notes", e.target.value)}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving
            ? "Enregistrement..."
            : editId
              ? "Mettre à jour"
              : "Enregistrer"}
        </Button>
        {saved && (
          <span className="text-sm text-green-600">Enregistré avec succès</span>
        )}
      </div>
    </form>
  );

  if (embedded) {
    return formContent;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {editId ? "Modifier la transaction" : "Nouvelle transaction"}
          {ocrConfidence !== undefined && (
            <Badge variant={ocrConfidence > 0.8 ? "default" : "destructive"}>
              OCR {(ocrConfidence * 100).toFixed(0)}%
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>{formContent}</CardContent>
    </Card>
  );
}

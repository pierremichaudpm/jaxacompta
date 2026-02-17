import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Receipt,
  Plus,
  Download,
  Check,
  Trash2,
  FileText,
  DollarSign,
  Clock,
  AlertTriangle,
  Mail,
  Pencil,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { generateFacturePDF } from "@/lib/generateFacturePDF";
import type {
  Transaction,
  Contact,
  Projet,
  CompteBancaire,
  LigneFacture,
} from "@/types";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(
    n,
  );

const STATUT_OPTIONS = [
  "Envoyée",
  "Payée",
  "En retard",
  "En attente",
  "À valider",
];

const STATUT_COLORS: Record<string, string> = {
  Payée: "default",
  Envoyée: "secondary",
  "En retard": "destructive",
  "En attente": "outline",
  "À valider": "outline",
};

interface NewLigne {
  description: string;
  unite: string;
  cout_unitaire: string;
  isHeader: boolean;
}

export default function Factures() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    payees: 0,
    en_attente: 0,
    en_retard: 0,
    montant_impaye: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projets, setProjets] = useState<Projet[]>([]);
  const [comptes, setComptes] = useState<CompteBancaire[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  // New invoice form state
  const [formClientId, setFormClientId] = useState("");
  const [formProjetId, setFormProjetId] = useState("");
  const [formCompteId, setFormCompteId] = useState("1");
  const [formNumero, setFormNumero] = useState("");
  const [formDate, setFormDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [formTaxable, setFormTaxable] = useState(true);
  const [formUseTVH, setFormUseTVH] = useState(false);
  const [formNotes, setFormNotes] = useState("");
  const [formLignes, setFormLignes] = useState<NewLigne[]>([
    { description: "", unite: "", cout_unitaire: "", isHeader: false },
  ]);
  const [saving, setSaving] = useState(false);

  // Contact editing state
  const [showContacts, setShowContacts] = useState(false);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [contactForm, setContactForm] = useState({
    nom: "",
    type: "client" as string,
    email: "",
    telephone: "",
    adresse: "",
    numero_tps: "",
    numero_tvq: "",
  });

  const loadContacts = async () => {
    const c = await api.get<Contact[]>("/api/contacts");
    setAllContacts(c);
    setContacts(c.filter((x) => x.type === "client" || x.type === "les deux"));
  };

  useEffect(() => {
    Promise.all([
      api.get<Contact[]>("/api/contacts"),
      api.get<Projet[]>("/api/projets"),
      api.get<CompteBancaire[]>("/api/comptes"),
    ]).then(([c, p, cpt]) => {
      setAllContacts(c);
      setContacts(
        c.filter((x) => x.type === "client" || x.type === "les deux"),
      );
      setProjets(p);
      setComptes(cpt);
    });
  }, []);

  const startEditContact = (c: Contact) => {
    setEditContact(c);
    setContactForm({
      nom: c.nom,
      type: c.type,
      email: c.email || "",
      telephone: c.telephone || "",
      adresse: c.adresse || "",
      numero_tps: c.numero_tps || "",
      numero_tvq: c.numero_tvq || "",
    });
  };

  const saveContact = async () => {
    if (!editContact) return;
    await api.put("/api/contacts", { id: editContact.id, ...contactForm });
    setEditContact(null);
    await loadContacts();
  };

  const handleSendEmail = (tx: Transaction) => {
    const email = tx.contact_email || "";
    const subject = encodeURIComponent(
      `Facture ${tx.numero_facture || ""} — JAXA Production inc.`,
    );
    const body = encodeURIComponent(
      `Bonjour,\n\nVeuillez trouver ci-joint la facture ${tx.numero_facture || ""} d'un montant de ${fmt(Number(tx.total_ttc))}.\n\n` +
        `Conditions : Montant payable en 30 jours.\n\n` +
        `N'hésitez pas à nous contacter pour toute question.\n\nCordialement,\nJAXA Production inc.\nvirginiejaffredo@jaxa.ca\n514-578-9989`,
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_self");
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatut) params.set("statut", filterStatut);
      const data = await api.get<{
        rows: Transaction[];
        summary: typeof summary;
      }>(`/api/factures?${params}`);
      setRows(data.rows);
      setSummary(data.summary);
    } finally {
      setLoading(false);
    }
  }, [filterStatut]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addLigne = () => {
    setFormLignes((prev) => [
      ...prev,
      { description: "", unite: "", cout_unitaire: "", isHeader: false },
    ]);
  };

  const removeLigne = (idx: number) => {
    setFormLignes((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateLigne = (
    idx: number,
    field: keyof NewLigne,
    value: string | boolean,
  ) => {
    setFormLignes((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)),
    );
  };

  const computedLignes = (): LigneFacture[] => {
    return formLignes.map((l) => ({
      description: l.description,
      unite: l.isHeader ? null : parseFloat(l.unite) || null,
      cout_unitaire: l.isHeader ? null : parseFloat(l.cout_unitaire) || null,
      montant: l.isHeader
        ? 0
        : (parseFloat(l.unite) || 1) * (parseFloat(l.cout_unitaire) || 0),
      isHeader: l.isHeader,
    }));
  };

  const sousTotal = computedLignes().reduce((sum, l) => sum + l.montant, 0);
  const tpsAmount = formTaxable
    ? formUseTVH
      ? Math.round(sousTotal * 0.13 * 100) / 100
      : Math.round(sousTotal * 0.05 * 100) / 100
    : 0;
  const tvqAmount =
    formTaxable && !formUseTVH
      ? Math.round(sousTotal * 0.09975 * 100) / 100
      : 0;
  const totalTTC = Math.round((sousTotal + tpsAmount + tvqAmount) * 100) / 100;

  const handleDownloadPDF = (tx: Transaction) => {
    const lignes: LigneFacture[] = tx.lignes_facture
      ? JSON.parse(tx.lignes_facture)
      : [
          {
            description: tx.description || tx.numero_facture || "Services",
            unite: 1,
            cout_unitaire: Number(tx.montant_ht) || 0,
            montant: Number(tx.montant_ht) || Number(tx.total_ttc),
          },
        ];

    const doc = generateFacturePDF({
      numero_facture: tx.numero_facture || `JAXA-${tx.id}`,
      date_facture: tx.date_transaction,
      client_nom: tx.contact_nom || "Client",
      client_adresse: tx.contact_adresse || null,
      client_telephone: tx.contact_telephone || null,
      projet_nom: tx.projet_nom || null,
      lignes,
      sous_total:
        Number(tx.montant_ht) ||
        Number(tx.total_ttc) - Number(tx.tps) - Number(tx.tvq),
      tps: Number(tx.tps),
      tvq: Number(tx.tvq),
      total_ttc: Number(tx.total_ttc),
      use_tvh:
        Number(tx.tvq) === 0 &&
        Number(tx.tps) > 0 &&
        Number(tx.tps) > Number(tx.montant_ht) * 0.06,
    });
    doc.save(`Facture_${tx.numero_facture || tx.id}.pdf`);
  };

  const handleUpdateStatut = async (tx: Transaction, statut: string) => {
    await api.put("/api/factures", {
      id: tx.id,
      statut_facture: statut,
      date_paiement:
        statut === "Payée"
          ? new Date().toISOString().split("T")[0]
          : tx.date_paiement,
      numero_facture: tx.numero_facture,
      lignes_facture: tx.lignes_facture,
    });
    fetchData();
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const lignes = computedLignes();
      const client = contacts.find((c) => c.id === Number(formClientId));
      const projet = projets.find((p) => p.id === Number(formProjetId));

      const result = await api.post<Transaction>("/api/factures", {
        date_transaction: formDate,
        description: `Facture ${formNumero} — ${client?.nom || ""}`,
        categorie_id: 14,
        projet_id: formProjetId ? Number(formProjetId) : null,
        contact_id: formClientId ? Number(formClientId) : null,
        compte_id: formCompteId ? Number(formCompteId) : null,
        mode_paiement: "Virement Interac",
        montant_ht: sousTotal,
        tps: tpsAmount,
        tvq: tvqAmount,
        total_ttc: totalTTC,
        taxable: formTaxable,
        statut_facture: "Envoyée",
        numero_facture: formNumero,
        lignes_facture: JSON.stringify(lignes),
      });

      // Generate and download PDF
      const doc = generateFacturePDF({
        numero_facture: formNumero,
        date_facture: formDate,
        client_nom: client?.nom || "Client",
        client_adresse: client?.adresse || null,
        client_telephone: client?.telephone || null,
        projet_nom: projet?.nom || null,
        lignes,
        sous_total: sousTotal,
        tps: tpsAmount,
        tvq: tvqAmount,
        total_ttc: totalTTC,
        use_tvh: formUseTVH,
      });
      doc.save(`Facture_${formNumero}.pdf`);

      // Reset form
      setShowCreate(false);
      setFormLignes([
        { description: "", unite: "", cout_unitaire: "", isHeader: false },
      ]);
      setFormNumero("");
      setFormNotes("");
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  const fetchNextNumber = async () => {
    const projet = projets.find((p) => p.id === Number(formProjetId));
    const prefix = projet?.code || "JAXA";
    try {
      const data = await api.get<{ suggested: string }>(
        `/api/factures?next_number=true&prefix=${prefix}`,
      );
      setFormNumero(data.suggested);
    } catch {
      // fallback
      const date = formDate.replace(/-/g, "").slice(4);
      setFormNumero(`${prefix}-${date}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Total factures</p>
            </div>
            <p className="text-2xl font-bold mt-1">{summary.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <p className="text-sm text-muted-foreground">Payées</p>
            </div>
            <p className="text-2xl font-bold mt-1 text-green-700">
              {summary.payees}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              <p className="text-sm text-muted-foreground">En attente</p>
            </div>
            <p className="text-2xl font-bold mt-1">{summary.en_attente}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <p className="text-sm text-muted-foreground">Impayé</p>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-700">
              {fmt(Number(summary.montant_impaye))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Invoices List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Factures
            </CardTitle>
            <div className="flex gap-2">
              <Select
                value={filterStatut}
                onValueChange={(v) => setFilterStatut(v === "all" ? "" : v)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Tous statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  {STATUT_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  loadContacts();
                  setShowContacts(true);
                }}
              >
                <Users className="h-4 w-4 mr-2" />
                Contacts
              </Button>
              <Button
                onClick={() => {
                  setShowCreate(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle facture
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Facture</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Projet</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Total TTC</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Aucune facture
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-sm">
                        {tx.numero_facture || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {tx.date_transaction?.split("T")[0]}
                      </TableCell>
                      <TableCell>{tx.contact_nom || "—"}</TableCell>
                      <TableCell>
                        {tx.projet_code && (
                          <Badge variant="outline">{tx.projet_code}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {tx.statut_facture ? (
                          <Badge
                            variant={
                              (STATUT_COLORS[tx.statut_facture] as
                                | "default"
                                | "secondary"
                                | "destructive"
                                | "outline") || "outline"
                            }
                          >
                            {tx.statut_facture}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-700">
                        {fmt(Number(tx.total_ttc))}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {tx.numero_facture && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Télécharger PDF"
                              onClick={() => handleDownloadPDF(tx)}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-blue-600"
                            title={
                              tx.contact_email
                                ? `Envoyer à ${tx.contact_email}`
                                : "Aucun courriel — modifier le contact"
                            }
                            onClick={() => {
                              if (tx.contact_email) {
                                handleSendEmail(tx);
                              } else {
                                const c = allContacts.find(
                                  (x) => x.id === tx.contact_id,
                                );
                                if (c) {
                                  startEditContact(c);
                                  setShowContacts(true);
                                }
                              }
                            }}
                          >
                            <Mail className="h-3 w-3" />
                          </Button>
                          {tx.statut_facture !== "Payée" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-green-600"
                              title="Marquer payée"
                              onClick={() => handleUpdateStatut(tx, "Payée")}
                            >
                              <DollarSign className="h-3 w-3" />
                            </Button>
                          )}
                          {tx.statut_facture === "Envoyée" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-600"
                              title="Marquer en retard"
                              onClick={() =>
                                handleUpdateStatut(tx, "En retard")
                              }
                            >
                              <AlertTriangle className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle facture</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Header fields */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={formClientId} onValueChange={setFormClientId}>
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
              <div className="space-y-2">
                <Label>Projet</Label>
                <Select
                  value={formProjetId}
                  onValueChange={(v) => {
                    setFormProjetId(v);
                  }}
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
              <div className="space-y-2">
                <Label>N° Facture</Label>
                <div className="flex gap-1">
                  <Input
                    value={formNumero}
                    onChange={(e) => setFormNumero(e.target.value)}
                    placeholder="CTV_0025-..."
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={fetchNextNumber}
                    title="Auto-générer"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Compte bancaire</Label>
                <Select value={formCompteId} onValueChange={setFormCompteId}>
                  <SelectTrigger>
                    <SelectValue />
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
              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  id="taxable"
                  checked={formTaxable}
                  onCheckedChange={(v) => setFormTaxable(v as boolean)}
                />
                <Label htmlFor="taxable">Taxable</Label>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  id="tvh"
                  checked={formUseTVH}
                  onCheckedChange={(v) => setFormUseTVH(v as boolean)}
                  disabled={!formTaxable}
                />
                <Label htmlFor="tvh">TPS/TVH 13% (Ontario)</Label>
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base">Lignes de facturation</Label>
                <Button variant="outline" size="sm" onClick={addLigne}>
                  <Plus className="h-3 w-3 mr-1" />
                  Ajouter ligne
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">En-tête</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-20">Unités</TableHead>
                      <TableHead className="w-28">Coût unit.</TableHead>
                      <TableHead className="w-28 text-right">Montant</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formLignes.map((l, idx) => {
                      const montant = l.isHeader
                        ? 0
                        : (parseFloat(l.unite) || 1) *
                          (parseFloat(l.cout_unitaire) || 0);
                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            <Checkbox
                              checked={l.isHeader}
                              onCheckedChange={(v) =>
                                updateLigne(idx, "isHeader", v as boolean)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={l.description}
                              onChange={(e) =>
                                updateLigne(idx, "description", e.target.value)
                              }
                              placeholder={
                                l.isHeader
                                  ? "Titre de section..."
                                  : "Description du service..."
                              }
                              className={l.isHeader ? "font-bold" : ""}
                            />
                          </TableCell>
                          <TableCell>
                            {!l.isHeader && (
                              <Input
                                type="number"
                                step="0.25"
                                value={l.unite}
                                onChange={(e) =>
                                  updateLigne(idx, "unite", e.target.value)
                                }
                                placeholder="1"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {!l.isHeader && (
                              <Input
                                type="number"
                                step="0.01"
                                value={l.cout_unitaire}
                                onChange={(e) =>
                                  updateLigne(
                                    idx,
                                    "cout_unitaire",
                                    e.target.value,
                                  )
                                }
                                placeholder="0.00"
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {!l.isHeader && montant !== 0 ? fmt(montant) : ""}
                          </TableCell>
                          <TableCell>
                            {formLignes.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500"
                                onClick={() => removeLigne(idx)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-72 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Sous-total</span>
                  <span className="font-mono">{fmt(sousTotal)}</span>
                </div>
                {formTaxable && (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{formUseTVH ? "TPS/TVH (13%)" : "TPS (5%)"}</span>
                      <span className="font-mono">{fmt(tpsAmount)}</span>
                    </div>
                    {!formUseTVH && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>TVQ (9,975%)</span>
                        <span className="font-mono">{fmt(tvqAmount)}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-1">
                  <span>Total</span>
                  <span className="font-mono">{fmt(totalTTC)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleCreate}
                disabled={
                  saving || !formClientId || !formNumero || sousTotal === 0
                }
              >
                <Download className="h-4 w-4 mr-2" />
                {saving ? "Enregistrement..." : "Enregistrer + PDF"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contacts Management Dialog */}
      <Dialog open={showContacts} onOpenChange={setShowContacts}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gérer les contacts clients</DialogTitle>
          </DialogHeader>

          {editContact ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Modifier : <strong>{editContact.nom}</strong>
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input
                    value={contactForm.nom}
                    onChange={(e) =>
                      setContactForm((p) => ({ ...p, nom: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Courriel</Label>
                  <Input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) =>
                      setContactForm((p) => ({ ...p, email: e.target.value }))
                    }
                    placeholder="client@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input
                    value={contactForm.telephone}
                    onChange={(e) =>
                      setContactForm((p) => ({
                        ...p,
                        telephone: e.target.value,
                      }))
                    }
                    placeholder="514-..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={contactForm.type}
                    onValueChange={(v) =>
                      setContactForm((p) => ({ ...p, type: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="fournisseur">Fournisseur</SelectItem>
                      <SelectItem value="les deux">Les deux</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Adresse</Label>
                  <Textarea
                    value={contactForm.adresse}
                    onChange={(e) =>
                      setContactForm((p) => ({
                        ...p,
                        adresse: e.target.value,
                      }))
                    }
                    rows={2}
                    placeholder="357 rue des Merles, Boucherville, Qc J4B 5Y5"
                  />
                </div>
                <div className="space-y-2">
                  <Label>N° TPS</Label>
                  <Input
                    value={contactForm.numero_tps}
                    onChange={(e) =>
                      setContactForm((p) => ({
                        ...p,
                        numero_tps: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>N° TVQ</Label>
                  <Input
                    value={contactForm.numero_tvq}
                    onChange={(e) =>
                      setContactForm((p) => ({
                        ...p,
                        numero_tvq: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditContact(null)}>
                  Annuler
                </Button>
                <Button onClick={saveContact}>Enregistrer</Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Courriel</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allContacts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nom}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.email || (
                        <span className="text-muted-foreground italic">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.telephone || "—"}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">
                      {c.adresse || "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => startEditContact(c)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
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

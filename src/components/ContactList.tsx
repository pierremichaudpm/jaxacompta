import { useState, useEffect } from "react";
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
import { Users, Plus, Pencil, Trash2, MapPin } from "lucide-react";
import { api } from "@/lib/api";
import type { Contact } from "@/types";

interface AdresseEntry {
  label: string;
  adresse: string;
}

const TYPE_LABELS: Record<string, string> = {
  client: "Client",
  fournisseur: "Fournisseur",
  "les deux": "Les deux",
};

const TYPE_COLORS: Record<string, "default" | "secondary" | "outline"> = {
  client: "default",
  fournisseur: "secondary",
  "les deux": "outline",
};

export default function ContactList() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [search, setSearch] = useState("");

  // Form state
  const [formNom, setFormNom] = useState("");
  const [formType, setFormType] = useState<string>("client");
  const [formEmail, setFormEmail] = useState("");
  const [formTelephone, setFormTelephone] = useState("");
  const [formNumeroTps, setFormNumeroTps] = useState("");
  const [formNumeroTvq, setFormNumeroTvq] = useState("");
  const [formAdresses, setFormAdresses] = useState<AdresseEntry[]>([]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const data = await api.get<Contact[]>("/api/contacts");
      setContacts(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const resetForm = () => {
    setFormNom("");
    setFormType("client");
    setFormEmail("");
    setFormTelephone("");
    setFormNumeroTps("");
    setFormNumeroTvq("");
    setFormAdresses([]);
    setEditingContact(null);
    setShowForm(false);
    setShowDeleteConfirm(false);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (c: Contact) => {
    try {
      setEditingContact(c);
      setFormNom(c.nom || "");
      setFormType(c.type || "client");
      setFormEmail(c.email || "");
      setFormTelephone(c.telephone || "");
      setFormNumeroTps(c.numero_tps || "");
      setFormNumeroTvq(c.numero_tvq || "");
      const adrs = Array.isArray(c.adresses) ? c.adresses : [];
      setFormAdresses(adrs.map((a) => ({ label: a.label || "", adresse: a.adresse || "" })));
    } catch (e) {
      console.error("openEdit error:", e);
    }
    setShowForm(true);
  };

  const addAdresse = () => {
    setFormAdresses((prev) => [...prev, { label: "", adresse: "" }]);
  };

  const removeAdresse = (idx: number) => {
    setFormAdresses((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateAdresse = (idx: number, field: keyof AdresseEntry, value: string) => {
    setFormAdresses((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a))
    );
  };

  const handleSave = async () => {
    // Build the legacy adresse field from the first address for backward compat
    const primaryAdresse =
      formAdresses.length > 0 ? formAdresses[0].adresse : "";

    const payload = {
      nom: formNom,
      type: formType,
      email: formEmail || null,
      telephone: formTelephone || null,
      adresse: primaryAdresse || null,
      numero_tps: formNumeroTps || null,
      numero_tvq: formNumeroTvq || null,
      adresses: formAdresses.filter((a) => a.adresse.trim() !== ""),
    };

    try {
      if (editingContact) {
        await api.put("/api/contacts", { id: editingContact.id, ...payload });
      } else {
        await api.post("/api/contacts", payload);
      }
      resetForm();
      await loadContacts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      alert(`Erreur : ${msg}`);
    }
  };

  const handleDelete = async () => {
    if (!editingContact) return;
    await api.delete(`/api/contacts?id=${editingContact.id}`);
    resetForm();
    await loadContacts();
  };

  const filtered = search
    ? contacts.filter(
        (c) =>
          c.nom.toLowerCase().includes(search.toLowerCase()) ||
          (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
          (c.telephone && c.telephone.includes(search))
      )
    : contacts;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Contacts
              <Badge variant="secondary" className="ml-1">
                {contacts.length}
              </Badge>
            </CardTitle>
            <div className="flex gap-2">
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-48"
              />
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau contact
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Courriel</TableHead>
                  <TableHead>Telephone</TableHead>
                  <TableHead>Adresses</TableHead>
                  <TableHead>TPS / TVQ</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Aucun contact
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nom}</TableCell>
                      <TableCell>
                        <Badge variant={TYPE_COLORS[c.type] || "outline"} className="text-xs">
                          {TYPE_LABELS[c.type] || c.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.email || <span className="text-muted-foreground">--</span>}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {c.telephone || <span className="text-muted-foreground">--</span>}
                      </TableCell>
                      <TableCell className="text-sm max-w-48">
                        {c.adresses && c.adresses.length > 0 ? (
                          <div className="space-y-0.5">
                            {c.adresses.map((a, i) => (
                              <div key={i} className="truncate">
                                <span className="text-xs font-medium text-muted-foreground">
                                  {a.label || "Adresse"}:
                                </span>{" "}
                                <span className="text-xs">{a.adresse}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono whitespace-nowrap">
                        {c.numero_tps || c.numero_tvq ? (
                          <div>
                            {c.numero_tps && <div>TPS: {c.numero_tps}</div>}
                            {c.numero_tvq && <div>TVQ: {c.numero_tvq}</div>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Chargement...</p>
            ) : filtered.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Aucun contact</p>
            ) : (
              filtered.map((c) => (
                <div
                  key={c.id}
                  className="border rounded-lg p-3 space-y-1"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{c.nom}</span>
                      <Badge variant={TYPE_COLORS[c.type] || "outline"} className="text-xs">
                        {TYPE_LABELS[c.type] || c.type}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => openEdit(c)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {c.email && (
                    <p className="text-sm text-muted-foreground">{c.email}</p>
                  )}
                  {c.telephone && (
                    <p className="text-sm text-muted-foreground">{c.telephone}</p>
                  )}
                  {c.adresses && c.adresses.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {c.adresses.map((a, i) => (
                        <div key={i} className="truncate">
                          <span className="font-medium">{a.label || "Adresse"}:</span> {a.adresse}
                        </div>
                      ))}
                    </div>
                  )}
                  {(c.numero_tps || c.numero_tvq) && (
                    <div className="text-xs font-mono text-muted-foreground">
                      {c.numero_tps && <span>TPS: {c.numero_tps} </span>}
                      {c.numero_tvq && <span>TVQ: {c.numero_tvq}</span>}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-xl w-[calc(100%-1rem)] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {editingContact ? `Modifier : ${editingContact.nom}` : "Nouveau contact"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nom</Label>
                <Input
                  value={formNom}
                  onChange={(e) => setFormNom(e.target.value)}
                  placeholder="Nom du contact"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={formType} onValueChange={setFormType}>
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
              <div className="space-y-1.5">
                <Label>Courriel</Label>
                <Input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="contact@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telephone</Label>
                <Input
                  value={formTelephone}
                  onChange={(e) => setFormTelephone(e.target.value)}
                  placeholder="514-..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>N. TPS</Label>
                <Input
                  value={formNumeroTps}
                  onChange={(e) => setFormNumeroTps(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>N. TVQ</Label>
                <Input
                  value={formNumeroTvq}
                  onChange={(e) => setFormNumeroTvq(e.target.value)}
                />
              </div>
            </div>

            {/* Addresses section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  Adresses
                </Label>
                <Button variant="outline" size="sm" onClick={addAdresse}>
                  <Plus className="h-3 w-3 mr-1" />
                  Adresse
                </Button>
              </div>

              {formAdresses.length === 0 && (
                <p className="text-sm text-muted-foreground italic">
                  Aucune adresse. Cliquez sur "+ Adresse" pour en ajouter.
                </p>
              )}

              {formAdresses.map((a, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      value={a.label}
                      onChange={(e) => updateAdresse(idx, "label", e.target.value)}
                      placeholder="Label (ex: Principal, Facturation, Bureau Toronto)"
                      className="text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 shrink-0"
                      onClick={() => removeAdresse(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    value={a.adresse}
                    onChange={(e) => updateAdresse(idx, "adresse", e.target.value)}
                    placeholder="357 rue des Merles, Boucherville, Qc J4B 5Y5"
                    rows={2}
                  />
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row justify-between gap-2">
              <div>
                {editingContact && !showDeleteConfirm && (
                  <Button
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </Button>
                )}
                {showDeleteConfirm && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-600">
                      Supprimer ce contact ? Les transactions liees seront delinkees.
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                    >
                      Confirmer
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Annuler
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetForm}>
                  Annuler
                </Button>
                <Button onClick={handleSave} disabled={!formNom.trim()}>
                  {editingContact ? "Enregistrer" : "Creer"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

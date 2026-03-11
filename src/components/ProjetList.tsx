import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import type { Projet, Transaction } from "@/types";
import { FolderOpen, Plus, Pencil, Trash2 } from "lucide-react";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(
    n,
  );

export default function ProjetList() {
  const [projets, setProjets] = useState<Projet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjet, setSelectedProjet] = useState<Projet | null>(null);
  const [projetTx, setProjetTx] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formNom, setFormNom] = useState("");
  const [formStatut, setFormStatut] = useState("En cours");
  const [formBudget, setFormBudget] = useState("");
  const [formDateDebut, setFormDateDebut] = useState("");
  const [formDateFin, setFormDateFin] = useState("");
  const [saving, setSaving] = useState(false);

  const loadProjets = () => {
    api
      .get<Projet[]>("/api/projets")
      .then(setProjets)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProjets();
  }, []);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormCode("");
    setFormNom("");
    setFormStatut("En cours");
    setFormBudget("");
    setFormDateDebut("");
    setFormDateFin("");
  };

  const startEdit = (p: Projet, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(p.id);
    setFormCode(p.code);
    setFormNom(p.nom);
    setFormStatut(p.statut);
    setFormBudget(p.budget ? String(p.budget) : "");
    setFormDateDebut(p.date_debut?.split("T")[0] || "");
    setFormDateFin(p.date_fin?.split("T")[0] || "");
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        code: formCode,
        nom: formNom,
        statut: formStatut,
        budget: formBudget ? Number(formBudget) : null,
        date_debut: formDateDebut || null,
        date_fin: formDateFin || null,
        compte_dedie: null,
      };
      if (editingId) {
        await api.put("/api/projets", { id: editingId, ...payload });
      } else {
        await api.post("/api/projets", payload);
      }
      resetForm();
      loadProjets();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    if (!confirm("Supprimer ce projet ? Les transactions ne seront pas supprimees mais ne seront plus liees a ce projet.")) return;
    await api.delete(`/api/projets?id=${editingId}`);
    resetForm();
    loadProjets();
  };

  const openProjet = async (p: Projet) => {
    setSelectedProjet(p);
    setLoadingTx(true);
    try {
      const data = await api.get<{ rows: Transaction[]; total: number }>(
        `/api/transactions?projet=${p.id}&limit=200`,
      );
      setProjetTx(data.rows);
    } finally {
      setLoadingTx(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Projets ({projets.length})
            </CardTitle>
            <Button onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau projet
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {projets.map((p) => {
              const rev = Number(p.revenus || 0);
              const dep = Number(p.depenses || 0);
              const marge = rev - dep;
              const pct = rev > 0 ? (marge / rev) * 100 : 0;
              return (
                <Card
                  key={p.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => openProjet(p)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-lg">{p.code}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Modifier"
                          onClick={(e) => startEdit(p, e)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Badge
                          variant={
                            p.statut === "En cours" ? "default" : "secondary"
                          }
                        >
                          {p.statut}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {p.nom}
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Revenus</p>
                        <p className="font-mono text-green-700">{fmt(rev)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Dépenses</p>
                        <p className="font-mono text-red-700">{fmt(dep)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Marge</p>
                        <p
                          className={`font-mono ${marge >= 0 ? "text-green-700" : "text-red-700"}`}
                        >
                          {pct.toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    {p.budget &&
                      Number(p.budget) > 0 &&
                      (() => {
                        const budgetPct = (dep / Number(p.budget)) * 100;
                        const barColor =
                          budgetPct >= 100
                            ? "bg-red-500"
                            : budgetPct >= 80
                              ? "bg-amber-500"
                              : "bg-green-500";
                        return (
                          <div className="mt-3">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>Budget</span>
                              <span>
                                {fmt(dep)} / {fmt(Number(p.budget))}
                              </span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded overflow-hidden">
                              <div
                                className={`h-1.5 rounded ${barColor}`}
                                style={{
                                  width: `${Math.min(budgetPct, 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Project Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md w-[calc(100%-1rem)] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier le projet" : "Nouveau projet"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="CTV_0025"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Statut</Label>
                <Select value={formStatut} onValueChange={setFormStatut}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="En cours">En cours</SelectItem>
                    <SelectItem value="Terminé">Termine</SelectItem>
                    <SelectItem value="En pause">En pause</SelectItem>
                    <SelectItem value="Annulé">Annule</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input
                value={formNom}
                onChange={(e) => setFormNom(e.target.value)}
                placeholder="Nom du projet"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Budget</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formBudget}
                  onChange={(e) => setFormBudget(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Debut</Label>
                <Input
                  type="date"
                  value={formDateDebut}
                  onChange={(e) => setFormDateDebut(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fin</Label>
                <Input
                  type="date"
                  value={formDateFin}
                  onChange={(e) => setFormDateFin(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-between pt-2">
              {editingId ? (
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Supprimer
                </Button>
              ) : <div />}
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetForm}>Annuler</Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !formCode || !formNom}
                >
                  {saving ? "Enregistrement..." : editingId ? "Modifier" : "Creer"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Project Transactions Dialog */}
      <Dialog
        open={!!selectedProjet}
        onOpenChange={() => setSelectedProjet(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedProjet?.code} — {selectedProjet?.nom}
            </DialogTitle>
          </DialogHeader>
          {loadingTx ? (
            <p className="text-muted-foreground py-4">Chargement...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Total TTC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projetTx.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-4 text-muted-foreground"
                    >
                      Aucune transaction
                    </TableCell>
                  </TableRow>
                ) : (
                  projetTx.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{tx.date_transaction}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            tx.type === "revenu" ? "default" : "destructive"
                          }
                        >
                          {tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {tx.description}
                      </TableCell>
                      <TableCell>{tx.contact_nom}</TableCell>
                      <TableCell
                        className={`text-right font-mono ${tx.type === "revenu" ? "text-green-700" : "text-red-700"}`}
                      >
                        {fmt(Number(tx.total_ttc))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import TransactionForm from "./TransactionForm";
import type { TransactionFormData } from "@/types";

interface Shortcut {
  label: string;
  data: Partial<TransactionFormData>;
}

// These IDs match the seed data from migrations
const SHORTCUTS: Shortcut[] = [
  {
    label: "Part actionnaire VJ",
    data: {
      type: "dépense",
      description: "Part actionnaire — Virginie Jaffredo",
      categorie_id: 9, // Part actionnaire
      contact_id: 9, // Virginie Jaffredo
      compte_id: 1, // Cpte 1-20 Opérations
      mode_paiement: "Virement Interac",
      taxable: false,
    },
  },
  {
    label: "Part actionnaire PM",
    data: {
      type: "dépense",
      description: "Part actionnaire — Pierre Michaud",
      categorie_id: 9, // Part actionnaire
      contact_id: 8, // Pierre Michaud
      compte_id: 1, // Cpte 1-20 Opérations
      mode_paiement: "Virement Interac",
      taxable: false,
    },
  },
  {
    label: "Frais forfait Cpte 21 (FIS)",
    data: {
      type: "dépense",
      description: "Frais forfaitaires — Compte 2-21 La Fissure",
      categorie_id: 5, // Frais bancaires
      projet_id: 6, // FIS — La Fissure
      compte_id: 2, // Cpte 2-21 La Fissure
      mode_paiement: "Débit",
      taxable: false,
    },
  },
  {
    label: "Frais forfait Cpte 24 (WF)",
    data: {
      type: "dépense",
      description: "Frais forfaitaires — Compte 2-24 Whispering Forest",
      categorie_id: 5, // Frais bancaires
      projet_id: 5, // WF — Whispering Forest
      compte_id: 3, // Cpte 2-24 Whispering Forest
      mode_paiement: "Débit",
      taxable: false,
    },
  },
  {
    label: "Facture client",
    data: {
      type: "revenu",
      description: "",
      categorie_id: 14, // Revenu client
      compte_id: 1, // Cpte 1-20 Opérations
      mode_paiement: "Virement Interac",
      taxable: true,
      statut_facture: "Envoyée",
    },
  },
  {
    label: "Transfert interne",
    data: {
      type: "transfert",
      description: "Transfert interne entre comptes",
      categorie_id: 10, // Transfert interne
      taxable: false,
    },
  },
];

export default function SaisieManuelle() {
  const [preset, setPreset] = useState<
    Partial<TransactionFormData> | undefined
  >(undefined);
  const [key, setKey] = useState(0);

  const applyShortcut = (data: Partial<TransactionFormData>) => {
    setPreset({
      ...data,
      date_transaction: new Date().toISOString().split("T")[0],
    });
    setKey((k) => k + 1);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4" />
            Raccourcis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {SHORTCUTS.map((s) => (
              <Button
                key={s.label}
                variant="outline"
                size="sm"
                onClick={() => applyShortcut(s.data)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      <TransactionForm key={key} initialData={preset} />
    </div>
  );
}

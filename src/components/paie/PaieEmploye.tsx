import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Coins, Landmark, LayoutDashboard, Settings, Users } from "lucide-react";
import { api } from "@/lib/api";
import type { CompteBancaire, Employe, MoisDAS, Paie, ParametresPaieAnnee } from "@/types";
import PaieTableauBord from "./PaieTableauBord";
import PaiesListe from "./PaiesListe";
import DasListe from "./DasListe";
import EmployesListe from "./EmployesListe";
import JournalPaie from "./JournalPaie";
import ParametresPaie from "./ParametresPaie";

export type DonneesPaie = {
  annee: number;
  employes: Employe[];
  comptes: CompteBancaire[];
  parametres: ParametresPaieAnnee[];
  paies: Paie[];
  das: MoisDAS[];
  readOnly: boolean;
  recharger: () => Promise<void>;
};

const anneeCourante = new Date().getFullYear();
const ANNEES = [anneeCourante + 1, anneeCourante, anneeCourante - 1, anneeCourante - 2].filter((a) => a >= 2026);

export default function PaieEmploye({ readOnly }: { readOnly: boolean }) {
  const [onglet, setOnglet] = useState("tableau");
  const [annee, setAnnee] = useState(anneeCourante);
  const [donnees, setDonnees] = useState<Omit<DonneesPaie, "annee" | "readOnly" | "recharger"> | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const recharger = useCallback(
    () =>
      Promise.all([
        api.get<Employe[]>("/api/paie/employes"),
        api.get<CompteBancaire[]>("/api/comptes").catch(() => [] as CompteBancaire[]),
        api.get<ParametresPaieAnnee[]>("/api/paie/parametres"),
        api.get<Paie[]>(`/api/paie?annee=${annee}`),
        api.get<MoisDAS[]>(`/api/paie/das?annee=${annee}`),
      ]).then(
        ([employes, comptes, parametres, paies, das]) => {
          setDonnees({ employes, comptes, parametres, paies, das });
          setErreur(null);
        },
        (e) => setErreur(e instanceof Error ? e.message : "Erreur de chargement"),
      ),
    [annee],
  );

  useEffect(() => {
    recharger();
  }, [recharger]);

  if (erreur) return <p className="text-red-700">{erreur}</p>;
  if (!donnees) return <p className="text-muted-foreground">Chargement de la paie…</p>;

  const d: DonneesPaie = { ...donnees, annee, readOnly, recharger };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Paie employé</h1>
          {readOnly && <p className="text-sm text-muted-foreground">Consultation et exports seulement</p>}
        </div>
        <Select value={String(annee)} onValueChange={(v) => setAnnee(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ANNEES.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={onglet} onValueChange={setOnglet}>
        <TabsList className="mb-4 h-auto w-full flex-wrap justify-start sm:w-fit">
          <TabsTrigger value="tableau"><LayoutDashboard className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Tableau de bord</span></TabsTrigger>
          <TabsTrigger value="paies"><Coins className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Paies</span></TabsTrigger>
          <TabsTrigger value="das"><Landmark className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">DAS</span></TabsTrigger>
          <TabsTrigger value="employes"><Users className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Employés</span></TabsTrigger>
          <TabsTrigger value="journal"><BookOpen className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Journal</span></TabsTrigger>
          <TabsTrigger value="parametres"><Settings className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Paramètres</span></TabsTrigger>
        </TabsList>
        <TabsContent value="tableau"><PaieTableauBord {...d} allerA={setOnglet} /></TabsContent>
        <TabsContent value="paies"><PaiesListe {...d} /></TabsContent>
        <TabsContent value="das"><DasListe {...d} /></TabsContent>
        <TabsContent value="employes"><EmployesListe {...d} /></TabsContent>
        <TabsContent value="journal"><JournalPaie {...d} /></TabsContent>
        <TabsContent value="parametres"><ParametresPaie {...d} /></TabsContent>
      </Tabs>
    </div>
  );
}

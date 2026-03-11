import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import Login from "@/components/Login";
import Dashboard from "@/components/Dashboard";
import SaisiePhoto from "@/components/SaisiePhoto";
import SaisieDocument from "@/components/SaisieDocument";
import SaisieManuelle from "@/components/SaisieManuelle";
import ImportCSV from "@/components/ImportCSV";
import TransactionList from "@/components/TransactionList";
import ProjetList from "@/components/ProjetList";
import Rapports from "@/components/Rapports";
import Factures from "@/components/Factures";
import BudgetTracker from "@/components/BudgetTracker";
import RapprochementComp from "@/components/Rapprochement";
import RecurrenceList from "@/components/RecurrenceList";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import logoWhite from "@/assets/logo-white.png";
import {
  LayoutDashboard,
  Camera,
  FileUp,
  PenLine,
  Upload,
  List,
  FolderOpen,
  FileText,
  Receipt,
  PieChart,
  CheckSquare,
  RefreshCw,
  LogOut,
  Menu,
  X,
} from "lucide-react";

type Page =
  | "dashboard"
  | "saisie"
  | "transactions"
  | "factures"
  | "projets"
  | "budgets"
  | "rapprochement"
  | "recurrences"
  | "rapports";

const NAV_ITEMS: { key: Page; label: string; icon: React.ReactNode }[] = [
  {
    key: "dashboard",
    label: "Tableau de bord",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  { key: "saisie", label: "Saisie", icon: <PenLine className="h-4 w-4" /> },
  {
    key: "transactions",
    label: "Transactions",
    icon: <List className="h-4 w-4" />,
  },
  {
    key: "factures",
    label: "Factures",
    icon: <Receipt className="h-4 w-4" />,
  },
  {
    key: "projets",
    label: "Projets",
    icon: <FolderOpen className="h-4 w-4" />,
  },
  {
    key: "budgets",
    label: "Budgets",
    icon: <PieChart className="h-4 w-4" />,
  },
  {
    key: "rapprochement",
    label: "Rapprochement",
    icon: <CheckSquare className="h-4 w-4" />,
  },
  {
    key: "recurrences",
    label: "Récurrences",
    icon: <RefreshCw className="h-4 w-4" />,
  },
  {
    key: "rapports",
    label: "Rapports",
    icon: <FileText className="h-4 w-4" />,
  },
];

export default function App() {
  const { authenticated, loading, error, login, logout } = useAuth();
  const [page, setPage] = useState<Page>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [saisieTab, setSaisieTab] = useState("photo");

  // Auto-generate due recurring transactions on login
  useEffect(() => {
    if (authenticated) {
      api.post("/api/recurrences", { action: "generate" }).catch(() => {});
    }
  }, [authenticated]);

  if (!authenticated) {
    return <Login onLogin={login} error={error} loading={loading} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 shrink-0">
            <button
              className="xl:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
            <img src={logoWhite} alt="JAXA Production" className="h-8" />
          </div>
          <nav className="hidden xl:flex items-center gap-0">
            {NAV_ITEMS.map((item) => (
              <Button
                key={item.key}
                variant={page === item.key ? "secondary" : "ghost"}
                size="sm"
                className={`px-2 ${
                  page === item.key ? "" : "text-slate-300 hover:text-slate-900"
                }`}
                onClick={() => setPage(item.key)}
                title={item.label}
              >
                {item.icon}
                <span className="ml-1 hidden 2xl:inline">{item.label}</span>
              </Button>
            ))}
          </nav>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon-lg"
              className={`xl:hidden ${page === "saisie" && saisieTab === "photo" ? "bg-secondary text-secondary-foreground" : "text-slate-300 hover:text-slate-900"}`}
              onClick={() => {
                setSaisieTab("photo");
                setPage("saisie");
                setMobileMenuOpen(false);
              }}
              title="Scanner un reçu"
            >
              <Camera className="size-7" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-300 hover:text-slate-900 h-8 w-8"
              onClick={logout}
              title="Déconnexion"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Burger menu (below xl breakpoint) */}
        {mobileMenuOpen && (
          <nav className="xl:hidden border-t border-slate-700 px-4 py-2 space-y-1">
            {NAV_ITEMS.map((item) => (
              <Button
                key={item.key}
                variant={page === item.key ? "secondary" : "ghost"}
                size="sm"
                className={`w-full justify-start ${page === item.key ? "" : "text-slate-300"}`}
                onClick={() => {
                  setPage(item.key);
                  setMobileMenuOpen(false);
                }}
              >
                {item.icon}
                <span className="ml-2">{item.label}</span>
              </Button>
            ))}
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {page === "dashboard" && <Dashboard />}

        {page === "saisie" && (
          <Tabs value={saisieTab} onValueChange={setSaisieTab}>
            <TabsList className="mb-4 w-full sm:w-fit">
              <TabsTrigger value="photo">
                <Camera className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Photo</span>
              </TabsTrigger>
              <TabsTrigger value="document">
                <FileUp className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Document</span>
              </TabsTrigger>
              <TabsTrigger value="csv">
                <Upload className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Import CSV</span>
              </TabsTrigger>
              <TabsTrigger value="manuel">
                <PenLine className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Manuel</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="photo">
              <SaisiePhoto />
            </TabsContent>
            <TabsContent value="document">
              <SaisieDocument />
            </TabsContent>
            <TabsContent value="csv">
              <ImportCSV />
            </TabsContent>
            <TabsContent value="manuel">
              <SaisieManuelle />
            </TabsContent>
          </Tabs>
        )}

        {page === "transactions" && <TransactionList />}
        {page === "factures" && <Factures />}
        {page === "projets" && <ProjetList />}
        {page === "budgets" && <BudgetTracker />}
        {page === "rapprochement" && <RapprochementComp />}
        {page === "recurrences" && <RecurrenceList />}
        {page === "rapports" && <Rapports />}
      </main>
    </div>
  );
}

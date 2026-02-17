import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard,
  Camera,
  FileUp,
  PenLine,
  Upload,
  List,
  FolderOpen,
  FileText,
  LogOut,
  Menu,
  X,
} from "lucide-react";

type Page = "dashboard" | "saisie" | "transactions" | "projets" | "rapports";

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
    key: "projets",
    label: "Projets",
    icon: <FolderOpen className="h-4 w-4" />,
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

  if (!authenticated) {
    return <Login onLogin={login} error={error} loading={loading} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
            <h1 className="font-bold text-lg">JAXA Compta</h1>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Button
                key={item.key}
                variant={page === item.key ? "secondary" : "ghost"}
                size="sm"
                className={
                  page === item.key ? "" : "text-slate-300 hover:text-white"
                }
                onClick={() => setPage(item.key)}
              >
                {item.icon}
                <span className="ml-1.5">{item.label}</span>
              </Button>
            ))}
          </nav>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-white"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Déconnexion</span>
          </Button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-slate-700 px-4 py-2 space-y-1">
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
          <Tabs defaultValue="photo">
            <TabsList className="mb-4">
              <TabsTrigger value="photo">
                <Camera className="h-4 w-4 mr-1.5" />
                Photo
              </TabsTrigger>
              <TabsTrigger value="document">
                <FileUp className="h-4 w-4 mr-1.5" />
                Document
              </TabsTrigger>
              <TabsTrigger value="csv">
                <Upload className="h-4 w-4 mr-1.5" />
                Import CSV
              </TabsTrigger>
              <TabsTrigger value="manuel">
                <PenLine className="h-4 w-4 mr-1.5" />
                Manuel
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
        {page === "projets" && <ProjetList />}
        {page === "rapports" && <Rapports />}
      </main>
    </div>
  );
}

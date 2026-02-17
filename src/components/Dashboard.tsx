import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '@/lib/api';
import type { DashboardData } from '@/types';

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n);

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardData>('/api/dashboard').then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Chargement...</p></div>;
  }

  if (!data) {
    return <div className="p-4"><p className="text-red-600">Erreur de chargement</p></div>;
  }

  const soldeTotal = data.soldes.reduce((s, c) => s + Number(c.solde_actuel || 0), 0);
  const ecart = Number(data.mois.revenus) - Number(data.mois.depenses);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Solde total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(soldeTotal)}</div>
            <p className="text-xs text-muted-foreground">{data.soldes.length} comptes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenus (mois)</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{fmt(Number(data.mois.revenus))}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dépenses (mois)</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{fmt(Number(data.mois.depenses))}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Écart</CardTitle>
            {ecart >= 0 ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${ecart >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {fmt(ecart)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Évolution 12 derniers mois</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.evolution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => fmt(value)} />
                <Legend />
                <Bar dataKey="revenus" name="Revenus" fill="#16a34a" radius={[2, 2, 0, 0]} />
                <Bar dataKey="depenses" name="Dépenses" fill="#dc2626" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Projets actifs */}
        <Card>
          <CardHeader>
            <CardTitle>Projets actifs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.projets.map((p) => {
                const marge = Number(p.revenus) - Number(p.depenses);
                const pctMarge = Number(p.revenus) > 0 ? (marge / Number(p.revenus)) * 100 : 0;
                return (
                  <div key={p.code} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <span className="font-medium">{p.code}</span>
                      <span className="text-sm text-muted-foreground ml-2">{p.nom}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{fmt(marge)}</span>
                      <Badge variant={marge >= 0 ? 'default' : 'destructive'}>
                        {pctMarge.toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
              {data.projets.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun projet actif</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Soldes comptes */}
        <Card>
          <CardHeader>
            <CardTitle>Soldes par compte</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.soldes.map((c) => (
                <div key={c.code} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <span className="font-medium">{c.nom}</span>
                  </div>
                  <span className={`font-mono ${Number(c.solde_actuel) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {fmt(Number(c.solde_actuel))}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Factures en retard */}
      {data.factures_retard.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Factures en retard ({data.factures_retard.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.factures_retard.map((f) => (
                <div key={f.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{f.contact_nom}</span>
                    <span className="text-muted-foreground ml-2">{f.description}</span>
                    {f.projet_code && <Badge variant="outline" className="ml-2">{f.projet_code}</Badge>}
                  </div>
                  <span className="font-mono text-red-700">{fmt(Number(f.total_ttc))}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

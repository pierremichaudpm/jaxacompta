import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock } from 'lucide-react';

interface LoginProps {
  onLogin: (password: string, email?: string) => Promise<void>;
  error: string | null;
  loading: boolean;
}

export default function Login({ onLogin, error, loading }: LoginProps) {
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState(() => new URLSearchParams(window.location.search).get('email') || '');
  const [guest, setGuest] = useState(() => !!new URLSearchParams(window.location.search).get('email'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onLogin(password, guest ? email : undefined).catch(() => {});
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f0e1] p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900">
            <Lock className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-xl">JAXA Compta</CardTitle>
          <p className="text-sm text-muted-foreground">JAXA Production Inc.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 mb-4" aria-label="Type d’accès">
            <Button type="button" variant={guest ? 'outline' : 'default'} aria-pressed={!guest} onClick={() => { setGuest(false); setPassword(''); }}>Équipe JAXA</Button>
            <Button type="button" variant={guest ? 'default' : 'outline'} aria-pressed={guest} onClick={() => { setGuest(true); setPassword(''); }}>Accès par courriel</Button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {guest && (
              <div className="space-y-2">
                <Label htmlFor="email">Courriel</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
                <p className="text-xs text-muted-foreground">Accès paie, ou accès invité en lecture seule (consultation et exports).</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Entrez le mot de passe"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading || !password || (guest && !email.trim())}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

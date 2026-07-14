import React, { useState } from 'react'; // <-- Agora importamos o React explicitamente!
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Button } from '@/src/components/ui/button';
import { Car } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';

export default function Login({ onLogin }: { onLogin: (user: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // 1. Autentica o usuário no Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message === 'Invalid login credentials' 
          ? 'E-mail ou senha incorretos' 
          : authError.message
        );
        setLoading(false);
        return;
      }

      if (data?.user) {
        // 2. Busca o perfil do usuário logado na tabela 'perfis'
        const { data: perfil, error: perfilError } = await supabase
          .from('perfis')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (perfilError) {
          console.warn('Perfil não encontrado. Usando dados padrão:', perfilError.message);
          onLogin({ ...data.user, role: 'vendedor' });
        } else {
          onLogin({ ...data.user, ...perfil });
        }
      }
    } catch (err) {
      setError('Erro de conexão com o banco de dados');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-zinc-300 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <div className="h-12 w-12 bg-emerald-600 rounded-full flex items-center justify-center text-white">
              <Car size={24} />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white">SDA-V8</CardTitle>
          <CardDescription>Sistema de Cotação Serra Dourada</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input 
                id="email" 
                type="email"
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="seu-email@dominio.com" 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input 
                id="password" 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="••••••••" 
                required 
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Conectando...' : 'Entrar'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
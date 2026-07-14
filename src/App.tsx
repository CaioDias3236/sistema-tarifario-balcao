import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Login from './pages/Login';
import Vendedor from './pages/Vendedor';
import Supervisor from './pages/Supervisor';
import { supabase } from './lib/supabase';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Sincroniza a sessão do Supabase com o cookie legado do Express (rota-ponte).
    // Só consideramos o usuário logado DEPOIS que o cookie foi emitido, senão as
    // telas de dados fariam chamadas à API antiga sem cookie e receberiam 401.
    async function hydrate(session: any) {
      if (!session) {
        if (active) setUser(null);
        return;
      }
      try {
        const res = await fetch('/api/auth/bridge', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const { user: appUser } = await res.json();
          if (active) setUser(appUser);
        } else if (active) {
          setUser(null);
        }
      } catch {
        if (active) setUser(null);
      }
    }

    supabase.auth.getSession().then(async ({ data }) => {
      await hydrate(data.session);
      if (active) setLoading(false);
    });

    // Mantém a sessão em sincronia (login, logout, refresh de token).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrate(session);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><p>Carregando...</p></div>;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/" element={
          !user ? <Navigate to="/login" /> :
          user.role === 'SUPERVISOR' ? <Navigate to="/supervisor" /> : <Navigate to="/vendedor" />
        } />
        <Route path="/vendedor" element={!user ? <Navigate to="/login" /> : <Vendedor user={user} />} />
        <Route path="/supervisor" element={!user || user.role !== 'SUPERVISOR' ? <Navigate to="/" /> : <Supervisor user={user} />} />
      </Routes>
    </Router>
  );
}

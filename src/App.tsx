import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Login from './pages/Login';
import Vendedor from './pages/Vendedor';
import Supervisor from './pages/Supervisor';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) setUser(data.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><p>Carregando...</p></div>;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login onLogin={setUser} />} />
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

import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useT } from '../i18n/lang';
import { Logo } from './components/Logo';
import { hasPendingLink, stashPendingLink } from './pendingLink';
import { Catalogue } from './pages/Catalogue';
import { Counter } from './pages/Counter';
import { Home } from './pages/Home';
import { More } from './pages/More';
import { Pay } from './pages/Pay';
import { Receipt } from './pages/Receipt';
import { Receive } from './pages/Receive';
import { Sales } from './pages/Sales';
import { Settings } from './pages/Settings';
import { ShopSetup } from './pages/ShopSetup';
import { SignIn } from './pages/SignIn';
import { SessionProvider, useSession } from './session';

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Gate />
      </SessionProvider>
    </BrowserRouter>
  );
}

/** Signed out → sign in; no shop yet → name the shop; otherwise the app. */
function Gate() {
  const t = useT();
  const { status } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  // A price-list link opened before signing in is kept and picked up once the shop is ready.
  useEffect(() => {
    if (status !== 'ready' && location.pathname === '/terima' && location.hash.includes('d=')) stashPendingLink(location.hash);
    if (status === 'ready' && location.pathname !== '/terima' && hasPendingLink()) navigate('/terima', { replace: true });
  }, [status, location.pathname, location.hash, navigate]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-brand-ink text-brand-muted" role="status">
        <Logo size={64} />
        <span className="text-sm">{t.app.loading}</span>
      </div>
    );
  }
  if (status === 'signedOut') return <SignIn />;
  if (status === 'needsShop') return <ShopSetup />;

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/kaunter" element={<Counter />} />
      <Route path="/kaunter/bayar" element={<Pay />} />
      <Route path="/resit/:id" element={<Receipt />} />
      <Route path="/jualan" element={<Sales />} />
      <Route path="/lagi" element={<More />} />
      <Route path="/katalog" element={<Catalogue />} />
      <Route path="/terima" element={<Receive />} />
      <Route path="/tetapan" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

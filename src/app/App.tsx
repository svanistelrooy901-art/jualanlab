import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useT } from '../i18n/lang';
import { Logo } from './components/Logo';
import { hasPendingLink, stashPendingLink } from './pendingLink';
import { BazaarSell } from './pages/BazaarSell';
import { BazaarSetup } from './pages/BazaarSetup';
import { Catalogue } from './pages/Catalogue';
import { CloseDay } from './pages/CloseDay';
import { Counter } from './pages/Counter';
import { Home } from './pages/Home';
import { LegalPage } from './pages/Legal';
import { More } from './pages/More';
import { Pay } from './pages/Pay';
import { Plans } from './pages/Plans';
import { PromoEditor, Promos } from './pages/Promos';
import { Kedai } from './pages/Kedai';
import { Orders } from './pages/Orders';
import { Prep } from './pages/Prep';
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
  // The privacy notice and terms open for everyone, signed in or not.
  if (location.pathname === '/privasi') return <LegalPage doc="privacy" />;
  if (location.pathname === '/terma') return <LegalPage doc="terms" />;
  if (status === 'signedOut') return <SignIn />;
  if (status === 'needsShop') return <ShopSetup />;

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/kaunter" element={<Counter />} />
      <Route path="/kaunter/bayar" element={<Pay />} />
      <Route path="/resit/:id" element={<Receipt />} />
      <Route path="/jualan" element={<Sales />} />
      <Route path="/jualan/:day" element={<Sales />} />
      <Route path="/tutup" element={<CloseDay />} />
      <Route path="/tutup/:day" element={<CloseDay />} />
      <Route path="/lagi" element={<More />} />
      <Route path="/katalog" element={<Catalogue />} />
      <Route path="/terima" element={<Receive />} />
      <Route path="/tetapan" element={<Settings />} />
      <Route path="/pelan" element={<Plans />} />
      <Route path="/diskaun" element={<Promos />} />
      <Route path="/kedai" element={<Kedai />} />
      <Route path="/pesanan" element={<Orders />} />
      <Route path="/pesanan/sedia" element={<Prep />} />
      <Route path="/diskaun/:id" element={<PromoEditor />} />
      <Route path="/bazar" element={<BazaarSetup />} />
      <Route path="/bazar/jual" element={<BazaarSell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

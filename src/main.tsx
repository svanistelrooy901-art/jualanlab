import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import { App } from './app/App';
import { setUpdateWaiting } from './app/appUpdate';

// Offline shell: the service worker precaches the app so the counter opens with no internet.
// A new version downloads in the background; the seller decides when to switch (banner in Layout),
// so a reload never interrupts a sale.
const updateSW = registerSW({ immediate: true, onNeedRefresh: () => setUpdateWaiting(() => void switchToNewVersion()) });

async function switchToNewVersion(): Promise<void> {
  await updateSW(false);
  const started = Date.now();
  while (Date.now() - started < 5000) {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg && !reg.waiting && reg.active?.state === 'activated') break;
    await new Promise((r) => setTimeout(r, 150));
  }
  window.location.reload();
}

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

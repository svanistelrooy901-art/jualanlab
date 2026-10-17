/**
 * QR poster for the stall (Kedai): one A4 page with the store's QR code, name, logo and colour. "Cetak" opens the
 * phone's print dialog, where "Save as PDF" also works.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { readableBrand } from '../../domain/kedai';
import { useT } from '../../i18n/lang';
import { Api, type KedaiInfo } from '../api';
import { qrPath } from '../qr';
import { useShop } from '../session';

export function Poster() {
  const t = useT();
  const { shop } = useShop();
  const [info, setInfo] = useState<KedaiInfo | null>(null);
  useEffect(() => {
    void Api.kedai().then(setInfo).catch(() => undefined);
  }, []);
  const s = info?.store ?? null;
  const url = info?.kedaiUrl && s ? `${info.kedaiUrl}/${s.slug}` : null;
  const qr = useMemo(() => (url ? qrPath(url) : null), [url]);
  if (!s || !url || !qr) return <p className="p-6 text-center text-muted">{t.app.loading}</p>;
  const brand = readableBrand(s.brandColor);
  const logo = info?.images.logo ? `/api/kedai/images/logo?v=${encodeURIComponent(info.images.logo)}` : null;
  const initials = shop.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
  const how = [s.pickup.on ? t.poster.pickup : null, s.delivery.on ? t.poster.delivery : null].filter(Boolean).join(' · ');

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <style>{'@page { size: A4; margin: 0 } @media print { html, body { background: #fff } }'}</style>
      <div className="mx-auto flex max-w-xl items-center gap-2 px-4 py-3 print:hidden">
        <Link to="/kedai" className="btn-ghost min-h-11 px-3">
          ← {t.app.back}
        </Link>
        <span className="flex-1" />
        <button type="button" className="btn-primary min-h-11 px-5" onClick={() => window.print()}>
          {t.poster.print}
        </button>
      </div>
      <p className="mx-auto max-w-xl px-4 pb-3 text-sm text-muted print:hidden">{t.poster.hint}</p>

      {/* The A4 page: 210 × 297 mm, scaled down on screen. */}
      <div className="mx-auto w-full max-w-xl px-4 pb-8 print:max-w-none print:p-0">
        <div
          className="mx-auto aspect-[210/297] w-full overflow-hidden bg-white shadow-lg print:aspect-auto print:h-[297mm] print:w-[210mm] print:shadow-none"
          style={{ containerType: 'inline-size', color: '#1E1512' }}
        >
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        >
          <div style={{ background: brand, color: '#fff', padding: '6cqw 8cqw 7cqw', borderRadius: '0 0 6cqw 6cqw', flex: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3.5cqw' }}>
              <div style={{ width: '13cqw', height: '13cqw', borderRadius: '3.5cqw', background: '#fff', color: brand, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontWeight: 800, fontSize: '5.5cqw', flex: 'none' }}>
                {logo ? <img src={logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '6.5cqw', lineHeight: 1.05, letterSpacing: '-0.02em' }}>{shop.name}</div>
                {s.tagline && <div style={{ fontSize: '3.3cqw', opacity: 0.92, marginTop: '1cqw' }}>{s.tagline}</div>}
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', padding: '5cqw 8cqw 0', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '8cqw', lineHeight: 1, letterSpacing: '-0.02em' }}>{t.poster.scan}</div>
            <div style={{ fontSize: '3.6cqw', color: '#75685F', marginTop: '2cqw' }}>{t.poster.scanSub}</div>
            <div style={{ margin: '4cqw auto 0', width: '48cqw', padding: '3cqw', borderRadius: '5cqw', border: `1.2cqw solid ${brand}`, background: '#fff' }}>
              <svg viewBox={`-2 -2 ${qr.size + 4} ${qr.size + 4}`} role="img" aria-label={`QR: ${url}`} style={{ display: 'block', width: '100%', height: 'auto' }} shapeRendering="crispEdges">
                <rect x="-2" y="-2" width={qr.size + 4} height={qr.size + 4} fill="#fff" />
                <path d={qr.d} fill="#000" />
              </svg>
            </div>
            <div style={{ marginTop: '3.5cqw', fontWeight: 800, fontSize: '3.8cqw', color: brand, wordBreak: 'break-all' }}>{url.replace(/^https?:\/\//, '')}</div>
          </div>

          <div style={{ padding: '0 8cqw 6cqw', flex: 'none' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '2.5cqw', textAlign: 'center' }}>
              {[t.poster.step1, t.poster.step2, t.poster.step3].map((step, n) => (
                <div key={n} style={{ background: '#F6F3EF', borderRadius: '3cqw', padding: '3cqw 2cqw' }}>
                  <div style={{ width: '7cqw', height: '7cqw', borderRadius: '99px', background: brand, color: '#fff', fontWeight: 800, fontSize: '3.6cqw', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5cqw' }}>{n + 1}</div>
                  <div style={{ fontSize: '3.1cqw', fontWeight: 700 }}>{step}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4cqw', fontSize: '2.8cqw', color: '#75685F' }}>
              <span>{[s.preorder.on ? t.poster.preorder : null, how].filter(Boolean).join(' · ')}</span>
              <span>{t.poster.madeWith}</span>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Kedai setup (DECISIONS K-01 to K-12): the store's link, look, how customers get their order, payment rules,
 * contacts and which items show online. Saved to the server (stores are public), so changes need internet.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { groupByCategory, type Item } from '../../domain/items';
import { DEFAULT_ITEM_STORE, isSlug, MAX_ABOUT, MAX_ANNOUNCEMENT, MAX_AREAS, MAX_BATCH_LABEL, MAX_BATCHES, MAX_ITEM_DESC, MAX_STOCK, MAX_TAGLINE, type Batch, type ItemStore, type StoreSettings } from '../../domain/kedai';
import { formatRM, parseRinggit } from '../../domain/money';
import { fill, useT } from '../../i18n/lang';
import { Api, ApiError, type KedaiImages, type KedaiInfo } from '../api';
import { Layout } from '../components/Layout';
import { ErrorNote, Sheet } from '../components/Sheet';
import { errorText } from '../errors';
import { useShop } from '../session';
import { shrinkImage } from '../images';

type HeaderImage = 'logo' | 'cover';

const SWATCHES = ['#B4351C', '#D9480F', '#C2185B', '#7A2E8E', '#4338CA', '#0B63CE', '#0F766E', '#1F5C4A', '#4D7C0F', '#A16207', '#6B4A3A', '#1E1512'];
const UNPAID = [30, 60, 120, 240, 720, 1440];

export function Kedai() {
  const t = useT();
  const { shop, items, me, refreshKedai } = useShop();
  const [info, setInfo] = useState<KedaiInfo | null>(null);
  const [s, setS] = useState<StoreSettings | null>(null);
  const [areaFees, setAreaFees] = useState<string[]>([]);
  const [minOrder, setMinOrder] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [editing, setEditing] = useState<Item | null>(null);

  useEffect(() => {
    Api.kedai()
      .then((k) => {
        setInfo(k);
        if (k.store) load(k.store);
      })
      .catch((e) => setError(errorText(e, t)));
  }, []);

  function load(st: StoreSettings) {
    setS(st);
    setAreaFees(st.delivery.areas.map((a) => (a.feeSen / 100).toFixed(2)));
    setMinOrder(st.minOrderSen ? (st.minOrderSen / 100).toFixed(2) : '');
  }

  const link = info?.kedaiUrl && s ? `${info.kedaiUrl}/${s.slug}` : null;
  const savedStore = info?.store ?? null;
  const live = !!savedStore?.published;
  const set = <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => s && setS({ ...s, [k]: v });

  async function save() {
    if (!s) return;
    const fees = areaFees.map((f) => parseRinggit(f));
    if (fees.some((f) => f === null)) return setError(t.kedai.errors.delivery);
    const min = minOrder.trim() ? parseRinggit(minOrder) : 0;
    if (min === null) return setError(t.kedai.errors.other);
    const next: StoreSettings = { ...s, minOrderSen: min, delivery: { ...s.delivery, areas: s.delivery.areas.map((a, i) => ({ name: a.name.trim(), feeSen: fees[i]! })) } };
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const r = await Api.saveKedai(next);
      load(r.store);
      setInfo(info ? { ...info, store: r.store } : info);
      setSaved(t.kedai.saved);
      void refreshKedai();
    } catch (e) {
      if (e instanceof ApiError && e.offline) setError(t.kedai.needsOnline);
      else if (e instanceof ApiError && e.code === 'slug_taken') setError(t.kedai.slugTaken);
      else if (e instanceof ApiError && e.code === 'bad_settings') {
        const key = String(e.extra.detail ?? '') as keyof typeof t.kedai.errors;
        setError(t.kedai.errors[key] ?? t.kedai.errors.other);
      } else setError(errorText(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function shareLink() {
    if (!link) return;
    const text = `${fill(t.kedai.shareText, { name: shop.name })} ${link}`;
    try {
      if (navigator.share) await navigator.share({ title: shop.name, text, url: link });
      else {
        await navigator.clipboard.writeText(link);
        setSaved(t.kedai.copied);
      }
    } catch {
      /* closed */
    }
  }

  if (!info) {
    return (
      <Layout title={t.kedai.title} back="/lagi">
        <ErrorNote>{error}</ErrorNote>
      </Layout>
    );
  }

  if (!s) {
    return (
      <Layout title={t.kedai.title} back="/lagi">
        <section className="card">
          <p className="text-lg font-bold">{t.kedai.title}</p>
          <p className="mt-1 text-sm text-muted">{t.kedai.intro}</p>
          <button type="button" className="btn-primary mt-4 w-full" onClick={() => info.suggested && load(info.suggested)}>
            {t.kedai.start}
          </button>
        </section>
      </Layout>
    );
  }

  const footer = (
    <div className="border-t border-border bg-surface px-4 py-3">
      <button type="button" className="btn-primary w-full" disabled={busy} onClick={() => void save()}>
        {busy ? t.app.saving : t.kedai.save}
      </button>
    </div>
  );

  return (
    <Layout title={t.kedai.title} back="/lagi" footer={footer}>
      <div className="space-y-3">
        <section className="card space-y-3">
          <div>
            <label className="label" htmlFor="slug">
              {t.kedai.address}
            </label>
            <div className="flex items-center rounded-xl border-[1.5px] border-border-strong bg-surface focus-within:border-primary">
              <span className="pl-3 text-sm text-subtle">{(info.kedaiUrl ?? '').replace(/^https?:\/\//, '')}/</span>
              <input
                id="slug"
                className="min-h-12 min-w-0 flex-1 bg-transparent pr-3 text-base outline-none"
                value={s.slug}
                autoCapitalize="none"
                spellCheck={false}
                onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40))}
              />
            </div>
            <p className={`mt-1 text-xs ${isSlug(s.slug) ? 'text-subtle' : 'text-bad'}`}>{t.kedai.addressHint}</p>
          </div>
          <Toggle label={t.kedai.published} hint={t.kedai.publishedHint} on={s.published} onChange={(v) => set('published', v)} />
          <Toggle label={t.kedai.open} hint={t.kedai.openHint} on={s.open} onChange={(v) => set('open', v)} />
          {live && link && (
            <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
              <a className="btn-secondary min-h-11 text-sm" href={link} target="_blank" rel="noopener">
                {t.kedai.view}
              </a>
              <button
                type="button"
                className="btn-secondary min-h-11 text-sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(link);
                  setSaved(t.kedai.copied);
                }}
              >
                {t.kedai.copy}
              </button>
              <button type="button" className="btn-secondary min-h-11 text-sm" onClick={() => void shareLink()}>
                {t.kedai.share}
              </button>
            </div>
          )}
        </section>

        <section className="card space-y-3">
          <h2 className="font-bold">{t.kedai.look}</h2>
          <ImagesEditor info={info} brand={s.brandColor} shopName={shop.name} onChange={(images) => setInfo({ ...info, images })} />
          <div>
            <p className="label">{t.kedai.brand}</p>
            <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label={t.kedai.brand}>
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={s.brandColor.toUpperCase() === c}
                  aria-label={c}
                  onClick={() => set('brandColor', c)}
                  className={`h-11 rounded-xl ${s.brandColor.toUpperCase() === c ? 'ring-[3px] ring-ink ring-offset-2' : ''}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <label className="mt-2 flex items-center gap-3 text-sm text-muted">
              <input type="color" value={s.brandColor} onChange={(e) => set('brandColor', e.target.value.toUpperCase())} className="h-10 w-14 rounded-lg border border-border" />
              {t.kedai.brandHint}
            </label>
          </div>
          <Field id="tagline" label={t.kedai.tagline} value={s.tagline} max={MAX_TAGLINE} placeholder={t.kedai.taglinePh} onChange={(v) => set('tagline', v)} />
          <Field id="ann" label={t.kedai.announcement} value={s.announcement} max={MAX_ANNOUNCEMENT} placeholder={t.kedai.announcementPh} onChange={(v) => set('announcement', v)} />
          <div>
            <label className="label" htmlFor="about">
              {t.kedai.about}
            </label>
            <textarea id="about" className="field py-3" rows={3} maxLength={MAX_ABOUT} value={s.about} onChange={(e) => set('about', e.target.value)} />
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="font-bold">{t.kedai.getIt}</h2>
          <Toggle label={t.kedai.pickup} on={s.pickup.on} onChange={(v) => set('pickup', { ...s.pickup, on: v })} />
          {s.pickup.on && (
            <div className="space-y-3 border-l-2 border-border pl-3">
              <Field id="paddr" label={t.kedai.pickupAddress} value={s.pickup.address} max={200} onChange={(v) => set('pickup', { ...s.pickup, address: v })} />
              <Field id="phours" label={t.kedai.pickupHours} value={s.pickup.hours} max={80} placeholder={t.kedai.pickupHoursPh} onChange={(v) => set('pickup', { ...s.pickup, hours: v })} />
              <Field id="pmap" label={t.kedai.mapUrl} value={s.pickup.mapUrl} max={300} placeholder="https://maps.app.goo.gl/…" onChange={(v) => set('pickup', { ...s.pickup, mapUrl: v })} />
            </div>
          )}
          <Toggle label={t.kedai.delivery} on={s.delivery.on} onChange={(v) => set('delivery', { ...s.delivery, on: v })} />
          {s.delivery.on && (
            <div className="space-y-2 border-l-2 border-border pl-3">
              <p className="label">{t.kedai.areas}</p>
              {s.delivery.areas.map((a, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <label className="sr-only" htmlFor={`an${i}`}>
                      {t.kedai.areaName}
                    </label>
                    <input id={`an${i}`} className="field" placeholder={t.kedai.areaName} maxLength={40} value={a.name} onChange={(e) => set('delivery', { ...s.delivery, areas: s.delivery.areas.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                  </div>
                  <div className="w-24">
                    <label className="sr-only" htmlFor={`af${i}`}>
                      {t.kedai.areaFee}
                    </label>
                    <input id={`af${i}`} className="field num" inputMode="decimal" placeholder="5.00" value={areaFees[i] ?? ''} onChange={(e) => setAreaFees(areaFees.map((f, j) => (j === i ? e.target.value : f)))} />
                  </div>
                  <button
                    type="button"
                    className="btn-ghost min-h-12 px-2 text-sm text-bad"
                    onClick={() => {
                      set('delivery', { ...s.delivery, areas: s.delivery.areas.filter((_, j) => j !== i) });
                      setAreaFees(areaFees.filter((_, j) => j !== i));
                    }}
                  >
                    {t.kedai.removeArea}
                  </button>
                </div>
              ))}
              {s.delivery.areas.length < MAX_AREAS && (
                <button
                  type="button"
                  className="btn-ghost min-h-10 px-0 text-sm"
                  onClick={() => {
                    set('delivery', { ...s.delivery, areas: [...s.delivery.areas, { name: '', feeSen: 0 }] });
                    setAreaFees([...areaFees, '']);
                  }}
                >
                  {t.kedai.addArea}
                </button>
              )}
              <Field id="dnote" label={t.kedai.deliveryNote} value={s.delivery.note} max={140} onChange={(v) => set('delivery', { ...s.delivery, note: v })} />
            </div>
          )}
        </section>

        <section className="card space-y-3">
          <h2 className="font-bold">{t.kedai.ordering}</h2>
          <div>
            <label className="label" htmlFor="minorder">
              {t.kedai.minOrder}
            </label>
            <input id="minorder" className="field num" inputMode="decimal" placeholder="0.00" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
          </div>
          <Toggle label={t.kedai.payAtPickup} hint={t.kedai.payAtPickupHint} on={s.payAtPickup} onChange={(v) => set('payAtPickup', v)} />
          <div>
            <label className="label" htmlFor="unpaid">
              {t.kedai.unpaid}
            </label>
            <select id="unpaid" className="field" value={s.unpaidCancelMinutes} onChange={(e) => set('unpaidCancelMinutes', Number(e.target.value))}>
              {UNPAID.map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? fill(t.kedai.minutes, { n: m }) : fill(t.kedai.hours, { n: m / 60 })}
                </option>
              ))}
            </select>
          </div>
          <div className={`rounded-xl px-3 py-2 text-sm ${info.hasQr ? 'bg-good-soft text-good' : 'bg-warn-soft text-warn'}`}>
            {info.hasQr ? t.kedai.qrHave : t.kedai.qrMissing}{' '}
            <Link to="/tetapan" className="font-bold underline">
              {t.kedai.qrSet}
            </Link>
          </div>
        </section>

        <PreorderEditor value={s.preorder} onChange={(v) => set('preorder', v)} />

        <section className="card space-y-3">
          <h2 className="font-bold">{t.kedai.contact}</h2>
          <div>
            <Field id="wa" label={t.kedai.whatsapp} value={s.whatsapp} max={20} placeholder="012-345 6789" inputMode="tel" onChange={(v) => set('whatsapp', v)} />
            <p className="mt-1 text-xs text-subtle">{t.kedai.whatsappHint}</p>
          </div>
          <Field id="ig" label="Instagram" value={s.instagram} max={41} placeholder="@namakedai" onChange={(v) => set('instagram', v)} />
          <Field id="tt" label="TikTok" value={s.tiktok} max={41} placeholder="@namakedai" onChange={(v) => set('tiktok', v)} />
          <Field id="fb" label="Facebook" value={s.facebook} max={41} placeholder="namakedai" onChange={(v) => set('facebook', v)} />
        </section>

        <ErrorNote>{error}</ErrorNote>
        {saved && <p className="rounded-xl bg-good-soft px-3 py-2 text-sm font-semibold text-good" role="status">{saved}</p>}

        <ItemsCard items={items} info={info} plan={me.shop?.plan ?? 'free'} onPick={setEditing} />
      </div>

      <Sheet open={editing !== null} title={t.kedai.itemTitle} onClose={() => setEditing(null)}>
        {editing && (
          <ItemStoreForm
            key={editing.id}
            item={editing}
            value={info.itemStore[editing.id] ?? DEFAULT_ITEM_STORE}
            photo={info.photos[editing.id] ?? null}
            onPhoto={(version) => {
              const photos = { ...info.photos };
              if (version) photos[editing.id] = version;
              else delete photos[editing.id];
              setInfo({ ...info, photos });
            }}
            onSaved={(v) => {
              setInfo({ ...info, itemStore: { ...info.itemStore, [editing.id]: v } });
              setEditing(null);
            }}
          />
        )}
      </Sheet>
    </Layout>
  );
}

function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        {hint && <span className="block text-xs text-subtle">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-border-strong'}`}
      >
        <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-[left] ${on ? 'left-7' : 'left-1'}`} />
      </button>
    </div>
  );
}

function Field(p: { id: string; label: string; value: string; max: number; placeholder?: string; inputMode?: 'tel' | 'text'; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label" htmlFor={p.id}>
        {p.label}
      </label>
      <input id={p.id} className="field" value={p.value} maxLength={p.max} placeholder={p.placeholder} inputMode={p.inputMode} onChange={(e) => p.onChange(e.target.value)} />
    </div>
  );
}

function ItemsCard({ items, info, plan, onPick }: { items: Item[]; info: KedaiInfo; plan: string; onPick: (i: Item) => void }) {
  const t = useT();
  const groups = useMemo(() => groupByCategory(items.filter((i) => i.active)), [items]);
  return (
    <section className="card p-0">
      <div className="px-4 pt-4">
        <h2 className="font-bold">{t.kedai.items}</h2>
        <p className="text-xs text-subtle">{t.kedai.itemsHint}</p>
        {plan !== 'pos' && <p className="mt-2 rounded-xl bg-primary-soft px-3 py-2 text-xs font-semibold text-primary-strong">{t.kedai.freeLimit}</p>}
      </div>
      <ul className="mt-2 divide-y divide-border">
        {groups.flatMap((g) => g.items).map((i) => {
          const st = info.itemStore[i.id] ?? DEFAULT_ITEM_STORE;
          return (
            <li key={i.id}>
              <button type="button" onClick={() => onPick(i)} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas ${st.online ? '' : 'opacity-55'}`}>
                <span className="flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-xl bg-canvas text-xs font-bold text-subtle">
                  {info.photos[i.id] ? <img src={photoSrc(i.id, info.photos[i.id]!)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <CameraIcon label={t.kedai.noPhoto} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{i.name}</span>
                  <span className="block truncate text-xs text-subtle">
                    {[st.online ? null : t.kedai.counterOnly, st.stock === 0 ? t.kedai.soldOut : st.stock !== null ? fill(t.kedai.stockN, { n: st.stock }) : null, st.featured ? t.kedai.featured : null, st.badge === 'baru' ? t.kedai.badgeNew : st.badge === 'pedas' ? t.kedai.badgeSpicy : null, st.description || null].filter(Boolean).join(' · ') || i.category || ''}
                  </span>
                </span>
                <span className="num text-sm font-bold">{formatRM(i.priceSen)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const photoSrc = (itemId: string, version: string) => `/api/kedai/items/${encodeURIComponent(itemId)}/photo?v=${encodeURIComponent(version)}`;

function ItemStoreForm({ item, value, photo, onSaved, onPhoto }: { item: Item; value: ItemStore; photo: string | null; onSaved: (v: ItemStore) => void; onPhoto: (version: string | null) => void }) {
  const t = useT();
  const [v, setV] = useState<ItemStore>(value);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState('');
  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    setError('');
    try {
      onPhoto((await Api.putItemPhoto(item.id, await shrinkImage(file, 'item'))).version);
    } catch (e) {
      setError(e instanceof Error && e.message === 'image_too_large' ? t.kedai.imageTooLarge : e instanceof ApiError && e.offline ? t.kedai.needsOnline : errorText(e, t));
    } finally {
      setPhotoBusy(false);
    }
  }
  async function removePhoto() {
    setPhotoBusy(true);
    setError('');
    try {
      await Api.deleteItemPhoto(item.id);
      onPhoto(null);
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setPhotoBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      // Stock is sent only when the seller changed it, so orders taken meanwhile are not overwritten.
      const { stock, ...rest } = { ...v, description: v.description.trim() };
      onSaved((await Api.saveItemStore(item.id, stock === value.stock ? rest : { ...rest, stock })).itemStore);
    } catch (e) {
      setError(e instanceof ApiError && e.offline ? t.kedai.needsOnline : errorText(e, t));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <p className="text-lg font-bold">{item.name}</p>
      <div className="flex items-center gap-3">
        <div className="flex h-24 w-24 flex-none items-center justify-center overflow-hidden rounded-2xl bg-canvas text-xs font-bold text-subtle">
          {photo ? <img src={photoSrc(item.id, photo)} alt={item.name} className="h-full w-full object-cover" /> : t.kedai.noPhoto}
        </div>
        <div className="flex-1 space-y-1">
          <label className={`btn-secondary min-h-11 w-full cursor-pointer text-sm ${photoBusy ? 'pointer-events-none opacity-60' : ''}`}>
            {photoBusy ? t.kedai.imageSaving : photo ? t.kedai.photoChange : t.kedai.photoAdd}
            <input type="file" accept="image/*" className="sr-only" disabled={photoBusy} onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {photo && (
            <button type="button" className="btn-ghost min-h-9 w-full text-sm text-bad" disabled={photoBusy} onClick={() => void removePhoto()}>
              {t.kedai.imageRemove}
            </button>
          )}
          <p className="text-xs text-subtle">{t.kedai.photoHint}</p>
        </div>
      </div>
      <Toggle label={t.kedai.online} on={v.online} onChange={(o) => setV({ ...v, online: o })} />
      <div className="rounded-2xl border border-border p-3">
        <Toggle label={t.kedai.trackStock} hint={t.kedai.trackStockHint} on={v.stock !== null} onChange={(on) => setV({ ...v, stock: on ? (v.stock ?? 0) : null })} />
        {v.stock !== null && (
          <div className="mt-3 flex items-center gap-2">
            <button type="button" className="btn-secondary size-12 flex-none text-2xl" aria-label={t.kedai.stockLess} onClick={() => setV({ ...v, stock: Math.max(0, (v.stock ?? 0) - 1) })}>
              −
            </button>
            <input
              id="istock"
              aria-label={t.kedai.stock}
              inputMode="numeric"
              className="field num h-12 flex-1 text-center text-xl font-extrabold"
              value={String(v.stock)}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/[^0-9]/g, '') || '0');
                setV({ ...v, stock: Math.min(MAX_STOCK, n) });
              }}
            />
            <button type="button" className="btn-secondary size-12 flex-none text-2xl" aria-label={t.kedai.stockMore} onClick={() => setV({ ...v, stock: Math.min(MAX_STOCK, (v.stock ?? 0) + 1) })}>
              +
            </button>
          </div>
        )}
        {v.stock === 0 && <p className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-xs font-semibold text-warn">{t.kedai.stockZero}</p>}
      </div>
      <div>
        <label className="label" htmlFor="idesc">
          {t.kedai.description}
        </label>
        <textarea id="idesc" className="field py-3" rows={3} maxLength={MAX_ITEM_DESC} placeholder={t.kedai.descriptionPh} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
      </div>
      <div>
        <p className="label">{t.kedai.badge}</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t.kedai.badge}>
          {([null, 'baru', 'pedas'] as const).map((b) => (
            <button
              key={b ?? 'none'}
              type="button"
              role="radio"
              aria-checked={v.badge === b}
              onClick={() => setV({ ...v, badge: b })}
              className={`min-h-11 rounded-xl border-[1.5px] text-sm font-bold ${v.badge === b ? 'border-primary bg-primary text-white' : 'border-border-strong text-muted'}`}
            >
              {b === null ? t.kedai.badgeNone : b === 'baru' ? t.kedai.badgeNew : t.kedai.badgeSpicy}
            </button>
          ))}
        </div>
      </div>
      <Toggle label={t.kedai.featured} on={v.featured} onChange={(f) => setV({ ...v, featured: f })} />
      <ErrorNote>{error}</ErrorNote>
      <button type="button" className="btn-primary w-full" disabled={busy} onClick={() => void save()}>
        {busy ? t.app.saving : t.kedai.save}
      </button>
    </div>
  );
}

/** Logo and header cover photo (Mamu's test, 15 Oct): a live preview of the store's header, with a button for each. */
function ImagesEditor({ info, brand, shopName, onChange }: { info: KedaiInfo; brand: string; shopName: string; onChange: (images: KedaiImages) => void }) {
  const t = useT();
  const [busy, setBusy] = useState<HeaderImage | null>(null);
  const [error, setError] = useState('');
  const src = (k: HeaderImage) => (info.images[k] ? `/api/kedai/images/${k}?v=${encodeURIComponent(info.images[k]!)}` : null);
  const logo = src('logo');
  const cover = src('cover');
  const initials = shopName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

  async function pick(kind: HeaderImage, file: File | undefined) {
    if (!file) return;
    setBusy(kind);
    setError('');
    try {
      onChange((await Api.putKedaiImage(kind, await shrinkImage(file, kind))).images);
    } catch (e) {
      setError(e instanceof Error && e.message === 'image_too_large' ? t.kedai.imageTooLarge : errorText(e, t));
    } finally {
      setBusy(null);
    }
  }
  async function remove(kind: HeaderImage) {
    setBusy(kind);
    setError('');
    try {
      onChange((await Api.deleteKedaiImage(kind)).images);
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy(null);
    }
  }

  const button = (kind: HeaderImage, has: boolean) => (
    <div className="flex items-center gap-2">
      <label className={`btn-secondary min-h-11 flex-1 cursor-pointer text-sm ${busy === kind ? 'pointer-events-none opacity-60' : ''}`}>
        {busy === kind ? t.kedai.imageSaving : has ? (kind === 'logo' ? t.kedai.logoChange : t.kedai.coverChange) : kind === 'logo' ? t.kedai.logoAdd : t.kedai.coverAdd}
        <input type="file" accept="image/*" className="sr-only" disabled={busy !== null} onChange={(e) => { void pick(kind, e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {has && (
        <button type="button" className="btn-ghost min-h-11 px-3 text-sm text-bad" disabled={busy !== null} onClick={() => void remove(kind)}>
          {t.kedai.imageRemove}
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="label">{t.kedai.images}</p>
      <div
        className="relative overflow-hidden rounded-2xl p-4 text-white"
        style={{
          background: cover ? `linear-gradient(180deg,rgba(18,10,6,.3),rgba(18,10,6,.75)),url("${cover}") center/cover no-repeat,${brand}` : brand,
          minHeight: cover ? 168 : 112,
        }}
        aria-label={t.kedai.imagesPreview}
      >
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white text-lg font-extrabold" style={{ color: brand }}>
          {logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : initials}
        </div>
        <p className={`${cover ? 'mt-14' : 'mt-3'} text-xl font-extrabold`}>{shopName}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {button('logo', !!logo)}
        {button('cover', !!cover)}
      </div>
      <p className="text-xs text-subtle">{t.kedai.imagesHint}</p>
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}

function CameraIcon({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={label}>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

/** Malaysian wall-clock "YYYY-MM-DDTHH:mm" for an instant, and back (Malaysia is UTC+8 all year). */
const toLocalInput = (iso: string) => new Date(Date.parse(iso) + 8 * 3600_000).toISOString().slice(0, 16);
const fromLocalInput = (v: string) => new Date(`${v}:00+08:00`).toISOString();

/** A new batch: ready next Saturday, orders closing Thursday 8 pm before it. */
function newBatch(): Batch {
  const now = new Date(Date.now() + 8 * 3600_000);
  const sat = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + ((6 - now.getUTCDay() + 7) % 7 || 7)));
  const ready = sat.toISOString().slice(0, 10);
  const thu = new Date(sat.getTime() - 2 * 864e5).toISOString().slice(0, 10);
  return { id: Math.random().toString(36).slice(2, 10), label: '', readyDate: ready, closesAt: fromLocalInput(`${thu}T20:00`), maxOrders: null };
}

/** Pra-tempah (Mamu, 17 Oct): batches with a ready date, a closing time and an optional order limit. */
function PreorderEditor({ value, onChange }: { value: StoreSettings['preorder']; onChange: (v: StoreSettings['preorder']) => void }) {
  const t = useT();
  const put = (i: number, b: Partial<Batch>) => onChange({ ...value, batches: value.batches.map((x, n) => (n === i ? { ...x, ...b } : x)) });
  return (
    <section className="card space-y-3">
      <h2 className="font-bold">{t.kedai.preorder}</h2>
      <Toggle
        label={t.kedai.preorderOn}
        hint={t.kedai.preorderHint}
        on={value.on}
        onChange={(on) => onChange({ on, batches: on && value.batches.length === 0 ? [newBatch()] : value.batches })}
      />
      {value.on && (
        <>
          {value.batches.map((b, i) => {
            const closed = Date.parse(b.closesAt) <= Date.now();
            return (
              <div key={b.id} className={`space-y-2 rounded-2xl border p-3 ${closed ? 'border-border bg-canvas' : 'border-border-strong'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{fill(t.kedai.batchN, { n: i + 1 })}</span>
                  {closed && <span className="rounded-lg bg-canvas px-2 py-0.5 text-xs font-bold text-muted">{t.kedai.batchClosed}</span>}
                </div>
                <div>
                  <label className="label" htmlFor={`bl${i}`}>{t.kedai.batchLabel}</label>
                  <input id={`bl${i}`} className="field" maxLength={MAX_BATCH_LABEL} placeholder={t.kedai.batchLabelPh} value={b.label} onChange={(e) => put(i, { label: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label" htmlFor={`br${i}`}>{t.kedai.batchReady}</label>
                    <input id={`br${i}`} type="date" className="field" value={b.readyDate} onChange={(e) => e.target.value && put(i, { readyDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="label" htmlFor={`bm${i}`}>{t.kedai.batchMax}</label>
                    <input
                      id={`bm${i}`}
                      inputMode="numeric"
                      className="field"
                      placeholder={t.kedai.batchMaxPh}
                      value={b.maxOrders ?? ''}
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(/[^0-9]/g, ''));
                        put(i, { maxOrders: n > 0 ? Math.min(n, 10_000) : null });
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor={`bc${i}`}>{t.kedai.batchCloses}</label>
                  <input id={`bc${i}`} type="datetime-local" className="field" value={toLocalInput(b.closesAt)} onChange={(e) => e.target.value && put(i, { closesAt: fromLocalInput(e.target.value) })} />
                </div>
                <button type="button" className="btn-ghost min-h-10 px-2 text-sm text-bad" onClick={() => onChange({ ...value, batches: value.batches.filter((_, n) => n !== i) })}>
                  {t.kedai.batchRemove}
                </button>
              </div>
            );
          })}
          {value.batches.length < MAX_BATCHES && (
            <button type="button" className="btn-secondary w-full" onClick={() => onChange({ ...value, batches: [...value.batches, newBatch()] })}>
              {t.kedai.batchAdd}
            </button>
          )}
          <p className="text-xs text-subtle">{t.kedai.batchSaveHint}</p>
        </>
      )}
    </section>
  );
}

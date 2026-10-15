import { useState } from 'react';
import { discountedPrice, type CartLine, type LineDiscount } from '../../domain/cart';
import { marginAt } from '../../domain/items';
import { formatPct, formatRM, parseRinggit } from '../../domain/money';
import { fill, useT } from '../../i18n/lang';

/**
 * Discount on one cart line: one of the shop's three quick percentages (5, 10, 15% unless changed under Diskaun &
 * Promosi), another percentage, or a special price. The margin after the discount comes from UntungLab's cost for
 * the item, shown before the cashier confirms. A line a promotion discounted says so; changing it is for this sale only.
 */
export function ItemDiscountForm({ line, presets, onApply }: { line: CartLine; presets: readonly number[]; onApply: (d: LineDiscount | null) => void }) {
  const t = useT();
  const list = line.listPriceSen ?? line.unitPriceSen;
  const cost = line.unitCostSen ?? (line.listPriceSen == null && line.marginPct !== null ? (list * (100 - line.marginPct)) / 100 : null);
  const listMargin = marginAt(list, cost);
  const startPct = line.listPriceSen != null && line.discountPct != null ? line.discountPct : null;
  const [preset, setPreset] = useState<number | null>(startPct !== null && presets.includes(startPct) ? startPct : null);
  const [pctText, setPctText] = useState(startPct !== null && preset === null ? String(startPct) : '');
  const [priceText, setPriceText] = useState(line.listPriceSen != null && line.discountPct == null ? (line.unitPriceSen / 100).toFixed(2) : '');

  let choice: LineDiscount | null = null;
  let error = '';
  if (preset !== null) choice = { kind: 'pct', pct: preset };
  else if (pctText.trim() !== '') {
    const pct = Number(pctText.replace(',', '.'));
    choice = { kind: 'pct', pct };
    if (discountedPrice(list, choice) === null) error = t.discount.invalidPct;
  } else if (priceText.trim() !== '') {
    const priceSen = parseRinggit(priceText);
    choice = { kind: 'price', priceSen: priceSen ?? -1 };
    if (priceSen === null || discountedPrice(list, choice) === null) error = fill(t.discount.invalidPrice, { max: formatRM(list) });
  }
  const price = choice && !error ? discountedPrice(list, choice) : null;
  const margin = price !== null ? marginAt(price, cost) : null;
  const profitEach = price !== null && cost !== null ? price - cost : null;

  return (
    <div>
      <p className="font-bold">{line.name}</p>
      <p className="num text-sm text-muted">{fill(t.discount.listPrice, { price: formatRM(list), margin: formatPct(listMargin) })}</p>
      {line.promoId && line.promoName && (
        <p className="mt-2 rounded-xl bg-promo-soft px-3 py-2 text-sm font-semibold text-promo">{fill(t.discount.fromPromo, { name: line.promoName })}</p>
      )}

      <p className="label mt-4">{t.discount.presets}</p>
      <div className="grid grid-cols-3 gap-2">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={preset === p}
            className={`num min-h-12 rounded-xl border-[1.5px] text-lg font-extrabold ${preset === p ? 'border-primary bg-primary text-white' : 'border-border-strong bg-surface text-ink'}`}
            onClick={() => {
              setPreset(preset === p ? null : p);
              setPctText('');
              setPriceText('');
            }}
          >
            {p}%
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="disc-pct">
            {t.discount.customPct}
          </label>
          <input
            id="disc-pct"
            className="field num"
            inputMode="decimal"
            placeholder="20"
            value={pctText}
            onChange={(e) => {
              setPctText(e.target.value);
              setPreset(null);
              setPriceText('');
            }}
          />
        </div>
        <div>
          <label className="label" htmlFor="disc-price">
            {t.discount.customPrice}
          </label>
          <input
            id="disc-price"
            className="field num"
            inputMode="decimal"
            placeholder={(list / 100).toFixed(2)}
            value={priceText}
            onChange={(e) => {
              setPriceText(e.target.value);
              setPreset(null);
              setPctText('');
            }}
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-bad-soft px-3 py-2 text-sm font-semibold text-bad" role="alert">
          {error}
        </p>
      )}
      {price !== null && (
        <div className="num mt-3 rounded-xl bg-canvas px-3 py-3" role="status">
          <p className="text-lg font-extrabold">{fill(t.discount.newPrice, { price: formatRM(price) })}</p>
          <p className="text-sm text-muted">{fill(t.discount.saves, { amount: formatRM(list - price) })}</p>
          {cost === null ? (
            <p className="mt-2 text-sm text-subtle">{t.discount.noCost}</p>
          ) : profitEach !== null && profitEach < 0 ? (
            <p className="mt-2 text-sm font-bold text-bad">{fill(t.discount.loss, { loss: formatRM(Math.round(-profitEach)) })}</p>
          ) : (
            <>
              <p className={`mt-2 text-sm font-bold ${listMargin !== null && margin !== null && margin < listMargin ? 'text-warn' : 'text-good'}`}>
                {fill(t.discount.margin, { margin: formatPct(margin), profit: formatRM(Math.round(profitEach ?? 0)) })}
              </p>
              {listMargin !== null && margin !== null && margin < listMargin && <p className="text-xs text-muted">{fill(t.discount.lower, { margin: formatPct(listMargin) })}</p>}
            </>
          )}
        </div>
      )}

      <button type="button" className="btn-primary mt-4 w-full" disabled={!choice || !!error} onClick={() => choice && onApply(choice)}>
        {t.discount.apply}
      </button>
      {line.listPriceSen != null && (
        <button type="button" className="btn-ghost mt-2 w-full" onClick={() => onApply(null)}>
          {t.discount.remove}
        </button>
      )}
    </div>
  );
}

/** "−10% · was RM10.00" (or "Special price · was RM10.00") under a discounted line, after the promotion's name when it has one. */
export function discountLabel(line: Pick<CartLine, 'listPriceSen' | 'discountPct' | 'promoName'>, t: ReturnType<typeof useT>): string | null {
  if (line.listPriceSen == null) return null;
  const what = line.discountPct != null ? `−${formatPct(line.discountPct).replace('−', '')}` : line.promoName ? null : t.discount.special;
  return [line.promoName, what, fill(t.discount.was, { price: formatRM(line.listPriceSen) })].filter(Boolean).join(' · ');
}

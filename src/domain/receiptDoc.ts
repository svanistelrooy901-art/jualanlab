/**
 * What goes on a receipt picture, in order, already worded and formatted. The picture itself is drawn on the
 * phone (src/app/receiptImage.ts); this part has no browser in it, so it is tested like the rest of the domain.
 */
import { lineTotal } from './cart';
import { formatRM } from './money';
import { lineDiscountText, methodLabel, type Sale } from './sale';

export interface ReceiptDoc {
  shopName: string;
  /** "Resit A7-0012" */
  heading: string;
  /** Date and time in Malaysia. */
  when: string;
  /** "DIBATALKAN · Salah tekan" when the sale was voided. */
  voided: string | null;
  lines: { name: string; detail: string; amount: string; note: string | null; discount: string | null }[];
  /** Subtotal and discount (only when there is a discount). */
  adjustments: { label: string; value: string }[];
  totalLabel: string;
  total: string;
  payment: { label: string; value: string }[];
  thanks: string;
  footer: string;
}

const WORDS = {
  ms: { receipt: 'Resit', subtotal: 'Jumlah kecil', discount: 'Diskaun', total: 'JUMLAH', cash: 'Tunai diterima', change: 'Baki', paid: 'Dibayar', thanks: 'Terima kasih!', voided: 'DIBATALKAN', footer: 'Dibuat dengan JualanLab' },
  en: { receipt: 'Receipt', subtotal: 'Subtotal', discount: 'Discount', total: 'TOTAL', cash: 'Cash received', change: 'Change', paid: 'Paid by', thanks: 'Thank you!', voided: 'VOIDED', footer: 'Made with JualanLab' },
} as const;

export function receiptDoc(shopName: string, sale: Sale, lang: 'ms' | 'en' = 'ms'): ReceiptDoc {
  const w = WORDS[lang];
  const off = lineDiscountText(lang);
  const when = new Date(sale.createdAt).toLocaleString(lang === 'ms' ? 'ms-MY' : 'en-MY', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur',
  });
  return {
    shopName,
    heading: `${w.receipt} ${sale.number}`,
    when,
    voided: sale.status === 'void' ? `${w.voided} · ${sale.voidReason ?? ''}`.trim() : null,
    lines: sale.lines.map((l) => ({
      name: l.name,
      detail: `${l.quantity} × ${formatRM(l.unitPriceSen)}`,
      amount: formatRM(lineTotal(l)),
      note: l.note ? l.note : null,
      discount: off(l),
    })),
    adjustments: sale.discountSen > 0 ? [{ label: w.subtotal, value: formatRM(sale.subtotalSen) }, { label: w.discount, value: formatRM(-sale.discountSen) }] : [],
    totalLabel: w.total,
    total: formatRM(sale.totalSen),
    payment:
      sale.cashReceivedSen !== null
        ? [{ label: w.cash, value: formatRM(sale.cashReceivedSen) }, { label: w.change, value: formatRM(sale.changeSen ?? 0) }]
        : [{ label: w.paid, value: methodLabel(sale.method, lang) }],
    thanks: w.thanks,
    footer: w.footer,
  };
}

/** File name for the picture: "resit-A7-0012.png". */
export function receiptFileName(sale: Pick<Sale, 'number'>, lang: 'ms' | 'en' = 'ms'): string {
  return `${lang === 'ms' ? 'resit' : 'receipt'}-${sale.number}.png`;
}

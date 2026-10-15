/**
 * Draws a receipt as a PNG on the phone (no internet needed): a white paper slip with the shop's name on a dark
 * band, the items, the total and how it was paid. WhatsApp shows a picture right in the chat.
 */
import type { ReceiptDoc } from '../domain/receiptDoc';

const W = 540; // drawn at 2x: a 1080 px wide picture
const SCALE = 2;
const MARGIN = 20;
const PAD = 28;
const FONT = '"Plus Jakarta Sans Variable", system-ui, -apple-system, "Segoe UI", sans-serif';
const C = { bg: '#E9EEF5', paper: '#FFFFFF', ink: '#05070A', text: '#0B1220', muted: '#5B6577', faint: '#8A94A6', line: '#CBD3DE', neon: '#3AB4FF', head: '#9AA4B2', bad: '#B42318' };

type Ctx = CanvasRenderingContext2D;

function font(ctx: Ctx, size: number, weight = 500, italic = false) {
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT}`;
}

/** Breaks text into lines that fit; a word longer than the width is split. */
export function wrap(measure: (s: string) => number, text: string, width: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (measure(next) <= width) {
      cur = next;
      continue;
    }
    if (cur) out.push(cur);
    cur = '';
    let rest = word;
    while (measure(rest) > width && rest.length > 1) {
      let n = rest.length - 1;
      while (n > 1 && measure(rest.slice(0, n)) > width) n--;
      out.push(rest.slice(0, n));
      rest = rest.slice(n);
    }
    cur = rest;
  }
  if (cur) out.push(cur);
  return out.length ? out : [''];
}

const TOOTH = 10;

/** Lays the receipt out; draws only when given the full height (from a first, measuring pass). Returns the height. */
function layout(ctx: Ctx, d: ReceiptDoc, height: number | null): number {
  const draw = height !== null;
  const left = MARGIN + PAD;
  const right = W - MARGIN - PAD;
  const inner = right - left;
  let y = MARGIN;
  if (draw) {
    // Background, then the paper slip with a torn bottom edge.
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, height);
    const bottom = height - MARGIN - TOOTH;
    ctx.fillStyle = C.paper;
    ctx.beginPath();
    ctx.moveTo(MARGIN, MARGIN + 18);
    ctx.arcTo(MARGIN, MARGIN, MARGIN + 18, MARGIN, 18);
    ctx.arcTo(W - MARGIN, MARGIN, W - MARGIN, MARGIN + 18, 18);
    ctx.lineTo(W - MARGIN, bottom);
    for (let x = W - MARGIN; x > MARGIN; x -= TOOTH * 2) {
      ctx.lineTo(Math.max(MARGIN, x - TOOTH), bottom + TOOTH);
      ctx.lineTo(Math.max(MARGIN, x - TOOTH * 2), bottom);
    }
    ctx.closePath();
    ctx.fill();
  }

  const text = (s: string, x: number, size: number, weight: number, color: string, align: CanvasTextAlign = 'left', italic = false) => {
    font(ctx, size, weight, italic);
    if (draw) {
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.fillText(s, x, y);
    }
  };
  const lines = (s: string, size: number, weight: number, width: number, italic = false) => {
    font(ctx, size, weight, italic);
    return wrap((t) => ctx.measureText(t).width, s, width);
  };
  const dashed = () => {
    if (draw) {
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  // Dark band: shop name, receipt number, date.
  const nameLines = lines(d.shopName, 28, 800, inner);
  const bandH = PAD + nameLines.length * 34 + 8 + 20 + 22 + PAD - 6;
  if (draw) {
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.moveTo(MARGIN, y + bandH);
    ctx.lineTo(MARGIN, y + 18);
    ctx.arcTo(MARGIN, y, MARGIN + 18, y, 18);
    ctx.arcTo(W - MARGIN, y, W - MARGIN, y + 18, 18);
    ctx.lineTo(W - MARGIN, y + bandH);
    ctx.closePath();
    ctx.fill();
  }
  y += PAD + 26;
  for (const l of nameLines) {
    text(l, left, 28, 800, '#FFFFFF');
    y += 34;
  }
  y += 2;
  if (draw && 'letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = '1.5px';
  text(d.heading.toUpperCase(), left, 14, 700, C.neon);
  if (draw && 'letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = '0px';
  y += 24;
  text(d.when, left, 15, 500, C.head);
  y = MARGIN + bandH;

  y += PAD;

  if (d.voided) {
    const vl = lines(d.voided, 16, 800, inner - 24);
    const h = 18 + vl.length * 22;
    if (draw) {
      ctx.fillStyle = C.bad;
      roundRect(ctx, left, y, inner, h, 10);
      ctx.fill();
    }
    y += 26;
    for (const l of vl) {
      text(l, W / 2, 16, 800, '#FFFFFF', 'center');
      y += 22;
    }
    y += 12;
  }

  for (const it of d.lines) {
    font(ctx, 18, 700);
    const amountW = ctx.measureText(it.amount).width;
    const nl = lines(it.name, 18, 700, inner - amountW - 16);
    y += 18;
    text(it.amount, right, 18, 700, C.text, 'right');
    for (const l of nl) {
      text(l, left, 18, 700, C.text);
      y += 24;
    }
    text(it.detail, left, 15, 500, C.muted);
    if (it.note) {
      for (const l of lines(`“${it.note}”`, 14, 500, inner, true)) {
        y += 20;
        text(l, left, 14, 500, C.muted, 'left', true);
      }
    }
    y += 16;
  }

  y += 4;
  dashed();
  y += 8;
  for (const a of d.adjustments) {
    y += 22;
    text(a.label, left, 16, 500, C.muted);
    text(a.value, right, 16, 600, C.muted, 'right');
  }
  y += 40;
  text(d.totalLabel, left, 16, 800, C.text);
  text(d.total, right, 32, 800, C.text, 'right');
  y += 8;
  for (const p of d.payment) {
    y += 24;
    text(p.label, left, 15, 500, C.muted);
    text(p.value, right, 15, 700, C.text, 'right');
  }
  y += 22;
  dashed();
  y += 38;
  text(d.thanks, W / 2, 20, 800, C.text, 'center');
  y += 26;
  text(d.footer, W / 2, 12, 600, C.faint, 'center');
  y += 26;

  return y + TOOTH + MARGIN;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The receipt as a PNG file, ready to share or save. */
export async function receiptImage(d: ReceiptDoc, fileName: string): Promise<File> {
  try {
    await Promise.all([700, 800, 500, 600].map((wt) => document.fonts.load(`${wt} 18px "Plus Jakarta Sans Variable"`)));
  } catch {
    /* system font then */
  }
  const scratch = document.createElement('canvas').getContext('2d');
  if (!scratch) throw new Error('no canvas');
  const height = Math.ceil(layout(scratch, d, null));
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.scale(SCALE, SCALE);
  layout(ctx, d, height);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('no image');
  return new File([blob], fileName, { type: 'image/png' });
}

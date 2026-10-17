/** A QR code as one SVG path (black squares on a transparent ground), for the store poster. */
import qrcode from 'qrcode-generator';

export function qrPath(text: string): { size: number; d: string } {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  let d = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
  }
  return { size: n, d };
}

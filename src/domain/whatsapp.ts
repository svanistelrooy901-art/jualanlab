/**
 * WhatsApp click-to-chat link for a receipt. A Malaysian number written the local way (012-345 6789)
 * becomes 60123456789; with no number, WhatsApp asks which chat to send to.
 */
export function normaliseMyPhone(input: string): string | null {
  let d = input.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = `6${d}`;
  if (!/^\d{8,15}$/.test(d)) return null;
  return d;
}

export function whatsappLink(text: string, phone?: string | null): string {
  const n = phone ? normaliseMyPhone(phone) : null;
  return `https://wa.me/${n ?? ''}?text=${encodeURIComponent(text)}`;
}

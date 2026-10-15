/** smeLab emails through Brevo (same account as UntungLab and JualanLab). */
import type { HubMailer, Item } from './ports';

const ITEM: Record<Item, string> = { untunglab: 'UntungLab', jualanlab: 'JualanLab POS penuh', combo: 'UntungLab + JualanLab' };

export function createHubMailer(opts: { apiKey: string; senderEmail: string; senderName: string; fetchImpl?: typeof fetch }): HubMailer {
  const f = opts.fetchImpl ?? fetch;
  const send = async (to: string, subject: string, text: string) => {
    const res = await f('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': opts.apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: { email: opts.senderEmail, name: opts.senderName }, to: [{ email: to }], subject, textContent: text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Brevo responded ${res.status}`);
  };
  return {
    async sendLoginCode(to, code, lang) {
      const ms = lang === 'ms';
      await send(
        to,
        ms ? `Kod masuk smeLab: ${code}` : `smeLab sign-in code: ${code}`,
        (ms
          ? ['Kod masuk akaun smeLab anda (UntungLab, JualanLab):', '', `    ${code}`, '', 'Kod ini sah selama 10 minit.', 'Jika anda tidak cuba log masuk, abaikan emel ini.']
          : ['Your smeLab account sign-in code (UntungLab, JualanLab):', '', `    ${code}`, '', 'This code works for 10 minutes.', 'If you did not try to sign in, ignore this email.']
        ).join('\n'),
      );
    },
    async sendReceipt(to, info) {
      const rm = `RM${(info.amountSen / 100).toFixed(2)}`;
      await send(
        to,
        `Resit smeLab: ${ITEM[info.item]} (${rm})`,
        [
          `Salam ${info.name},`,
          '',
          `Terima kasih. Bayaran ${rm} untuk ${ITEM[info.item]} telah diterima dan dibuka pada akaun smeLab anda (${to}).`,
          ...(info.ulCode ? ['', `Kod lesen UntungLab anda: ${info.ulCode}`, 'Masukkan kod ini di UntungLab (Lesen), atau log masuk dengan akaun smeLab.'] : []),
          ...(info.item !== 'untunglab' && !info.jualanLabOpen
            ? ['', 'JualanLab dibuka pada hari pelancaran, awal November 2026. Kami akan emel anda. Log masuk JualanLab dengan emel ini dan POS penuh terus aktif.']
            : []),
          '',
          `No. pesanan: ${info.orderId}`,
          `Akaun anda: ${info.baseUrl}/akaun`,
          '',
          'Bayaran balik penuh dalam 7 hari: balas emel ini.',
          '',
          'smeLab oleh Digital Sambal',
        ].join('\n'),
      );
    },
  };
}

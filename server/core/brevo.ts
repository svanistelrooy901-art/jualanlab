import type { Mailer } from './ports';

/** Sends the sign-in code through Brevo's transactional email API (same provider as UntungLab). */
export function createBrevoMailer(opts: { apiKey: string; senderEmail: string; senderName: string; fetchImpl?: typeof fetch }): Mailer {
  const f = opts.fetchImpl ?? fetch;
  return {
    async sendLoginCode(to, code, lang) {
      const ms = lang === 'ms';
      const subject = ms ? `Kod masuk JualanLab: ${code}` : `JualanLab sign-in code: ${code}`;
      const text = (ms
        ? ['Kod masuk JualanLab anda:', '', `    ${code}`, '', 'Kod ini sah selama 10 minit.', 'Jika anda tidak cuba masuk ke JualanLab, abaikan emel ini.']
        : ['Your JualanLab sign-in code:', '', `    ${code}`, '', 'This code works for 10 minutes.', 'If you did not try to sign in to JualanLab, ignore this email.']
      ).join('\n');
      const res = await f('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': opts.apiKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: { email: opts.senderEmail, name: opts.senderName }, to: [{ email: to }], subject, textContent: text }),
        // A stuck Brevo call must not leave the sign-in screen spinning: give up and report email_failed.
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Brevo responded ${res.status}`);
    },
  };
}

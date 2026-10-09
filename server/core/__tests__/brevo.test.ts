import { describe, expect, it } from 'vitest';
import { createBrevoMailer } from '../brevo';

describe('Brevo mailer', () => {
  it('sends the code in the chosen language from the configured sender', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const m = createBrevoMailer({
      apiKey: 'k', senderEmail: 'jualanlab@digitalsambal.space', senderName: 'JualanLab',
      fetchImpl: (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response('{}', { status: 201 });
      }) as typeof fetch,
    });
    await m.sendLoginCode('a@b.co', '123456', 'ms');
    expect(calls[0]!.url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((calls[0]!.init.headers as Record<string, string>)['api-key']).toBe('k');
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toMatchObject({ sender: { email: 'jualanlab@digitalsambal.space', name: 'JualanLab' }, to: [{ email: 'a@b.co' }], subject: 'Kod masuk JualanLab: 123456' });
    expect(body.textContent).toContain('10 minit');
    expect(calls[0]!.init.signal).toBeDefined();
  });

  it('throws when Brevo refuses', async () => {
    const m = createBrevoMailer({ apiKey: 'k', senderEmail: 's@x.co', senderName: 'J', fetchImpl: (async () => new Response('{}', { status: 401 })) as unknown as typeof fetch });
    await expect(m.sendLoginCode('a@b.co', '123456', 'en')).rejects.toThrow('401');
  });
});

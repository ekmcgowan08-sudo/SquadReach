import 'server-only';
/* Sending one email. Resend's HTTP API, over fetch — no SDK. With no key
   configured, nothing is sent and the caller records why. */

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export const emailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export async function sendEmail(m: Mail): Promise<void> {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [m.to], subject: m.subject, html: m.html, text: m.text })
  });
  if (!r.ok) throw new Error('The email service answered ' + r.status + ': ' + (await r.text()).slice(0, 200));
}

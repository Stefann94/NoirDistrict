// Notificări (doar pe server):
//   - email către client: cerere primită, confirmată, refuzată, expirată, anulată, memento (de pe Gmail-ul frizeriei);
//   - WhatsApp către Orlando: cerere nouă (cu linkul de confirmare), anulare, cerere expirată (prin CallMeBot).
// Fiecare trimitere are o a doua încercare. Local, fără chei, mesajele apar doar în consolă.
import nodemailer, { type Transporter } from 'nodemailer';
import { getSecret } from 'astro:env/server';
import { business, fullAddress, mapsHref, telHref } from '../data/business';
import type { Booking } from './store';
import { TIME_ZONE } from './schedule';

const when = new Intl.DateTimeFormat('ro-RO', { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long' });
const hour = new Intl.DateTimeFormat('ro-RO', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const describeWhen = (iso: string) => `${when.format(new Date(iso))}, ora ${hour.format(new Date(iso))}`;
export const describeHour = (iso: string) => hour.format(new Date(iso));

/** Textul clientului ajunge în email doar „neutralizat”: nimic nu poate fi interpretat ca HTML. */
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

async function twice(run: () => Promise<void>) {
  try {
    await run();
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
    await run();
  }
}

/* ---------------- WhatsApp către Orlando ---------------- */

export async function whatsappOrlando(text: string) {
  const to = getSecret('CALLMEBOT_PHONE');
  const apiKey = getSecret('CALLMEBOT_APIKEY');
  if (!to || !apiKey) {
    if (import.meta.env.DEV) console.info(`\n[WhatsApp simulat către Orlando]\n${text}\n`);
    return false;
  }
  try {
    await twice(async () => {
      const api = new URL('https://api.callmebot.com/whatsapp.php');
      api.searchParams.set('phone', to);
      api.searchParams.set('text', text);
      api.searchParams.set('apikey', apiKey);
      const res = await fetch(api, { signal: AbortSignal.timeout(10_000) });
      const reply = res.ok ? (await res.text()).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300) : '';
      // CallMeBot nu documentează textul de succes: reușit = răspuns 200 fără mesaj de eroare.
      if (!res.ok || /invalid|error|not allowed|blocked|wrong/i.test(reply)) throw new Error(reply || `HTTP ${res.status}`);
    });
    return true;
  } catch (error) {
    console.error('WhatsApp (CallMeBot) nu a trimis mesajul:', error);
    return false;
  }
}

type OrlandoKind = 'new' | 'cancelled' | 'expired';

/** Mesajul pentru Orlando. La o cerere nouă, `link` e pagina din care o confirmă sau o refuză. */
export function orlandoText(kind: OrlandoKind, b: Booking, link?: string) {
  const title = {
    new: '💈 Cerere nouă de programare',
    cancelled: '❌ Programare ANULATĂ de client',
    expired: '⌛ Cerere expirată (n-a fost confirmată la timp)',
  }[kind];
  const digits = b.phone.replace(/\D/g, '');
  const lines = [
    `${title} – ${business.name}`,
    '',
    `Când: ${describeWhen(b.starts_at)}`,
    `Serviciu: ${b.service} (${b.price} lei, ${b.duration} min)`,
    '',
    `Client: ${b.name}`,
    `Telefon: ${b.phone}`,
    b.email ? `Email: ${b.email}` : null,
    `WhatsApp client: https://wa.me/${digits}`,
  ];
  if (kind === 'new' && link) {
    lines.push('', '👉 Confirmă sau refuză aici:', link);
    if (b.expires_at) lines.push('', `Ora e rezervată până confirmi. Dacă nu răspunzi până ${describeWhen(b.expires_at)}, cererea expiră și ora se eliberează.`);
  }
  if (kind === 'cancelled') lines.push('', 'Ora s-a eliberat pe site.');
  if (kind === 'expired') lines.push('', 'Ora s-a eliberat pe site, iar clientul a fost anunțat pe email.');
  return lines.filter((l) => l !== null).join('\n');
}

/* ---------------- Email către client ---------------- */

let transport: Transporter | null = null;
function mailer() {
  const user = getSecret('GMAIL_USER');
  const pass = getSecret('GMAIL_APP_PASSWORD');
  if (!user || !pass) return null;
  transport ??= nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  return { transport, from: `"${business.name}" <${user}>` };
}

export type EmailKind = 'received' | 'confirmed' | 'declined' | 'expired' | 'cancelled' | 'reminder';

const SUBJECT: Record<EmailKind, (b: Booking) => string> = {
  received: (b) => `Am primit cererea ta – ${describeWhen(b.starts_at)}`,
  confirmed: (b) => `Programare confirmată la ${business.name} – ${describeWhen(b.starts_at)}`,
  declined: () => `Programarea ta la ${business.name} nu a putut fi confirmată`,
  expired: () => `Programarea ta la ${business.name} nu a putut fi confirmată`,
  cancelled: () => `Programarea ta la ${business.name} a fost anulată`,
  reminder: (b) => `Mâine la ${business.name}: ${describeWhen(b.starts_at)}`,
};
const INTRO: Record<EmailKind, string> = {
  received: `Cererea ta a ajuns la ${business.owner}. Ora e rezervată pentru tine și îți scriem imediat ce o confirmă.`,
  confirmed: `${business.owner} ți-a confirmat programarea. Te așteptăm!`,
  declined: `Ne pare rău, ${business.owner} nu te poate primi la ora aleasă. Alege, te rog, altă oră.`,
  expired: `Ne pare rău, ${business.owner} nu a apucat să confirme cererea ta la timp, așa că ora s-a eliberat. Alege altă oră sau sună-ne.`,
  cancelled: 'Programarea ta a fost anulată. Ne pare rău că nu ne vedem de data asta.',
  reminder: 'Îți amintim că mâine ai programare la noi.',
};
/** Emailurile în care clientul are încă o programare activă (și primește linkul de anulare). */
const ACTIVE: EmailKind[] = ['received', 'confirmed', 'reminder'];
const STRUCK: EmailKind[] = ['declined', 'expired', 'cancelled'];

function render(kind: EmailKind, b: Booking, manageUrl: string) {
  const rows: [string, string][] = [
    ['Serviciu', `${b.service} · ${b.price} lei`],
    ['Când', describeWhen(b.starts_at)],
    ['Unde', fullAddress],
  ];
  if (kind === 'received') rows.push(['Stare', 'Așteaptă confirmarea']);
  const active = ACTIVE.includes(kind);
  const newBooking = new URL('/#programare', manageUrl).href;
  const cancelLabel = kind === 'received' ? 'Anulează cererea' : 'Anulează programarea';
  const note = kind === 'received' ? 'Dacă te-ai răzgândit, poți anula cererea oricând din butonul de mai sus.' : 'Poți anula cu cel puțin 2 ore înainte. După aceea, sună-ne.';
  const text = [
    `Salut, ${b.name}!`,
    '',
    INTRO[kind],
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    active ? `${cancelLabel}: ${manageUrl}` : `Fă o programare nouă: ${newBooking}`,
    active ? note : '',
    `Telefon: ${business.phoneDisplay}`,
    '',
    `${business.name} by ${business.owner}`,
  ].join('\n');

  const button = (href: string, label: string) =>
    `<a href="${esc(href)}" style="display:inline-block;padding:14px 26px;background:#f2eee7;color:#0a0a0a;text-decoration:none;font:600 13px/1 Arial,sans-serif;letter-spacing:2px;text-transform:uppercase">${esc(label)}</a>`;
  const html = `<!doctype html><html lang="ro"><body style="margin:0;background:#0a0a0a;color:#f2eee7;font:15px/1.6 Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border:1px solid #2a2a2a">
<tr><td style="padding:32px 28px 8px;text-align:center;font:400 13px/1 Georgia,serif;letter-spacing:6px;text-transform:uppercase;color:#a29c93">${esc(business.name)}</td></tr>
<tr><td style="padding:8px 28px 4px;text-align:center;font:400 26px/1.25 Georgia,serif">Salut, ${esc(b.name)}!</td></tr>
<tr><td style="padding:4px 28px 20px;text-align:center;color:#a29c93">${esc(INTRO[kind])}</td></tr>
<tr><td style="padding:0 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #2a2a2a;border-bottom:1px solid #2a2a2a">
${rows.map(([k, v]) => `<tr><td style="padding:10px 0;color:#a29c93;font-size:12px;letter-spacing:2px;text-transform:uppercase">${esc(k)}</td><td style="padding:10px 0;text-align:right;font:16px Georgia,serif;${STRUCK.includes(kind) && k === 'Când' ? 'text-decoration:line-through' : ''}">${esc(v)}</td></tr>`).join('')}
</table></td></tr>
<tr><td style="padding:24px 28px 8px;text-align:center">${active ? button(manageUrl, cancelLabel) : button(newBooking, 'Alege altă oră')}</td></tr>
<tr><td style="padding:4px 28px 24px;text-align:center;font-size:12px;color:#a29c93">${active ? esc(note) : ''}</td></tr>
<tr><td style="padding:16px 28px 28px;text-align:center;font-size:13px;color:#a29c93;border-top:1px solid #2a2a2a">
<a href="${esc(mapsHref)}" style="color:#f2eee7">${esc(fullAddress)}</a><br><a href="${esc(telHref)}" style="color:#f2eee7">${esc(business.phoneDisplay)}</a></td></tr>
</table></td></tr></table></body></html>`;
  return { subject: SUBJECT[kind](b), text, html };
}

export async function emailClient(kind: EmailKind, b: Booking, manageUrl: string) {
  if (!b.email) return false;
  const msg = render(kind, b, manageUrl);
  const m = mailer();
  if (!m) {
    if (import.meta.env.DEV) console.info(`\n[Email simulat către ${b.email}] ${msg.subject}\n${msg.text}\n`);
    return false;
  }
  try {
    await twice(async () => {
      await m.transport.sendMail({ from: m.from, to: b.email!, subject: msg.subject, text: msg.text, html: msg.html });
    });
    return true;
  } catch (error) {
    console.error('Emailul nu a putut fi trimis:', error);
    return false;
  }
}

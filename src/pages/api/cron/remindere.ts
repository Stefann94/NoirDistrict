// Mementourile zilnice: Vercel pornește ruta asta o dată pe zi (vezi „crons” în vercel.json).
// Trimite emailul de reamintire tuturor programărilor de mâine (o singură dată fiecăreia).
// Accesarea zilnică a bazei de date ține și proiectul Supabase activ (pe planul gratuit,
// un proiect nefolosit o săptămână e pus pe pauză).
import type { APIRoute } from 'astro';
import { getSecret } from 'astro:env/server';
import { SITE_URL } from '../../../data/site.mjs';
import { addDays, local, toInstant } from '../../../lib/schedule';
import { store } from '../../../lib/store';
import { emailClient } from '../../../lib/notify';
import { json, manageUrl, sweepExpired } from '../../../lib/booking-server';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  // Doar Vercel (care trimite cheia CRON_SECRET) poate porni mementourile.
  const secret = getSecret('CRON_SECRET');
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return json(401, { ok: false });

  // Întâi cererile rămase neconfirmate (de obicei le prinde deja o vizită pe site).
  const expired = await sweepExpired();
  const tomorrow = addDays(local().day, 1);
  const due = await store().dueReminders(toInstant(tomorrow, 0).toISOString(), toInstant(addDays(tomorrow, 1), 0).toISOString());
  let sent = 0;
  for (const b of due) {
    if (await emailClient('reminder', b, manageUrl(SITE_URL, b.token))) {
      await store().markReminded(b.id);
      sent++;
    }
  }
  console.info(`Mementouri pentru ${tomorrow}: ${sent} din ${due.length} trimise.`);
  return json(200, { ok: true, day: tomorrow, due: due.length, sent, expired });
};

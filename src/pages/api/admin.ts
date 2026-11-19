// Acțiunile din pagina de administrare (formulare simple, fără JavaScript): login, logout,
// confirmare / refuz / anulare, programare adăugată de Orlando (ex. primită la telefon), ore blocate.
// Fiecare acțiune verifică sesiunea; cererile trebuie să vină de pe site (protecție CSRF).
import type { APIRoute } from 'astro';
import { isAdmin, login, logout } from '../../lib/admin-auth';
import { checkEmail, checkName, checkPhone } from '../../scripts/validate';
import { isDayKey, isRealDay, toInstant, toMinutes } from '../../lib/schedule';
import { SlotTaken, store } from '../../lib/store';
import { emailClient } from '../../lib/notify';
import { clientIp, interval, limited, manageUrl, sameOrigin, services } from '../../lib/booking-server';

export const prerender = false;

const back = (day: string | null, message: string, ok = true) => {
  const url = new URLSearchParams();
  if (day) url.set('zi', day);
  url.set(ok ? 'ok' : 'eroare', message);
  return new Response(null, { status: 303, headers: { Location: `/admin/?${url}`, 'Cache-Control': 'no-store' } });
};
const isTime = (s: string) => /^\d{2}:\d{2}$/.test(s) && toMinutes(s) < 24 * 60;

export const POST: APIRoute = async ({ request, url, cookies, clientAddress }) => {
  if (!sameOrigin(request, url)) return new Response('Cerere nepermisă.', { status: 403 });
  const form = await request.formData();
  const field = (name: string) => String(form.get(name) ?? '').trim();
  const action = field('action');
  const day = isDayKey(field('zi')) && isRealDay(field('zi')) ? field('zi') : null;

  if (action === 'login') {
    if (limited(`admin-login:${clientIp(request, () => clientAddress)}`, 8, 15 * 60_000)) {
      return back(null, 'Prea multe încercări. Așteaptă 15 minute.', false);
    }
    const ok = await login(cookies, field('password'), url.protocol === 'https:');
    return ok ? back(null, 'Bine ai venit!') : back(null, 'Parolă greșită.', false);
  }
  if (!(await isAdmin(cookies))) return back(null, 'Autentifică-te din nou.', false);
  if (action === 'logout') {
    logout(cookies);
    return back(null, 'Te-ai deconectat.');
  }

  try {
    // Confirmare / refuz / anulare: doar dacă programarea e încă în starea potrivită (atomic).
    const decisions = {
      confirm: { from: ['pending'], to: 'confirmed', done: 'confirmată' },
      decline: { from: ['pending'], to: 'declined', done: 'refuzată' },
      cancel: { from: ['pending', 'confirmed'], to: 'cancelled', done: 'anulată' },
    } as const;
    if (action in decisions) {
      const d = decisions[action as keyof typeof decisions];
      const updated = await store().decide(field('id'), [...d.from], d.to);
      if (!updated) return back(day, 'Programarea nu mai e în așteptare / activă.', false);
      const notified = await emailClient(d.to, updated, manageUrl(url.origin, updated.token));
      return back(day, `Programarea lui ${updated.name} a fost ${d.done}${notified ? ' (clientul a primit email)' : ''}.`);
    }

    if (action === 'add') {
      const service = services.get(field('service'));
      const time = field('ora');
      if (!service || !day || !isTime(time)) return back(day, 'Completează serviciul, ziua și ora.', false);
      const name = checkName(field('name'));
      if (!name.ok) return back(day, name.error, false);
      const phone = checkPhone(field('phone'));
      if (!phone.ok) return back(day, phone.error, false);
      const email = field('email') ? checkEmail(field('email')) : null;
      if (email && !email.ok) return back(day, email.error, false);
      const booking = await store().create({
        service: service.name,
        price: service.price,
        duration: service.duration,
        ...interval(day, time, service.duration),
        name: name.value,
        phone: phone.value,
        email: email?.ok ? email.value : null,
        source: 'admin',
        // Adăugată de Orlando: e confirmată din start.
        status: 'confirmed',
        expires_at: null,
      });
      const notified = await emailClient('confirmed', booking, manageUrl(url.origin, booking.token));
      return back(day, `Programare adăugată: ${booking.name}, ora ${time}${notified ? ' (clientul a primit email)' : ''}.`);
    }

    if (action === 'block') {
      const from = field('de');
      const to = field('pana');
      if (!day || !isTime(from) || !isTime(to) || toMinutes(to) <= toMinutes(from)) {
        return back(day, 'Alege ziua și un interval valid (de la … până la …).', false);
      }
      await store().addBlock({
        starts_at: toInstant(day, toMinutes(from)).toISOString(),
        ends_at: toInstant(day, toMinutes(to)).toISOString(),
        note: field('nota').slice(0, 120) || null,
      });
      return back(day, `Interval blocat: ${from}–${to}.`);
    }

    if (action === 'unblock') {
      await store().removeBlock(field('id'));
      return back(day, 'Intervalul a fost deblocat.');
    }
  } catch (error) {
    if (error instanceof SlotTaken) return back(day, 'Ora se suprapune cu altă programare sau cu un interval blocat.', false);
    console.error('Admin:', error);
    return back(day, 'Ceva n-a mers. Încearcă din nou.', false);
  }
  return back(day, 'Acțiune necunoscută.', false);
};

// Formularul de programare: generează zilele și orele din program și trimite cererea pe WhatsApp.
import type { DayCode, OpeningHours } from '../data/business';
import { checkName, checkPhone } from './validate';

interface Config {
  hours: OpeningHours[];
  slotMinutes: number;
  days: number;
  whatsapp: string;
}

const JS_DAY: DayCode[] = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
/** Cât timp înainte se poate rezerva pentru ziua curentă. */
const LEAD_MINUTES = 30;

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const toTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const weekday = new Intl.DateTimeFormat('ro-RO', { weekday: 'short' });
const dayMonth = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short' });
const longDate = new Intl.DateTimeFormat('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });

function chip(name: string, value: string, top: string, bottom?: string, disabled = false) {
  const label = document.createElement('label');
  label.className = 'chip';
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = name;
  input.value = value;
  input.disabled = disabled;
  const t = document.createElement('span');
  t.className = 'chip-top';
  t.textContent = top;
  label.append(input, t);
  if (bottom) {
    const b = document.createElement('span');
    b.className = 'chip-bottom';
    b.textContent = bottom;
    label.append(b);
  }
  return label;
}

export function initBooking(form: HTMLFormElement) {
  const config: Config = JSON.parse(form.dataset.config!);
  const daysEl = form.querySelector<HTMLElement>('[data-days]')!;
  const slotsEl = form.querySelector<HTMLElement>('[data-slots]')!;
  const errorEl = form.querySelector<HTMLElement>('[data-error]')!;

  const selectedService = () => form.querySelector<HTMLInputElement>('input[name="service"]:checked');
  const duration = () => Number(selectedService()?.dataset.duration ?? config.slotMinutes);

  const slotsFor = (date: Date) => {
    const schedule = config.hours.find((h) => h.days.includes(JS_DAY[date.getDay()]));
    if (!schedule) return [];
    const now = new Date();
    const isToday = toKey(date) === toKey(now);
    const earliest = isToday ? now.getHours() * 60 + now.getMinutes() + LEAD_MINUTES : 0;
    const slots: string[] = [];
    const last = toMinutes(schedule.closes) - duration();
    for (let t = toMinutes(schedule.opens); t <= last; t += config.slotMinutes) {
      if (t >= earliest) slots.push(toTime(t));
    }
    return slots;
  };

  function renderDays() {
    const selected = form.querySelector<HTMLInputElement>('input[name="day"]:checked')?.value;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    daysEl.replaceChildren(
      ...Array.from({ length: config.days }, (_, i) => {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        const label = i === 0 ? 'Azi' : i === 1 ? 'Mâine' : weekday.format(date);
        const el = chip('day', toKey(date), label, dayMonth.format(date), slotsFor(date).length === 0);
        const input = el.querySelector('input')!;
        if (input.value === selected && !input.disabled) input.checked = true;
        return el;
      }),
    );
  }

  function renderSlots() {
    const day = form.querySelector<HTMLInputElement>('input[name="day"]:checked');
    if (!day) return;
    const selected = form.querySelector<HTMLInputElement>('input[name="slot"]:checked')?.value;
    const slots = slotsFor(fromKey(day.value));
    if (!slots.length) {
      slotsEl.innerHTML = '<p class="booking-hint">Nu mai sunt ore libere în ziua asta.</p>';
      return;
    }
    slotsEl.replaceChildren(
      ...slots.map((s) => {
        const el = chip('slot', s, s);
        if (s === selected) el.querySelector('input')!.checked = true;
        return el;
      }),
    );
  }

  form.addEventListener('change', (e) => {
    const name = (e.target as HTMLInputElement).name;
    errorEl.textContent = '';
    if (name === 'service') {
      renderDays();
      renderSlots();
    } else if (name === 'day') {
      renderSlots();
    }
  });

  /* ---- Telefon: asistent pas cu pas (1 Serviciul → 2 Ziua → 3 Ora → 4 Datele tale) ---- */

  const wizard = (() => {
    const phone = matchMedia('(max-width: 47.99rem)');
    const head = form.querySelector<HTMLElement>('[data-wizard]');
    const nav = form.querySelector<HTMLElement>('[data-wizard-nav]');
    const steps = [...form.querySelectorAll<HTMLFieldSetElement>('.booking-step')];
    const titles = ['Serviciul', 'Ziua', 'Ora', 'Datele tale'];
    const back = nav?.querySelector<HTMLButtonElement>('[data-wizard-back]');
    const next = nav?.querySelector<HTMLButtonElement>('[data-wizard-next]');
    const picks = head?.querySelector<HTMLElement>('[data-wizard-picks]');
    let step = 1;

    const on = () => phone.matches && !!head && !!nav;
    const chosen = (n: number) =>
      n === 1 ? !!selectedService() : !!form.querySelector(`input[name="${n === 2 ? 'day' : 'slot'}"]:checked`);
    /** Primul pas încă necompletat (nu poți sări peste el). */
    const firstMissing = () => [1, 2, 3].find((n) => !chosen(n)) ?? 4;

    function renderPicks() {
      if (!picks) return;
      const service = selectedService();
      const day = form.querySelector<HTMLInputElement>('input[name="day"]:checked');
      const slot = form.querySelector<HTMLInputElement>('input[name="slot"]:checked');
      const items: [number, string | null][] = [
        [1, service ? service.value : null],
        [2, day ? longDate.format(fromKey(day.value)) : null],
        [3, slot ? `ora ${slot.value}` : null],
      ];
      picks.replaceChildren(
        ...items
          .filter(([, text]) => text)
          .map(([n, text]) => {
            const li = document.createElement('li');
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = text; // text simplu, niciodată HTML
            b.setAttribute('aria-label', `Schimbă: ${text}`);
            b.addEventListener('click', () => go(n));
            li.append(b);
            return li;
          }),
      );
    }

    function go(n: number, scroll = true) {
      if (!on()) return;
      step = Math.max(1, Math.min(n, firstMissing(), 4));
      form.dataset.step = String(step);
      steps.forEach((s, i) => s.classList.toggle('is-current', i === step - 1));
      head!.querySelector('[data-wizard-count]')!.textContent = `Pasul ${step} din 4`;
      head!.querySelector('[data-wizard-title]')!.textContent = titles[step - 1];
      head!.querySelector<HTMLElement>('[data-wizard-bar]')!.style.transform = `scaleX(${step / 4})`;
      if (back) back.hidden = step === 1;
      if (next) {
        next.hidden = step === 4;
        next.disabled = !chosen(step);
      }
      renderPicks();
      // Începutul formularului rămâne vizibil sub header când schimbi pasul.
      if (scroll) {
        const top = form.getBoundingClientRect().top;
        const header = document.querySelector<HTMLElement>('.header')?.offsetHeight ?? 0;
        if (top < header || top > innerHeight * 0.4) scrollBy({ top: top - header - 12, behavior: 'smooth' });
      }
    }

    function mode() {
      const active = on();
      form.classList.toggle('is-wizard', active);
      if (head) head.hidden = !active;
      if (nav) nav.hidden = !active;
      if (active) go(step, false);
      else {
        delete form.dataset.step;
        steps.forEach((s) => s.classList.remove('is-current'));
      }
    }

    back?.addEventListener('click', () => go(step - 1));
    next?.addEventListener('click', () => go(step + 1));
    // Alegerea trece singură la pasul următor (după o clipă, ca să se vadă selecția).
    form.addEventListener('change', (e) => {
      if (!on()) return;
      const name = (e.target as HTMLInputElement).name;
      const n = name === 'service' ? 1 : name === 'day' ? 2 : name === 'slot' ? 3 : 0;
      if (!n) return;
      if (next) next.disabled = !chosen(step);
      renderPicks();
      if (n === step) setTimeout(() => go(step + 1), 280);
    });
    phone.addEventListener('change', mode);
    mode();
    return { go, on };
  })();

  /* ---- Validarea numelui și a telefonului ---- */

  const fields = {
    name: { input: form.querySelector<HTMLInputElement>('input[name="name"]')!, check: checkName },
    phone: { input: form.querySelector<HTMLInputElement>('input[name="phone"]')!, check: checkPhone },
  };
  const touched = new Set<keyof typeof fields>();

  /** Verifică un câmp, arată mesajul sub el și întoarce valoarea curățată (sau null). */
  function validate(key: keyof typeof fields, show = true) {
    const { input, check } = fields[key];
    const result = check(input.value);
    const errorBox = document.getElementById(input.getAttribute('aria-describedby')!)!;
    if (show) {
      errorBox.textContent = result.ok ? '' : result.error; // textContent: nimic nu e interpretat ca HTML
      input.setAttribute('aria-invalid', String(!result.ok));
    }
    return result.ok ? result.value : null;
  }

  for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
    const { input } = fields[key];
    // Mesajul apare când ieși din câmp; după aceea, se actualizează pe măsură ce scrii.
    input.addEventListener('blur', () => {
      if (input.value.trim()) touched.add(key);
      if (touched.has(key)) {
        const value = validate(key);
        if (value) input.value = value; // forma standard: „Ion Popescu”, „+40 712 345 678”
      }
    });
    input.addEventListener('input', () => {
      if (touched.has(key)) validate(key);
    });
  }

  /* ---- Trimiterea ---- */

  const openedAt = Date.now();
  let lastSent = 0;
  const trap = form.querySelector<HTMLInputElement>('input[name="website"]');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorEl.textContent = '';

    // Roboții completează câmpul ascuns sau trimit în prima secundă: îi ignorăm fără zgomot.
    if (trap?.value || Date.now() - openedAt < 1500) return;
    // Protecție la apăsări repetate: o singură cerere la câteva secunde.
    if (Date.now() - lastSent < 5000) return;

    const service = selectedService();
    const dayInput = form.querySelector<HTMLInputElement>('input[name="day"]:checked');
    const slotInput = form.querySelector<HTMLInputElement>('input[name="slot"]:checked');

    // Ziua și ora trebuie să fie unele dintre cele generate de noi și încă disponibile.
    const day = dayInput && /^\d{4}-\d{2}-\d{2}$/.test(dayInput.value) && !dayInput.disabled ? dayInput.value : null;
    const slot =
      day && slotInput && /^\d{2}:\d{2}$/.test(slotInput.value) && slotsFor(fromKey(day)).includes(slotInput.value)
        ? slotInput.value
        : null;

    const name = validate('name');
    const phone = validate('phone');
    touched.add('name').add('phone');

    const missing = !service ? 'serviciul' : !day ? 'ziua' : !slot ? 'ora' : null;
    if (missing) {
      errorEl.textContent = `Mai alege ${missing}.`;
      if (wizard.on()) wizard.go(missing === 'serviciul' ? 1 : missing === 'ziua' ? 2 : 3);
      else
        (missing === 'serviciul' ? form.querySelector('input[name="service"]') : missing === 'ziua' ? daysEl : slotsEl)
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    if (!name || !phone) {
      errorEl.textContent = 'Verifică datele de mai sus.';
      (name ? fields.phone.input : fields.name.input).focus();
      return;
    }

    fields.name.input.value = name;
    fields.phone.input.value = phone;
    lastSent = Date.now();
    send({ service: service!.value, price: service!.dataset.price ?? '', day: day!, slot: slot!, name, phone });
  });

  /* ---- Trimiterea către server (care o dă mai departe pe WhatsApp-ul lui Orlando) ---- */

  const done = form.parentElement?.querySelector<HTMLElement>('[data-booking-done]');
  const fallback = form.querySelector<HTMLElement>('[data-fallback]');
  const submitLabel = submit?.textContent ?? '';

  /** Link de rezervă: cererea gata scrisă, trimisă de client din WhatsApp-ul lui. */
  const whatsappLink = (r: Request) =>
    `https://wa.me/${encodeURIComponent(config.whatsapp)}?text=${encodeURIComponent(
      [
        'Bună ziua! Aș dori o programare la Noir District:',
        `• Serviciu: ${r.service} (${r.price} lei)`,
        `• Ziua: ${longDate.format(fromKey(r.day))}`,
        `• Ora: ${r.slot}`,
        `• Nume: ${r.name}`,
        `• Telefon: ${r.phone}`,
      ].join('\n'),
    )}`;

  type Request = { service: string; price: string; day: string; slot: string; name: string; phone: string };

  async function send(r: Request) {
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Se trimite…';
    }
    if (fallback) fallback.hidden = true;
    try {
      const res = await fetch('/api/programare/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: r.service, day: r.day, slot: r.slot, name: r.name, phone: r.phone, website: trap?.value ?? '' }),
      });
      const answer = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; field?: string };
      if (res.ok && answer.ok) return success(r);

      // Serverul a respins o valoare anume: arătăm mesajul lângă câmpul ei.
      if (answer.field === 'name' || answer.field === 'phone') {
        const input = fields[answer.field].input;
        document.getElementById(input.getAttribute('aria-describedby')!)!.textContent = answer.error ?? '';
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        errorEl.textContent = 'Verifică datele de mai sus.';
      } else if (answer.field) {
        errorEl.textContent = answer.error ?? 'Alege din nou ziua și ora.';
        renderDays();
        renderSlots();
        wizard.go(answer.field === 'service' ? 1 : answer.field === 'day' ? 2 : 3);
      } else {
        throw new Error(answer.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      // Serverul nu e disponibil / nu a putut trimite: clientul nu rămâne blocat.
      errorEl.textContent = `${err instanceof Error && !err.message.startsWith('HTTP') && !/fetch/i.test(err.message) ? err.message + ' ' : ''}Poți trimite cererea direct pe WhatsApp sau ne poți suna.`;
      if (fallback) {
        fallback.hidden = false;
        fallback.querySelector<HTMLAnchorElement>('[data-fallback-whatsapp]')!.href = whatsappLink(r);
      }
    } finally {
      if (submit) {
        submit.textContent = submitLabel;
        setTimeout(() => (submit.disabled = false), 1500);
      }
    }
  }

  function success(r: Request) {
    if (!done) return;
    // Rezumatul se scrie doar ca text (textContent), niciodată ca HTML.
    const set = (key: string, value: string) => {
      const el = done.querySelector<HTMLElement>(`[data-done="${key}"]`);
      if (el) el.textContent = value;
    };
    set('service', `${r.service} · ${r.price} lei`);
    set('when', `${longDate.format(fromKey(r.day))}, ora ${r.slot}`);
    set('name', r.name);
    set('phone', r.phone);
    form.hidden = true;
    done.hidden = false;
    done.focus();
    done.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  done?.querySelector('[data-done-again]')?.addEventListener('click', () => {
    form.reset();
    Object.values(fields).forEach(({ input }) => input.removeAttribute('aria-invalid'));
    form.querySelectorAll<HTMLElement>('.field-error').forEach((el) => (el.textContent = ''));
    touched.clear();
    renderDays();
    slotsEl.innerHTML = '<p class="booking-hint">Alege întâi ziua.</p>';
    done.hidden = true;
    form.hidden = false;
    wizard.go(1);
  });

  renderDays();
}

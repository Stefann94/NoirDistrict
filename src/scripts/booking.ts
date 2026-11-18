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
    if (submit) {
      submit.disabled = true;
      setTimeout(() => (submit.disabled = false), 5000);
    }

    // Mesajul e text simplu, codificat în link: nu poate rula nimic, nici aici, nici la Orlando.
    const message = [
      'Bună ziua! Aș dori o programare la Noir District:',
      `• Serviciu: ${service!.value} (${service!.dataset.price} lei)`,
      `• Ziua: ${longDate.format(fromKey(day!))}`,
      `• Ora: ${slot}`,
      `• Nume: ${name}`,
      `• Telefon: ${phone}`,
    ].join('\n');
    location.href = `https://wa.me/${encodeURIComponent(config.whatsapp)}?text=${encodeURIComponent(message)}`;
  });

  renderDays();
}

// Formularul de programare: generează zilele și orele din program și trimite cererea pe WhatsApp.
import type { DayCode, OpeningHours } from '../data/business';

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

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const service = selectedService();
    const day = data.get('day') as string | null;
    const slot = data.get('slot') as string | null;
    const name = String(data.get('name') ?? '').trim();
    const phone = String(data.get('phone') ?? '').trim();

    const missing = !service ? 'serviciul' : !day ? 'ziua' : !slot ? 'ora' : !name ? 'numele' : null;
    if (missing) {
      errorEl.textContent = `Mai alege ${missing}.`;
      return;
    }
    if (phone.replace(/\D/g, '').length < 9) {
      errorEl.textContent = 'Numărul de telefon pare incomplet.';
      return;
    }

    const message = [
      'Bună ziua! Aș dori o programare la Noir District:',
      `• Serviciu: ${service!.value} (${service!.dataset.price} lei)`,
      `• Ziua: ${longDate.format(fromKey(day!))}`,
      `• Ora: ${slot}`,
      `• Nume: ${name}`,
      `• Telefon: ${phone}`,
    ].join('\n');
    location.href = `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(message)}`;
  });

  renderDays();
}

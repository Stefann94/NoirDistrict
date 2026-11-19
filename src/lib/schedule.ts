// Programul și orele libere, calculate la fel în browser (formular) și pe server (verificare).
// Toate orele sunt ora României (Europe/Bucharest), indiferent unde rulează codul.
import type { DayCode, OpeningHours } from '../data/business';

export const TIME_ZONE = 'Europe/Bucharest';
const WEEK: DayCode[] = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Interval ocupat într-o zi, în minute de la miezul nopții: [început, sfârșit). */
export type Busy = [number, number];

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
export const toTime = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/* ---------------- Zile („2026-11-21”) ---------------- */

export const isDayKey = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

const parts = (key: string) => key.split('-').map(Number) as [number, number, number];

/** Ziua calendaristică + n zile (fără probleme de fus orar: calcul pe UTC). */
export function addDays(key: string, n: number) {
  const [y, m, d] = parts(key);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export const weekdayOf = (key: string): DayCode => {
  const [y, m, d] = parts(key);
  return WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
};
/** Ziua e o dată reală (nu 2026-02-31). */
export const isRealDay = (key: string) => {
  const [y, m, d] = parts(key);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDate() === d;
};

/* ---------------- Ora României ---------------- */

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Ziua și minutul din România pentru un moment dat. */
export function local(date: Date = new Date()) {
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, minutes: +p.hour * 60 + +p.minute };
}

/** Momentul exact (UTC) pentru „ziua X, ora Y” în România — corect și la schimbarea orei de vară. */
export function toInstant(day: string, minutes: number) {
  const [y, m, d] = parts(day);
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  const offset = (t: number) => {
    const l = local(new Date(t));
    const [ly, lm, ld] = parts(l.day);
    return Date.UTC(ly, lm - 1, ld, Math.floor(l.minutes / 60), l.minutes % 60) - t;
  };
  const first = guess - offset(guess);
  return new Date(guess - offset(first));
}

/* ---------------- Ore libere ---------------- */

export interface SlotRules {
  hours: readonly OpeningHours[];
  slotMinutes: number;
  /** Cât trebuie să treacă de acum până la o programare, în minute. */
  leadMinutes: number;
}

export const scheduleFor = (day: string, hours: readonly OpeningHours[]) =>
  hours.find((h) => (h.days as readonly DayCode[]).includes(weekdayOf(day))) ?? null;

/** Orele la care poate începe un serviciu de `duration` minute, într-o zi, ținând cont de ce e ocupat. */
export function freeSlots(day: string, duration: number, busy: readonly Busy[], rules: SlotRules, now = local()) {
  const schedule = scheduleFor(day, rules.hours);
  if (!schedule || day < now.day) return [];
  const earliest = day === now.day ? now.minutes + rules.leadMinutes : 0;
  const closes = toMinutes(schedule.closes);
  const slots: string[] = [];
  for (let t = toMinutes(schedule.opens); t + duration <= closes; t += rules.slotMinutes) {
    if (t < earliest) continue;
    if (busy.some(([s, e]) => t < e && t + duration > s)) continue;
    slots.push(toTime(t));
  }
  return slots;
}

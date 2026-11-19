// „Deschis acum · până la 18:00” / „Închis acum · deschidem mâine la 10:00”, după ora din România,
// plus ziua de azi evidențiată în tabelul de program. Se actualizează în fiecare minut.
import type { DayCode, OpeningHours } from '../data/business';

const WEEK: DayCode[] = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_NAME: Record<DayCode, string> = {
  Mo: 'luni', Tu: 'marți', We: 'miercuri', Th: 'joi', Fr: 'vineri', Sa: 'sâmbătă', Su: 'duminică',
};
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Ziua săptămânii și minutul curent, în România (indiferent unde e clientul). */
function romaniaNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  const index = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { index, day: WEEK[index], minutes: +parts.hour * 60 + +parts.minute };
}

function describe(hours: OpeningHours[]) {
  const now = romaniaNow();
  const today = hours.find((h) => h.days.includes(now.day));
  if (today && now.minutes >= toMinutes(today.opens) && now.minutes < toMinutes(today.closes)) {
    return { open: true, text: `Deschis acum · până la ${today.closes}`, day: now.day };
  }
  // Următoarea deschidere: azi mai târziu sau în una din zilele următoare.
  for (let i = 0; i < 7; i++) {
    const day = WEEK[(now.index + i) % 7];
    const slot = hours.find((h) => h.days.includes(day));
    if (!slot || (i === 0 && now.minutes >= toMinutes(slot.opens))) continue;
    const when = i === 0 ? 'azi' : i === 1 ? 'mâine' : DAY_NAME[day];
    return { open: false, text: `Închis acum · deschidem ${when} la ${slot.opens}`, day: now.day };
  }
  return { open: false, text: 'Închis acum', day: now.day };
}

export function openStatus() {
  const run = () => {
    document.querySelectorAll<HTMLElement>('[data-open-status]').forEach((el) => {
      const s = describe(JSON.parse(el.dataset.hours ?? '[]'));
      el.textContent = s.text;
      el.classList.toggle('is-open', s.open);
      el.hidden = false;
      document.querySelectorAll<HTMLElement>('.hours-row').forEach((row) => row.classList.toggle('is-today', row.dataset.day === s.day));
    });
  };
  run();
  setInterval(run, 60_000);
}

// Validarea datelor din formularul de programare. Funcții pure (fără DOM), ușor de testat.
// Ce intră e curățat (caractere invizibile / de control, spații multiple), verificat după reguli
// stricte și întors într-o formă standard. Nimic de aici nu ajunge în pagină ca HTML: rezultatul
// e folosit doar ca text, codificat în link-ul de WhatsApp.

export type Check = { ok: true; value: string } | { ok: false; error: string };

/** Scoate caracterele de control și invizibile (inclusiv zero-width, direcție text), normalizează. */
export function clean(raw: string) {
  return raw
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}\p{Co}\p{Cn}]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

/* ---------------- Nume ---------------- */

const NAME_MAX = 40;
// Litere (orice alfabet), apoi grupuri de litere legate prin spațiu, cratimă sau apostrof.
// Ex.: „Ion”, „Ana-Maria”, „D'Angelo”, „Ștefan Cozma”. Fără cifre, simboluri, < > { } etc.
const NAME_SHAPE = /^\p{L}[\p{L}\p{M}]*(?:[ '’-]\p{L}[\p{L}\p{M}]*)*\.?$/u;

export function checkName(raw: string): Check {
  const value = clean(raw);
  if (!value) return { ok: false, error: 'Scrie-ți numele.' };
  if (value.length > NAME_MAX) return { ok: false, error: `Numele e prea lung (maximum ${NAME_MAX} de caractere).` };
  // Simbolurile (< > " ; = ( ) @ etc.) au mesajul lor; cifrele singure, pe al lor.
  if (/[^\p{L}\p{M}\d '’.-]/u.test(value)) {
    return { ok: false, error: 'Numele poate conține doar litere, spații, cratimă (-) și apostrof.' };
  }
  if (/\d/u.test(value)) return { ok: false, error: 'Numele nu poate conține cifre.' };
  if (!NAME_SHAPE.test(value)) {
    return { ok: false, error: 'Numele poate conține doar litere, spații, cratimă (-) și apostrof.' };
  }
  const words = value.split(/[ '’-]/u).filter(Boolean);
  const letters = value.replace(/[^\p{L}]/gu, '').length;
  if (letters < 2 || !words.some((w) => w.replace(/\.$/, '').length >= 2)) {
    return { ok: false, error: 'Numele e prea scurt.' };
  }
  if (words.length > 4) return { ok: false, error: 'Scrie doar numele și prenumele.' };
  // Aceeași literă de 3+ ori la rând („Aaaa”, „Ionnnn”) nu apare în nume reale.
  if (/(\p{L})\1{2,}/iu.test(value)) return { ok: false, error: 'Numele pare scris greșit.' };
  // Prima literă a fiecărei părți, majusculă: „ana-maria popescu” → „Ana-Maria Popescu”.
  const pretty = value.toLocaleLowerCase('ro-RO').replace(/(^|[ '’-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase('ro-RO'));
  return { ok: true, value: pretty };
}

/* ---------------- Telefon ---------------- */

// România: mobil 07x (fără 070, care nu e număr de mobil), fix 02x / 03x; 9 cifre după prefixul 0 / +40.
const RO = /^(7[1-9]\d{7}|[23]\d{8})$/;

function looksFake(digits: string) {
  if (/(\d)\1{5,}/.test(digits)) return true; // 6+ cifre identice la rând
  const tail = digits.slice(-8);
  return '0123456789012'.includes(tail) || '9876543210987'.includes(tail); // 12345678, 87654321…
}

export function checkPhone(raw: string): Check {
  const value = clean(raw);
  if (!value) return { ok: false, error: 'Scrie-ți numărul de telefon.' };
  // Separatori acceptați: spațiu, punct, cratimă, paranteze, slash. Altceva → nu e un număr.
  const compact = value.replace(/[\s.\-()/]/g, '');
  if (!/^\+?\d+$/.test(compact)) {
    return { ok: false, error: 'Numărul poate conține doar cifre (și + la început).' };
  }

  let national: string | null = null;
  if (compact.startsWith('+40')) national = compact.slice(3);
  else if (compact.startsWith('0040')) national = compact.slice(4);
  else if (compact.startsWith('40') && compact.length === 11) national = compact.slice(2);
  else if (compact.startsWith('0')) national = compact.slice(1);

  if (national !== null) {
    if (national.length < 9) return { ok: false, error: 'Numărul are prea puține cifre (ex.: 0712 345 678).' };
    if (national.length > 9) return { ok: false, error: 'Numărul are prea multe cifre (ex.: 0712 345 678).' };
    if (!RO.test(national)) {
      return { ok: false, error: 'Scrie un număr de mobil (07…) sau fix (02… / 03…).' };
    }
    if (looksFake(national)) return { ok: false, error: 'Numărul pare inventat. Verifică-l, te rog.' };
    return { ok: true, value: `+40 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}` };
  }

  // Număr străin: format internațional E.164 (+ prefixul țării, 8–15 cifre în total).
  if (compact.startsWith('+')) {
    const digits = compact.slice(1);
    if (!/^[1-9]\d{7,14}$/.test(digits)) {
      return { ok: false, error: 'Numărul internațional trebuie să aibă 8–15 cifre după +.' };
    }
    if (looksFake(digits)) return { ok: false, error: 'Numărul pare inventat. Verifică-l, te rog.' };
    return { ok: true, value: `+${digits}` };
  }
  return { ok: false, error: 'Scrie numărul cu 0 în față (07…) sau cu prefixul țării (+…).' };
}

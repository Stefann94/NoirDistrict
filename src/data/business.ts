// Sursa unică de adevăr pentru datele frizeriei.
// Tot ce e aici ajunge în pagini, în footer, în datele structurate (JSON-LD) și în meta tag-uri.
// Numele, adresa și telefonul trebuie să fie IDENTICE cu cele din Google Business Profile.
//
// TODO: valorile marcate cu `PLACEHOLDER` trebuie confirmate cu Orlando înainte de lansare.

export type DayCode = 'Mo' | 'Tu' | 'We' | 'Th' | 'Fr' | 'Sa' | 'Su';

export interface OpeningHours {
  days: DayCode[];
  opens: string;
  closes: string;
}

export interface Service {
  name: string;
  description: string;
  price: number;
  /** Durata în minute. */
  duration: number;
  /** Apare pe prima pagină. */
  featured?: boolean;
}

export interface ServiceGroup {
  title: string;
  services: Service[];
}

export const business = {
  name: 'Noir District',
  kind: 'Frizerie',
  owner: 'Orlando',
  description:
    'Frizerie pentru bărbați în Piatra Neamț. Tunsori clasice și moderne, skin fade, păr lung și aranjat de barbă.',

  phone: '+40793301282', // format E.164
  phoneDisplay: '0793 301 282',
  email: '', // opțional

  address: {
    street: 'Strada Mihai Viteazul nr. 6, bl. I2, sc. C',
    city: 'Piatra Neamț',
    region: 'Neamț',
    postalCode: '', // PLACEHOLDER: codul poștal exact (opțional)
    country: 'RO',
  },
  // PLACEHOLDER: coordonatele exacte, din Google Maps (click dreapta pe locație → primul rând).
  // Cât timp e `null`, Google Maps și Waze caută după adresă.
  geo: null as { lat: number; lng: number } | null,
  // Link-ul direct din Google Business Profile („Distribuie”). Dacă e gol, se generează o căutare.
  mapsUrl: '',

  priceRange: '30–110 RON',
  currency: 'RON',

  // Numărul pe care ajung cererile de programare din formular (fără +, fără spații).
  whatsapp: '40793301282',
  // Intervalul dintre sloturile de programare, în minute.
  slotMinutes: 30,
  // Câte zile în avans se pot face programări.
  bookingDays: 14,
  // Link extern de programare (Mero, Booksy etc.). Dacă e completat, formularul trimite către el.
  bookingUrl: '',

  social: {
    instagram: '', // ex: https://www.instagram.com/noirdistrict.pn/
    facebook: '',
    tiktok: '',
  },

  // Programul (de la Orlando). Duminica: închis.
  hours: [
    { days: ['Mo', 'Tu', 'We', 'Th', 'Fr'], opens: '10:00', closes: '18:00' },
    { days: ['Sa'], opens: '10:00', closes: '16:00' },
  ] satisfies OpeningHours[],
} as const;

// Prețurile de la Orlando. Duratele (din ele se calculează orele libere) sunt estimate: de confirmat.
export const serviceGroups: ServiceGroup[] = [
  {
    title: 'Tuns',
    services: [
      { name: 'Tuns clasic', description: 'Foarfecă și mașină, contur curat.', price: 40, duration: 40, featured: true },
      { name: 'Skin fade', description: 'Degradeu până la piele, contur precis.', price: 60, duration: 45, featured: true },
      { name: 'Tuns păr lung', description: 'Tunsoare cu foarfeca, păstrând lungimea.', price: 80, duration: 60 },
    ],
  },
  {
    title: 'Barbă',
    services: [
      { name: 'Aranjat barbă', description: 'Formă, contur și ulei de barbă.', price: 30, duration: 30, featured: true },
    ],
  },
  {
    title: 'Pachete',
    services: [
      { name: 'Tuns + barbă', description: 'Tunsoare la alegere și aranjat de barbă.', price: 90, duration: 70, featured: true },
      { name: 'Tuns + spălat', description: 'Tunsoare, spălat și aranjat (styling).', price: 80, duration: 60 },
      { name: 'Pachet complet', description: 'Tuns, barbă, spălat și aranjat.', price: 110, duration: 90 },
    ],
  },
];

export const featuredServices = serviceGroups.flatMap((g) => g.services).filter((s) => s.featured);

// ---- Valori derivate, nu trebuie editate ----

export const fullAddress = [business.address.street, `${business.address.city} ${business.address.postalCode}`.trim()].join(', ');

export const mapsHref =
  business.mapsUrl ||
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${business.name}, ${fullAddress}`)}`;

export const wazeHref = business.geo
  ? `https://waze.com/ul?ll=${business.geo.lat},${business.geo.lng}&navigate=yes`
  : `https://waze.com/ul?q=${encodeURIComponent(fullAddress)}&navigate=yes`;

export const telHref = `tel:${business.phone}`;

export const whatsappHref = `https://wa.me/${business.whatsapp}`;

export const bookingHref = business.bookingUrl || '/#programare';

export const socialLinks = Object.entries(business.social)
  .filter(([, url]) => url)
  .map(([network, url]) => ({ network, url }));

const DAY_ORDER: DayCode[] = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DAY_LABEL: Record<DayCode, string> = {
  Mo: 'Luni', Tu: 'Marți', We: 'Miercuri', Th: 'Joi', Fr: 'Vineri', Sa: 'Sâmbătă', Su: 'Duminică',
};

/** Program pe fiecare zi, pentru tabelul de program. */
export const weeklyHours = DAY_ORDER.map((day) => {
  const slot = business.hours.find((h) => (h.days as readonly DayCode[]).includes(day));
  return { day, label: DAY_LABEL[day], hours: slot ? `${slot.opens}–${slot.closes}` : null };
});

/** Program comprimat: „Luni–Vineri 09:00–20:00”, plus zilele închise. */
export const hoursSummary = [
  ...business.hours.map((h) => {
    const first = DAY_LABEL[h.days[0]];
    const last = DAY_LABEL[h.days[h.days.length - 1]];
    return { days: h.days.length > 1 ? `${first}–${last}` : first, hours: `${h.opens}–${h.closes}` };
  }),
  ...weeklyHours.filter((d) => !d.hours).map((d) => ({ days: d.label, hours: 'închis' })),
];

export const formatPrice = (price: number) => `${price} lei`;

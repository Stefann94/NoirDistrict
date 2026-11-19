// Accesul la programări (doar pe server). În producție: Supabase (Postgres).
// Local, fără chei Supabase, folosește o bază de date simulată în memorie, ca totul să poată fi testat.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSecret } from 'astro:env/server';

/**
 * pending   – cerere trimisă de client; ora e rezervată până confirmă Orlando (sau până expiră)
 * confirmed – confirmată de Orlando
 * declined  – refuzată de Orlando
 * cancelled – anulată (de client sau de Orlando)
 * expired   – Orlando nu a răspuns la timp; ora s-a eliberat
 */
export type Status = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'expired';
/** Stările în care ora e ocupată. */
export const HOLDING: Status[] = ['pending', 'confirmed'];

export interface Booking {
  id: string;
  token: string;
  admin_token: string;
  service: string;
  price: number;
  duration: number;
  starts_at: string;
  ends_at: string;
  name: string;
  phone: string;
  email: string | null;
  status: Status;
  source: 'site' | 'admin';
  expires_at: string | null;
  created_at: string;
  decided_at: string | null;
  reminded_at: string | null;
}
export interface Block {
  id: string;
  starts_at: string;
  ends_at: string;
  note: string | null;
}
export type NewBooking = Pick<
  Booking,
  'service' | 'price' | 'duration' | 'starts_at' | 'ends_at' | 'name' | 'phone' | 'email' | 'source' | 'status' | 'expires_at'
>;
export type Interval = { starts_at: string; ends_at: string };

/** Ora cerută s-a ocupat între timp (altă programare sau oră blocată). */
export class SlotTaken extends Error {
  constructor() {
    super('Ora aleasă tocmai a fost ocupată.');
  }
}
/** Baza de date nu e configurată (lipsesc cheile, online). */
export class NotConfigured extends Error {}

/** Cheie aleatorie pentru linkuri: 32 de octeți, imposibil de ghicit. */
export function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const overlaps = (a: Interval, b: Interval) => a.starts_at < b.ends_at && b.starts_at < a.ends_at;

interface Store {
  busy(from: string, to: string): Promise<Interval[]>;
  create(b: NewBooking): Promise<Booking>;
  byToken(token: string): Promise<Booking | null>;
  byAdminToken(token: string): Promise<Booking | null>;
  byId(id: string): Promise<Booking | null>;
  /**
   * Schimbă starea doar dacă programarea e încă într-una din stările `from` (atomic: dacă doi apasă
   * în același timp, doar unul reușește). Întoarce programarea actualizată sau null.
   */
  decide(id: string, from: Status[], to: Status): Promise<Booking | null>;
  /** Cererile neconfirmate la timp devin „expired” (o singură dată fiecare); le întoarce, pentru anunțuri. */
  expireDue(now: string): Promise<Booking[]>;
  list(from: string, to: string): Promise<Booking[]>;
  dueReminders(from: string, to: string): Promise<Booking[]>;
  markReminded(id: string): Promise<void>;
  blocks(from: string, to: string): Promise<Block[]>;
  addBlock(b: Omit<Block, 'id'>): Promise<void>;
  removeBlock(id: string): Promise<void>;
}

/* ---------------- Supabase ---------------- */

function supabaseStore(db: SupabaseClient): Store {
  const must = <T>(r: { data: T; error: { code?: string; message: string } | null }) => {
    if (r.error) {
      if (r.error.code === '23P01') throw new SlotTaken(); // regula anti-suprapunere din baza de date
      throw new Error(r.error.message);
    }
    return r.data;
  };
  /** Orele blocate de Orlando au prioritate: nu se poate programa peste ele. */
  const assertNotBlocked = async (i: Interval) => {
    const hits = must(await db.from('blocks').select('id').lt('starts_at', i.ends_at).gt('ends_at', i.starts_at).limit(1));
    if (hits?.length) throw new SlotTaken();
  };
  return {
    async busy(from, to) {
      const bookings = must(
        await db.from('bookings').select('starts_at, ends_at').in('status', HOLDING).lt('starts_at', to).gt('ends_at', from),
      ) as Interval[];
      const blocks = must(await db.from('blocks').select('starts_at, ends_at').lt('starts_at', to).gt('ends_at', from)) as Interval[];
      return [...bookings, ...blocks];
    },
    async create(b) {
      await assertNotBlocked(b);
      return must(await db.from('bookings').insert({ ...b, token: newToken(), admin_token: newToken() }).select().single()) as Booking;
    },
    async byToken(token) {
      return must(await db.from('bookings').select().eq('token', token).maybeSingle()) as Booking | null;
    },
    async byAdminToken(token) {
      return must(await db.from('bookings').select().eq('admin_token', token).maybeSingle()) as Booking | null;
    },
    async byId(id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      return must(await db.from('bookings').select().eq('id', id).maybeSingle()) as Booking | null;
    },
    async decide(id, from, to) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      return must(
        await db.from('bookings').update({ status: to, decided_at: new Date().toISOString() }).eq('id', id).in('status', from).select().maybeSingle(),
      ) as Booking | null;
    },
    async expireDue(now) {
      return must(
        await db.from('bookings').update({ status: 'expired', decided_at: now }).eq('status', 'pending').lt('expires_at', now).select(),
      ) as Booking[];
    },
    async list(from, to) {
      return must(await db.from('bookings').select().lt('starts_at', to).gte('starts_at', from).order('starts_at')) as Booking[];
    },
    async dueReminders(from, to) {
      return must(
        await db.from('bookings').select().eq('status', 'confirmed').is('reminded_at', null).not('email', 'is', null).gte('starts_at', from).lt('starts_at', to),
      ) as Booking[];
    },
    async markReminded(id) {
      must(await db.from('bookings').update({ reminded_at: new Date().toISOString() }).eq('id', id));
    },
    async blocks(from, to) {
      return must(await db.from('blocks').select('id, starts_at, ends_at, note').lt('starts_at', to).gt('ends_at', from).order('starts_at')) as Block[];
    },
    async addBlock(b) {
      must(await db.from('blocks').insert(b));
    },
    async removeBlock(id) {
      must(await db.from('blocks').delete().eq('id', id));
    },
  };
}

/* ---------------- Simulare în memorie (doar local) ---------------- */

function memoryStore(): Store {
  const g = globalThis as unknown as { __ndBookings?: Booking[]; __ndBlocks?: Block[] };
  const bookings = (g.__ndBookings ??= []);
  const blocks = (g.__ndBlocks ??= []);
  const holding = (b: Booking) => HOLDING.includes(b.status);
  const clash = (i: Interval) => bookings.some((b) => holding(b) && overlaps(b, i)) || blocks.some((b) => overlaps(b, i));
  const copy = (b: Booking | undefined) => (b ? { ...b } : null);
  return {
    async busy(from, to) {
      const range = { starts_at: from, ends_at: to };
      return [...bookings.filter((b) => holding(b) && overlaps(b, range)), ...blocks.filter((b) => overlaps(b, range))].map(
        ({ starts_at, ends_at }) => ({ starts_at, ends_at }),
      );
    },
    async create(b) {
      if (clash(b)) throw new SlotTaken();
      const row: Booking = {
        ...b,
        id: crypto.randomUUID(),
        token: newToken(),
        admin_token: newToken(),
        created_at: new Date().toISOString(),
        decided_at: b.status === 'pending' ? null : new Date().toISOString(),
        reminded_at: null,
      };
      bookings.push(row);
      return { ...row };
    },
    async byToken(token) {
      return copy(bookings.find((x) => x.token === token));
    },
    async byAdminToken(token) {
      return copy(bookings.find((x) => x.admin_token === token));
    },
    async byId(id) {
      return copy(bookings.find((x) => x.id === id));
    },
    async decide(id, from, to) {
      const b = bookings.find((x) => x.id === id && from.includes(x.status));
      if (!b) return null;
      Object.assign(b, { status: to, decided_at: new Date().toISOString() });
      return { ...b };
    },
    async expireDue(now) {
      const due = bookings.filter((b) => b.status === 'pending' && b.expires_at && b.expires_at < now);
      for (const b of due) Object.assign(b, { status: 'expired', decided_at: now });
      return due.map((b) => ({ ...b }));
    },
    async list(from, to) {
      return bookings
        .filter((b) => b.starts_at >= from && b.starts_at < to)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
        .map((b) => ({ ...b }));
    },
    async dueReminders(from, to) {
      return bookings.filter((b) => b.status === 'confirmed' && !b.reminded_at && b.email && b.starts_at >= from && b.starts_at < to);
    },
    async markReminded(id) {
      const b = bookings.find((x) => x.id === id);
      if (b) b.reminded_at = new Date().toISOString();
    },
    async blocks(from, to) {
      return blocks.filter((b) => overlaps(b, { starts_at: from, ends_at: to }));
    },
    async addBlock(b) {
      blocks.push({ ...b, id: crypto.randomUUID() });
    },
    async removeBlock(id) {
      const i = blocks.findIndex((b) => b.id === id);
      if (i >= 0) blocks.splice(i, 1);
    },
  };
}

/* ---------------- Alegerea ---------------- */

let cached: Store | null = null;

export function store(): Store {
  if (cached) return cached;
  const url = getSecret('SUPABASE_URL');
  const key = getSecret('SUPABASE_SERVICE_ROLE_KEY');
  if (url && key) {
    cached = supabaseStore(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
  } else if (import.meta.env.DEV) {
    console.info('[programări] Supabase nu e configurat: folosesc baza de date simulată (doar local).');
    cached = memoryStore();
  } else {
    throw new NotConfigured('Baza de date pentru programări nu e configurată.');
  }
  return cached;
}

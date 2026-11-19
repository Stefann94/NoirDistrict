-- Baza de date pentru programări. Se rulează o singură dată, în Supabase → SQL Editor → New query.
-- Accesul se face doar de pe server (cheia „service_role”, ținută în Vercel); din browser, nimic.
--
-- Fluxul: clientul trimite o cerere (status „pending”, ora e rezervată) → Orlando o confirmă
-- („confirmed”) sau o refuză („declined”) din linkul primit pe WhatsApp. Dacă nu răspunde la timp,
-- cererea expiră („expired”) și ora se eliberează. Clientul poate anula („cancelled”).

create extension if not exists btree_gist;

create table if not exists bookings (
  id           uuid primary key default gen_random_uuid(),
  -- Linkul clientului (anulare) și linkul lui Orlando (confirmare / refuz): aleatorii, imposibil de ghicit.
  token        text not null unique,
  admin_token  text not null unique,
  service      text not null,
  price        integer not null check (price >= 0),
  duration     integer not null check (duration between 5 and 480),
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  name         text not null check (char_length(name) between 2 and 60),
  phone        text not null check (char_length(phone) between 6 and 25),
  email        text check (email is null or char_length(email) <= 120),
  status       text not null default 'pending'
               check (status in ('pending', 'confirmed', 'declined', 'cancelled', 'expired')),
  source       text not null default 'site' check (source in ('site', 'admin')),
  -- Până când așteaptă cererea confirmarea lui Orlando (după aceea expiră și ora se eliberează).
  expires_at   timestamptz,
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  reminded_at  timestamptz,
  check (ends_at > starts_at),
  -- Garanția de bază: o oră rezervată (în așteptare sau confirmată) nu poate fi luată de altcineva,
  -- oricât de simultan ar sosi cererile.
  constraint bookings_no_overlap exclude using gist (tstzrange(starts_at, ends_at) with &&)
    where (status in ('pending', 'confirmed'))
);
create index if not exists bookings_active on bookings (starts_at) where status in ('pending', 'confirmed');
create index if not exists bookings_pending on bookings (expires_at) where status = 'pending';

-- Ore blocate de Orlando (pauză, concediu, treabă). Nu se pot face programări peste ele.
create table if not exists blocks (
  id         uuid primary key default gen_random_uuid(),
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  note       text check (note is null or char_length(note) <= 120),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists blocks_starts_at on blocks (starts_at);

-- Securitate: fără nicio regulă de acces public. Doar serverul (service_role) poate citi și scrie.
alter table bookings enable row level security;
alter table blocks enable row level security;

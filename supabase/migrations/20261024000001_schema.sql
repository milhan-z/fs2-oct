-- FS² Digital Passport — schema (SPEC §4)
-- Every table has RLS ON and NO policies: clients can never read/write tables directly.
-- All access goes through SECURITY DEFINER RPCs (public schema) or Edge Functions (service role).

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- tables
-- ---------------------------------------------------------------------------

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  nrp text not null unique check (nrp ~ '^\d{4,14}$'),
  nama text not null check (length(nama) between 1 and 120),
  departemen text not null check (length(departemen) between 1 and 120),
  angkatan text not null check (length(angkatan) between 1 and 20),
  photo_path text,
  created_at timestamptz not null default now()
);

create table public.participant_auth (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  pin_hash text not null,
  failed_count int not null default 0,
  locked_until timestamptz,
  qr_token text not null unique
);

create table public.sessions (
  token_hash text primary key,
  role text not null check (role in ('participant', 'staff', 'admin')),
  subject_id text not null,
  booth_id text,
  expires_at timestamptz not null
);
create index sessions_subject_idx on public.sessions (role, subject_id);

create table public.booths (
  id text primary key,
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,40}$'),
  nama text not null,
  region text not null default '',
  stamp_url text,
  x int not null default 0,
  y int not null default 0,
  placeholder_pos boolean not null default true,
  sort int not null default 0
);

create table public.speakers (
  id text primary key,
  booth_id text not null references public.booths(id) on delete cascade,
  nama text not null,
  universitas text not null default '',
  program text not null default '',
  foto_url text,
  cerita text not null default '',
  placeholder boolean not null default true,
  sort int not null default 0
);

create table public.facilities (
  id text primary key,
  jenis text not null default 'lainnya',
  label text not null,
  x int,
  y int,
  placeholder boolean not null default true,
  catatan text
);

create table public.staff_pins (
  booth_id text primary key references public.booths(id) on delete cascade,
  pin_hash text not null,
  failed_count int not null default 0,
  locked_until timestamptz
);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  booth_id text not null references public.booths(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  confirmed_at timestamptz not null default now(),
  confirmed_by text not null,
  cancelled_at timestamptz
);
create unique index visits_one_active on public.visits (participant_id, booth_id) where cancelled_at is null;
create index visits_booth_idx on public.visits (booth_id, confirmed_at desc);

create table public.resumes (
  participant_id uuid not null references public.participants(id) on delete cascade,
  booth_id text not null references public.booths(id) on delete cascade,
  poin1 text not null default '' check (length(poin1) <= 2000),
  poin2 text not null default '' check (length(poin2) <= 2000),
  poin3 text not null default '' check (length(poin3) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (participant_id, booth_id)
);

create table public.feedback_questions (
  id text primary key,
  teks text not null,
  tipe text not null check (tipe in ('skala_1_5', 'teks')),
  wajib boolean not null default true,
  sort int not null default 0
);

create table public.feedback_answers (
  participant_id uuid not null references public.participants(id) on delete cascade,
  question_id text not null references public.feedback_questions(id) on delete cascade,
  nilai_int int check (nilai_int between 1 and 5),
  nilai_teks text check (length(nilai_teks) <= 2000),
  primary key (participant_id, question_id)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null unique references public.participants(id) on delete cascade,
  version int not null default 1,
  status text not null check (status in ('submitted', 'revision', 'approved')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_note text
);

create table public.stamp4it (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  given boolean not null default false,
  given_at timestamptz,
  given_by text
);

create table public.settings (
  key text primary key,
  value jsonb not null
);

create table public.audit_log (
  id bigserial primary key,
  actor text not null,
  action text not null,
  target text,
  at timestamptz not null default now()
);

create table public.login_attempts (
  key text primary key,
  failed_count int not null default 0,
  locked_until timestamptz
);

-- RLS on everywhere, no policies
do $$
declare t text;
begin
  foreach t in array array['participants','participant_auth','sessions','booths','speakers','facilities','staff_pins','visits','resumes',
    'feedback_questions','feedback_answers','submissions','stamp4it','settings','audit_log','login_attempts']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;
revoke all on sequence public.audit_log_id_seq from anon, authenticated;

-- ---------------------------------------------------------------------------
-- storage: private attendance photos, public content images (stamps, speaker photos)
-- (no storage policies → only the service role in Edge Functions can touch objects)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attendance-photos', 'attendance-photos', false, 1048576, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content', 'content', true, 2097152, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

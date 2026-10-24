-- Private helpers (schema `private` is not exposed through PostgREST and not executable by anon).
-- Errors are raised as 'code:Pesan untuk pengguna' and split by the client adapter.

create or replace function private.fail(p_code text, p_msg text) returns void
language plpgsql as $$
begin
  raise exception using errcode = 'P0001', message = p_code || ':' || p_msg;
end $$;

create or replace function private.hash_token(p_token text) returns text
language sql immutable as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex')
$$;

create or replace function private.random_pin() returns text
language sql volatile as $$
  select lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 10000))::text, 4, '0')
$$;

create or replace function private.setting(p_key text) returns jsonb
language sql stable as $$
  select value from public.settings where key = p_key
$$;

create or replace function private.word_count(p text) returns int
language sql immutable as $$
  select case when btrim(coalesce(p, '')) = '' then 0
              else coalesce(array_length(regexp_split_to_array(btrim(p), '\s+'), 1), 0) end
$$;

create or replace function private.mask_nrp(p_nrp text) returns text
language sql immutable as $$
  select '••••' || right(p_nrp, 4)
$$;

create or replace function private.submission_code(p_nrp text, p_version int) returns text
language sql immutable as $$
  select 'FS2-' || right(p_nrp, 4) || '-' || chr(64 + least(greatest(p_version, 1), 26))
$$;

create or replace function private.new_session(p_role text, p_subject text, p_booth text default null) returns text
language plpgsql as $$
declare v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  delete from public.sessions where expires_at < now();
  insert into public.sessions (token_hash, role, subject_id, booth_id, expires_at)
  values (private.hash_token(v_token), p_role, p_subject, p_booth, now() + interval '3 days');
  return v_token;
end $$;

create or replace function private.session(p_token text, p_role text) returns public.sessions
language plpgsql as $$
declare s public.sessions;
begin
  select * into s from public.sessions
   where token_hash = private.hash_token(coalesce(p_token, '')) and role = p_role and expires_at > now();
  if not found then
    perform private.fail('auth', case p_role when 'participant' then 'Sesi berakhir. Masuk lagi dengan NRP + PIN.'
                                            when 'staff' then 'Sesi petugas berakhir. Masukkan PIN booth lagi.'
                                            else 'Sesi admin berakhir.' end);
  end if;
  return s;
end $$;

create or replace function private.participant_id(p_token text) returns uuid
language sql as $$
  select (private.session(p_token, 'participant')).subject_id::uuid
$$;

create or replace function private.require_admin(p_token text) returns void
language plpgsql as $$
begin
  perform private.session(p_token, 'admin');
end $$;

create or replace function private.scan_open() returns boolean
language sql stable as $$
  select coalesce((private.setting('simulation_mode'))::boolean, false)
      or now() between (private.setting('session_start') #>> '{}')::timestamptz and (private.setting('session_end') #>> '{}')::timestamptz
$$;

create or replace function private.audit(p_actor text, p_action text, p_target text) returns void
language sql as $$
  insert into public.audit_log (actor, action, target) values (p_actor, p_action, p_target)
$$;

create or replace function private.assert_editable(p_pid uuid) returns void
language plpgsql stable as $$
begin
  if exists (select 1 from public.submissions where participant_id = p_pid and status <> 'revision') then
    perform private.fail('locked', 'Pengajuan sudah dikirim — isi terkunci.');
  end if;
end $$;

create or replace function private.my_state(p_pid uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'participant', jsonb_build_object(
      'id', p.id, 'nama', p.nama, 'nrpMasked', private.mask_nrp(p.nrp), 'nrpLast4', right(p.nrp, 4),
      'departemen', p.departemen, 'angkatan', p.angkatan, 'photo', p.photo_path),
    'qrToken', a.qr_token,
    'visits', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'boothId', v.booth_id, 'confirmedAt', v.confirmed_at) order by v.confirmed_at)
                          from public.visits v where v.participant_id = p.id and v.cancelled_at is null), '[]'::jsonb),
    'resumes', coalesce((select jsonb_agg(jsonb_build_object('boothId', r.booth_id, 'poin', jsonb_build_array(r.poin1, r.poin2, r.poin3), 'updatedAt', r.updated_at))
                           from public.resumes r where r.participant_id = p.id), '[]'::jsonb),
    'answers', coalesce((select jsonb_agg(jsonb_build_object('questionId', f.question_id, 'nilaiInt', f.nilai_int, 'nilaiTeks', f.nilai_teks))
                           from public.feedback_answers f where f.participant_id = p.id), '[]'::jsonb),
    'submission', (select jsonb_build_object('id', s.id, 'code', private.submission_code(p.nrp, s.version), 'version', s.version, 'status', s.status,
                                             'submittedAt', s.submitted_at, 'reviewedAt', s.reviewed_at, 'reviewerNote', s.reviewer_note)
                     from public.submissions s where s.participant_id = p.id),
    'stamp4it', coalesce((select given from public.stamp4it where participant_id = p.id), false),
    'serverNow', now())
  from public.participants p join public.participant_auth a on a.participant_id = p.id
  where p.id = p_pid
$$;

create or replace function private.resolve_participant(p_pid uuid, p_booth text, p_token text) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'token', p_token,
    'kind', case when exists (select 1 from public.visits v where v.participant_id = p.id and v.booth_id = p_booth and v.cancelled_at is null)
                 then 'duplicate' else 'ok' end,
    'participantId', p.id, 'nama', p.nama, 'nrpMasked', private.mask_nrp(p.nrp), 'photo', p.photo_path)
  from public.participants p where p.id = p_pid
$$;

-- generic login throttle for staff/admin keys: 5 failures → 5 minute lock
create or replace function private.check_lock(p_key text) returns void
language plpgsql as $$
declare v_until timestamptz;
begin
  select locked_until into v_until from public.login_attempts where key = p_key;
  if v_until is not null and v_until > now() then
    perform private.fail('locked', 'Terlalu banyak percobaan. Coba lagi ' || ceil(extract(epoch from v_until - now()) / 60)::int || ' menit lagi.');
  end if;
end $$;

create or replace function private.register_failure(p_key text) returns void
language plpgsql as $$
begin
  insert into public.login_attempts (key, failed_count) values (p_key, 1)
  on conflict (key) do update set failed_count = public.login_attempts.failed_count + 1;
  update public.login_attempts set failed_count = 0, locked_until = now() + interval '5 minutes'
   where key = p_key and failed_count >= 5;
end $$;

create or replace function private.clear_failures(p_key text) returns void
language sql as $$
  delete from public.login_attempts where key = p_key
$$;

revoke all on all functions in schema private from public, anon, authenticated;

-- pin search_path on every helper (all names inside are schema-qualified)
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' loop
    execute format('alter function %s set search_path = %L', f, '');
  end loop;
end $$;

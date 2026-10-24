-- PIN reset without handing out PINs: the admin opens a 24-hour reset window for a participant; the participant then
-- signs in with the NRP, is asked to choose a new PIN, and keeps all progress (same passport, same stamps and notes).

alter table public.participant_auth add column if not exists reset_until timestamptz;

-- {exists, reset}: lets the sign-in form know which step comes next
create or replace function public.participant_status(p_nrp text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('exists', true, 'reset', coalesce(a.reset_until > now(), false))
       from public.participants p join public.participant_auth a on a.participant_id = p.id
      where p.nrp = btrim(p_nrp)),
    jsonb_build_object('exists', false, 'reset', false))
$$;

-- the participant chooses the new PIN (only while a reset is open) and is signed in
create or replace function public.participant_set_pin(p_nrp text, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid; a public.participant_auth;
begin
  if coalesce(p_pin, '') !~ '^\d{4}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid', 'message', 'PIN must be 4 digits.');
  end if;
  select id into v_pid from public.participants where nrp = btrim(p_nrp);
  if v_pid is null then
    return jsonb_build_object('ok', false, 'error', 'not_found', 'message', 'This NRP is not registered yet.');
  end if;
  select * into a from public.participant_auth where participant_id = v_pid for update;
  if a.reset_until is null or a.reset_until <= now() then
    return jsonb_build_object('ok', false, 'error', 'no_reset', 'message', 'No PIN reset is open for this NRP. Ask the committee to reset it.');
  end if;
  update public.participant_auth
     set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')), failed_count = 0, locked_until = null, reset_until = null
   where participant_id = v_pid;
  return jsonb_build_object('ok', true, 'token', private.new_session('participant', v_pid::text),
    'photo', (select photo_path from public.participants where id = v_pid));
end $$;

-- while a reset is open the old PIN no longer signs in
create or replace function public.participant_login(p_nrp text, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid; a public.participant_auth;
begin
  select id into v_pid from public.participants where nrp = btrim(p_nrp);
  if v_pid is null then
    return jsonb_build_object('ok', false, 'error', 'not_found', 'message', 'NRP belum terdaftar.');
  end if;
  select * into a from public.participant_auth where participant_id = v_pid for update;
  if a.reset_until is not null and a.reset_until > now() then
    return jsonb_build_object('ok', false, 'error', 'reset_pending', 'message', 'Your PIN was reset. Enter your NRP again to choose a new one.');
  end if;
  if a.locked_until is not null and a.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'locked',
      'message', 'Terlalu banyak percobaan. Coba lagi ' || ceil(extract(epoch from a.locked_until - now()) / 60)::int || ' menit lagi.');
  end if;
  if a.pin_hash <> extensions.crypt(coalesce(p_pin, ''), a.pin_hash) then
    update public.participant_auth
       set failed_count = case when failed_count + 1 >= 5 then 0 else failed_count + 1 end,
           locked_until = case when failed_count + 1 >= 5 then now() + interval '5 minutes' else locked_until end
     where participant_id = v_pid;
    return jsonb_build_object('ok', false, 'error', 'bad_pin', 'message', 'PIN salah.');
  end if;
  update public.participant_auth set failed_count = 0, locked_until = null where participant_id = v_pid;
  return jsonb_build_object('ok', true, 'token', private.new_session('participant', v_pid::text),
    'photo', (select photo_path from public.participants where id = v_pid));
end $$;

-- admin: opens the reset window and signs the participant out everywhere; no PIN is issued
drop function if exists public.admin_reset_pin(text, uuid);
create function public.admin_reset_pin(p_token text, p_pid uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_token);
  update public.participant_auth set reset_until = now() + interval '24 hours', failed_count = 0, locked_until = null where participant_id = p_pid;
  if not found then perform private.fail('not_found', 'Participant not found.'); end if;
  delete from public.sessions where role = 'participant' and subject_id = p_pid::text;
  perform private.audit('admin', 'reset_pin', p_pid::text);
end $$;

create or replace function public.admin_list_participants(p_token text, p_q text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_token);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'nrp', p.nrp, 'nama', p.nama, 'departemen', p.departemen, 'angkatan', p.angkatan, 'hasPhoto', p.photo_path is not null,
      'visits', (select count(*) from public.visits v where v.participant_id = p.id and v.cancelled_at is null),
      'status', (select status from public.submissions s where s.participant_id = p.id),
      'locked', coalesce(a.locked_until > now(), false),
      'resetPending', coalesce(a.reset_until > now(), false)) order by p.created_at desc)
    from public.participants p join public.participant_auth a on a.participant_id = p.id
   where coalesce(p_q, '') = '' or p.nama ilike '%' || p_q || '%' or p.nrp like '%' || p_q || '%'), '[]'::jsonb);
end $$;

revoke all on function public.participant_status(text), public.participant_set_pin(text, text), public.participant_login(text, text),
  public.admin_reset_pin(text, uuid), public.admin_list_participants(text, text) from public, authenticated;
grant execute on function public.participant_status(text), public.participant_set_pin(text, text), public.participant_login(text, text),
  public.admin_reset_pin(text, uuid), public.admin_list_participants(text, text) to anon;

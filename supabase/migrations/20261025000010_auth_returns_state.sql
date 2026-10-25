-- Sign-in, registration and PIN reset answer with the passport state too, so the app no longer needs a second
-- round trip (get_my_state) right after them. Same functions as before plus a 'state' key.

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
    'photo', (select photo_path from public.participants where id = v_pid),
    'state', private.my_state(v_pid));
end $$;

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
    'photo', (select photo_path from public.participants where id = v_pid),
    'state', private.my_state(v_pid));
end $$;

create or replace function public.participant_register(p_nrp text, p_nama text, p_departemen text, p_angkatan text, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid; v_nrp text := btrim(p_nrp);
begin
  if v_nrp !~ '^\d{4,14}$' then perform private.fail('invalid', 'NRP tidak valid.'); end if;
  if coalesce(p_pin, '') !~ '^\d{4}$' then perform private.fail('invalid', 'PIN harus 4 angka.'); end if;
  if length(btrim(coalesce(p_nama, ''))) < 3 then perform private.fail('invalid', 'Isi nama lengkap.'); end if;
  if btrim(coalesce(p_departemen, '')) = '' then perform private.fail('invalid', 'Pilih departemen.'); end if;
  if exists (select 1 from public.participants where nrp = v_nrp) then
    perform private.fail('exists', 'NRP sudah punya paspor. Masuk dengan PIN.');
  end if;
  insert into public.participants (nrp, nama, departemen, angkatan)
  values (v_nrp, left(btrim(p_nama), 120), left(btrim(p_departemen), 120), left(btrim(coalesce(p_angkatan, '')), 20))
  returning id into v_pid;
  insert into public.participant_auth (participant_id, pin_hash, qr_token)
  values (v_pid, extensions.crypt(p_pin, extensions.gen_salt('bf')), encode(extensions.gen_random_bytes(18), 'hex'));
  return jsonb_build_object('ok', true, 'token', private.new_session('participant', v_pid::text), 'state', private.my_state(v_pid));
end $$;

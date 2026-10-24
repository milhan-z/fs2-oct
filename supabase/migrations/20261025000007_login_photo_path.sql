-- Sign-in also returns the attendance photo path, so the app can ask for its signed URL while the passport state loads.
create or replace function public.participant_login(p_nrp text, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid; a public.participant_auth;
begin
  select id into v_pid from public.participants where nrp = btrim(p_nrp);
  if v_pid is null then
    return jsonb_build_object('ok', false, 'error', 'not_found', 'message', 'NRP belum terdaftar.');
  end if;
  select * into a from public.participant_auth where participant_id = v_pid for update;
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

revoke all on function public.participant_login(text, text) from public, authenticated;
grant execute on function public.participant_login(text, text) to anon;

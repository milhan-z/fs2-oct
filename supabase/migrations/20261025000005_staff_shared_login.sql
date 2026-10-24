-- One shared staff (runner) PIN for all booths. A runner signs in once and switches booths
-- without signing in again. Per-booth PINs keep working.
--   * root session:  role 'staff', subject 'runner', booth_id null   (may only switch)
--   * booth session: role 'staff', subject 'runner:<booth>', booth_id <booth>

create table if not exists public.staff_master (
  id int primary key default 1 check (id = 1),
  pin_hash text not null
);
alter table public.staff_master enable row level security;
revoke all on table public.staff_master from anon, authenticated;

create or replace function private.random_pin6() returns text
language sql volatile as $$
  select lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000))::text, 6, '0')
$$;

-- staff_login(slug, pin): booth PIN or the shared PIN. Empty slug + shared PIN = root session.
create or replace function public.staff_login(p_slug text, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.booths; v_hash text; v_master text; v_until timestamptz; v_key text;
begin
  select pin_hash into v_master from public.staff_master where id = 1;
  if coalesce(p_slug, '') = '' then
    v_key := 'staff:all';
  else
    select * into b from public.booths where slug = p_slug;
    if not found then return jsonb_build_object('ok', false, 'error', 'not_found', 'message', 'Booth not found.'); end if;
    v_key := 'staff:' || b.id;
  end if;
  select locked_until into v_until from public.login_attempts where key = v_key;
  if v_until is not null and v_until > now() then
    return jsonb_build_object('ok', false, 'error', 'locked', 'message', 'Too many attempts. Try again in ' || ceil(extract(epoch from v_until - now()) / 60)::int || ' min.');
  end if;

  if v_master is not null and v_master = extensions.crypt(coalesce(p_pin, ''), v_master) then
    perform private.clear_failures(v_key);
    if b.id is null then
      return jsonb_build_object('ok', true, 'roaming', true, 'token', private.new_session('staff', 'runner', null));
    end if;
    return jsonb_build_object('ok', true, 'roaming', true, 'token', private.new_session('staff', 'runner:' || b.id, b.id), 'boothId', b.id, 'boothNama', b.nama);
  end if;

  if b.id is not null then
    select pin_hash into v_hash from public.staff_pins where booth_id = b.id;
    if v_hash is not null and v_hash = extensions.crypt(coalesce(p_pin, ''), v_hash) then
      perform private.clear_failures(v_key);
      return jsonb_build_object('ok', true, 'roaming', false, 'token', private.new_session('staff', 'staff-' || b.id, b.id), 'boothId', b.id, 'boothNama', b.nama);
    end if;
  end if;

  perform private.register_failure(v_key);
  return jsonb_build_object('ok', false, 'error', 'bad_pin', 'message', 'Wrong staff PIN.');
end $$;

-- A runner session (root or booth) mints a session for another booth.
create or replace function public.staff_switch(p_token text, p_slug text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.sessions := private.session(p_token, 'staff'); b public.booths;
begin
  if s.subject_id <> 'runner' and s.subject_id not like 'runner:%' then
    perform private.fail('auth', 'This sign-in is for one booth only. Use the shared staff PIN to switch booths.');
  end if;
  select * into b from public.booths where slug = p_slug;
  if not found then perform private.fail('not_found', 'Booth not found.'); end if;
  return jsonb_build_object('token', private.new_session('staff', 'runner:' || b.id, b.id), 'boothId', b.id, 'boothNama', b.nama);
end $$;

create or replace function public.admin_reset_staff_master_pin(p_token text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_pin text := private.random_pin6();
begin
  perform private.require_admin(p_token);
  insert into public.staff_master (id, pin_hash) values (1, extensions.crypt(v_pin, extensions.gen_salt('bf')))
  on conflict (id) do update set pin_hash = excluded.pin_hash;
  delete from public.sessions where role = 'staff' and (subject_id = 'runner' or subject_id like 'runner:%');
  perform private.clear_failures('staff:all');
  perform private.audit('admin', 'reset_staff_master_pin', '');
  return v_pin;
end $$;

revoke all on function public.staff_login(text, text), public.staff_switch(text, text), public.admin_reset_staff_master_pin(text) from public, authenticated;
grant execute on function public.staff_login(text, text), public.staff_switch(text, text), public.admin_reset_staff_master_pin(text) to anon;

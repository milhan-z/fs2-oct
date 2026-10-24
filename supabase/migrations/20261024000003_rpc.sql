-- Public RPC API (SPEC §4). All SECURITY DEFINER with an empty search_path; every name is schema-qualified.
-- Login RPCs return {ok:false,error,message} instead of raising so failed-attempt counters are not rolled back.

-- ===========================================================================
-- content (public, no session)
-- ===========================================================================
create or replace function public.get_content() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'booths', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'slug', slug, 'nama', nama, 'region', region, 'stamp', stamp_url,
                                         'x', x, 'y', y, 'placeholderPos', placeholder_pos, 'sort', sort) order by sort) from public.booths), '[]'::jsonb),
    'speakers', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'boothId', booth_id, 'nama', nama, 'universitas', universitas, 'program', program,
                                           'foto', foto_url, 'cerita', cerita, 'placeholder', placeholder) order by booth_id, sort, id) from public.speakers), '[]'::jsonb),
    'facilities', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'jenis', jenis, 'label', label, 'x', x, 'y', y,
                                             'placeholder', placeholder, 'catatan', catatan) order by id) from public.facilities), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'teks', teks, 'tipe', tipe, 'wajib', wajib, 'sort', sort) order by sort)
                             from public.feedback_questions), '[]'::jsonb),
    'settings', jsonb_build_object(
      'simulationMode', coalesce(private.setting('simulation_mode'), 'false'::jsonb),
      'sessionStart', private.setting('session_start'),
      'sessionEnd', private.setting('session_end'),
      'deadline', private.setting('deadline')),
    'event', private.setting('event'),
    'rooms', private.setting('rooms'),
    'rules', private.setting('rules'),
    'serverNow', now())
$$;

-- ===========================================================================
-- participant
-- ===========================================================================
create or replace function public.check_nrp(p_nrp text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.participants where nrp = btrim(p_nrp))
$$;

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
  return jsonb_build_object('ok', true, 'token', private.new_session('participant', v_pid::text));
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
  return jsonb_build_object('ok', true, 'token', private.new_session('participant', v_pid::text));
end $$;

create or replace function public.get_my_state(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  return private.my_state(private.participant_id(p_token));
end $$;

/** Called after the Edge Function `photo-upload-url` handed out a signed upload URL for this path. */
create or replace function public.set_photo(p_token text, p_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := private.participant_id(p_token);
begin
  if p_path is null or p_path not like v_pid::text || '/%' then perform private.fail('invalid', 'Path foto tidak valid.'); end if;
  if exists (select 1 from public.submissions where participant_id = v_pid and status <> 'revision') then
    perform private.fail('locked', 'Foto tidak bisa diganti setelah pengajuan dikirim.');
  end if;
  update public.participants set photo_path = p_path where id = v_pid;
end $$;

create or replace function public.save_resume(p_token text, p_booth text, p_poin1 text, p_poin2 text, p_poin3 text) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := private.participant_id(p_token); v_at timestamptz := now();
begin
  perform private.assert_editable(v_pid);
  if not exists (select 1 from public.visits where participant_id = v_pid and booth_id = p_booth and cancelled_at is null) then
    perform private.fail('not_stamped', 'Booth ini belum dicap.');
  end if;
  insert into public.resumes (participant_id, booth_id, poin1, poin2, poin3, updated_at)
  values (v_pid, p_booth, left(coalesce(p_poin1, ''), 2000), left(coalesce(p_poin2, ''), 2000), left(coalesce(p_poin3, ''), 2000), v_at)
  on conflict (participant_id, booth_id) do update
     set poin1 = excluded.poin1, poin2 = excluded.poin2, poin3 = excluded.poin3, updated_at = excluded.updated_at;
  return v_at;
end $$;

create or replace function public.save_feedback(p_token text, p_answers jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := private.participant_id(p_token);
begin
  perform private.assert_editable(v_pid);
  delete from public.feedback_answers where participant_id = v_pid;
  insert into public.feedback_answers (participant_id, question_id, nilai_int, nilai_teks)
  select v_pid, a->>'questionId', nullif(a->>'nilaiInt', '')::int, left(a->>'nilaiTeks', 2000)
    from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) a
   where exists (select 1 from public.feedback_questions q where q.id = a->>'questionId');
end $$;

create or replace function public.submit(p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := private.participant_id(p_token);
  v_rules jsonb := private.setting('rules');
  v_need int; v_min int; v_points int; v_sub public.submissions;
begin
  if now() > (private.setting('deadline') #>> '{}')::timestamptz then perform private.fail('deadline', 'Batas kirim sudah lewat.'); end if;
  v_need := least(coalesce((v_rules->>'jumlah_booth_wajib')::int, 4), (select count(*) from public.booths)::int);
  v_min := coalesce((v_rules->>'min_kata_per_poin')::int, 5);
  v_points := coalesce((v_rules->>'poin_per_resume')::int, 3);
  if (select count(*) from public.visits where participant_id = v_pid and cancelled_at is null) < v_need then
    perform private.fail('incomplete', 'Belum semua booth dicap.');
  end if;
  if (select count(*) from public.resumes r
       where r.participant_id = v_pid
         and exists (select 1 from public.visits v where v.participant_id = v_pid and v.booth_id = r.booth_id and v.cancelled_at is null)
         and ((private.word_count(r.poin1) >= v_min)::int + (private.word_count(r.poin2) >= v_min)::int + (private.word_count(r.poin3) >= v_min)::int) >= v_points
     ) < v_need then
    perform private.fail('incomplete', 'Resume belum lengkap.');
  end if;
  if exists (select 1 from public.feedback_questions q where q.wajib and not exists (
       select 1 from public.feedback_answers a where a.participant_id = v_pid and a.question_id = q.id
          and (a.nilai_int is not null or btrim(coalesce(a.nilai_teks, '')) <> ''))) then
    perform private.fail('incomplete', 'Feedback wajib belum diisi.');
  end if;
  select * into v_sub from public.submissions where participant_id = v_pid for update;
  if found then
    if v_sub.status <> 'revision' then perform private.fail('locked', 'Pengajuan sudah dikirim.'); end if;
    update public.submissions set version = version + 1, status = 'submitted', submitted_at = now(), reviewed_at = null where id = v_sub.id;
  else
    insert into public.submissions (participant_id, status) values (v_pid, 'submitted');
  end if;
end $$;

-- ===========================================================================
-- staff
-- ===========================================================================
create or replace function public.staff_login(p_slug text, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.booths; v_hash text; v_until timestamptz;
begin
  select * into b from public.booths where slug = p_slug;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found', 'message', 'Booth tidak ditemukan.'); end if;
  select locked_until into v_until from public.login_attempts where key = 'staff:' || b.id;
  if v_until is not null and v_until > now() then
    return jsonb_build_object('ok', false, 'error', 'locked', 'message', 'Terlalu banyak percobaan. Coba lagi ' || ceil(extract(epoch from v_until - now()) / 60)::int || ' menit lagi.');
  end if;
  select pin_hash into v_hash from public.staff_pins where booth_id = b.id;
  if v_hash is null or v_hash <> extensions.crypt(coalesce(p_pin, ''), v_hash) then
    perform private.register_failure('staff:' || b.id);
    return jsonb_build_object('ok', false, 'error', 'bad_pin', 'message', 'PIN booth salah.');
  end if;
  perform private.clear_failures('staff:' || b.id);
  return jsonb_build_object('ok', true, 'token', private.new_session('staff', 'staff-' || b.id, b.id), 'boothId', b.id, 'boothNama', b.nama);
end $$;

create or replace function public.staff_session_info(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.sessions := private.session(p_token, 'staff');
begin
  return (select jsonb_build_object('boothId', id, 'boothNama', nama, 'slug', slug) from public.booths where id = s.booth_id);
end $$;

create or replace function public.staff_resolve_tokens(p_token text, p_tokens text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.sessions := private.session(p_token, 'staff'); v_out jsonb := '[]'::jsonb; t text; v_pid uuid;
begin
  foreach t in array coalesce(p_tokens, array[]::text[]) loop
    select participant_id into v_pid from public.participant_auth where qr_token = regexp_replace(btrim(t), '^FS2:', '');
    if v_pid is null then
      v_out := v_out || jsonb_build_array(jsonb_build_object('token', t, 'kind', 'unknown'));
    else
      v_out := v_out || jsonb_build_array(private.resolve_participant(v_pid, s.booth_id, t));
    end if;
  end loop;
  return v_out;
end $$;

create or replace function public.staff_find_by_last4(p_token text, p_last4 text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.sessions := private.session(p_token, 'staff');
begin
  if coalesce(p_last4, '') !~ '^\d{4}$' then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(private.resolve_participant(p.id, s.booth_id, 'manual:' || p.id)) from public.participants p
                    where right(p.nrp, 4) = p_last4), '[]'::jsonb);
end $$;

create or replace function public.staff_confirm_batch(p_token text, p_participant_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare s public.sessions := private.session(p_token, 'staff'); v_n int;
begin
  if not private.scan_open() then perform private.fail('closed', 'Sesi booth belum/tidak dibuka.'); end if;
  with ins as (
    insert into public.visits (participant_id, booth_id, confirmed_by)
    select distinct p.id, s.booth_id, s.subject_id from public.participants p where p.id = any(p_participant_ids)
    on conflict (participant_id, booth_id) where cancelled_at is null do nothing
    returning 1)
  select count(*) into v_n from ins;
  perform private.audit(s.subject_id, 'confirm_batch', v_n::text);
  return v_n;
end $$;

create or replace function public.staff_history(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.sessions := private.session(p_token, 'staff');
begin
  return coalesce((select jsonb_agg(jsonb_build_object('visitId', v.id, 'participantId', p.id, 'nama', p.nama, 'nrpMasked', private.mask_nrp(p.nrp),
                                                       'photo', p.photo_path, 'confirmedAt', v.confirmed_at) order by v.confirmed_at desc)
                     from public.visits v join public.participants p on p.id = v.participant_id
                    where v.booth_id = s.booth_id and v.cancelled_at is null), '[]'::jsonb);
end $$;

create or replace function public.staff_cancel_visit(p_token text, p_visit uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sessions := private.session(p_token, 'staff'); v_pid uuid;
begin
  update public.visits set cancelled_at = now() where id = p_visit and booth_id = s.booth_id and cancelled_at is null
  returning participant_id into v_pid;
  if v_pid is null then perform private.fail('not_found', 'Kunjungan tidak ditemukan.'); end if;
  perform private.audit(s.subject_id, 'cancel_visit', v_pid::text);
end $$;

-- ===========================================================================
-- admin
-- ===========================================================================
create or replace function public.admin_login(p_password text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_hash text := private.setting('admin_password_hash') #>> '{}'; v_until timestamptz;
begin
  select locked_until into v_until from public.login_attempts where key = 'admin';
  if v_until is not null and v_until > now() then
    return jsonb_build_object('ok', false, 'error', 'locked', 'message', 'Terlalu banyak percobaan. Coba lagi ' || ceil(extract(epoch from v_until - now()) / 60)::int || ' menit lagi.');
  end if;
  if v_hash is null or v_hash <> extensions.crypt(coalesce(p_password, ''), v_hash) then
    perform private.register_failure('admin');
    return jsonb_build_object('ok', false, 'error', 'bad_password', 'message', 'Kata sandi salah.');
  end if;
  perform private.clear_failures('admin');
  return jsonb_build_object('ok', true, 'token', private.new_session('admin', 'admin'));
end $$;

create or replace function public.admin_check(p_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_token);
  return true;
end $$;

create or replace function public.admin_dashboard(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_need int;
begin
  perform private.require_admin(p_token);
  v_need := least(coalesce((private.setting('rules')->>'jumlah_booth_wajib')::int, 4), (select count(*) from public.booths)::int);
  return jsonb_build_object(
    'participants', (select count(*) from public.participants),
    'withPhoto', (select count(*) from public.participants where photo_path is not null),
    'perBooth', coalesce((select jsonb_agg(jsonb_build_object('boothId', b.id, 'nama', b.nama,
                  'count', (select count(*) from public.visits v where v.booth_id = b.id and v.cancelled_at is null)) order by b.sort) from public.booths b), '[]'::jsonb),
    'allFour', (select count(*) from (select participant_id from public.visits where cancelled_at is null group by participant_id having count(*) >= v_need) x),
    'submissions', jsonb_build_object(
       'submitted', (select count(*) from public.submissions where status = 'submitted'),
       'revision', (select count(*) from public.submissions where status = 'revision'),
       'approved', (select count(*) from public.submissions where status = 'approved')),
    'stamp4it', (select count(*) from public.stamp4it where given),
    'recent', coalesce((select jsonb_agg(r) from (
        select jsonb_build_object('nama', p.nama, 'boothNama', b.nama, 'at', v.confirmed_at) r
          from public.visits v join public.participants p on p.id = v.participant_id join public.booths b on b.id = v.booth_id
         where v.cancelled_at is null order by v.confirmed_at desc limit 8) t), '[]'::jsonb));
end $$;

create or replace function public.admin_list_submissions(p_token text, p_status text, p_q text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_token);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'submissionId', s.id, 'participantId', p.id, 'code', private.submission_code(p.nrp, s.version), 'nama', p.nama, 'nrp', p.nrp,
      'status', s.status, 'version', s.version, 'submittedAt', s.submitted_at,
      'boothCount', (select count(*) from public.visits v where v.participant_id = p.id and v.cancelled_at is null)) order by s.submitted_at)
    from public.submissions s join public.participants p on p.id = s.participant_id
   where s.status = p_status
     and (coalesce(p_q, '') = '' or p.nama ilike '%' || p_q || '%' or p.nrp like '%' || p_q || '%')), '[]'::jsonb);
end $$;

create or replace function public.admin_participant_detail(p_token text, p_pid uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare st jsonb;
begin
  perform private.require_admin(p_token);
  st := private.my_state(p_pid);
  if st is null then perform private.fail('not_found', 'Peserta tidak ditemukan.'); end if;
  return (select jsonb_build_object(
    'id', p.id, 'nrp', p.nrp, 'nama', p.nama, 'departemen', p.departemen, 'angkatan', p.angkatan, 'photo', p.photo_path, 'createdAt', p.created_at,
    'visits', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'boothId', v.booth_id, 'confirmedAt', v.confirmed_at, 'confirmedBy', v.confirmed_by))
                          from public.visits v where v.participant_id = p.id and v.cancelled_at is null), '[]'::jsonb),
    'resumes', st->'resumes', 'answers', st->'answers', 'submission', st->'submission', 'stamp4it', st->'stamp4it')
    from public.participants p where p.id = p_pid);
end $$;

create or replace function public.admin_review(p_token text, p_submission uuid, p_action text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid;
begin
  perform private.require_admin(p_token);
  if p_action not in ('approve', 'revision') then perform private.fail('invalid', 'Aksi tidak dikenal.'); end if;
  if p_action = 'revision' and btrim(coalesce(p_note, '')) = '' then perform private.fail('invalid', 'Catatan wajib diisi saat mengembalikan.'); end if;
  update public.submissions
     set status = case p_action when 'approve' then 'approved' else 'revision' end,
         reviewed_at = now(), reviewer_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_submission returning participant_id into v_pid;
  if v_pid is null then perform private.fail('not_found', 'Pengajuan tidak ditemukan.'); end if;
  perform private.audit('admin', p_action, v_pid::text);
end $$;

create or replace function public.admin_set_stamp4it(p_token text, p_pid uuid, p_given boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_token);
  insert into public.stamp4it (participant_id, given, given_at, given_by)
  values (p_pid, p_given, case when p_given then now() end, 'admin')
  on conflict (participant_id) do update set given = excluded.given, given_at = excluded.given_at, given_by = excluded.given_by;
  perform private.audit('admin', 'stamp4it', p_pid::text);
end $$;

create or replace function public.admin_list_participants(p_token text, p_q text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_token);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'nrp', p.nrp, 'nama', p.nama, 'departemen', p.departemen, 'angkatan', p.angkatan, 'hasPhoto', p.photo_path is not null,
      'visits', (select count(*) from public.visits v where v.participant_id = p.id and v.cancelled_at is null),
      'status', (select status from public.submissions s where s.participant_id = p.id),
      'locked', coalesce(a.locked_until > now(), false)) order by p.created_at desc)
    from public.participants p join public.participant_auth a on a.participant_id = p.id
   where coalesce(p_q, '') = '' or p.nama ilike '%' || p_q || '%' or p.nrp like '%' || p_q || '%'), '[]'::jsonb);
end $$;

create or replace function public.admin_reset_pin(p_token text, p_pid uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_pin text := private.random_pin();
begin
  perform private.require_admin(p_token);
  update public.participant_auth set pin_hash = extensions.crypt(v_pin, extensions.gen_salt('bf')), failed_count = 0, locked_until = null
   where participant_id = p_pid;
  if not found then perform private.fail('not_found', 'Peserta tidak ditemukan.'); end if;
  delete from public.sessions where role = 'participant' and subject_id = p_pid::text;
  perform private.audit('admin', 'reset_pin', p_pid::text);
  return v_pin;
end $$;

create or replace function public.admin_rotate_qr(p_token text, p_pid uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_token);
  update public.participant_auth set qr_token = encode(extensions.gen_random_bytes(18), 'hex') where participant_id = p_pid;
  perform private.audit('admin', 'rotate_qr', p_pid::text);
end $$;

create or replace function public.admin_reset_staff_pin(p_token text, p_booth text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_pin text := private.random_pin();
begin
  perform private.require_admin(p_token);
  insert into public.staff_pins (booth_id, pin_hash) values (p_booth, extensions.crypt(v_pin, extensions.gen_salt('bf')))
  on conflict (booth_id) do update set pin_hash = excluded.pin_hash, failed_count = 0, locked_until = null;
  delete from public.sessions where role = 'staff' and booth_id = p_booth;
  perform private.clear_failures('staff:' || p_booth);
  perform private.audit('admin', 'reset_staff_pin', p_booth);
  return v_pin;
end $$;

create or replace function public.admin_upsert_booth(p_token text, p_booth jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_token);
  insert into public.booths (id, slug, nama, region, stamp_url, x, y, placeholder_pos, sort)
  values (p_booth->>'id', p_booth->>'slug', p_booth->>'nama', coalesce(p_booth->>'region', ''), p_booth->>'stamp',
          round((p_booth->>'x')::numeric), round((p_booth->>'y')::numeric), coalesce((p_booth->>'placeholderPos')::boolean, true), coalesce((p_booth->>'sort')::int, 0))
  on conflict (id) do update set slug = excluded.slug, nama = excluded.nama, region = excluded.region, stamp_url = excluded.stamp_url,
     x = excluded.x, y = excluded.y, placeholder_pos = excluded.placeholder_pos, sort = excluded.sort;
  perform private.audit('admin', 'upsert_booth', p_booth->>'id');
end $$;

create or replace function public.admin_upsert_speaker(p_token text, p_speaker jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_token);
  insert into public.speakers (id, booth_id, nama, universitas, program, foto_url, cerita, placeholder)
  values (p_speaker->>'id', p_speaker->>'boothId', p_speaker->>'nama', coalesce(p_speaker->>'universitas', ''), coalesce(p_speaker->>'program', ''),
          p_speaker->>'foto', coalesce(p_speaker->>'cerita', ''), coalesce((p_speaker->>'placeholder')::boolean, true))
  on conflict (id) do update set booth_id = excluded.booth_id, nama = excluded.nama, universitas = excluded.universitas, program = excluded.program,
     foto_url = excluded.foto_url, cerita = excluded.cerita, placeholder = excluded.placeholder;
end $$;

create or replace function public.admin_delete_speaker(p_token text, p_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_token);
  delete from public.speakers where id = p_id;
end $$;

create or replace function public.admin_upsert_facility(p_token text, p_facility jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_token);
  insert into public.facilities (id, jenis, label, x, y, placeholder, catatan)
  values (p_facility->>'id', coalesce(p_facility->>'jenis', 'lainnya'), p_facility->>'label',
          round((p_facility->>'x')::numeric), round((p_facility->>'y')::numeric), coalesce((p_facility->>'placeholder')::boolean, true), p_facility->>'catatan')
  on conflict (id) do update set jenis = excluded.jenis, label = excluded.label, x = excluded.x, y = excluded.y,
     placeholder = excluded.placeholder, catatan = excluded.catatan;
end $$;

create or replace function public.admin_delete_facility(p_token text, p_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_token);
  delete from public.facilities where id = p_id;
end $$;

create or replace function public.admin_upsert_question(p_token text, p_question jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_token);
  insert into public.feedback_questions (id, teks, tipe, wajib, sort)
  values (p_question->>'id', p_question->>'teks', p_question->>'tipe', coalesce((p_question->>'wajib')::boolean, true), coalesce((p_question->>'sort')::int, 0))
  on conflict (id) do update set teks = excluded.teks, tipe = excluded.tipe, wajib = excluded.wajib, sort = excluded.sort;
end $$;

create or replace function public.admin_set_settings(p_token text, p_settings jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare m record;
begin
  perform private.require_admin(p_token);
  for m in select * from (values ('simulationMode', 'simulation_mode'), ('sessionStart', 'session_start'),
                                 ('sessionEnd', 'session_end'), ('deadline', 'deadline')) v(api, db) loop
    if p_settings ? m.api then
      insert into public.settings (key, value) values (m.db, p_settings->m.api)
      on conflict (key) do update set value = excluded.value;
    end if;
  end loop;
  perform private.audit('admin', 'settings', p_settings::text);
end $$;

/** Raw rows for the export (no PIN, hash, token or photo path). Rows are formatted client-side. */
create or replace function public.admin_export_raw(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_token);
  return jsonb_build_object(
    'participants', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nrp', nrp, 'nama', nama, 'departemen', departemen, 'angkatan', angkatan,
                                'hasPhoto', photo_path is not null, 'createdAt', created_at) order by created_at) from public.participants), '[]'::jsonb),
    'visits', coalesce((select jsonb_agg(jsonb_build_object('participantId', participant_id, 'boothId', booth_id, 'confirmedAt', confirmed_at,
                                'cancelledAt', cancelled_at) order by confirmed_at) from public.visits), '[]'::jsonb),
    'resumes', coalesce((select jsonb_agg(jsonb_build_object('participantId', participant_id, 'boothId', booth_id,
                                'poin', jsonb_build_array(poin1, poin2, poin3))) from public.resumes), '[]'::jsonb),
    'answers', coalesce((select jsonb_agg(jsonb_build_object('participantId', participant_id, 'questionId', question_id,
                                'nilaiInt', nilai_int, 'nilaiTeks', nilai_teks)) from public.feedback_answers), '[]'::jsonb),
    'submissions', coalesce((select jsonb_agg(jsonb_build_object('participantId', participant_id, 'version', version, 'status', status,
                                'submittedAt', submitted_at)) from public.submissions), '[]'::jsonb),
    'stamp4it', coalesce((select jsonb_agg(participant_id) from public.stamp4it where given), '[]'::jsonb));
end $$;

-- ===========================================================================
-- Edge Function helper (service role only): resolve a session token
-- ===========================================================================
create or replace function public.edge_session(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('role', role, 'subject', subject_id, 'boothId', booth_id)
    from public.sessions where token_hash = private.hash_token(coalesce(p_token, '')) and expires_at > now()
$$;

-- ---------------------------------------------------------------------------
-- grants: anon may execute the API, nothing else
-- ---------------------------------------------------------------------------
revoke all on all functions in schema public from public, anon, authenticated;
grant usage on schema private to postgres, service_role;
grant execute on function
  public.get_content(), public.check_nrp(text), public.participant_login(text, text), public.participant_register(text, text, text, text, text),
  public.get_my_state(text), public.set_photo(text, text), public.save_resume(text, text, text, text, text), public.save_feedback(text, jsonb),
  public.submit(text),
  public.staff_login(text, text), public.staff_session_info(text), public.staff_resolve_tokens(text, text[]), public.staff_find_by_last4(text, text),
  public.staff_confirm_batch(text, uuid[]), public.staff_history(text), public.staff_cancel_visit(text, uuid),
  public.admin_login(text), public.admin_check(text), public.admin_dashboard(text), public.admin_list_submissions(text, text, text),
  public.admin_participant_detail(text, uuid), public.admin_review(text, uuid, text, text), public.admin_set_stamp4it(text, uuid, boolean),
  public.admin_list_participants(text, text), public.admin_reset_pin(text, uuid), public.admin_rotate_qr(text, uuid),
  public.admin_reset_staff_pin(text, text), public.admin_upsert_booth(text, jsonb), public.admin_upsert_speaker(text, jsonb),
  public.admin_delete_speaker(text, text), public.admin_upsert_facility(text, jsonb), public.admin_delete_facility(text, text),
  public.admin_upsert_question(text, jsonb), public.admin_set_settings(text, jsonb), public.admin_export_raw(text)
to anon;
grant execute on function public.edge_session(text) to service_role;

-- functions created later must not be executable by anon by default
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

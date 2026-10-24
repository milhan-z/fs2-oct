-- Feedback questions can carry a section title (shown above the question and in the review screen) and the two
-- end labels of a 1–5 scale ("Poor" … "Excellent", "Strongly disagree" … "Strongly agree").
alter table public.feedback_questions
  add column if not exists section text check (section is null or length(section) <= 160),
  add column if not exists label_low text check (label_low is null or length(label_low) <= 40),
  add column if not exists label_high text check (label_high is null or length(label_high) <= 40);

create or replace function public.get_content() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'booths', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'slug', slug, 'nama', nama, 'region', region, 'stamp', stamp_url,
                                         'x', x, 'y', y, 'placeholderPos', placeholder_pos, 'sort', sort) order by sort) from public.booths), '[]'::jsonb),
    'speakers', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'boothId', booth_id, 'nama', nama, 'universitas', universitas, 'program', program,
                                           'foto', foto_url, 'cerita', cerita, 'placeholder', placeholder) order by booth_id, sort, id) from public.speakers), '[]'::jsonb),
    'facilities', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'jenis', jenis, 'label', label, 'x', x, 'y', y,
                                             'placeholder', placeholder, 'catatan', catatan) order by id) from public.facilities), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'teks', teks, 'tipe', tipe, 'wajib', wajib, 'sort', sort,
                                           'section', section, 'labelLow', label_low, 'labelHigh', label_high) order by sort)
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

create or replace function public.admin_upsert_question(p_token text, p_question jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id text := btrim(coalesce(p_question->>'id', ''));
  v_teks text := btrim(coalesce(p_question->>'teks', ''));
  v_sec text := nullif(btrim(coalesce(p_question->>'section', '')), '');
  v_lo text := nullif(btrim(coalesce(p_question->>'labelLow', '')), '');
  v_hi text := nullif(btrim(coalesce(p_question->>'labelHigh', '')), '');
begin
  perform private.require_admin(p_token);
  if v_id !~ '^[a-z0-9_-]{1,40}$' then perform private.fail('invalid', 'Invalid question id.'); end if;
  if length(v_teks) < 3 or length(v_teks) > 240 then perform private.fail('invalid', 'Question must be 3–240 characters.'); end if;
  if coalesce(p_question->>'tipe', '') not in ('skala_1_5', 'teks') then perform private.fail('invalid', 'Unknown question type.'); end if;
  if length(coalesce(v_sec, '')) > 160 or length(coalesce(v_lo, '')) > 40 or length(coalesce(v_hi, '')) > 40 then
    perform private.fail('invalid', 'Section title up to 160 characters, scale labels up to 40.');
  end if;
  insert into public.feedback_questions (id, teks, tipe, wajib, sort, section, label_low, label_high)
  values (v_id, v_teks, p_question->>'tipe', coalesce((p_question->>'wajib')::boolean, true), coalesce((p_question->>'sort')::int, 0), v_sec, v_lo, v_hi)
  on conflict (id) do update set teks = excluded.teks, wajib = excluded.wajib, sort = excluded.sort,
    section = excluded.section, label_low = excluded.label_low, label_high = excluded.label_high;
  perform private.audit('admin', 'upsert_question', v_id);
end $$;

revoke all on function public.get_content(), public.admin_upsert_question(text, jsonb) from public, authenticated;
grant execute on function public.get_content(), public.admin_upsert_question(text, jsonb) to anon;

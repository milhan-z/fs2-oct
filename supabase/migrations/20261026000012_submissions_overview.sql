-- The submissions screen lists everyone at once, so each row carries what the admin needs to judge it without opening it:
-- stamps, finished notes, required feedback answered, Stamp4It. p_status = 'all' (or empty) lists every status.
create or replace function public.admin_list_submissions(p_token text, p_status text, p_q text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_rules jsonb := private.setting('rules');
  v_min int := coalesce((v_rules->>'min_kata_per_poin')::int, 5);
  v_points int := coalesce((v_rules->>'poin_per_resume')::int, 3);
  v_fb_required int := (select count(*) from public.feedback_questions where wajib);
begin
  perform private.require_admin(p_token);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'submissionId', s.id, 'participantId', p.id, 'code', private.submission_code(p.nrp, s.version), 'nama', p.nama, 'nrp', p.nrp,
      'departemen', p.departemen, 'angkatan', p.angkatan,
      'status', s.status, 'version', s.version, 'submittedAt', s.submitted_at, 'reviewerNote', s.reviewer_note,
      'boothCount', (select count(*) from public.visits v where v.participant_id = p.id and v.cancelled_at is null),
      'notesDone', (select count(*) from public.resumes r
                     where r.participant_id = p.id
                       and exists (select 1 from public.visits v where v.participant_id = p.id and v.booth_id = r.booth_id and v.cancelled_at is null)
                       and ((private.word_count(r.poin1) >= v_min)::int + (private.word_count(r.poin2) >= v_min)::int + (private.word_count(r.poin3) >= v_min)::int) >= v_points),
      'feedbackDone', (select count(*) from public.feedback_questions q
                        where q.wajib and exists (select 1 from public.feedback_answers a
                                                   where a.participant_id = p.id and a.question_id = q.id
                                                     and (a.nilai_int is not null or btrim(coalesce(a.nilai_teks, '')) <> ''))),
      'feedbackRequired', v_fb_required,
      'stamp4it', coalesce((select given from public.stamp4it where participant_id = p.id), false)
    ) order by s.submitted_at)
    from public.submissions s join public.participants p on p.id = s.participant_id
   where (coalesce(p_status, '') in ('', 'all') or s.status = p_status)
     and (coalesce(p_q, '') = '' or p.nama ilike '%' || p_q || '%' or p.nrp like '%' || p_q || '%')), '[]'::jsonb);
end $$;

-- Feedback so far, per question: how many answered, the average and 1–5 spread of scale questions, and the latest
-- written answers. Read-only, admin only.
create or replace function public.admin_feedback_summary(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_token);
  return jsonb_build_object(
    'respondents', (select count(distinct participant_id) from public.feedback_answers
                     where nilai_int is not null or btrim(coalesce(nilai_teks, '')) <> ''),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'questionId', q.id,
        'n', (select count(*) from public.feedback_answers a
               where a.question_id = q.id and (a.nilai_int is not null or btrim(coalesce(a.nilai_teks, '')) <> '')),
        'avg', (select round(avg(a.nilai_int)::numeric, 2) from public.feedback_answers a where a.question_id = q.id and a.nilai_int is not null),
        'dist', jsonb_build_array(
          (select count(*) from public.feedback_answers a where a.question_id = q.id and a.nilai_int = 1),
          (select count(*) from public.feedback_answers a where a.question_id = q.id and a.nilai_int = 2),
          (select count(*) from public.feedback_answers a where a.question_id = q.id and a.nilai_int = 3),
          (select count(*) from public.feedback_answers a where a.question_id = q.id and a.nilai_int = 4),
          (select count(*) from public.feedback_answers a where a.question_id = q.id and a.nilai_int = 5)),
        'texts', coalesce((select jsonb_agg(jsonb_build_object('nama', t.nama, 'text', t.txt))
                             from (select p.nama, btrim(a.nilai_teks) as txt
                                     from public.feedback_answers a join public.participants p on p.id = a.participant_id
                                    where a.question_id = q.id and btrim(coalesce(a.nilai_teks, '')) <> ''
                                    order by p.created_at desc limit 40) t), '[]'::jsonb)
      ) order by q.sort) from public.feedback_questions q), '[]'::jsonb));
end $$;

revoke all on function public.admin_feedback_summary(text) from public, authenticated;
grant execute on function public.admin_feedback_summary(text) to anon;

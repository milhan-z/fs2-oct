-- The participant sees their own full NRP on their passport (it is the proof when claiming Stamp4It). Staff lists keep the masked form.
create or replace function private.my_state(p_pid uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'participant', jsonb_build_object(
      'id', p.id, 'nama', p.nama, 'nrp', p.nrp, 'nrpMasked', private.mask_nrp(p.nrp), 'nrpLast4', right(p.nrp, 4),
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

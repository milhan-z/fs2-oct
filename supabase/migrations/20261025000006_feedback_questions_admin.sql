-- Feedback questions are fully editable by the admin: any number, add / edit / reorder / delete.
create or replace function public.admin_upsert_question(p_token text, p_question jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_id text := btrim(coalesce(p_question->>'id', '')); v_teks text := btrim(coalesce(p_question->>'teks', ''));
begin
  perform private.require_admin(p_token);
  if v_id !~ '^[a-z0-9_-]{1,40}$' then perform private.fail('invalid', 'Invalid question id.'); end if;
  if length(v_teks) < 3 or length(v_teks) > 240 then perform private.fail('invalid', 'Question must be 3–240 characters.'); end if;
  if coalesce(p_question->>'tipe', '') not in ('skala_1_5', 'teks') then perform private.fail('invalid', 'Unknown question type.'); end if;
  insert into public.feedback_questions (id, teks, tipe, wajib, sort)
  values (v_id, v_teks, p_question->>'tipe', coalesce((p_question->>'wajib')::boolean, true), coalesce((p_question->>'sort')::int, 0))
  on conflict (id) do update set teks = excluded.teks, wajib = excluded.wajib, sort = excluded.sort;
  perform private.audit('admin', 'upsert_question', v_id);
end $$;

-- Also deletes the answers given to it (on delete cascade).
create or replace function public.admin_delete_question(p_token text, p_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_token);
  delete from public.feedback_questions where id = p_id;
  if not found then perform private.fail('not_found', 'Question not found.'); end if;
  perform private.audit('admin', 'delete_question', p_id);
end $$;

-- Several edits at once (reordering).
create or replace function public.admin_set_question_order(p_token text, p_ids text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_token);
  update public.feedback_questions q set sort = o.n
    from (select id, ord::int as n from unnest(p_ids) with ordinality as t(id, ord)) o where q.id = o.id;
end $$;

revoke all on function public.admin_delete_question(text, text), public.admin_set_question_order(text, text[]) from public, authenticated;
grant execute on function public.admin_delete_question(text, text), public.admin_set_question_order(text, text[]) to anon;

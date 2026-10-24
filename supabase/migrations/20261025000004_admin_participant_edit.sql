-- Admin: correct a participant's identity data, or delete a participant (test runs, duplicates).

create or replace function public.admin_update_participant(p_token text, p_pid uuid, p_data jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_nrp text := btrim(coalesce(p_data->>'nrp', ''));
  v_nama text := btrim(coalesce(p_data->>'nama', ''));
  v_dep text := btrim(coalesce(p_data->>'departemen', ''));
  v_ang text := btrim(coalesce(p_data->>'angkatan', ''));
begin
  perform private.require_admin(p_token);
  if v_nrp !~ '^\d{4,14}$' then perform private.fail('invalid', 'NRP must be 4–14 digits.'); end if;
  if length(v_nama) < 3 then perform private.fail('invalid', 'Fill in the full name.'); end if;
  if v_dep = '' then perform private.fail('invalid', 'Fill in the department.'); end if;
  if exists (select 1 from public.participants where nrp = v_nrp and id <> p_pid) then
    perform private.fail('exists', 'Another participant already uses this NRP.');
  end if;
  update public.participants
     set nrp = v_nrp, nama = left(v_nama, 120), departemen = left(v_dep, 120), angkatan = left(v_ang, 20)
   where id = p_pid;
  if not found then perform private.fail('not_found', 'Participant not found.'); end if;
  perform private.audit('admin', 'update_participant', p_pid::text);
end $$;

-- Visits, notes, feedback, submission and Stamp4It rows go with it (on delete cascade).
create or replace function public.admin_delete_participant(p_token text, p_pid uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_token);
  delete from public.sessions where role = 'participant' and subject_id = p_pid::text;
  delete from public.participants where id = p_pid;
  if not found then perform private.fail('not_found', 'Participant not found.'); end if;
  perform private.audit('admin', 'delete_participant', p_pid::text);
end $$;

revoke all on function public.admin_update_participant(text, uuid, jsonb), public.admin_delete_participant(text, uuid) from public, authenticated;
grant execute on function public.admin_update_participant(text, uuid, jsonb), public.admin_delete_participant(text, uuid) to anon;

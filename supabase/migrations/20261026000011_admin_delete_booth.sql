-- Booths can be added (admin_upsert_booth already inserts) and now also removed. Everything that hangs on the booth goes
-- with it through the foreign keys: its speakers, staff PIN, stamps and notes.
create or replace function public.admin_delete_booth(p_token text, p_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_token);
  delete from public.booths where id = p_id;
  if not found then perform private.fail('not_found', 'Booth not found.'); end if;
  perform private.audit('admin', 'delete_booth', p_id);
end $$;

revoke all on function public.admin_delete_booth(text, text) from public, authenticated;
grant execute on function public.admin_delete_booth(text, text) to anon;

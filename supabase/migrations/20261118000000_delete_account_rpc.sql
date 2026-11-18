-- Exclusão de conta direto pelo banco (dispensa a Edge Function `delete-account`).
-- Apaga liga, estado e o próprio login do usuário que chamou. Os dados do aparelho
-- não são afetados. A função roda como o dono (postgres), que pode apagar em auth.users.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  delete from public.league_members where user_id = me;
  delete from public.game_states where user_id = me;
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

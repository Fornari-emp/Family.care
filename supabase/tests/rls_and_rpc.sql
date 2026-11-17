-- Testes de segurança (RLS) e das funções do Invest Level.
-- Rode com: npm run test:sql   (precisa de Postgres local)
\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'c@example.com');

-- Asserção que espera um erro com mensagem específica.
create function pg_temp.expect_error(p_sql text, p_msg text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'FALHOU: esperava erro "%" em: %', p_msg, p_sql;
exception when others then
  if sqlerrm not like '%' || p_msg || '%' then
    raise exception 'FALHOU: erro "%" diferente do esperado "%" em: %', sqlerrm, p_msg, p_sql;
  end if;
end $$;
grant execute on function pg_temp.expect_error(text, text) to anon, authenticated;

create function pg_temp.check(p_ok boolean, p_what text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FALHOU: %', p_what; end if;
end $$;
grant execute on function pg_temp.check(boolean, text) to anon, authenticated;

create function pg_temp.week() returns text language sql as $$
  select to_char(now() at time zone 'America/Sao_Paulo', 'IYYY-"W"IW')
$$;
grant execute on function pg_temp.week() to anon, authenticated;

-- ---------------------------------------------------------------- save_state
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
select pg_temp.check(public.save_state(0, 3, '{"v":1}') = 1, 'A cria o estado com revisão 1');
select pg_temp.expect_error($$select public.save_state(0, 3, '{"v":2}')$$, 'revision_conflict');
select pg_temp.check(public.save_state(1, 3, '{"v":2}') = 2, 'A atualiza com a revisão certa');
select pg_temp.expect_error($$select public.save_state(1, 3, '{"v":3}')$$, 'revision_conflict');
select pg_temp.check((select state->>'v' from public.game_states) = '2', 'A lê o próprio estado');
select pg_temp.expect_error($$select public.save_state(2, 3, '[]')$$, 'game_states_state_check');
select pg_temp.expect_error(
  $$select public.save_state(2, 3, jsonb_build_object('x', repeat('a', 2100000)))$$, 'state_too_large');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
select pg_temp.check((select count(*) from public.game_states) = 0, 'B não vê o estado de A (RLS)');
update public.game_states set state = '{"hack":true}' where user_id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.expect_error(
  $$insert into public.game_states (user_id, schema_version, state)
    values ('00000000-0000-0000-0000-00000000000a', 3, '{}')$$, 'row-level security');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
select pg_temp.check((select state->>'v' from public.game_states) = '2', 'update de B não afetou A');
commit;

begin;
set local role anon;
select pg_temp.expect_error($$select public.save_state(0, 3, '{}')$$, 'permission denied');
select pg_temp.check((select count(*) from public.game_states) = 0, 'anônimo não vê estados');
commit;

-- ---------------------------------------------------------------- liga
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
select pg_temp.expect_error($$select public.join_league('2001-W01', 'Ana')$$, 'invalid_week');
select pg_temp.expect_error($$select public.join_league(pg_temp.week(), '   ')$$, 'invalid_name');
select pg_temp.check(public.join_league(pg_temp.week(), '  Ana   Lu ') > 0, 'A entra na liga');
select pg_temp.check(
  (select display_name from public.league_standings(pg_temp.week()) where is_me) = 'Ana Lu', 'apelido limpo');
select pg_temp.check(
  public.join_league(pg_temp.week(), 'Ana') = public.join_league(pg_temp.week(), 'Ana'), 'entrar é idempotente');
select pg_temp.check(public.submit_league_xp(pg_temp.week(), 999999, 'Ana') = 5250, 'XP limitado ao teto');
select pg_temp.check(public.submit_league_xp(pg_temp.week(), -5, null) = 0, 'XP negativo vira 0');
select pg_temp.check(public.submit_league_xp(pg_temp.week(), 300, null) = 300, 'XP normal aceito');
select pg_temp.check((select count(*) from public.league_members) = 0, 'tabela da liga não é legível direto');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
select pg_temp.expect_error($$select public.submit_league_xp(pg_temp.week(), 10, 'Bia')$$, 'not_in_league');
select pg_temp.check(public.join_league(pg_temp.week(), 'Bia') > 0, 'B entra na liga');
select public.submit_league_xp(pg_temp.week(), 500, 'Bia');
select pg_temp.check(
  (select array_agg(display_name || ':' || xp || ':' || is_me order by pos) from public.league_standings(pg_temp.week()))
  = array['Bia:500:true', 'Ana:300:false'], 'placar do grupo, só apelido e XP');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
select pg_temp.check((select count(*) from public.league_standings(pg_temp.week())) = 0, 'quem não participa não vê o placar');
commit;

-- grupos de no máximo 30
do $$
declare i int; uid uuid;
begin
  for i in 1..40 loop
    uid := gen_random_uuid();
    insert into auth.users (id) values (uid);
    perform set_config('request.jwt.claim.sub', uid::text, true);
    perform public.join_league(pg_temp.week(), 'p' || i);
  end loop;
end $$;
select pg_temp.check(
  (select max(c) from (select count(*) c from public.league_members group by group_id) x) <= 30, 'grupos com até 30');
select pg_temp.check((select count(*) from public.league_groups) = 2, '42 pessoas em 2 grupos');

-- ---------------------------------------------------------------- saída e exclusão
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
select public.leave_league(pg_temp.week());
select pg_temp.check((select count(*) from public.league_standings(pg_temp.week())) = 0, 'B saiu da liga');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
select public.delete_my_cloud_data();
select pg_temp.check((select count(*) from public.game_states) = 0, 'A apagou o estado');
select pg_temp.check((select count(*) from public.league_standings(pg_temp.week())) = 0, 'A apagou a liga');
commit;

begin;
set local role anon;
select pg_temp.expect_error($$select public.delete_my_cloud_data()$$, 'permission denied');
commit;

-- apagar o usuário apaga tudo em cascata
delete from auth.users where id = '00000000-0000-0000-0000-00000000000c';

\echo 'OK: todos os testes de SQL passaram'

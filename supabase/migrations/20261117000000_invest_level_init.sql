-- Invest Level — esquema inicial (Fase 4)
-- Sincronização do estado do app + liga semanal com outras pessoas.
-- Segurança: RLS em todas as tabelas; cada usuário só acessa os próprios dados.
-- A liga expõe apenas apelido e XP semanal, e somente para quem optou por participar.

-- ---------------------------------------------------------------------------
-- Estado do app (um documento JSON por usuário, com revisão para evitar sobrescrita)
-- ---------------------------------------------------------------------------
create table public.game_states (
  user_id uuid primary key references auth.users (id) on delete cascade,
  schema_version int not null check (schema_version between 1 and 1000),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.game_states enable row level security;

create policy "game_states: ler o próprio" on public.game_states
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "game_states: criar o próprio" on public.game_states
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "game_states: alterar o próprio" on public.game_states
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "game_states: apagar o próprio" on public.game_states
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Salva com controle otimista: só grava se a revisão esperada for a atual.
-- p_expected = 0 cria o primeiro registro. Conflito -> erro 'revision_conflict'.
create function public.save_state(p_expected bigint, p_schema_version int, p_state jsonb)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_revision bigint;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if octet_length(p_state::text) > 2000000 then
    raise exception 'state_too_large' using errcode = '22023';
  end if;

  if p_expected = 0 then
    insert into public.game_states (user_id, schema_version, state)
    values (auth.uid(), p_schema_version, p_state)
    on conflict (user_id) do nothing
    returning revision into new_revision;
  else
    update public.game_states
       set state = p_state,
           schema_version = p_schema_version,
           revision = revision + 1,
           updated_at = now()
     where user_id = auth.uid() and revision = p_expected
    returning revision into new_revision;
  end if;

  if new_revision is null then
    raise exception 'revision_conflict' using errcode = '40001';
  end if;
  return new_revision;
end;
$$;

-- ---------------------------------------------------------------------------
-- Liga semanal (grupos de até 30 pessoas por semana ISO)
-- ---------------------------------------------------------------------------
create table public.league_groups (
  id bigint generated always as identity primary key,
  week text not null check (week ~ '^\d{4}-W\d{2}$'),
  created_at timestamptz not null default now()
);
create index league_groups_week_idx on public.league_groups (week);

create table public.league_members (
  week text not null check (week ~ '^\d{4}-W\d{2}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  group_id bigint not null references public.league_groups (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 20),
  xp int not null default 0 check (xp >= 0),
  updated_at timestamptz not null default now(),
  primary key (week, user_id)
);
create index league_members_group_idx on public.league_members (group_id);

-- Sem políticas: acesso direto negado. Tudo passa pelas funções abaixo.
alter table public.league_groups enable row level security;
alter table public.league_members enable row level security;

-- Semana aceita: a atual (fuso de Brasília, com folga de 3h para outros fusos do país)
-- ou a anterior (para fechar o placar da semana que terminou).
create function public.league_week_ok(p_week text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_week in (
    to_char((now() at time zone 'America/Sao_Paulo'), 'IYYY-"W"IW'),
    to_char((now() at time zone 'America/Sao_Paulo') + interval '3 hours', 'IYYY-"W"IW'),
    to_char((now() at time zone 'America/Sao_Paulo') - interval '7 days', 'IYYY-"W"IW')
  );
$$;

create function public.clean_display_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(left(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'), 20), '');
$$;

-- Entra na liga da semana (idempotente). Devolve o id do grupo.
create function public.join_league(p_week text, p_display_name text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  gid bigint;
  name text := public.clean_display_name(p_display_name);
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not public.league_week_ok(p_week) then raise exception 'invalid_week' using errcode = '22023'; end if;
  if name is null then raise exception 'invalid_name' using errcode = '22023'; end if;

  select group_id into gid from public.league_members where week = p_week and user_id = me;
  if gid is not null then return gid; end if;

  -- Serializa entradas na mesma semana para não estourar o tamanho do grupo.
  perform pg_advisory_xact_lock(hashtext('league:' || p_week));

  select g.id into gid
    from public.league_groups g
   where g.week = p_week
     and (select count(*) from public.league_members m where m.group_id = g.id) < 30
   order by g.id
   limit 1;

  if gid is null then
    insert into public.league_groups (week) values (p_week) returning id into gid;
  end if;

  insert into public.league_members (week, user_id, group_id, display_name)
  values (p_week, me, gid, name);
  return gid;
end;
$$;

-- Envia o XP semanal. O servidor limita ao teto que as regras do jogo permitem.
create function public.submit_league_xp(p_week text, p_xp int, p_display_name text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_weekly_xp constant int := 5250;
  me uuid := auth.uid();
  capped int := least(greatest(coalesce(p_xp, 0), 0), max_weekly_xp);
  name text := public.clean_display_name(p_display_name);
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not public.league_week_ok(p_week) then raise exception 'invalid_week' using errcode = '22023'; end if;

  update public.league_members
     set xp = capped,
         display_name = coalesce(name, display_name),
         updated_at = now()
   where week = p_week and user_id = me;
  if not found then raise exception 'not_in_league' using errcode = '22023'; end if;
  return capped;
end;
$$;

-- Placar do grupo do usuário na semana (só apelido e XP).
create function public.league_standings(p_week text)
returns table (pos int, display_name text, xp int, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select (row_number() over (order by m.xp desc, m.updated_at asc))::int as pos,
         m.display_name,
         m.xp,
         m.user_id = auth.uid() as is_me
    from public.league_members m
   where m.group_id = (
     select group_id from public.league_members
      where week = p_week and user_id = auth.uid()
   )
   order by pos;
$$;

-- Sai da liga (deixa de aparecer para os outros).
create function public.leave_league(p_week text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.league_members where week = p_week and user_id = auth.uid();
$$;

-- Apaga TODOS os dados do usuário na nuvem (o login é removido pela Edge Function).
create function public.delete_my_cloud_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  delete from public.league_members where user_id = auth.uid();
  delete from public.game_states where user_id = auth.uid();
end;
$$;

-- Permissões: somente usuários logados chamam as funções.
revoke all on function public.save_state(bigint, int, jsonb) from public, anon;
revoke all on function public.join_league(text, text) from public, anon;
revoke all on function public.submit_league_xp(text, int, text) from public, anon;
revoke all on function public.league_standings(text) from public, anon;
revoke all on function public.leave_league(text) from public, anon;
revoke all on function public.delete_my_cloud_data() from public, anon;
grant execute on function public.save_state(bigint, int, jsonb) to authenticated;
grant execute on function public.join_league(text, text) to authenticated;
grant execute on function public.submit_league_xp(text, int, text) to authenticated;
grant execute on function public.league_standings(text) to authenticated;
grant execute on function public.leave_league(text) to authenticated;
grant execute on function public.delete_my_cloud_data() to authenticated;

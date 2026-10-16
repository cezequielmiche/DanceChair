-- Tiempos justos en línea (2026-10-16: en la pantalla te veías sentado antes que un bot y el servidor te sacaba).
--
-- A. Las llegadas de los bots ya se deciden al empezar la ronda: ahora se mandan por adelantado
--    ('bots_llegan') y el teléfono los sienta a esa hora exacta, no cuando se entera en la siguiente consulta.
-- B. Cuenta la hora en que tocaste Sentarse (en el reloj del servidor, la manda el teléfono), no la hora en que
--    llega: el retraso de internet ya no te castiga. Solo se aceptan hasta 250 ms antes de que llegue (así una app
--    modificada no puede ganar más que eso) y nunca antes del alto (con los 300 ms de tolerancia de siempre).
--    Para que esos toques alcancen a contar, la ronda se cierra 250 ms después de que se ocupa la última silla.

-- ---------------------------------------------------------------- Estado de la partida (+ bots_llegan)
create or replace function public._partida_json(p_sala uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'estado', s.estado,
    'ronda', s.ronda,
    'ahora', (extract(epoch from now()) * 1000)::bigint,
    'inicio', (extract(epoch from s.ronda_inicio) * 1000)::bigint,
    'alto', (extract(epoch from s.alto) * 1000)::bigint,
    'vivos', to_jsonb(s.vivos),
    'fuera', s.fuera,
    'ganador', s.ganador,
    'reclamos', coalesce((
      select jsonb_agg(jsonb_build_object('quien', r.quien, 'hora', (extract(epoch from r.hora) * 1000)::bigint) order by r.hora)
      from sala_reclamos r
      where r.sala_id = s.id and r.ronda = s.ronda and r.hora <= now()
        and not s.fuera @> jsonb_build_array(jsonb_build_object('quien', r.quien, 'ronda', r.ronda))
    ), '[]'::jsonb),
    'anteriores', coalesce((
      select jsonb_agg(jsonb_build_object('quien', r.quien, 'hora', (extract(epoch from r.hora) * 1000)::bigint) order by r.hora)
      from sala_reclamos r
      where r.sala_id = s.id and r.ronda = s.ronda - 1 and r.hora <= now()
        and not s.fuera @> jsonb_build_array(jsonb_build_object('quien', r.quien, 'ronda', r.ronda))
    ), '[]'::jsonb),
    -- cuándo llega cada bot en esta ronda, aunque todavía no pase (ya está decidido desde que empezó)
    'bots_llegan', coalesce((
      select jsonb_agg(jsonb_build_object('quien', r.quien, 'hora', (extract(epoch from r.hora) * 1000)::bigint) order by r.hora)
      from sala_reclamos r
      where r.sala_id = s.id and r.ronda = s.ronda and r.quien like 'bot%' and r.quien = any (s.vivos)
    ), '[]'::jsonb)
  )
  from salas s where s.id = p_sala
$$;
revoke execute on function public._partida_json(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- Avanzar la partida (interna)
-- Igual que en 20261016000000_concurrencia.sql, pero con las sillas llenas espera 250 ms antes de cerrar
-- (por si llega el toque de alguien que tocó antes pero su internet tardó).
create or replace function public._avanzar(p_sala uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  s salas;
  n int;
  v_corte timestamptz;
  v_fuera text;
  pase int;
begin
  -- pase 1: sin bloquear (lo normal: todavía no toca cerrar); pase 2: con la sala bloqueada
  for pase in 1..2 loop
    if pase = 1 then
      select * into s from salas where id = p_sala;
    else
      select * into s from salas where id = p_sala for update;
    end if;
    if not found or s.estado <> 'jugando' or s.alto is null or now() < s.alto then return; end if;
    n := cardinality(s.vivos);
    -- hora en que se ocupó la última silla (la llegada número n - 1), si ya pasó
    select r.hora into v_corte from sala_reclamos r
      where r.sala_id = p_sala and r.ronda = s.ronda and r.quien = any (s.vivos) and r.hora <= now()
      order by r.hora
      offset greatest(n - 2, 0) limit 1;
    if (v_corte is null or now() < v_corte + interval '250 milliseconds') and now() < s.alto + interval '3 seconds' then
      return;
    end if;
  end loop;

  select v.quien into v_fuera
    from unnest(s.vivos) as v(quien)
    left join sala_reclamos r on r.sala_id = p_sala and r.ronda = s.ronda and r.quien = v.quien and r.hora <= now()
    order by r.hora desc nulls first, random()
    limit 1;

  update salas set
    vivos = array_remove(s.vivos, v_fuera),
    fuera = s.fuera || jsonb_build_array(jsonb_build_object('quien', v_fuera, 'ronda', s.ronda))
    where id = p_sala returning * into s;

  if cardinality(s.vivos) <= 1 then
    update salas set estado = 'terminada', ganador = s.vivos[1], alto = null where id = p_sala;
  else
    perform _empezar_ronda(p_sala, s.ronda + 1, now() + interval '3.5 seconds');
  end if;
end $$;
revoke execute on function public._avanzar(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- Sentarse (con la hora del toque)
-- p_hora: hora del toque en el reloj del servidor (ms desde 1970). Sin ella (apps viejas) vale la hora de llegada.
drop function if exists public.reclamar_silla(uuid, int);
create function public.reclamar_silla(p_sala uuid, p_ronda int, p_hora bigint default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  yo text := auth.uid()::text;
  s salas;
  v_hora timestamptz := now();
begin
  if yo is null then raise exception 'Inicia sesión' using errcode = 'P0001'; end if;
  if not exists (select 1 from sala_jugadores where sala_id = p_sala and user_id = auth.uid()) then
    raise exception 'No estás en esa partida' using errcode = 'P0001';
  end if;
  if p_hora is not null then
    -- ni en el futuro ni más de 250 ms antes de que llegue
    v_hora := greatest(least(to_timestamp(p_hora / 1000.0), now()), now() - interval '250 milliseconds');
  end if;
  select * into s from salas where id = p_sala;
  if s.estado = 'jugando' and s.ronda = p_ronda and v_hora >= s.alto - interval '300 milliseconds' and yo = any (s.vivos) then
    insert into sala_reclamos (sala_id, ronda, quien, hora) values (p_sala, p_ronda, yo, greatest(v_hora, s.alto))
      on conflict do nothing;
  end if;
  perform _avanzar(p_sala);
  return _partida_json(p_sala);
end $$;
revoke execute on function public.reclamar_silla(uuid, int, bigint) from public, anon;
grant execute on function public.reclamar_silla(uuid, int, bigint) to authenticated;

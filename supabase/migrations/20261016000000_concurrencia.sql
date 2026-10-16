-- Preparar el servidor para más jugadores a la vez (prueba de carga del 2026-10-16: 36 jugadores sin errores).
--
-- 1. _avanzar y estado_sala bloqueaban la sala en cada consulta, aunque no hubiera nada que hacer (los
--    teléfonos consultan cada 250 ms a 2 s). Ahora primero miran sin bloquear y solo bloquean cuando de
--    verdad toca cerrar la ronda o arrancar la sala; después del bloqueo se vuelve a revisar, por si otro
--    teléfono ya lo hizo.
-- 2. Las salas nunca se borraban: las terminadas se quedaban para siempre y las abandonadas (todos cerraron
--    la app) se quedaban "jugando" o "esperando". Una tarea de pg_cron las borra cada hora.

-- ---------------------------------------------------------------- Avanzar la partida (interna)
-- Igual que en 20261015000000_partida.sql, con la revisión previa sin bloqueo.
create or replace function public._avanzar(p_sala uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  s salas;
  n int;
  llegaron int;
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
    select count(*) into llegaron from sala_reclamos r
      where r.sala_id = p_sala and r.ronda = s.ronda and r.quien = any (s.vivos) and r.hora <= now();
    if llegaron < n - 1 and now() < s.alto + interval '3 seconds' then return; end if;
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

-- ---------------------------------------------------------------- Estado de la sala
-- Igual que en 20261015000100_primera_ronda.sql, pero solo bloquea cuando la sala está por arrancar.
create or replace function public.estado_sala(p_sala uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s salas;
  n int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión' using errcode = 'P0001'; end if;
  if not exists (select 1 from sala_jugadores where sala_id = p_sala and user_id = auth.uid()) then
    raise exception 'Ya no estás en esa sala' using errcode = 'P0001';
  end if;

  select * into s from salas where id = p_sala;
  select count(*) into n from sala_jugadores where sala_id = p_sala;
  if s.estado = 'esperando' and (n >= 6 or now() >= s.creada + interval '20 seconds') then
    -- toca arrancarla: se bloquea y se vuelve a revisar (otro teléfono pudo arrancarla primero)
    select * into s from salas where id = p_sala for update;
    select count(*) into n from sala_jugadores where sala_id = p_sala;
    if s.estado = 'esperando' and (n >= 6 or now() >= s.creada + interval '20 seconds') then
      update salas set
        estado = 'jugando', inicio = now(), bots = 6 - n,
        vivos = array(select j.user_id::text from sala_jugadores j where j.sala_id = p_sala order by j.entro)
             || array(select 'bot' || i from generate_series(1, 6 - n) i)
        where id = p_sala;
      perform _empezar_ronda(p_sala, 1, now() + interval '8 seconds');
    end if;
    select * into s from salas where id = p_sala;
  end if;

  return jsonb_build_object(
    'id', s.id,
    'estado', s.estado,
    'dificultad', s.dificultad,
    'semilla', s.semilla,
    'bots', s.bots,
    'ahora', now(),
    'empieza', s.creada + interval '20 seconds',
    'inicio', s.inicio,
    'jugadores', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', j.user_id, 'nombre', j.nombre, 'avatar', j.avatar, 'tu', j.user_id = auth.uid()) order by j.entro)
      from sala_jugadores j where j.sala_id = p_sala
    ), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------- Limpieza de salas
-- * Terminadas hace más de un día (los puntos y monedas ya quedaron en partidas y perfiles; quien no cobró
--   en un día ya no lo hará).
-- * En espera hace más de 10 minutos: nadie las consultó (arrancan solas a los 20 s si alguien mira).
-- * Jugando hace más de 2 horas: abandonadas (una partida dura un par de minutos).
-- Con la sala se borran en cascada sus jugadores y sus llegadas a las sillas.
create or replace function public._limpiar_salas() returns int
language plpgsql security definer set search_path = public as $$
declare
  borradas int;
begin
  delete from salas
    where (estado = 'terminada' and creada < now() - interval '1 day')
       or (estado = 'esperando' and creada < now() - interval '10 minutes')
       or (estado = 'jugando' and creada < now() - interval '2 hours');
  get diagnostics borradas = row_count;
  return borradas;
end $$;

revoke execute on function public._limpiar_salas() from public, anon, authenticated;

create index if not exists salas_creada on public.salas (creada);

-- Cada hora, al minuto 17. cron.schedule con el mismo nombre reemplaza la tarea si ya existía.
create extension if not exists pg_cron;
select cron.schedule('limpiar-salas', '17 * * * *', 'select public._limpiar_salas()');

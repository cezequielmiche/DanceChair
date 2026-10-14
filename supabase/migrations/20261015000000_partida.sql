-- Fase 3: partida en línea en tiempo real.
-- El servidor decide todo lo que importa: cuándo empieza cada ronda, cuándo para la música (alto), cuándo
-- llega cada jugador a su silla y quién queda fuera. Los teléfonos solo dibujan y mandan "me senté".
-- No hay ningún proceso aparte: la partida avanza cuando algún teléfono consulta (estado_partida) o se sienta
-- (reclamar_silla), y como las horas ya están decididas, da igual quién lo haga primero.
--
-- A cada participante se le llama por una clave de texto: el user_id de los jugadores y 'bot1', 'bot2'… de
-- los bots (en cada teléfono los bots salen con el mismo nombre porque se eligen con la semilla de la sala).

alter table public.salas
  add column ronda int not null default 0,
  -- la ronda actual: cuándo empieza la música y cuándo para
  add column ronda_inicio timestamptz,
  add column alto timestamptz,
  -- quiénes siguen en juego y quiénes quedaron fuera, en orden ({quien, ronda})
  add column vivos text[] not null default '{}',
  add column fuera jsonb not null default '[]'::jsonb,
  add column ganador text;

-- Cuándo llegó cada participante a una silla en cada ronda (hora del servidor). Las de los bots se escriben
-- al empezar la ronda con su hora futura; solo se muestran cuando esa hora ya pasó.
create table public.sala_reclamos (
  sala_id uuid not null references public.salas on delete cascade,
  ronda int not null,
  quien text not null,
  hora timestamptz not null,
  primary key (sala_id, ronda, quien)
);
alter table public.sala_reclamos enable row level security;

-- ---------------------------------------------------------------- Empezar una ronda (interna)
-- La música dura de 3 a 8.5 s. Los bots tardan según la dificultad, un poco menos cada ronda (como contra bots).
create function public._empezar_ronda(p_sala uuid, p_ronda int, p_desde timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare
  s salas;
  v_alto timestamptz := p_desde + (3000 + random() * 5500) * interval '1 millisecond';
  a float;
  b float;
  q text;
begin
  select * into s from salas where id = p_sala;
  a := case s.dificultad when 'Fácil' then 650 when 'Normal' then 420 else 230 end;
  b := case s.dificultad when 'Fácil' then 1500 when 'Normal' then 1050 else 700 end;
  update salas set ronda = p_ronda, ronda_inicio = p_desde, alto = v_alto where id = p_sala;
  foreach q in array s.vivos loop
    if q like 'bot%' then
      insert into sala_reclamos (sala_id, ronda, quien, hora)
        values (p_sala, p_ronda, q, v_alto + (a + random() * (b - a)) * power(0.92, p_ronda - 1) * interval '1 millisecond');
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- Avanzar la partida (interna)
-- Cierra la ronda si ya se ocupó la última silla o si pasaron 3 s del alto. Queda fuera el que llegó más
-- tarde (o, si varios no llegaron, uno de ellos al azar). Si queda uno, ganó; si no, la siguiente ronda
-- empieza 3.5 s después (el teléfono muestra quién quedó fuera y cuenta 3, 2, 1).
create function public._avanzar(p_sala uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  s salas;
  n int;
  llegaron int;
  v_fuera text;
begin
  select * into s from salas where id = p_sala for update;
  if s.estado <> 'jugando' or s.alto is null or now() < s.alto then return; end if;
  n := cardinality(s.vivos);
  select count(*) into llegaron from sala_reclamos r
    where r.sala_id = p_sala and r.ronda = s.ronda and r.quien = any (s.vivos) and r.hora <= now();
  if llegaron < n - 1 and now() < s.alto + interval '3 seconds' then return; end if;

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

-- ---------------------------------------------------------------- Estado de la sala (reemplaza la de la fase 2)
-- Igual que antes, pero al arrancar prepara la partida: todos vivos y la primera ronda empieza en 4 s
-- (lo que tardan los teléfonos en abrir la pista).
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

  select * into s from salas where id = p_sala for update;
  select count(*) into n from sala_jugadores where sala_id = p_sala;
  if s.estado = 'esperando' and (n >= 6 or now() >= s.creada + interval '20 seconds') then
    update salas set
      estado = 'jugando', inicio = now(), bots = 6 - n,
      vivos = array(select j.user_id::text from sala_jugadores j where j.sala_id = p_sala order by j.entro)
           || array(select 'bot' || i from generate_series(1, 6 - n) i)
      where id = p_sala;
    perform _empezar_ronda(p_sala, 1, now() + interval '4 seconds');
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

-- ---------------------------------------------------------------- Estado de la partida
-- Lo consulta la pantalla del juego (seguido cerca del alto). Las horas van en milisegundos desde 1970 y
-- 'ahora' sirve para ajustar el reloj del teléfono. Solo se mandan los reclamos que ya pasaron.
create function public._partida_json(p_sala uuid) returns jsonb
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
      from sala_reclamos r where r.sala_id = s.id and r.ronda = s.ronda and r.hora <= now()
    ), '[]'::jsonb)
  )
  from salas s where s.id = p_sala
$$;

create function public.estado_partida(p_sala uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión' using errcode = 'P0001'; end if;
  if not exists (select 1 from sala_jugadores where sala_id = p_sala and user_id = auth.uid()) then
    raise exception 'No estás en esa partida' using errcode = 'P0001';
  end if;
  perform _avanzar(p_sala);
  return _partida_json(p_sala);
end $$;

-- ---------------------------------------------------------------- Sentarse
-- Cuenta la hora en que llega al servidor. Antes del alto no vale (la música sigue), salvo 300 ms de
-- tolerancia por si el reloj del teléfono va un poco adelantado (cuenta como llegar justo en el alto).
-- Si ya se cerró la ronda o ya estás fuera, no hace nada. Devuelve el estado de la partida.
create function public.reclamar_silla(p_sala uuid, p_ronda int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  yo text := auth.uid()::text;
  s salas;
begin
  if yo is null then raise exception 'Inicia sesión' using errcode = 'P0001'; end if;
  if not exists (select 1 from sala_jugadores where sala_id = p_sala and user_id = auth.uid()) then
    raise exception 'No estás en esa partida' using errcode = 'P0001';
  end if;
  select * into s from salas where id = p_sala;
  if s.estado = 'jugando' and s.ronda = p_ronda and now() >= s.alto - interval '300 milliseconds' and yo = any (s.vivos) then
    insert into sala_reclamos (sala_id, ronda, quien, hora) values (p_sala, p_ronda, yo, greatest(now(), s.alto))
      on conflict do nothing;
  end if;
  perform _avanzar(p_sala);
  return _partida_json(p_sala);
end $$;

revoke execute on function public._empezar_ronda(uuid, int, timestamptz) from public, anon, authenticated;
revoke execute on function public._avanzar(uuid) from public, anon, authenticated;
revoke execute on function public._partida_json(uuid) from public, anon, authenticated;
revoke execute on function public.estado_partida(uuid) from public, anon;
revoke execute on function public.reclamar_silla(uuid, int) from public, anon;
grant execute on function public.estado_partida(uuid) to authenticated;
grant execute on function public.reclamar_silla(uuid, int) to authenticated;

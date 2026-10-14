-- Fase 2: salas y emparejamiento para jugar en línea.
-- Una sala junta hasta 6 jugadores de la misma dificultad. Empieza cuando se llena o a los 20 segundos de
-- creada; los lugares que falten se completan con bots. Las tablas no tienen políticas: solo se leen y
-- cambian con las funciones de abajo (security definer), así nadie entra a una sala llena o ajena.

-- ---------------------------------------------------------------- Salas
create table public.salas (
  id uuid primary key default gen_random_uuid(),
  dificultad text not null check (dificultad in ('Fácil', 'Normal', 'Difícil')),
  estado text not null default 'esperando' check (estado in ('esperando', 'jugando', 'terminada')),
  -- misma semilla en todos los teléfonos: los bots y las sillas salen iguales para todos
  semilla int not null default floor(random() * 2147483647)::int,
  bots int not null default 0 check (bots between 0 and 6),
  creada timestamptz not null default now(),
  inicio timestamptz
);
create index salas_esperando on public.salas (dificultad, creada) where estado = 'esperando';
alter table public.salas enable row level security;

create table public.sala_jugadores (
  sala_id uuid not null references public.salas on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  -- copia del perfil al entrar (lo que ven los demás en la sala)
  nombre text not null,
  avatar jsonb not null default '{}'::jsonb,
  entro timestamptz not null default now(),
  primary key (sala_id, user_id)
);
create index sala_jugadores_user on public.sala_jugadores (user_id);
alter table public.sala_jugadores enable row level security;

-- ---------------------------------------------------------------- Buscar sala
-- Entra a la sala en espera más antigua de esa dificultad que tenga lugar; si no hay, crea una.
-- Devuelve el id de la sala.
create function public.buscar_sala(p_dificultad text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  yo uuid := auth.uid();
  v_sala uuid;
  v_nombre text;
  v_avatar jsonb;
begin
  if yo is null then raise exception 'Inicia sesión' using errcode = 'P0001'; end if;
  if p_dificultad not in ('Fácil', 'Normal', 'Difícil') then
    raise exception 'Dificultad no válida' using errcode = 'P0001';
  end if;

  -- si estaba esperando en otra sala, sale de ella (y se borran las salas en espera que queden vacías)
  delete from sala_jugadores j using salas s
    where j.sala_id = s.id and j.user_id = yo and s.estado = 'esperando';
  delete from salas s
    where s.estado = 'esperando' and not exists (select 1 from sala_jugadores j where j.sala_id = s.id);

  select nombre, avatar into v_nombre, v_avatar from perfiles where id = yo;

  -- "for update skip locked": dos jugadores que buscan a la vez no se pisan al contar los lugares.
  -- Las salas a punto de empezar (más de 18 s) se saltan para no entrar justo al arrancar.
  select s.id into v_sala from salas s
    where s.estado = 'esperando' and s.dificultad = p_dificultad
      and s.creada > now() - interval '18 seconds'
      and (select count(*) from sala_jugadores j where j.sala_id = s.id) < 6
    order by s.creada
    limit 1
    for update skip locked;
  if v_sala is null then
    insert into salas (dificultad) values (p_dificultad) returning id into v_sala;
  end if;

  insert into sala_jugadores (sala_id, user_id, nombre, avatar)
    values (v_sala, yo, coalesce(v_nombre, 'Jugador'), coalesce(v_avatar, '{}'::jsonb));
  return v_sala;
end $$;

-- ---------------------------------------------------------------- Estado de la sala
-- La pantalla de espera la consulta cada segundo. Si ya se llenó o pasaron los 20 s, la arranca
-- (completa con bots). Cualquier jugador puede arrancarla: solo cuenta la primera vez.
create function public.estado_sala(p_sala uuid) returns jsonb
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
    update salas set estado = 'jugando', inicio = now(), bots = 6 - n where id = p_sala returning * into s;
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

-- ---------------------------------------------------------------- Salir de la sala
-- Solo mientras espera (salir de una partida empezada llega en la fase 3). Si queda vacía, se borra.
create function public.salir_sala(p_sala uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión' using errcode = 'P0001'; end if;
  delete from sala_jugadores j using salas s
    where j.sala_id = p_sala and s.id = p_sala and j.user_id = auth.uid() and s.estado = 'esperando';
  delete from salas s
    where s.id = p_sala and s.estado = 'esperando'
      and not exists (select 1 from sala_jugadores j where j.sala_id = p_sala);
end $$;

revoke execute on function public.buscar_sala(text) from public, anon;
revoke execute on function public.estado_sala(uuid) from public, anon;
revoke execute on function public.salir_sala(uuid) from public, anon;
grant execute on function public.buscar_sala(text) to authenticated;
grant execute on function public.estado_sala(uuid) to authenticated;
grant execute on function public.salir_sala(uuid) to authenticated;

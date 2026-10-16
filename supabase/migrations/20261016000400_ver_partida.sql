-- Ver la partida de un amigo: mis_amigos dice en qué sala está jugando cada amigo, y ver_sala / ver_partida
-- dejan mirarla (sin jugar) a quien sea amigo de alguien de la sala.

-- ---------------------------------------------------------------- Mis amigos (con la sala en la que juega)
-- Cambian las columnas que devuelve: hay que borrarla y crearla de nuevo.
drop function if exists public.mis_amigos();
create function public.mis_amigos()
returns table (id uuid, nombre text, avatar jsonb, conectado boolean, visto timestamptz, sala uuid)
language sql stable security definer set search_path = public as $$
  select p.id, p.nombre, p.avatar,
         coalesce(c.visto > now() - interval '90 seconds', false) as conectado,
         c.visto,
         (select s.id from sala_jugadores j join salas s on s.id = j.sala_id
           where j.user_id = p.id and s.estado = 'jugando'
           order by s.inicio desc limit 1) as sala
  from amigos a
  join perfiles p on p.id = a.amigo_id
  left join conexiones c on c.user_id = a.amigo_id
  where a.user_id = auth.uid()
  order by conectado desc, lower(p.nombre);
$$;
revoke execute on function public.mis_amigos() from public, anon;
grant execute on function public.mis_amigos() to authenticated;

-- ---------------------------------------------------------------- ¿Puedo mirar esta sala?
-- Sí si un amigo tuyo está (o estuvo) jugando en ella.
create function public._puedo_ver(p_sala uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from sala_jugadores j
    join amigos a on a.amigo_id = j.user_id and a.user_id = auth.uid()
    where j.sala_id = p_sala
  )
$$;
revoke execute on function public._puedo_ver(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- Ver la sala (quiénes juegan)
-- Como estado_sala, pero sin arrancarla y sin marcar a nadie como "tú".
create function public.ver_sala(p_sala uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s salas;
begin
  if auth.uid() is null then raise exception 'Inicia sesión' using errcode = 'P0001'; end if;
  if not _puedo_ver(p_sala) then raise exception 'Solo puedes ver partidas de tus amigos' using errcode = 'P0001'; end if;
  select * into s from salas where id = p_sala;
  if not found then raise exception 'Esa partida ya terminó' using errcode = 'P0001'; end if;
  if s.estado = 'esperando' then raise exception 'La partida todavía no empieza' using errcode = 'P0001'; end if;
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
      select jsonb_agg(jsonb_build_object('user_id', j.user_id, 'nombre', j.nombre, 'avatar', j.avatar, 'tu', false) order by j.entro)
      from sala_jugadores j where j.sala_id = p_sala
    ), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------- Ver la partida (como estado_partida)
-- También la hace avanzar: las horas ya están decididas, da igual quién consulte.
create function public.ver_partida(p_sala uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión' using errcode = 'P0001'; end if;
  if not _puedo_ver(p_sala) then raise exception 'Solo puedes ver partidas de tus amigos' using errcode = 'P0001'; end if;
  perform _avanzar(p_sala);
  return _partida_json(p_sala);
end $$;

revoke execute on function public.ver_sala(uuid) from public, anon;
revoke execute on function public.ver_partida(uuid) from public, anon;
grant execute on function public.ver_sala(uuid) to authenticated;
grant execute on function public.ver_partida(uuid) to authenticated;

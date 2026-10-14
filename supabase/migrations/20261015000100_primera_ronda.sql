-- La primera ronda empezaba 4 s después de arrancar la sala y los teléfonos todavía estaban cargando la pista
-- 3D: en la ronda 1 el alto se veía tarde (iPhone ~0.5 s, Samsung hasta 1.3 s) y el más lento perdía.
-- Ahora empieza a los 8 s. Solo cambia esa espera en estado_sala.
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
    perform _empezar_ronda(p_sala, 1, now() + interval '8 seconds');
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

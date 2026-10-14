-- El que mira la partida no veía a nadie sentarse: la ronda se cierra en cuanto se ocupa la última silla y
-- la respuesta ya traía la ronda siguiente, así que los reclamos que no alcanzó a ver se perdían.
-- Ahora también se mandan los de la ronda anterior ('anteriores'). En las dos listas se quita al que quedó
-- fuera en esa ronda (un bot que iba a llegar tarde no debe verse sentado).
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
    ), '[]'::jsonb)
  )
  from salas s where s.id = p_sala
$$;

revoke execute on function public._partida_json(uuid) from public, anon, authenticated;

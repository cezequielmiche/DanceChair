-- Fase 4: los resultados y las monedas los calcula el servidor.
--
-- * Partida en línea: cobrar_partida calcula puesto, puntos y monedas con lo que el propio servidor arbitró
--   (quién quedó fuera y en qué ronda). Del teléfono solo acepta cuántos pasos bailaste, con tope.
--   Puntos de ranking: 20 por ronda en la que quedó fuera una persona (no un bot) mientras seguías,
--   100 por ganar si había otra persona en la sala, y 5 por paso.
--   Monedas: como siempre, puntos / 10, pero contando todas las rondas y la victoria aunque fueran bots.
-- * Contra bots sin internet: subir_monedas_bots sube las monedas ganadas, con tope de 150 por día.
-- * registrar_partida (los puntos los mandaba el teléfono) ya no se puede llamar.

alter table public.sala_jugadores add column cobro jsonb;

-- ---------------------------------------------------------------- Cobrar una partida en línea
-- Se puede cobrar en cuanto quedas fuera o, si ganaste, al terminar. Solo una vez por sala: si se vuelve a
-- llamar (por ejemplo, porque se cortó la conexión), devuelve lo mismo.
create function public.cobrar_partida(p_sala uuid, p_pasos int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  yo text := auth.uid()::text;
  s salas;
  v_cobro jsonb;
  v_total int;
  v_humanos int;
  v_idx int;
  v_ronda_fuera int;
  v_gano boolean;
  v_puesto int;
  v_rondas int;      -- rondas que jugaste (para el tope de pasos)
  v_sobrevividas int;
  v_por_personas int;
  v_pasos int;
  v_puntos int;
  v_ganadas int;
  v_monedas int;
begin
  if yo is null then raise exception 'Inicia sesión' using errcode = 'P0001'; end if;
  select cobro into v_cobro from sala_jugadores where sala_id = p_sala and user_id = auth.uid() for update;
  if not found then raise exception 'No estás en esa partida' using errcode = 'P0001'; end if;
  if v_cobro is not null then
    return v_cobro || jsonb_build_object('monedas_total', (select monedas from perfiles where id = auth.uid()));
  end if;

  select * into s from salas where id = p_sala;
  select count(*) into v_humanos from sala_jugadores where sala_id = p_sala;
  v_total := cardinality(s.vivos) + jsonb_array_length(s.fuera);

  select e.i, (e.f->>'ronda')::int into v_idx, v_ronda_fuera
    from jsonb_array_elements(s.fuera) with ordinality as e(f, i)
    where e.f->>'quien' = yo;
  if v_idx is not null then
    v_gano := false;
    v_puesto := v_total - v_idx::int + 1;
    v_rondas := v_ronda_fuera;
  elsif s.estado = 'terminada' and s.ganador = yo then
    v_gano := true;
    v_puesto := 1;
    v_rondas := s.ronda;
    v_ronda_fuera := s.ronda + 1;
  else
    raise exception 'La partida sigue' using errcode = 'P0001';
  end if;

  -- las rondas que sobreviviste son las que cerraron antes de la tuya
  select count(*), count(*) filter (where f->>'quien' not like 'bot%')
    into v_sobrevividas, v_por_personas
    from jsonb_array_elements(s.fuera) f
    where (f->>'ronda')::int < v_ronda_fuera;

  -- un paso cada 1.7 s en hasta ~9 s de música: no más de 6 por ronda
  v_pasos := least(greatest(coalesce(p_pasos, 0), 0), 6 * v_rondas);
  v_puntos := 20 * v_por_personas + case when v_gano and v_humanos >= 2 then 100 else 0 end + 5 * v_pasos;
  v_ganadas := (20 * v_sobrevividas + case when v_gano then 100 else 0 end + 5 * v_pasos) / 10;

  insert into partidas (user_id, puntos, gano, puesto, jugadores) values (auth.uid(), v_puntos, v_gano, v_puesto, v_total);
  update perfiles set monedas = monedas + v_ganadas where id = auth.uid() returning monedas into v_monedas;

  v_cobro := jsonb_build_object('puntos', v_puntos, 'ganadas', v_ganadas, 'gano', v_gano, 'puesto', v_puesto, 'jugadores', v_total);
  update sala_jugadores set cobro = v_cobro where sala_id = p_sala and user_id = auth.uid();
  return v_cobro || jsonb_build_object('monedas_total', v_monedas);
end $$;

-- ---------------------------------------------------------------- Monedas ganadas contra bots
-- El teléfono las junta por día (su día local) mientras no hay conexión y las sube después. Se aceptan
-- hasta 150 por día; las de hace más de una semana ya no.
create table public.monedas_bots (
  user_id uuid not null references public.perfiles on delete cascade,
  dia date not null,
  n int not null default 0,
  primary key (user_id, dia)
);
alter table public.monedas_bots enable row level security;

create function public.subir_monedas_bots(p_dia date, p_monedas int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ya int;
  v_aceptadas int := 0;
  v_monedas int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión' using errcode = 'P0001'; end if;
  if p_dia between current_date - 7 and current_date + 1 and p_monedas > 0 then
    insert into monedas_bots (user_id, dia) values (auth.uid(), p_dia) on conflict do nothing;
    select n into v_ya from monedas_bots where user_id = auth.uid() and dia = p_dia for update;
    v_aceptadas := greatest(0, least(p_monedas, 150 - v_ya));
    update monedas_bots set n = n + v_aceptadas where user_id = auth.uid() and dia = p_dia;
  end if;
  update perfiles set monedas = monedas + v_aceptadas where id = auth.uid() returning monedas into v_monedas;
  return jsonb_build_object('aceptadas', v_aceptadas, 'monedas_total', v_monedas);
end $$;

revoke execute on function public.cobrar_partida(uuid, int) from public, anon;
revoke execute on function public.subir_monedas_bots(date, int) from public, anon;
grant execute on function public.cobrar_partida(uuid, int) to authenticated;
grant execute on function public.subir_monedas_bots(date, int) to authenticated;

-- los puntos ya no los manda el teléfono
revoke execute on function public.registrar_partida(int, boolean, int, int) from public, anon, authenticated;

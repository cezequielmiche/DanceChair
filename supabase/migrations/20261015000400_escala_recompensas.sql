-- Nueva escala de premios (la misma cuenta que src/game/modo.ts). Ganar una sala de 6 da como mucho
-- 35 puntos de ranking y 30 monedas.
--
-- * Puntos de ranking: +4 por cada ronda que sobreviviste en la que quedó fuera una persona (no un bot),
--   +10 por ganar si había otra persona en la sala, y +1 por paso con máximo uno por ronda jugada.
-- * Monedas: +4 por ronda sobrevivida (personas o bots), +6 por ganar y +2 por cada 15 pasos
--   (máximo 6 pasos por ronda jugada).

create or replace function public.cobrar_partida(p_sala uuid, p_pasos int) returns jsonb
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
  v_rondas int;      -- rondas que jugaste, contando en la que quedaste fuera
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
  v_puntos := 4 * v_por_personas + case when v_gano and v_humanos >= 2 then 10 else 0 end + least(v_pasos, v_rondas);
  v_ganadas := 4 * v_sobrevividas + case when v_gano then 6 else 0 end + 2 * (v_pasos / 15);

  insert into partidas (user_id, puntos, gano, puesto, jugadores) values (auth.uid(), v_puntos, v_gano, v_puesto, v_total);
  update perfiles set monedas = monedas + v_ganadas where id = auth.uid() returning monedas into v_monedas;

  v_cobro := jsonb_build_object('puntos', v_puntos, 'ganadas', v_ganadas, 'gano', v_gano, 'puesto', v_puesto, 'jugadores', v_total);
  update sala_jugadores set cobro = v_cobro where sala_id = p_sala and user_id = auth.uid();
  return v_cobro || jsonb_build_object('monedas_total', v_monedas);
end $$;

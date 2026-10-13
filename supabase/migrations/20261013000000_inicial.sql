-- Sillas Bailarinas: perfiles, inventario, partidas y ranking.
-- Las monedas y el inventario solo cambian desde funciones del servidor (comprar, registrar_partida),
-- así un jugador no puede darse monedas ni artículos desde la app.

-- ---------------------------------------------------------------- Catálogo (precios oficiales)
create table public.catalogo (
  id text primary key,
  tipo text not null check (tipo in ('ropa', 'paso')),
  precio int not null check (precio >= 0),
  activo boolean not null default true
);

insert into public.catalogo (id, tipo, precio) values
  ('chaqueta', 'ropa', 0), ('blusa', 'ropa', 0), ('jeans', 'ropa', 0), ('falda', 'ropa', 0),
  ('tenis', 'ropa', 0), ('zapatos', 'ropa', 0),
  ('lentes', 'ropa', 200), ('audifonos', 'ropa', 350), ('dino', 'ropa', 900),
  ('brazos', 'paso', 0), ('balanceo', 'paso', 0), ('disco', 'paso', 250), ('robot', 'paso', 400),
  ('macarena', 'paso', 500), ('aura', 'paso', 600), ('dab', 'paso', 700), ('moonwalk', 'paso', 800);

alter table public.catalogo enable row level security;
create policy "catálogo visible" on public.catalogo for select using (true);

-- ---------------------------------------------------------------- Perfiles
create table public.perfiles (
  id uuid primary key references auth.users on delete cascade,
  nombre text not null default 'Jugador' check (char_length(nombre) between 2 and 12),
  avatar jsonb not null default '{}'::jsonb,
  favoritos text[] not null default array['brazos', 'balanceo', null, null]::text[],
  monedas int not null default 600 check (monedas >= 0),
  creado timestamptz not null default now()
);

alter table public.perfiles enable row level security;
-- nombre y avatar se ven en el ranking
create policy "perfiles visibles" on public.perfiles for select using (true);
create policy "editar mi perfil" on public.perfiles for update using (auth.uid() = id) with check (auth.uid() = id);
-- solo se pueden cambiar estas columnas desde la app (las monedas no)
revoke update on public.perfiles from authenticated, anon;
grant update (nombre, avatar, favoritos) on public.perfiles to authenticated;

-- ---------------------------------------------------------------- Inventario
create table public.inventario (
  user_id uuid not null references public.perfiles on delete cascade,
  item_id text not null references public.catalogo,
  origen text not null default 'compra' check (origen in ('gratis', 'compra', 'evento')),
  creado timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.inventario enable row level security;
create policy "ver mi inventario" on public.inventario for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------- Partidas y amigos
create table public.partidas (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.perfiles on delete cascade,
  puntos int not null check (puntos >= 0),
  gano boolean not null default false,
  puesto int not null,
  jugadores int not null,
  creado timestamptz not null default now()
);
create index partidas_user_creado on public.partidas (user_id, creado desc);
create index partidas_creado on public.partidas (creado desc);

alter table public.partidas enable row level security;
create policy "ver mis partidas" on public.partidas for select using (auth.uid() = user_id);

create table public.amigos (
  user_id uuid not null references public.perfiles on delete cascade,
  amigo_id uuid not null references public.perfiles on delete cascade,
  creado timestamptz not null default now(),
  primary key (user_id, amigo_id),
  check (user_id <> amigo_id)
);
alter table public.amigos enable row level security;
create policy "mis amigos" on public.amigos for select using (auth.uid() = user_id);
create policy "agregar amigo" on public.amigos for insert with check (auth.uid() = user_id);
create policy "quitar amigo" on public.amigos for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------- Perfil nuevo al registrarse
create function public.nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(nullif(left(new.raw_user_meta_data ->> 'nombre', 12), ''), 'Jugador'));
  insert into public.inventario (user_id, item_id, origen)
  select new.id, id, 'gratis' from public.catalogo where precio = 0;
  return new;
end $$;

create trigger al_registrarse after insert on auth.users
  for each row execute function public.nuevo_usuario();

-- El avatar solo puede llevar prendas de pago que el jugador tenga
create function public.validar_avatar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  falta text;
begin
  select x.item into falta from (values
    ('lentes', new.avatar ->> 'lentes' = 'si'),
    ('audifonos', new.avatar ->> 'audifonos' = 'si'),
    ('dino', new.avatar ->> 'disfraz' = 'dino')
  ) as x(item, lleva)
  where x.lleva and not exists (select 1 from inventario i where i.user_id = new.id and i.item_id = x.item)
  limit 1;
  if falta is not null then
    raise exception 'No tienes %', falta using errcode = 'P0001';
  end if;
  -- los favoritos deben ser pasos que tiene (o vacíos)
  if exists (
    select 1 from unnest(new.favoritos) f
    where f is not null and not exists (select 1 from inventario i where i.user_id = new.id and i.item_id = f)
  ) then
    raise exception 'Ese paso no es tuyo' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger revisar_avatar before update of avatar, favoritos on public.perfiles
  for each row execute function public.validar_avatar();

-- ---------------------------------------------------------------- Comprar con monedas
create function public.comprar(p_item text) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_precio int;
  v_monedas int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión' using errcode = 'P0001'; end if;
  select precio into v_precio from catalogo where id = p_item and activo;
  if v_precio is null then raise exception 'Artículo no disponible' using errcode = 'P0001'; end if;
  if exists (select 1 from inventario where user_id = auth.uid() and item_id = p_item) then
    raise exception 'Ya es tuyo' using errcode = 'P0001';
  end if;
  update perfiles set monedas = monedas - v_precio
    where id = auth.uid() and monedas >= v_precio
    returning monedas into v_monedas;
  if v_monedas is null then raise exception 'No te alcanzan las monedas' using errcode = 'P0001'; end if;
  insert into inventario (user_id, item_id, origen) values (auth.uid(), p_item, 'compra');
  return v_monedas;
end $$;

-- ---------------------------------------------------------------- Guardar una partida
-- Puntos: +20 por ronda sobrevivida, +100 por ganar, +5 por paso. Monedas ganadas = puntos / 10.
create function public.registrar_partida(p_puntos int, p_gano boolean, p_puesto int, p_jugadores int)
returns table (monedas_total int, ganadas int)
language plpgsql security definer set search_path = public as $$
declare
  v_max int;
  v_ganadas int;
  v_monedas int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión' using errcode = 'P0001'; end if;
  if p_jugadores not between 3 and 8 or p_puesto not between 1 and p_jugadores then
    raise exception 'Partida inválida' using errcode = 'P0001';
  end if;
  -- tope razonable: rondas posibles + victoria + un paso cada 1.7 s durante ~9 s de música por ronda
  v_max := 20 * (p_jugadores - 1) + 100 + 5 * 6 * (p_jugadores - 1);
  if p_puntos < 0 or p_puntos > v_max or (p_gano and p_puesto <> 1) then
    raise exception 'Puntos inválidos' using errcode = 'P0001';
  end if;
  -- no más de una partida cada 20 segundos
  if exists (select 1 from partidas p where p.user_id = auth.uid() and p.creado > now() - interval '20 seconds') then
    raise exception 'Espera un momento' using errcode = 'P0001';
  end if;
  insert into partidas (user_id, puntos, gano, puesto, jugadores)
    values (auth.uid(), p_puntos, p_gano, p_puesto, p_jugadores);
  v_ganadas := p_puntos / 10;
  update perfiles pf set monedas = pf.monedas + v_ganadas where pf.id = auth.uid() returning pf.monedas into v_monedas;
  return query select v_monedas, v_ganadas;
end $$;

-- ---------------------------------------------------------------- Ranking
-- p_tipo: 'semanal' (desde el lunes), 'global' (todo) o 'amigos' (semanal, tú y tus amigos)
create function public.ranking(p_tipo text default 'semanal', p_limite int default 50)
returns table (puesto bigint, user_id uuid, nombre text, avatar jsonb, puntos bigint, es_tu boolean)
language sql stable security definer set search_path = public as $$
  with desde as (
    select case when p_tipo = 'global' then '-infinity'::timestamptz else date_trunc('week', now()) end as t
  ),
  suma as (
    select p.user_id, sum(p.puntos) as puntos
    from partidas p, desde
    where p.creado >= desde.t
      and (p_tipo <> 'amigos' or p.user_id = auth.uid()
           or p.user_id in (select amigo_id from amigos where user_id = auth.uid()))
    group by p.user_id
  ),
  orden as (
    select rank() over (order by s.puntos desc) as puesto, s.user_id, pf.nombre, pf.avatar, s.puntos,
           s.user_id = auth.uid() as es_tu
    from suma s join perfiles pf on pf.id = s.user_id
  )
  select * from orden where puesto <= p_limite or es_tu order by puesto;
$$;

grant execute on function public.comprar(text) to authenticated;
grant execute on function public.registrar_partida(int, boolean, int, int) to authenticated;
grant execute on function public.ranking(text, int) to authenticated;
revoke execute on function public.comprar(text) from anon;
revoke execute on function public.registrar_partida(int, boolean, int, int) from anon;

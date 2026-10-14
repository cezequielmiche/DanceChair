-- Amigos: quién está conectado y buscar jugadores para agregarlos.
-- La app manda un "latido" cada 45 s mientras está abierta con cuenta; si pasan 90 s sin latido, el
-- jugador cuenta como desconectado. La hora del último latido solo se ve a través de mis_amigos().

create table public.conexiones (
  user_id uuid primary key references public.perfiles on delete cascade,
  visto timestamptz not null default now()
);
alter table public.conexiones enable row level security;
-- sin políticas: solo las funciones de abajo la leen y escriben

-- ---------------------------------------------------------------- Latido
create function public.latido() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión' using errcode = 'P0001'; end if;
  insert into conexiones (user_id, visto) values (auth.uid(), now())
    on conflict (user_id) do update set visto = now();
end $$;

-- Al cerrar la app o la sesión: desconectado de inmediato (sin esperar los 90 s).
create function public.desconectar() returns void
language plpgsql security definer set search_path = public as $$
begin
  update conexiones set visto = now() - interval '1 hour' where user_id = auth.uid();
end $$;

-- ---------------------------------------------------------------- Mis amigos
-- Primero los conectados; dentro de cada grupo, por nombre.
create function public.mis_amigos()
returns table (id uuid, nombre text, avatar jsonb, conectado boolean, visto timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.nombre, p.avatar,
         coalesce(c.visto > now() - interval '90 seconds', false) as conectado,
         c.visto
  from amigos a
  join perfiles p on p.id = a.amigo_id
  left join conexiones c on c.user_id = a.amigo_id
  where a.user_id = auth.uid()
  order by conectado desc, lower(p.nombre);
$$;

-- ---------------------------------------------------------------- Buscar jugadores por nombre
create function public.buscar_jugadores(p_texto text)
returns table (id uuid, nombre text, avatar jsonb, es_amigo boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.nombre, p.avatar,
         exists (select 1 from amigos a where a.user_id = auth.uid() and a.amigo_id = p.id)
  from perfiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and char_length(trim(p_texto)) >= 2
    -- los comodines de LIKE (% y _) que escriba el jugador se buscan como texto
    and p.nombre ilike '%' || replace(replace(replace(trim(p_texto), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by lower(p.nombre)
  limit 20;
$$;

revoke execute on function public.latido() from public, anon;
revoke execute on function public.desconectar() from public, anon;
revoke execute on function public.mis_amigos() from public, anon;
revoke execute on function public.buscar_jugadores(text) from public, anon;
grant execute on function public.latido() to authenticated;
grant execute on function public.desconectar() to authenticated;
grant execute on function public.mis_amigos() to authenticated;
grant execute on function public.buscar_jugadores(text) to authenticated;

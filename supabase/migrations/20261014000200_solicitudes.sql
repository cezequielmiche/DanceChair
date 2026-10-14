-- Solicitudes de amistad: agregar a alguien le manda una solicitud; son amigos (los dos) cuando la acepta.
-- La tabla amigos guarda las dos direcciones (A→B y B→A) y ya no se cambia desde la app: solo con estas funciones.

create table public.solicitudes (
  de uuid not null references public.perfiles on delete cascade,
  para uuid not null references public.perfiles on delete cascade,
  creada timestamptz not null default now(),
  primary key (de, para),
  check (de <> para)
);
create index solicitudes_para on public.solicitudes (para);
alter table public.solicitudes enable row level security;
-- sin políticas: solo las funciones de abajo

-- La app ya no agrega ni quita amigos directo (sería amistad de un solo lado, sin aceptar).
drop policy "agregar amigo" on public.amigos;
drop policy "quitar amigo" on public.amigos;

-- Las amistades de un solo lado que ya existían pasan a ser solicitudes pendientes.
insert into public.solicitudes (de, para, creada)
  select a.user_id, a.amigo_id, a.creado from public.amigos a
  where not exists (select 1 from public.amigos b where b.user_id = a.amigo_id and b.amigo_id = a.user_id)
  on conflict do nothing;
delete from public.amigos a
  where not exists (select 1 from public.amigos b where b.user_id = a.amigo_id and b.amigo_id = a.user_id);

-- ---------------------------------------------------------------- Enviar
-- Si el otro ya te había mandado una, se aceptan las dos y quedan como amigos.
-- Devuelve 'enviada' o 'amigos' (si ya lo eran o quedaron).
create function public.enviar_solicitud(p_para uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  yo uuid := auth.uid();
begin
  if yo is null then raise exception 'Inicia sesión' using errcode = 'P0001'; end if;
  if p_para = yo then raise exception 'No puedes agregarte a ti' using errcode = 'P0001'; end if;
  if not exists (select 1 from perfiles where id = p_para) then
    raise exception 'Ese jugador no existe' using errcode = 'P0001';
  end if;
  if exists (select 1 from amigos where user_id = yo and amigo_id = p_para) then return 'amigos'; end if;
  if exists (select 1 from solicitudes where de = p_para and para = yo) then
    delete from solicitudes where (de = p_para and para = yo) or (de = yo and para = p_para);
    insert into amigos (user_id, amigo_id) values (yo, p_para), (p_para, yo) on conflict do nothing;
    return 'amigos';
  end if;
  insert into solicitudes (de, para) values (yo, p_para) on conflict do nothing;
  return 'enviada';
end $$;

-- ---------------------------------------------------------------- Responder (aceptar o rechazar)
create function public.responder_solicitud(p_de uuid, p_acepta boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  yo uuid := auth.uid();
begin
  if yo is null then raise exception 'Inicia sesión' using errcode = 'P0001'; end if;
  delete from solicitudes where de = p_de and para = yo;
  if not found then raise exception 'Esa solicitud ya no existe' using errcode = 'P0001'; end if;
  if p_acepta then
    -- si yo también le había mandado una, ya no hace falta
    delete from solicitudes where de = yo and para = p_de;
    insert into amigos (user_id, amigo_id) values (yo, p_de), (p_de, yo) on conflict do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------- Cancelar una que mandé
create function public.cancelar_solicitud(p_para uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión' using errcode = 'P0001'; end if;
  delete from solicitudes where de = auth.uid() and para = p_para;
end $$;

-- ---------------------------------------------------------------- Quitar amigo (deja de serlo para los dos)
create function public.quitar_amigo(p_amigo uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión' using errcode = 'P0001'; end if;
  delete from amigos where (user_id = auth.uid() and amigo_id = p_amigo) or (user_id = p_amigo and amigo_id = auth.uid());
end $$;

-- ---------------------------------------------------------------- Mis solicitudes
-- 'recibida' = me la mandaron (puedo aceptar o rechazar); 'enviada' = la mandé yo (pendiente).
create function public.mis_solicitudes()
returns table (id uuid, nombre text, avatar jsonb, tipo text, creada timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.nombre, p.avatar, 'recibida', s.creada
    from solicitudes s join perfiles p on p.id = s.de where s.para = auth.uid()
  union all
  select p.id, p.nombre, p.avatar, 'enviada', s.creada
    from solicitudes s join perfiles p on p.id = s.para where s.de = auth.uid()
  order by 4 desc, 5 desc;
$$;

-- Para el numerito del ícono de amigos.
create function public.solicitudes_recibidas() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from solicitudes where para = auth.uid();
$$;

-- ---------------------------------------------------------------- Buscar jugadores (ahora con estado)
-- estado: 'amigo', 'enviada' (pendiente), 'recibida' (te la mandó él) o null.
drop function public.buscar_jugadores(text);
create function public.buscar_jugadores(p_texto text)
returns table (id uuid, nombre text, avatar jsonb, estado text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nombre, p.avatar,
         case
           when exists (select 1 from amigos a where a.user_id = auth.uid() and a.amigo_id = p.id) then 'amigo'
           when exists (select 1 from solicitudes s where s.de = auth.uid() and s.para = p.id) then 'enviada'
           when exists (select 1 from solicitudes s where s.de = p.id and s.para = auth.uid()) then 'recibida'
         end
  from perfiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and char_length(trim(p_texto)) >= 2
    -- los comodines de LIKE (% y _) que escriba el jugador se buscan como texto
    and p.nombre ilike '%' || replace(replace(replace(trim(p_texto), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by lower(p.nombre)
  limit 20;
$$;

revoke execute on function public.enviar_solicitud(uuid) from public, anon;
revoke execute on function public.responder_solicitud(uuid, boolean) from public, anon;
revoke execute on function public.cancelar_solicitud(uuid) from public, anon;
revoke execute on function public.quitar_amigo(uuid) from public, anon;
revoke execute on function public.mis_solicitudes() from public, anon;
revoke execute on function public.solicitudes_recibidas() from public, anon;
revoke execute on function public.buscar_jugadores(text) from public, anon;
grant execute on function public.enviar_solicitud(uuid) to authenticated;
grant execute on function public.responder_solicitud(uuid, boolean) to authenticated;
grant execute on function public.cancelar_solicitud(uuid) to authenticated;
grant execute on function public.quitar_amigo(uuid) to authenticated;
grant execute on function public.mis_solicitudes() to authenticated;
grant execute on function public.solicitudes_recibidas() to authenticated;
grant execute on function public.buscar_jugadores(text) to authenticated;

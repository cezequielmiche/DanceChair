-- Dos partes de arriba nuevas en la tienda: sudadera con capucha y cara de oso, y chaqueta de mezclilla.
-- 500 monedas cada una. validar_avatar ahora también revisa que la parte de arriba de pago sea tuya.

insert into public.catalogo (id, tipo, precio) values
  ('sudadera', 'ropa', 500), ('mezclilla', 'ropa', 500)
on conflict (id) do update set precio = excluded.precio, activo = true;

create or replace function public.validar_avatar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  falta text;
begin
  select x.item into falta from (values
    ('lentes', new.avatar ->> 'lentes' = 'si'),
    ('audifonos', new.avatar ->> 'audifonos' = 'si'),
    ('dino', new.avatar ->> 'disfraz' = 'dino'),
    ('sudadera', new.avatar ->> 'camisaTipo' = 'sudadera'),
    ('mezclilla', new.avatar ->> 'camisaTipo' = 'mezclilla')
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

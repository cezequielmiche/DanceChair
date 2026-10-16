-- Rebaja temporal: disfraces de pingüino y dino a 300 monedas (normal: 900).
-- Para quitarla: update public.catalogo set precio = 900 where id in ('pinguino', 'dino');
-- (y regresar los precios en src/data/catalogo.ts). Correr después de 20261016000200_pinguino.sql.
update public.catalogo set precio = 300 where id in ('pinguino', 'dino');
select id, precio from public.catalogo where id in ('pinguino', 'dino');

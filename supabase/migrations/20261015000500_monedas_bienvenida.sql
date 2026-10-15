-- Regalo por registrarse: 250 monedas (antes 600). Solo cambia para los que se registren de aquí en
-- adelante; los perfiles que ya existen se quedan con lo que tienen.
alter table public.perfiles alter column monedas set default 250;

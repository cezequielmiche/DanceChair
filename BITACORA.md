# Bitácora de DanceChair (Sillas Bailarinas)

Registro de lo que se hace en cada sesión: cambios, decisiones y pendientes. Lo más nuevo va arriba.

---

## 14 de octubre de 2026 (noche): Fase 4, recompensas calculadas por el servidor

- **Partida en línea:** `cobrar_partida` calcula puesto, puntos y monedas con lo que arbitró el propio servidor. Del teléfono solo toma los pasos bailados (máximo 6 por ronda jugada). Se cobra una sola vez por sala; si se repite la llamada, devuelve lo mismo.
- **Bots en salas en línea (decisión del usuario):** los 20 puntos de ranking por ronda solo cuentan si quien quedó fuera era una persona; los +100 por ganar, solo si había otra persona en la sala; los pasos sí cuentan. Las monedas se dan completas (puntos totales / 10).
- **Contra bots sin internet:** las monedas se guardan por día en el teléfono y `subir_monedas_bots` las sube al iniciar sesión, al volver a la app y después de cada partida. El servidor también aplica el tope de 150 por día y no acepta las de hace más de una semana.
- **`registrar_partida` cerrada:** el teléfono ya no puede mandar puntos.
- **Migración:** `20261015000300_recompensas.sql`, ya corrida (verificada con `curl`). **Probado jugando por el usuario: todo bien.**
- **Nueva escala de premios (decisión del usuario):** los puntos de ranking eran demasiados. Ahora el ganador de una sala de 6 saca como mucho **35 puntos y 30 monedas**:
  - Ranking: +4 por persona que quedó fuera mientras seguías, +10 por ganar si había otra persona, +1 por paso (máximo uno por ronda jugada).
  - Monedas (cuentan también los bots): +4 por ronda sobrevivida, +6 por ganar, +2 por cada 15 pasos (máximo 6 pasos por ronda).
  - La cuenta está en `src/game/modo.ts` (`puntosRanking`, `monedasPartida`) y en `cobrar_partida` (migración `20261015000400_escala_recompensas.sql`, ya corrida). Contra bots sin internet se usa la misma cuenta de monedas, con el tope de 150 por día.
  - El ranking de ejemplo sin servidor se escaló al 10 %.
- **Dificultad a Ajustes (pedido del usuario):** ya no está en el inicio. Ahora es "Dificultad de los bots" en Ajustes y se guarda en el teléfono (no se borra al cerrar sesión). Solo cambia a los bots sin internet; en línea todas las salas son Normal para que nadie quede separado por dificultad.
- **Regalo por registrarse (decisión del usuario):** 250 monedas en vez de 600, para los que se registren de aquí en adelante (migración `20261015000500_monedas_bienvenida.sql`, ya corrida). El modo sin cuenta también empieza con 250.

---

## 14 de octubre de 2026 (tarde): Fase 3, partida en tiempo real

- **El servidor manda:** decide cuándo empieza cada ronda, cuándo para la música, a qué hora llega cada quien a su silla y quién queda fuera. Los teléfonos solo dibujan y avisan "me senté".
- **Sin proceso aparte:** la partida avanza cuando algún teléfono consulta (`estado_partida`) o se sienta (`reclamar_silla`). Como las horas ya están decididas, da igual quién consulte primero.
- **Tiempos:** la primera ronda empieza 4 s después de arrancar la sala; la música dura de 3 a 8.5 s; la ronda se cierra cuando se ocupa la última silla o 3 s después del alto; la siguiente empieza 3.5 s después.
- **Quién queda fuera:** el que llegó más tarde. Si varios no se sentaron (o se salieron), uno de ellos al azar.
- **Bots:** su hora de llegada la sortea el servidor al empezar la ronda, con los mismos rangos que contra bots. Salen con el mismo nombre en todos los teléfonos (se eligen con la semilla de la sala).
- **Reloj:** el teléfono ajusta su reloj al del servidor con la consulta más rápida. Sentarse vale desde 300 ms antes del alto (por si el reloj va adelantado) y cuenta como llegar justo en el alto.
- **Consultas:** cada segundo, y cada 250 ms cerca del alto y mientras se reparten las sillas. Se usan consultas en vez de Supabase Realtime: es más simple y no hace falta abrir las tablas con políticas.
- **Medición iPhone contra Samsung** (registros temporales `[tiempos …]` en la consola de Metro): la red del iPhone es más rápida (~150 ms contra ~220 ms) y desde la ronda 2 los dos marcan el alto con 35 ms o menos de diferencia en casi todas las rondas. Al ver la partida después de perder, se entra a la ronda real sin atraso.
- **Ronda 1 atrasada (0.5 a 1.3 s):** las primeras consultas al entrar son lentas y el reloj se calibraba mal; la ronda 1 se quedaba programada con ese error. Ahora la ronda se vuelve a programar cuando el reloj se corrige. Además, la primera ronda empieza a los 8 s (`20261015000100_primera_ronda.sql`, ya corrida).
- **Archivos:** `supabase/migrations/20261015000000_partida.sql`, `src/game/enLinea.ts`, modo `remoto` en `src/game/juego.ts`, `estadoPartida` y `reclamarSilla` en `src/lib/api.ts`, y `tests/enLinea.test.ts`.
- **Migración corrida** en el SQL Editor (verificada con `curl`) y **probada con iPhone y Samsung**: con el arreglo del reloj, en la ronda 1 los dos marcan el alto 14–33 ms tarde. Los registros temporales ya se quitaron.
- **El que mira no veía a nadie sentarse:** la ronda se cerraba entre dos consultas y se perdían los reclamos. El servidor ahora manda también los de la ronda anterior (`20261015000200_reclamos_anteriores.sql`, corrida y probada: ya se ven sentarse).
- **Podio del ranking:** el número del puesto y los puntos ahora quedan justo debajo de cada escalón (se calcula dónde lo dibuja la cámara, no con columnas iguales).

---

## 13 y 14 de octubre de 2026

### Commits del día

| Commit | Qué incluye |
|---|---|
| `bb6115b` | Partida en línea en tiempo real (Fase 3), reloj sincronizado, espectador ve sentarse, podio alineado |
| `0bc12bc` | Salas en línea (Fase 2), amigos con solicitudes, tope diario de monedas, cuenta regresiva con pitido |
| `e4f14e0` | Pantalla de Ajustes con Cerrar sesión, sonido que se guarda, enlace de confirmación de correo, botón de Apple oculto en Expo Go |
| `7f6756a` | Revisar la conexión antes de jugar (Fase 1); regla de oro en `AGENTS.md` |
| `264b8fd` | Tema crema, imágenes en la tienda, rendimiento y arreglos de avatar |
| `7039df8` | Música en iOS: usar `setPlaybackRate` (`playbackRate` es de solo lectura) |
| `a9fbfd1` | Quitar avisos de three (sombras PCF y `THREE.Clock`) |
| `3026b42` | Metro usa `three.module.js` (el `.cjs` llamaba a `process.emitWarning` y crasheaba en RN) |

### Arreglos y mejoras visuales
- **Rueda de pasos:** el texto ya no se corta ("BALANC"); en la partida los lugares sin paso salen deshabilitados ("SIN PASO") y los pasos se eligen solo desde Mis pasos.
- **Pista:** piso más claro, la cámara se aleja para que el círculo quepa en pantallas angostas, y la recarga en caliente ya no deja la escena vacía.
- **Tema crema:** fondo `#F5EFE0`, texto `tinta`, enlaces `acento`, tarjetas `#3A4877`; la barra de pestañas respeta el área segura de Android.
- **Títulos Baloo:** alto de línea de al menos 1.35× el tamaño para que no se corten en iOS.
- **Tienda:** 17 imágenes en `assets/images/tienda/`, generadas con los modelos 3D (ver `arte/miniaturas/LEEME.md`).
- **Colores de las piezas:** se normalizan los nombres de material (`.001`) para que el pelo y la ropa tomen el color elegido.
- **Paso "Brazos":** cada brazo se abre hasta 30° de la vertical (en "Y"), para que las manos no queden detrás de la cabeza sin parecer alas.

### Rendimiento y calor (medido en un Galaxy A16)
- 30 fps con `Limitador`, nada se dibuja fuera de foco, sombras de 512 y sin sombras en los visores chicos.
- Al final de la partida el ganador baila una vez y después la escena se queda quieta: la CPU baja de ~190% a ~14%.
- El cuello de botella es el hilo de JavaScript, sobre todo en modo desarrollo.

### Modo en línea: decisiones
- **Regla del juego:** al tocar Jugar se revisa internet.
  - Sin internet (o sin servidor): partida contra bots que solo da monedas, con tope de **150 al día**.
  - Con internet y cuenta: partida en línea con salas.
  - Con internet sin cuenta: se pregunta si iniciar sesión o jugar contra bots.
- **Salas:** hasta 6 jugadores de la misma dificultad. Arrancan al llenarse o a los **20 s**, y los lugares vacíos se completan con bots.
- **Entre rondas en línea:** no hay botón "Siguiente". El centro muestra **3, 2, 1** con un pitido por segundo y la ronda arranca sola.
- **Amigos:** mutuos, con solicitud que el otro acepta. El ícono muestra cuántas solicitudes tienes. La pantalla muestra solicitudes, conectados, desconectados y enviadas (pendientes).
- **Conexión:** latido cada 45 s; sin latido por 90 s cuentas como desconectado; al mandar la app al fondo o cerrar sesión te desconectas de inmediato.
- **Cerrar sesión:** en Ajustes (engrane del inicio), con confirmación.

### Plan del modo en línea
1. Revisar conexión y elegir modo: **hecha**.
2. Salas y emparejamiento: **hecha**.
3. **Partida en tiempo real: hecha y probada** con dos teléfonos (ver arriba).
4. **Resultados y monedas calculados por el servidor: hecha y probada** (ver arriba).
5. Pruebas reales con dos teléfonos.

### Supabase
- **Proyecto:** `https://yycitmpdklrxztuqugpb.supabase.co`. La URL y la clave pública están en `.env`, que no se sube a Git.
- **Migraciones corridas en el SQL Editor:**
  - `20261013000000_inicial.sql`
  - `20261014000000_salas.sql`
  - `20261014000100_amigos.sql`
  - `20261014000200_solicitudes.sql`
  - `20261015000000_partida.sql`
  - `20261015000100_primera_ronda.sql`
  - `20261015000200_reclamos_anteriores.sql`
  - `20261015000300_recompensas.sql`
  - `20261015000400_escala_recompensas.sql`
  - `20261015000500_monedas_bienvenida.sql`
- **Redirect URLs agregadas:** `exp://**` y `sillasbailarinas://**`, para que el correo de confirmación abra la app.
- **Cómo se trabajan las migraciones:** primero se prueban en un Postgres local que simula Supabase, después se corren en el SQL Editor y al final se verifican con `curl` usando la clave pública.

### Pendientes
- [ ] **Cambiar la Secret key de Supabase** (quedó escrita en el chat). La app no la usa.
- [ ] Probar salas y amigos con dos cuentas (iPhone y Samsung).
- [ ] Opcional: correo de confirmación en español (Authentication → Emails).
- [ ] Por decidir: **monedas ganadas sin cuenta.** Hoy solo viven en el teléfono (AsyncStorage `sillas-jugador`), no en la base de datos. Si se borra la app se pierden, y al crear cuenta o iniciar sesión el saldo se reemplaza por el del servidor (también se pierden las compras hechas sin cuenta). Además, el tope diario contra bots (`monedasHoy`) se comparte entre sin cuenta y con cuenta. Opción propuesta: al registrarse, pasar las monedas locales con un tope (por ejemplo, hasta 150 además de las 250 de regalo), sin pasar las compras. El usuario prefirió dejarlo anotado por ahora.
- [ ] Opcional: configurar el inicio con Google (Google Cloud + Supabase).
- [ ] Ideas que quedaron sin respuesta:
  - podio del ranking quieto después de bailar unos segundos;
  - quitar las sombras de la pista;
  - imágenes de la tienda en Mis pasos;
  - otro ángulo para la imagen de Moonwalk;
  - splash en crema;
  - revisar si el ganador aparece sentado mientras celebra.

### Cómo trabajamos
- Siempre en español.
- **Evidencia:** las capturas de errores van a `../Bugs`; se revisan primero las más nuevas.
- **Servidor de Expo:** `npx expo start --go --clear`, corriendo en segundo plano y reiniciado cuando cambia la configuración.
- **Antes de dar algo por terminado:** `npx tsc --noEmit`, `npx expo lint` y `npm test`.
- **Commit y push:** solo cuando se piden.

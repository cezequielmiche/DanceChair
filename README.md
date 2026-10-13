# Sillas Bailarinas (DanceChair)

Juego de las sillas musicales para celulares, hecho con **Expo (React Native)** y **Supabase**.
Los jugadores bailan alrededor de las sillas; cuando para la música hay que tocar **Sentarse** antes que los demás.
Personajes 3D (chico y chica) con ropa intercambiable, pasos de baile, tienda y ranking.

Primera versión: **contra bots**. El modo en línea viene en la segunda fase.

## Probarlo en tu teléfono

```bash
npm install
npx expo start --go
```

Escanea el código QR con **Expo Go** (Android) o con la cámara (iPhone). Todo lo que usa la app viene incluido en Expo Go.
El `--go` hace falta porque el proyecto incluye `expo-dev-client`: sin él, el QR abre un build de desarrollo en vez de Expo Go.
El teléfono y la computadora deben estar en la misma red Wi-Fi; si no se conecta, usa `npx expo start --go --tunnel`.

Sin configurar nada la app abre en **modo local**: tu avatar, monedas y puntos se guardan en el teléfono y el ranking es de ejemplo.

## Conectar Supabase (cuentas, ranking y tienda en línea)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor** pega y ejecuta `supabase/migrations/20261013000000_inicial.sql`
   (o con la CLI: `supabase link` y `supabase db push`).
3. Copia `.env.example` como `.env` y pon la **URL** y la **anon key** (Project Settings → API).
4. Vuelve a abrir `npx expo start --go`.

Qué crea la migración:

| Tabla / función | Para qué |
|---|---|
| `catalogo` | Precios oficiales de prendas y pasos. |
| `perfiles` | Nombre, avatar (`AvatarConfig`), 4 pasos favoritos y monedas. Se crea solo al registrarse, con 600 monedas y la ropa gratis. |
| `inventario` | Lo que tiene cada jugador. |
| `partidas` | Puntos de cada partida (para el ranking). |
| `amigos` | Para el ranking de amigos. |
| `comprar(item)` | Compra con monedas: revisa precio y saldo en el servidor. |
| `registrar_partida(...)` | Guarda puntos (con tope razonable y máximo una cada 20 s) y suma monedas: 1 por cada 10 puntos. |
| `ranking(tipo)` | `semanal` (desde el lunes), `global` o `amigos`. |

Seguridad: la app solo puede cambiar `nombre`, `avatar` y `favoritos` de su propio perfil. Las monedas y el inventario
cambian solo con esas funciones, y el servidor rechaza un avatar con prendas de pago que el jugador no tiene.

### Iniciar sesión con Google y Apple

- **Correo y contraseña:** funciona con solo conectar Supabase.
- **Google:** en Supabase → Authentication → Providers activa Google con tu Client ID/Secret de Google Cloud, y en
  Authentication → URL Configuration agrega `sillasbailarinas://auth` a las *Redirect URLs*.
- **Apple (iPhone):** activa el proveedor Apple en Supabase con tu *Services ID* y usa un build propio (EAS), porque
  el botón nativo necesita el *bundle id* `com.dancechair.app`.

## Cómo está organizado

```
src/app/                pantallas (expo-router)
  login.tsx             entrar / crear cuenta / jugar sin cuenta
  (tabs)/index.tsx      Inicio: puntos, ranking con podio 3D y botón Jugar
  (tabs)/avatar.tsx     Creador de avatar (cuerpo, pelo, ropa, disfraz, extras)
  (tabs)/pasos.tsx      Mis pasos: los 4 favoritos de la rueda
  (tabs)/tienda.tsx     Tienda: tocar una prenda te la prueba al instante
  juego.tsx             Partida contra bots
src/game/juego.ts       Lógica del juego (sin pantalla, con pruebas)
src/game/Pista3D.tsx    Pista 3D: jugadores, sillas, cámara al ganador
src/game/Rueda.tsx      Rueda de pasos alrededor de Sentarse
src/avatar/             Modelo 3D: piezas, colores, bailes y pose sentado
src/store/jugador.ts    Estado del jugador (se guarda en el teléfono y en Supabase)
src/lib/                Supabase, llamadas al servidor y compras
supabase/migrations/    Base de datos
assets/models/          Chico.glb y Chica.glb (con todas las piezas y bailes)
assets/audio/           Música y efectos (propios, generados con arte/generar_audio.py)
arte/                   Archivos .blend y scripts de Blender para regenerar los modelos
```

## Reglas del juego

- 3 a 8 jugadores (tú + bots), una silla menos que jugadores. Cada ronda sale uno y se quita una silla.
- La música dura entre 3 y 8.5 s; cada ronda gira un poco más rápido y la música se acelera.
- Los bots tardan en sentarse según la dificultad (Fácil, Normal, Difícil) y cada ronda son más rápidos.
- Puntos: **+20** por ronda que sobrevives, **+100** por ganar, **+5** por cada paso de la rueda mientras suena la música.
- Si quedas fuera puedes **ver cómo termina** la partida. Al final la cámara se acerca al ganador, que baila.

## Modelos 3D

Cada malla del `.glb` se llama `Grupo_valor` y se muestra según el `AvatarConfig`:

| Grupo | Campo | Valores |
|---|---|---|
| `Pelo_` | `pelo` | `corto`, `largo`, `ninguno` |
| `Camisa_` | `camisaTipo` | `chaqueta`, `blusa` |
| `Pant_` | `pantalonTipo` | `jeans`, `falda` |
| `Zap_` | `zapatos` | `tenis`, `zapatos` |
| `Acc_` | `lentes`, `audifonos` | `si` / `no` |
| `Disf_` | `disfraz` | `ninguno`, `dino` (esconde pantalón y zapatos) |

Los materiales `piel`, `ojos_iris`, `tint_pelo`, `tint_camisa`, `tint_pantalon`, `tint_zapato`, `tint_acc` y
`tint_disfraz` toman el color del avatar. Una prenda nueva entra sola si su malla sigue ese nombre.

## Comandos

```bash
npm test            # pruebas de la lógica del juego
npm run typecheck   # revisión de tipos
npx expo lint       # estilo
```

## Publicar

```bash
npx eas-cli@latest build --profile preview --platform android   # APK para probar
npx eas-cli@latest build --profile production --platform all    # tiendas
```

## Pendiente para las siguientes fases

- **Compras de monedas con dinero real:** conectar una librería de compras (por ejemplo RevenueCat) y una función
  del servidor que valide el recibo y sume monedas (ver `src/lib/compras.ts`). En modo local las monedas se suman directo para probar.
- **Partidas en línea:** salas y emparejamiento con Supabase Realtime; el servidor decide cuándo para la música y quién se sentó primero.
- **Amigos:** pantalla para buscar y agregar amigos (la tabla ya existe).

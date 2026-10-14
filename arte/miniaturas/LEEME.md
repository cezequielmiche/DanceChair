# Imágenes de la tienda

Las tarjetas de la tienda usan imágenes fijas (`assets/images/tienda/*.png`) del avatar con cada prenda o
haciendo cada paso. Se generan con los mismos modelos 3D de la app, en un teléfono Android con Expo Go:

1. Conecta el teléfono por USB (depuración USB activada) y arranca `npx expo start --go`.
2. En otra terminal: `node arte/miniaturas/receptor.cjs "$PWD/assets/images/tienda" /tmp`
3. `adb reverse tcp:8081 tcp:8081 && adb reverse tcp:8099 tcp:8099`
4. Copia `arte/miniaturas/pantalla.tsx` a `src/app/miniaturas.tsx` y abre
   `adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081/--/miniaturas" host.exp.exponent`
5. Para cada paso de baile elige la mejor de `paso_0.png … paso_7.png`, cópiala como `paso.png` y borra las demás.
6. Borra `src/app/miniaturas.tsx` (no es una pantalla de la app).

El receptor quita el fondo (alfa), voltea la imagen y la recorta al personaje.

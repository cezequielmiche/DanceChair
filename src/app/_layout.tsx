import { Baloo2_600SemiBold, Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2';
import { Nunito_400Regular, Nunito_700Bold, Nunito_800ExtraBold, useFonts } from '@expo-google-fonts/nunito';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { useJugador } from '@/store/jugador';
import { C } from '@/ui/tema';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Raiz() {
  const [fuentes] = useFonts({ Baloo2_600SemiBold, Baloo2_800ExtraBold, Nunito_400Regular, Nunito_700Bold, Nunito_800ExtraBold });
  const [hidratado, setHidratado] = useState(useJugador.persist.hasHydrated());

  useEffect(() => useJugador.persist.onFinishHydration(() => setHidratado(true)), []);

  // Con cuenta: al iniciar sesión (o al volver a abrir la app) se carga el perfil del servidor.
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((evento, sesion) => {
      if (sesion && (evento === 'SIGNED_IN' || evento === 'INITIAL_SESSION')) {
        useJugador.getState().entrarConCuenta().catch(() => {});
      }
      if (evento === 'SIGNED_OUT' && useJugador.getState().modo === 'cuenta') useJugador.setState({ modo: null });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const listo = fuentes && hidratado;
  useEffect(() => {
    if (listo) SplashScreen.hideAsync().catch(() => {});
  }, [listo]);
  if (!listo) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.fondo }, animation: 'fade' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="juego" options={{ gestureEnabled: false, animation: 'slide_from_bottom' }} />
      </Stack>
    </SafeAreaProvider>
  );
}

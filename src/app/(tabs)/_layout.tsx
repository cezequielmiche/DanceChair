// Barra de abajo: Ranking · Avatar · Pasos · Tienda. Si no ha entrado, va al login.
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useJugador } from '@/store/jugador';
import { Bolsa, Estrella, Persona, Trofeo } from '@/ui/iconos';
import { C, F } from '@/ui/tema';

export default function Pestanas() {
  const modo = useJugador((s) => s.modo);
  // espacio de los botones del sistema (Android) o la barra de inicio (iPhone): la barra va encima de ellos
  const { bottom } = useSafeAreaInsets();
  if (!modo) return <Redirect href="/login" />;
  const icono = (I: typeof Trofeo) =>
    function Icono({ color }: { color: unknown }) {
      return <I size={20} color={String(color)} />;
    };
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.amarillo,
        tabBarInactiveTintColor: C.apagado,
        tabBarStyle: { backgroundColor: C.fondo, borderTopColor: C.linea, borderTopWidth: 2, height: 58 + bottom, paddingTop: 4, paddingBottom: bottom },
        tabBarLabelStyle: { fontFamily: F.fuerte, fontSize: 11 },
        sceneStyle: { backgroundColor: C.pantalla },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Ranking', tabBarIcon: icono(Trofeo) }} />
      <Tabs.Screen name="avatar" options={{ title: 'Avatar', tabBarIcon: icono(Persona) }} />
      <Tabs.Screen name="pasos" options={{ title: 'Pasos', tabBarIcon: icono(Estrella) }} />
      <Tabs.Screen name="tienda" options={{ title: 'Tienda', tabBarIcon: icono(Bolsa) }} />
    </Tabs>
  );
}

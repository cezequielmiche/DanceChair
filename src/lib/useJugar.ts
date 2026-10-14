// Empezar una partida (botón Jugar del inicio y "Guardar y jugar" del avatar): primero se revisa la conexión.
// Sin internet, contra bots (solo monedas); con internet y cuenta, en línea; con internet sin cuenta, se pregunta.
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import type { Dificultad } from '@/game/juego';
import { elegirModo, type ModoPartida } from '@/game/modo';
import { useJugador } from '@/store/jugador';
import { hayInternet } from './conexion';
import { hayServidor } from './supabase';

export function useJugar() {
  const [revisando, setRevisando] = useState(false);

  const jugar = async (dificultad: Dificultad = 'Normal') => {
    if (revisando) return;
    setRevisando(true);
    const internet = await hayInternet();
    setRevisando(false);
    const abrir = (m: ModoPartida) => router.push({ pathname: '/juego', params: { dificultad, jugadores: '6', modo: m } });
    const decision = elegirModo({ internet, servidor: hayServidor, cuenta: useJugador.getState().modo === 'cuenta' });
    if (decision !== 'sesion') return abrir(decision);
    Alert.alert('Juega en línea', 'Inicia sesión para jugar contra otras personas y sumar puntos al ranking. Contra bots solo ganas monedas.', [
      { text: 'Jugar contra bots', onPress: () => abrir('bots') },
      { text: 'Iniciar sesión', onPress: () => router.push('/login') },
    ]);
  };

  return { jugar, revisando };
}

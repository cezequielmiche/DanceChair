// Sala de espera en línea: busca una sala, muestra quién va entrando y la cuenta regresiva.
// Arranca cuando se llena (6) o a los 20 s; los lugares vacíos se completan con bots.
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar3D } from '@/avatar/Avatar3D';
import { AVATAR_DEFAULT, type AvatarConfig } from '@/avatar/types';
import type { Dificultad } from '@/game/juego';
import * as api from '@/lib/api';
import { guardarSala } from '@/lib/salaActual';
import { useJugador } from '@/store/jugador';
import { Boton, MiniAvatar } from '@/ui/comunes';
import { C, F } from '@/ui/tema';

const LUGARES = 6;
const CADA_MS = 1000;

export default function Sala() {
  const params = useLocalSearchParams<{ dificultad?: Dificultad }>();
  const dificultad = params.dificultad ?? 'Normal';
  const avatar = useJugador((s) => s.avatar);
  const [sala, setSala] = useState<api.EstadoSala | null>(null);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const [ahora, setAhora] = useState(() => Date.now());
  // diferencia entre el reloj del servidor y el del teléfono (para la cuenta regresiva)
  const [desfase, setDesfase] = useState(0);
  const id = useRef<string | null>(null);
  const empezo = useRef(false);

  useEffect(() => {
    let vivo = true;
    let t: ReturnType<typeof setTimeout>;
    const revisar = async () => {
      if (!id.current) return;
      try {
        const s = await api.estadoSala(id.current);
        if (!vivo) return;
        setDesfase(new Date(s.ahora).getTime() - Date.now());
        setSala(s);
        if (s.estado === 'jugando') {
          empezo.current = true;
          guardarSala(s);
          router.replace({ pathname: '/juego', params: { modo: 'linea', dificultad: s.dificultad, sala: s.id } });
          return;
        }
      } catch (e) {
        if (vivo) setError((e as Error).message);
        return;
      }
      t = setTimeout(revisar, CADA_MS);
    };
    api
      .buscarSala(dificultad)
      .then((sid) => {
        id.current = sid;
        return revisar();
      })
      .catch((e) => vivo && setError((e as Error).message));
    return () => {
      vivo = false;
      clearTimeout(t);
      // si se sale de la pantalla sin que la sala arranque (Cancelar, botón atrás), deja el lugar libre
      if (id.current && !empezo.current) api.salirSala(id.current).catch(() => {});
    };
  }, [dificultad, intento]);

  // la cuenta regresiva se mueve sola entre consultas
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const faltan = sala ? Math.max(0, Math.ceil((new Date(sala.empieza).getTime() - (ahora + desfase)) / 1000)) : null;
  const jugadores = sala?.jugadores ?? [];

  return (
    <SafeAreaView style={styles.pantalla} edges={['top', 'bottom']}>
      <Text style={styles.titulo}>{error ? 'No se pudo entrar' : 'Buscando jugadores…'}</Text>
      <Text style={styles.sub}>Partida en línea · {dificultad}</Text>

      <Avatar3D avatares={[{ config: avatar, anim: 'brazos' }]} style={styles.visor} girar={false} sombras={false} />

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          <View style={styles.cuenta}>
            {faltan == null ? <ActivityIndicator color={C.tinta} /> : <Text style={styles.cuentaNum}>{faltan}</Text>}
            <Text style={styles.cuentaTxt}>{faltan == null ? 'Buscando sala…' : `Empieza en ${faltan} s o cuando se llene`}</Text>
          </View>
          <View style={styles.lugares}>
            {Array.from({ length: LUGARES }, (_, i) => {
              const j = jugadores[i];
              return <Lugar key={j?.user_id ?? `vacio${i}`} nombre={j ? (j.tu ? 'Tú' : j.nombre) : ''} avatar={j ? { ...AVATAR_DEFAULT, ...j.avatar } : null} tu={!!j?.tu} />;
            })}
          </View>
          <Text style={styles.nota}>Si no llegan más jugadores, completamos la sala con bots.</Text>
        </>
      )}

      <View style={{ flex: 1 }} />
      {error ? <Boton titulo="Intentar de nuevo" onPress={() => {
            setError('');
            setSala(null);
            setIntento((n) => n + 1);
          }} style={{ alignSelf: 'stretch' }} /> : null}
      <Boton tipo="secundario" titulo="Cancelar" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
    </SafeAreaView>
  );
}

function Lugar({ nombre, avatar, tu }: { nombre: string; avatar: AvatarConfig | null; tu: boolean }) {
  return (
    <View style={styles.lugar}>
      <MiniAvatar piel={avatar?.piel} camisa={avatar?.camisa} size={56} vacio={!avatar} borde={tu ? C.amarillo : undefined} />
      <Text style={[styles.lugarTxt, !avatar && { color: C.tinta2 }]} numberOfLines={1}>
        {avatar ? nombre : 'Esperando…'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.pantalla, padding: 16, gap: 10, alignItems: 'center' },
  titulo: { fontFamily: F.titulo, fontSize: 28, lineHeight: 38, color: C.tinta, marginTop: 8 },
  sub: { fontFamily: F.fuerte, fontSize: 15, color: C.tinta2 },
  visor: { width: 160, height: 190 },
  cuenta: { alignItems: 'center', gap: 2 },
  cuentaNum: { fontFamily: F.titulo, fontSize: 44, lineHeight: 60, color: C.acento },
  cuentaTxt: { fontFamily: F.fuerte, fontSize: 14, color: C.tinta2 },
  lugares: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 8, alignSelf: 'stretch' },
  lugar: { width: '29%', alignItems: 'center', gap: 6 },
  lugarTxt: { fontFamily: F.fuerte, fontSize: 13, color: C.tinta },
  nota: { fontFamily: F.texto, fontSize: 13, color: C.tinta2, textAlign: 'center', marginTop: 4 },
  error: { fontFamily: F.fuerte, fontSize: 15, color: C.tinta, textAlign: 'center', marginTop: 12 },
});

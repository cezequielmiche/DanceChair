// Inicio: tus puntos, el ranking (semanal, global, amigos) con el podio en 3D y el botón Jugar.
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useNetworkState } from 'expo-network';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar3D } from '@/avatar/Avatar3D';
import { AVATAR_DEFAULT, type AvatarConfig } from '@/avatar/types';
import { BOTS } from '@/data/bots';
import * as api from '@/lib/api';
import { elegirModo, type ModoPartida } from '@/game/modo';
import { hayInternet } from '@/lib/conexion';
import { hayServidor } from '@/lib/supabase';
import { puntosSemana, useJugador } from '@/store/jugador';
import { Boton, Opciones, Pestanas } from '@/ui/comunes';
import { Jugar, Moneda } from '@/ui/iconos';
import { C, F, fmt } from '@/ui/tema';

type Tipo = 'semanal' | 'global' | 'amigos';
interface Fila {
  puesto: number;
  nombre: string;
  puntos: number;
  avatar: AvatarConfig;
  tu: boolean;
}

// Sin servidor: ranking de ejemplo con los bots y tus puntos guardados en el teléfono.
function rankingLocal(tipo: Tipo, nombre: string, avatar: AvatarConfig, mios: number): Fila[] {
  const base: [string, number][] =
    tipo === 'global'
      ? [['Kami', 18420], ['Luna', 16880], ['Max', 15740], ['Coco', 14390], ['Bea', 13950], ['Nina', 9900], ['Pipo', 8200]]
      : tipo === 'amigos'
        ? [['Nina', 1700], ['Pipo', 1920]]
        : [['Luna', 2480], ['Max', 2310], ['Coco', 2150], ['Pipo', 1920], ['Nina', 1700], ['Tito', 1510], ['Bea', 1390]];
  const filas = base.map(([n, p]) => ({ nombre: n, puntos: p, avatar: BOTS.find((b) => b.nombre === n) ?? AVATAR_DEFAULT, tu: false }));
  filas.push({ nombre, puntos: mios, avatar, tu: true });
  return filas.sort((a, b) => b.puntos - a.puntos).map((f, i) => ({ ...f, puesto: i + 1 }));
}

export default function Inicio() {
  const { nombre, avatar, monedas, partidas, ultimaGanancia, modo } = useJugador();
  const [tipo, setTipo] = useState<Tipo>('semanal');
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState('');
  const [dificultad, setDificultad] = useState<'Fácil' | 'Normal' | 'Difícil'>('Normal');
  const [revisando, setRevisando] = useState(false);
  const red = useNetworkState();
  const sinRed = red.isConnected === false || red.isInternetReachable === false;
  const semana = puntosSemana(partidas);
  const total = partidas.reduce((a, p) => a + p.puntos, 0);

  const cargar = useCallback(() => {
    setError('');
    if (modo !== 'cuenta') {
      setFilas(rankingLocal(tipo, nombre, avatar, tipo === 'global' ? total : semana));
      return;
    }
    setFilas(null);
    api
      .ranking(tipo)
      .then((r) =>
        setFilas(r.map((f) => ({ puesto: Number(f.puesto), nombre: f.nombre, puntos: Number(f.puntos), avatar: { ...AVATAR_DEFAULT, ...f.avatar } as AvatarConfig, tu: f.es_tu }))),
      )
      .catch((e) => {
        setError((e as Error).message);
        setFilas([]);
      });
  }, [modo, tipo, nombre, avatar, semana, total]);

  useFocusEffect(cargar);

  // Al tocar Jugar se revisa la conexión: sin internet, contra bots (solo monedas); con internet y cuenta, en línea.
  const jugar = async () => {
    if (revisando) return;
    setRevisando(true);
    const internet = await hayInternet();
    setRevisando(false);
    const abrir = (m: ModoPartida) => router.push({ pathname: '/juego', params: { dificultad, jugadores: '6', modo: m } });
    const decision = elegirModo({ internet, servidor: hayServidor, cuenta: modo === 'cuenta' });
    if (decision !== 'sesion') return abrir(decision);
    Alert.alert('Juega en línea', 'Inicia sesión para jugar contra otras personas y sumar puntos al ranking. Contra bots solo ganas monedas.', [
      { text: 'Jugar contra bots', onPress: () => abrir('bots') },
      { text: 'Iniciar sesión', onPress: () => router.push('/login') },
    ]);
  };

  const yo = filas?.find((f) => f.tu);
  const arriba = yo && filas ? filas.find((f) => f.puesto === yo.puesto - 1) : undefined;
  const podio = useMemo(() => {
    const top = (filas ?? []).slice(0, 3);
    const orden = [1, 0, 2].filter((i) => top[i]);
    const x = { 1: -1.25, 0: 0, 2: 1.25 } as Record<number, number>;
    const alto = { 0: 0.36, 1: 0.24, 2: 0.14 } as Record<number, number>;
    const bailes = ['brazos', 'balanceo', 'macarena'] as const;
    return orden.map((i) => ({ fila: top[i], i, x: x[i], alto: alto[i], anim: bailes[i] }));
  }, [filas]);

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <View style={styles.cabeza}>
        <Pressable accessibilityLabel="Editar mi avatar" onPress={() => router.push('/avatar')} style={styles.mini}>
          <View style={[styles.miniCara, { backgroundColor: avatar.piel }]} />
          <View style={[styles.miniCuerpo, { backgroundColor: avatar.camisa }]} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.hola}>Hola de nuevo</Text>
          <Text style={styles.nombre}>{nombre}</Text>
        </View>
        <Pressable accessibilityLabel="Monedas, ir a la tienda" onPress={() => router.push('/tienda')} style={styles.monedas}>
          <Moneda />
          <Text style={styles.monedasTxt}>{fmt(monedas)}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 16 }}>
        <View style={styles.tarjeta}>
          <View style={styles.filaEntre}>
            <Text style={styles.etq}>Tus puntos esta semana</Text>
            {ultimaGanancia > 0 ? <Text style={styles.chip}>+{ultimaGanancia} última partida</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <Text style={styles.puntos}>{fmt(modo === 'cuenta' && tipo === 'semanal' && yo ? yo.puntos : semana)}</Text>
            {yo ? <Text style={styles.puesto}>Puesto #{yo.puesto}</Text> : null}
          </View>
          <Text style={styles.texto}>
            {arriba && yo ? `Te faltan ${fmt(arriba.puntos - yo.puntos + 1)} puntos para pasar a ${arriba.nombre} (#${arriba.puesto})` : yo?.puesto === 1 ? '¡Vas primero!' : 'Juega una partida para entrar al ranking.'}
          </Text>
        </View>

        <Pestanas<Tipo> items={[['semanal', 'Semanal'], ['global', 'Global'], ['amigos', 'Amigos']]} valor={tipo} onCambio={setTipo} />

        {filas === null ? (
          <ActivityIndicator color={C.amarillo} style={{ height: 200 }} />
        ) : (
          <>
            {podio.length ? (
              <View>
                <Avatar3D
                  avatares={podio.map((p) => ({ config: p.fila.avatar, anim: p.anim, x: p.x, alto: p.alto, colorBase: ['#FFC233', '#C9D3EA', '#E0A070'][p.i] }))}
                  style={{ height: 230 }}
                  girar={false}
                  piso={false}
                />
                <View style={styles.podioNombres}>
                  {podio.map((p) => (
                    <View key={p.i} style={styles.escalon}>
                      <Text style={[styles.escalonPos, { color: ['#8A6A00', '#5A6585', '#9A5530'][p.i] }]}>#{p.i + 1}</Text>
                      <Text style={styles.escalonTxt} numberOfLines={1}>
                        {p.fila.tu ? 'Tú' : p.fila.nombre} · {fmt(p.fila.puntos)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Text style={[styles.texto, { textAlign: 'center', padding: 24, color: C.tinta2 }]}>{error || 'Todavía no hay puntos esta semana. ¡Sé el primero!'}</Text>
            )}
            <View style={styles.lista}>
              {filas.slice(3).map((f) => (
                <View key={`${f.puesto}-${f.nombre}`} style={[styles.fila, f.tu && { backgroundColor: C.amarilloFondo }]}>
                  <Text style={[styles.filaPos, f.tu && { color: C.amarillo }]}>#{f.puesto}</Text>
                  <View style={styles.bola}>
                    <View style={[styles.bolaCara, { backgroundColor: f.avatar.piel }]} />
                  </View>
                  <Text style={[styles.filaNombre, f.tu && { color: C.amarillo }]} numberOfLines={1}>
                    {f.nombre}
                    {f.tu ? ' (tú)' : ''}
                  </Text>
                  <Text style={[styles.filaPts, f.tu && { color: C.amarillo }]}>{fmt(f.puntos)}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
        <Opciones items={[['Fácil', 'Fácil'], ['Normal', 'Normal'], ['Difícil', 'Difícil']]} valor={dificultad} onCambio={setDificultad} />
        {sinRed ? <Text style={styles.sinRed}>Sin conexión: jugarás contra bots y solo ganarás monedas.</Text> : null}
        <Boton grande titulo={revisando ? 'Revisando conexión…' : 'Jugar'} deshabilitado={revisando} onPress={jugar}>
          {revisando ? <ActivityIndicator color={C.fondo} /> : <Jugar />}
        </Boton>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.pantalla },
  sinRed: { fontFamily: F.fuerte, fontSize: 13, color: C.tinta2, textAlign: 'center' },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingBottom: 10 },
  mini: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: C.amarillo, backgroundColor: C.piso, overflow: 'hidden', alignItems: 'center' },
  miniCara: { width: 24, height: 24, borderRadius: 12, marginTop: 7 },
  miniCuerpo: { width: 36, height: 20, borderRadius: 10, marginTop: 2 },
  hola: { fontFamily: F.texto, fontSize: 13, color: C.tinta2 },
  nombre: { fontFamily: F.titulo, fontSize: 22, lineHeight: 30, color: C.tinta },
  monedas: { height: 40, paddingLeft: 8, paddingRight: 12, borderRadius: 999, borderWidth: 2, borderColor: C.borde, backgroundColor: C.tarjeta, flexDirection: 'row', alignItems: 'center', gap: 6 },
  monedasTxt: { fontFamily: F.fuerte, fontSize: 15, color: '#FFF' },
  tarjeta: { backgroundColor: C.tarjeta, borderRadius: 20, padding: 16, gap: 6 },
  filaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  etq: { fontFamily: F.fuerte, fontSize: 13, color: C.apagado },
  chip: { fontFamily: F.fuerte, fontSize: 12, color: C.turquesa, backgroundColor: C.turquesaFondo, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  puntos: { fontFamily: F.titulo, fontSize: 44, lineHeight: 60, color: C.amarillo },
  puesto: { fontFamily: F.fuerte, fontSize: 15, color: C.texto },
  texto: { fontFamily: F.texto, fontSize: 13, color: C.texto2 },
  podioNombres: { flexDirection: 'row', justifyContent: 'space-around', marginTop: -6 },
  escalon: { flex: 1, alignItems: 'center' },
  escalonPos: { fontFamily: F.titulo, fontSize: 18, lineHeight: 24 },
  escalonTxt: { fontFamily: F.fuerte, fontSize: 12, color: C.tinta, paddingHorizontal: 4 },
  lista: { borderRadius: 16, backgroundColor: C.tarjeta, padding: 4 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 12, borderRadius: 12 },
  filaPos: { width: 40, fontFamily: F.titulo, fontSize: 17, color: C.apagado2 },
  bola: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.tarjeta2, alignItems: 'center', justifyContent: 'center' },
  bolaCara: { width: 20, height: 20, borderRadius: 10 },
  filaNombre: { flex: 1, fontFamily: F.fuerte, fontSize: 15, color: C.texto },
  filaPts: { fontFamily: F.fuerte, fontSize: 15, color: C.texto2 },
});

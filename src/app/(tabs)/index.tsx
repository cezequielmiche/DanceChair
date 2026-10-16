// Inicio: tus puntos, el ranking (semanal, global, amigos) con el podio en 3D y el botón Jugar.
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useNetworkState } from 'expo-network';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar3D } from '@/avatar/Avatar3D';
import { AVATAR_DEFAULT, type AvatarConfig } from '@/avatar/types';
import { BOTS } from '@/data/bots';
import * as api from '@/lib/api';
import { useJugar } from '@/lib/useJugar';
import { puntosSemana, useJugador } from '@/store/jugador';
import { Boton, Pestanas } from '@/ui/comunes';
import { Amigos, Engrane, Jugar, Moneda } from '@/ui/iconos';
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
      ? [['Kami', 1842], ['Luna', 1688], ['Max', 1574], ['Coco', 1439], ['Bea', 1395], ['Nina', 990], ['Pipo', 820]]
      : tipo === 'amigos'
        ? [['Nina', 170], ['Pipo', 192]]
        : [['Luna', 248], ['Max', 231], ['Coco', 215], ['Pipo', 192], ['Nina', 170], ['Tito', 151], ['Bea', 139]];
  const filas = base.map(([n, p]) => ({ nombre: n, puntos: p, avatar: BOTS.find((b) => b.nombre === n) ?? AVATAR_DEFAULT, tu: false }));
  filas.push({ nombre, puntos: mios, avatar, tu: true });
  return filas.sort((a, b) => b.puntos - a.puntos).map((f, i) => ({ ...f, puesto: i + 1 }));
}

// Podio: las etiquetas van justo debajo de cada escalón. La cámara del visor (Avatar3D con varios avatares)
// tiene 30° de campo vertical y queda a ~4.77 m de la base de los escalones: un metro en x mide siempre lo
// mismo en pantalla según la altura del visor, sin importar el ancho (por eso no sirven columnas iguales).
const ALTO_PODIO = 230;
const PX_POR_METRO = ALTO_PODIO / 2 / (4.77 * Math.tan((15 * Math.PI) / 180));
const ANCHO_ETIQUETA = 104;

export default function Inicio() {
  const { nombre, avatar, monedas, partidas, ultimaGanancia, ultimasMonedas, modo } = useJugador();
  const [tipo, setTipo] = useState<Tipo>('semanal');
  const [anchoPodio, setAnchoPodio] = useState(0);
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState('');
  const { jugar, revisando } = useJugar();
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

  // numerito del ícono de amigos: solicitudes que te mandaron (al volver al inicio y cada 30 s)
  const [solicitudes, setSolicitudes] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (modo !== 'cuenta') return;
      const revisar = () => api.solicitudesRecibidas().then(setSolicitudes).catch(() => {});
      revisar();
      const t = setInterval(revisar, 30_000);
      return () => clearInterval(t);
    }, [modo]),
  );


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
        <Pressable
          accessibilityLabel={modo === 'cuenta' && solicitudes ? `Amigos, ${solicitudes} solicitudes nuevas` : 'Amigos'}
          onPress={() => router.push('/amigos')}
          style={styles.engrane}
        >
          <Amigos size={20} />
          {modo === 'cuenta' && solicitudes > 0 ? (
            <View style={styles.globo}>
              <Text style={styles.globoTxt}>{solicitudes > 9 ? '9+' : solicitudes}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable accessibilityLabel="Ajustes" onPress={() => router.push('/ajustes')} style={styles.engrane}>
          <Engrane />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 16 }}>
        <View style={styles.tarjeta}>
          <View style={styles.filaEntre}>
            <Text style={styles.etq}>Tus puntos esta semana</Text>
            {ultimaGanancia > 0 || ultimasMonedas > 0 ? (
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                {ultimaGanancia > 0 ? <Text style={styles.chip}>+{ultimaGanancia} última partida</Text> : null}
                {ultimasMonedas > 0 ? (
                  <View style={styles.chipMonedas}>
                    <Moneda size={13} />
                    <Text style={styles.chipMonedasTxt}>
                      +{ultimasMonedas} monedas{ultimaGanancia > 0 ? '' : ' última partida'}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
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
              <View onLayout={(e) => setAnchoPodio(e.nativeEvent.layout.width)}>
                <Avatar3D
                  avatares={podio.map((p) => ({ config: p.fila.avatar, anim: p.anim, x: p.x, alto: p.alto, colorBase: ['#FFC233', '#C9D3EA', '#E0A070'][p.i] }))}
                  style={{ height: ALTO_PODIO }}
                  girar={false}
                  piso={false}
                />
                <View style={styles.podioNombres}>
                  {podio.map((p) => (
                    <View key={p.i} style={[styles.escalon, { left: anchoPodio / 2 + p.x * PX_POR_METRO - ANCHO_ETIQUETA / 2 }]}>
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
        {sinRed ? <Text style={styles.sinRed}>Sin conexión: jugarás contra bots y solo ganarás monedas.</Text> : null}
        <Boton grande titulo={revisando ? 'Revisando conexión…' : 'Jugar'} deshabilitado={revisando} onPress={() => jugar()}>
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
  engrane: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: C.borde, backgroundColor: C.tarjeta, alignItems: 'center', justifyContent: 'center' },
  globo: { position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: C.coral, borderWidth: 2, borderColor: C.pantalla, alignItems: 'center', justifyContent: 'center' },
  globoTxt: { fontFamily: F.fuerte, fontSize: 11, lineHeight: 14, color: '#FFF' },
  monedasTxt: { fontFamily: F.fuerte, fontSize: 15, color: '#FFF' },
  tarjeta: { backgroundColor: C.tarjeta, borderRadius: 20, padding: 16, gap: 6 },
  filaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  etq: { fontFamily: F.fuerte, fontSize: 13, color: C.apagado },
  chipMonedas: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.amarilloFondo, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  chipMonedasTxt: { fontFamily: F.fuerte, fontSize: 12, color: C.amarillo },
  chip: { fontFamily: F.fuerte, fontSize: 12, color: C.turquesa, backgroundColor: C.turquesaFondo, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  puntos: { fontFamily: F.titulo, fontSize: 44, lineHeight: 60, color: C.amarillo },
  puesto: { fontFamily: F.fuerte, fontSize: 15, color: C.texto },
  texto: { fontFamily: F.texto, fontSize: 13, color: C.texto2 },
  podioNombres: { height: 42, marginTop: -6 },
  escalon: { position: 'absolute', top: 0, width: ANCHO_ETIQUETA, alignItems: 'center' },
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

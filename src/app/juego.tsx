// Pantalla del juego (contra bots sin conexión; en línea, con los jugadores de la sala; por ahora los mueve la
// computadora en cada teléfono, hasta la fase 3): pista 3D arriba; abajo la rueda de pasos con Sentarse y los jugadores a los lados.
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { efecto, musicaOff, musicaOn, prepararAudio } from '@/audio/sonidos';
import { Avatar3D } from '@/avatar/Avatar3D';
import { paso as datosPaso } from '@/data/catalogo';
import { Juego, type Dificultad } from '@/game/juego';
import { monedasContraBots, type ModoPartida } from '@/game/modo';
import { salaGuardada } from '@/lib/salaActual';
import { AVATAR_DEFAULT, type AvatarConfig } from '@/avatar/types';
import { Pista3D, type Etiqueta } from '@/game/Pista3D';
import { Rueda } from '@/game/Rueda';
import { Boton } from '@/ui/comunes';
import { Bocina, Flecha, Moneda, Ojo, Pulgar } from '@/ui/iconos';
import { C, F } from '@/ui/tema';
import { useJugador } from '@/store/jugador';

export default function PantallaJuego() {
  'use no memo'; // se anima cada cuadro: fuera del React Compiler
  const params = useLocalSearchParams<{ jugadores?: string; dificultad?: Dificultad; modo?: ModoPartida; sala?: string }>();
  const modo: ModoPartida = params.modo === 'linea' ? 'linea' : 'bots';
  const { avatar, favoritos, registrarPartida, silencio: mudo, setSilencio } = useJugador();
  const { width } = useWindowDimensions();
  const favPasos = useMemo(() => favoritos.map((f) => (f ? datosPaso(f) ?? null : null)), [favoritos]);

  const crear = useCallback(
    () =>
      new Juego({
        jugadores: Number(params.jugadores ?? 6),
        dificultad: params.dificultad ?? 'Normal',
        tuNombre: 'Tú',
        tuAvatar: avatar,
        favoritos,
        automatico: params.modo === 'linea',
        // en línea: los otros jugadores de la sala, con su nombre y avatar
        rivales: salaGuardada(params.sala)
          ?.jugadores.filter((j) => !j.tu)
          .map((j) => ({ nombre: j.nombre, avatar: { ...AVATAR_DEFAULT, ...j.avatar } as AvatarConfig })),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const juego = useRef<Juego>(null as unknown as Juego);
  if (!juego.current) juego.current = crear();
  const etiquetas = useRef<Etiqueta[]>([]);
  const [, setTic] = useState(0);
  const [ganadas, setGanadas] = useState<number | null>(null);
  const guardada = useRef(false);

  // Bucle: avanza el juego cada cuadro y redibuja la interfaz ~15 veces por segundo.
  useEffect(() => {
    let raf = 0;
    let ultimo = performance.now();
    let ultimoDibujo = 0;
    const g = juego.current;
    prepararAudio().then(() => g.iniciar(performance.now()));
    const quitar = g.on((e) => {
      if (e === 'musica') musicaOn(g.ronda);
      if (e === 'alto') {
        musicaOff();
        efecto('alto');
      }
      if (e === 'sentado') efecto('sentado');
      if (e === 'paso') efecto('paso');
      if (e === 'ganaste') {
        musicaOff();
        efecto('ganaste');
      }
      if (e === 'fuera' || e === 'fin') musicaOff();
      if ((e === 'ganaste' || (e === 'fuera' && g.fase === 'fin')) && !guardada.current) {
        guardada.current = true;
        registrarPartida(g.resumen(), modo).then(setGanadas);
      }
    });
    const bucle = (t: number) => {
      const dt = Math.min(50, t - ultimo);
      ultimo = t;
      g.actualizar(performance.now(), dt);
      // al final, cuando el ganador ya bailó, la interfaz ya no cambia: no se redibuja hasta "Otra vez"
      if (t - ultimoDibujo > 66 && !g.quieto(performance.now())) {
        ultimoDibujo = t;
        setTic(t);
      }
      raf = requestAnimationFrame(bucle);
    };
    raf = requestAnimationFrame(bucle);
    return () => {
      cancelAnimationFrame(raf);
      quitar();
      musicaOff();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const g = juego.current;
  const ahora = performance.now();
  const tu = g.tu;
  const sentado = !!g.reclamos[0];
  const puedeSentarse = g.fase === 'alto' && !sentado && tu.vivo;
  const bailando = g.fase === 'musica' && ahora < g.baileHasta;
  const puedeBailar = g.fase === 'musica' && tu.vivo && !bailando;
  const vivos = g.jugadores.filter((p) => p.vivo).length;
  const geoN = g.enRonda.length;

  const otraVez = () => {
    // en línea, otra partida es otra sala
    if (params.sala) return router.replace({ pathname: '/sala', params: { dificultad: params.dificultad ?? 'Normal' } });
    guardada.current = false;
    setGanadas(null);
    g.iniciar(performance.now());
  };

  // ---------------- tarjeta de estado
  // contra bots no hay puntos de ranking: lo que se lleva son monedas
  const premio = modo === 'bots' ? `${monedasContraBots(g.pts)} monedas` : `${g.pts} pts`;
  let titulo = '';
  let msg = '';
  let fondo = C.tarjeta;
  let tinta = C.texto;
  if (g.fase === 'cuenta') {
    titulo = `Empieza en ${Math.max(1, g.cuenta)}…`;
    msg = 'Cuando pare la música, toca Sentarse.';
    fondo = C.amarillo;
    tinta = C.fondo;
  } else if (g.fase === 'musica') {
    titulo = g.espectando ? 'Viendo la partida…' : 'La música suena…';
    msg = `Ronda ${g.ronda} · ${geoN} jugadores, ${geoN - 1} ${geoN - 1 === 1 ? 'silla' : 'sillas'}`;
  } else if (g.fase === 'alto') {
    titulo = '¡ALTO!';
    msg = g.espectando ? '¿Quién se quedará sin silla?' : sentado ? 'Encontraste silla. Esperando a los demás…' : '¡Siéntate antes que los demás!';
    fondo = C.coral;
    tinta = C.fondo;
  } else if (g.fase === 'resultado') {
    titulo = `${g.ultimoFuera} quedó fuera`;
    msg = `Se quita una silla. Quedan ${vivos} jugadores.${g.espectando || g.siguienteEn ? ' La siguiente ronda empieza sola.' : ''}`;
  } else if (g.fase === 'fin') {
    if (g.gano) {
      titulo = `¡Campeón! +${premio}`;
      msg = ganadas && modo === 'linea' ? `Fuiste el último con silla. +${ganadas} monedas.` : 'Fuiste el último con silla.';
      fondo = C.amarillo;
      tinta = C.fondo;
    } else if (g.espectando) {
      titulo = `¡${g.ganador} ganó!`;
      msg = `Quedaste en el puesto ${g.puesto} de ${g.total} (+${premio}${ganadas && modo === 'linea' ? `, +${ganadas} monedas` : ''}).`;
      fondo = C.amarillo;
      tinta = C.fondo;
    } else {
      titulo = `Sin silla · +${premio}`;
      msg = `Puesto ${g.puesto} de ${g.total}.`;
    }
  }
  const barras = [0, 1, 2, 3, 4].map((i) => (g.fase === 'musica' ? Math.round(6 + 20 * Math.abs(Math.sin(g.andar * (0.8 + i * 0.13) + i))) : 4));

  // ---------------- botón central
  // en línea, entre rondas el centro solo cuenta los segundos (nadie decide cuándo sigue)
  const enEspera = g.fase === 'resultado' && !g.espectando && g.siguienteEn > 0;
  const faltaRonda = enEspera ? Math.max(1, Math.ceil((g.siguienteEn - ahora) / 1000)) : 0;
  // un pitido por cada segundo que baja (3, 2, 1)
  useEffect(() => {
    if (faltaRonda > 0) efecto('pitido');
  }, [faltaRonda]);
  const accion = g.fase === 'resultado' && !g.espectando && !enEspera ? 'Siguiente' : g.fase === 'fin' ? 'Otra vez' : '';
  const centroOn = !!accion || puedeSentarse;
  const pulso = puedeSentarse ? (Math.sin(ahora / 140) + 1) / 2 : 0;
  const tamRueda = Math.min(246, width - 2 * 64);
  const tamBoton = Math.round(118 * (tamRueda / 246));
  const etiquetaCentro = enEspera ? String(faltaRonda) : accion || (g.espectando ? 'Viendo' : sentado ? '¡Sentado!' : 'Sentarse');
  const alCentro = () => {
    if (g.fase === 'resultado') g.siguiente(performance.now());
    else if (g.fase === 'fin') otraVez();
    else g.sentarse(performance.now());
  };

  // ---------------- jugadores a los lados (mitad y mitad)
  const porLado = Math.ceil(g.jugadores.length / 2);
  const lados = [g.jugadores.slice(0, porLado), g.jugadores.slice(porLado)];

  const perdiste = g.fase === 'fin' && !g.gano && !g.espectando;

  return (
    <SafeAreaView style={styles.pantalla} edges={['top', 'bottom']}>
      <View style={styles.arriba}>
        <Pressable accessibilityLabel="Volver al inicio" onPress={() => router.back()} style={styles.icono}>
          <Flecha />
        </Pressable>
        <View style={[styles.tarjeta, { backgroundColor: fondo }]}>
          <View style={styles.barras}>
            {barras.map((h, i) => (
              <View key={i} style={{ width: 5, height: h, borderRadius: 3, backgroundColor: fondo === C.tarjeta ? C.amarillo : C.fondo }} />
            ))}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.titulo, { color: tinta }]} numberOfLines={1}>
              {titulo}
            </Text>
            <Text style={[styles.msg, { color: tinta }]} numberOfLines={2}>
              {msg}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityLabel={mudo ? 'Activar sonido' : 'Silenciar'}
          onPress={() => {
            setSilencio(!mudo);
            if (mudo && g.fase === 'musica') musicaOn(g.ronda);
          }}
          style={styles.icono}
        >
          <Bocina mudo={mudo} />
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        <Pista3D juego={juego} etiquetas={etiquetas} style={StyleSheet.absoluteFill} />
        {etiquetas.current.map((t) => (
          <View key={t.id} pointerEvents="none" style={[styles.tag, { left: t.x, top: t.y, opacity: t.fuera ? 0.45 : 1, backgroundColor: t.tu ? C.amarillo : 'rgba(12,17,32,0.72)' }]}>
            <Text style={[styles.tagTxt, { color: t.tu ? C.fondo : '#FFF' }]}>{t.nombre}</Text>
          </View>
        ))}
        <View style={styles.filaPista} pointerEvents="box-none">
          {g.espectando && g.fase !== 'fin' ? (
            <View style={styles.chip}>
              <Ojo size={16} color={C.texto2} />
              <Text style={styles.chipTxt}>Espectando</Text>
            </View>
          ) : (
            <Text style={styles.stat}>{g.fase === 'cuenta' ? `${g.total} jugadores${modo === 'bots' ? ' · contra bots' : ''}` : `Ronda ${g.ronda} · ${vivos} en juego · ${premio}`}</Text>
          )}
          {ahora < g.flashHasta ? (
            <View style={[styles.chip, { backgroundColor: C.turquesaFondo }]}>
              <Text style={[styles.chipTxt, { color: C.turquesa, fontSize: 14 }]}>{g.flash}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.abajo, { height: tamRueda + 14 }]}>
        {lados.map((lista, lado) => (
          <View key={lado} style={[styles.columna, lado === 0 ? { left: 2 } : { right: 2 }]}>
            {lista.map((p) => {
              const reclamo = p.vivo ? g.reclamos[p.id] : null;
              const salto = reclamo ? Math.max(0, 1 - (ahora - reclamo.t0) / 450) : 0;
              const aro = reclamo ? C.turquesa : p.tu ? C.amarillo : p.vivo ? '#3A4877' : '#5A3040';
              return (
                <View
                  key={p.id}
                  accessible
                  accessibilityLabel={`${p.nombre}${p.vivo ? (reclamo ? ', ya tiene silla' : ', sigue en juego') : ', quedó fuera'}`}
                  style={[styles.jug, { opacity: p.vivo ? 1 : 0.55 }]}
                >
                  <View style={{ transform: [{ scale: 1 + 0.18 * Math.sin(Math.PI * salto) }] }}>
                    <View style={[styles.circulo, { borderColor: aro, backgroundColor: reclamo ? C.turquesaFondo : C.piso }]}>
                      <View style={[styles.cara, { backgroundColor: p.avatar.piel }]} />
                      <View style={[styles.cuerpo, { backgroundColor: p.avatar.disfraz === 'dino' ? p.avatar.colorDisfraz ?? '#3DBE4A' : p.avatar.camisa }]} />
                    </View>
                    <View style={[styles.pulgar, { backgroundColor: p.vivo ? C.turquesa : C.coral }]}>
                      <Pulgar size={13} abajo={!p.vivo} />
                    </View>
                  </View>
                  <Text style={[styles.jugNombre, { color: p.tu ? C.acento : C.tinta }]} numberOfLines={1}>
                    {p.nombre}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
        <Rueda
          favoritos={favPasos}
          tam={tamRueda}
          activo={bailando ? g.baile : null}
          habilitado={puedeBailar}
          onPaso={(_, p) => g.bailar(p.id, performance.now())}
        >
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <View
              pointerEvents="none"
              style={[
                styles.aroPulso,
                {
                  width: tamBoton + 12 + pulso * 12,
                  height: tamBoton + 12 + pulso * 12,
                  borderRadius: 999,
                  borderColor: puedeSentarse ? `rgba(255,194,51,${(0.85 - pulso * 0.6).toFixed(2)})` : centroOn ? 'rgba(255,194,51,0.35)' : C.linea,
                },
              ]}
            />
            <Pressable
              accessibilityRole={enEspera ? 'text' : 'button'}
              accessibilityLabel={enEspera ? `La siguiente ronda empieza en ${faltaRonda} segundos` : etiquetaCentro}
              disabled={!centroOn}
              onPress={alCentro}
              style={[
                styles.centro,
                { width: tamBoton, height: tamBoton, borderRadius: tamBoton / 2, backgroundColor: centroOn ? C.amarillo : sentado ? C.turquesa : C.tarjeta2 },
                centroOn && styles.sombra,
              ]}
            >
              <Text
                style={[
                  styles.centroTxt,
                  { fontSize: (enEspera ? 40 : accion ? 22 : 24) * (tamRueda / 246), color: enEspera ? C.texto : centroOn || sentado ? C.fondo : C.apagado2 },
                  enEspera && { lineHeight: 54 * (tamRueda / 246) },
                ]}
              >
                {etiquetaCentro}
              </Text>
            </Pressable>
          </View>
        </Rueda>
      </View>

      <Modal visible={perdiste} transparent animationType="fade">
        <View style={styles.velo}>
          <View style={styles.modal}>
            <Avatar3D avatares={[{ config: avatar, anim: 'idle' }]} style={{ width: 120, height: 150 }} girar={false} sombras={false} />
            <Text style={styles.modalTitulo}>¡Te quedaste sin silla!</Text>
            <Text style={styles.modalTxt}>
              Terminaste en el puesto {g.puesto} de {g.total}.
            </Text>
            <View style={styles.premio}>
              {modo === 'linea' ? <Text style={styles.premioTxt}>+{g.pts} puntos al ranking</Text> : null}
              {ganadas != null && ganadas > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Moneda size={16} />
                  <Text style={styles.premioTxt}>+{ganadas}</Text>
                </View>
              ) : null}
            </View>
            {g.puedeEspectar ? (
              <Boton tipo="secundario" titulo="Ver cómo termina" onPress={() => g.espectar(performance.now())} style={{ alignSelf: 'stretch' }}>
                <Ojo size={20} color={C.texto} />
              </Boton>
            ) : null}
            <Boton titulo="Jugar de nuevo" onPress={otraVez} style={{ alignSelf: 'stretch' }} />
            <Pressable onPress={() => router.back()} style={{ padding: 10 }}>
              <Text style={[styles.modalTxt, { color: C.amarillo, fontFamily: F.fuerte }]}>Ir al inicio</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.pantalla },
  arriba: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 6 },
  icono: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.tarjeta, alignItems: 'center', justifyContent: 'center' },
  tarjeta: { flex: 1, minHeight: 64, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 26 },
  titulo: { fontFamily: F.titulo, fontSize: 20, lineHeight: 27 },
  msg: { fontFamily: F.texto, fontSize: 13 },
  tag: { position: 'absolute', transform: [{ translateX: -30 }, { translateY: -18 }], minWidth: 60, alignItems: 'center', paddingHorizontal: 7, borderRadius: 10 },
  tagTxt: { fontFamily: F.fuerte, fontSize: 11, lineHeight: 16 },
  filaPista: { position: 'absolute', left: 12, right: 12, bottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stat: { fontFamily: F.fuerte, fontSize: 13, color: C.tinta2 },
  chip: { height: 30, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#2C3961', flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipTxt: { fontFamily: F.fuerte, fontSize: 13, color: C.texto2 },
  abajo: { alignItems: 'center', justifyContent: 'center' },
  columna: { position: 'absolute', top: 0, bottom: 0, width: 64, justifyContent: 'space-evenly', alignItems: 'center' },
  jug: { alignItems: 'center', width: 64 },
  circulo: { width: 46, height: 46, borderRadius: 23, borderWidth: 3, overflow: 'hidden', alignItems: 'center' },
  cara: { width: 22, height: 22, borderRadius: 11, marginTop: 6 },
  cuerpo: { width: 34, height: 20, borderRadius: 10, marginTop: 2 },
  pulgar: { position: 'absolute', right: -6, bottom: -4, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: C.pantalla, alignItems: 'center', justifyContent: 'center' },
  jugNombre: { fontFamily: F.fuerte, fontSize: 11, marginTop: 2 },
  aroPulso: { position: 'absolute', borderWidth: 4 },
  centro: { alignItems: 'center', justifyContent: 'center' },
  centroTxt: { fontFamily: F.titulo, textAlign: 'center' },
  sombra: { shadowColor: '#000', shadowOpacity: 0.35, shadowOffset: { width: 0, height: 7 }, shadowRadius: 0, elevation: 6 },
  velo: { flex: 1, backgroundColor: 'rgba(8,12,24,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal: { width: '100%', maxWidth: 340, backgroundColor: C.tarjeta, borderRadius: 28, borderWidth: 3, borderColor: C.coral, padding: 22, alignItems: 'center', gap: 10 },
  modalTitulo: { fontFamily: F.titulo, fontSize: 26, color: C.texto, textAlign: 'center' },
  modalTxt: { fontFamily: F.texto, fontSize: 15, color: C.texto2, textAlign: 'center' },
  premio: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.turquesaFondo },
  premioTxt: { fontFamily: F.fuerte, fontSize: 15, color: C.turquesa },
});

// Amigos (desde el ícono del inicio): arriba las solicitudes que te mandaron (aceptar o rechazar), luego los
// amigos conectados y los desconectados, y al final las solicitudes que mandaste (pendientes).
// Con el buscador se encuentran jugadores por nombre para mandarles solicitud. Mantener presionado un amigo
// lo quita; una solicitud pendiente, la cancela. Si un amigo conectado está en una partida, se puede ver.
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AVATAR_DEFAULT } from '@/avatar/types';
import * as api from '@/lib/api';
import { guardarSala } from '@/lib/salaActual';
import { useJugador } from '@/store/jugador';
import { Boton, Etiqueta, MiniAvatar } from '@/ui/comunes';
import { Flecha } from '@/ui/iconos';
import { C, F } from '@/ui/tema';

const REFRESCAR_MS = 20_000;

/** "hace 5 min", "hace 2 h"… */
function haceCuanto(visto: string | null) {
  if (!visto) return 'Sin conexión reciente';
  const min = Math.floor((Date.now() - new Date(visto).getTime()) / 60000);
  if (min < 1) return 'Hace un momento';
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Ayer' : `Hace ${d} días`;
}

export default function Amigos() {
  const conCuenta = useJugador((s) => s.modo === 'cuenta');
  const [amigos, setAmigos] = useState<api.Amigo[] | null>(null);
  const [solicitudes, setSolicitudes] = useState<api.Solicitud[]>([]);
  const [error, setError] = useState('');
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<api.JugadorEncontrado[] | null>(null);

  const cargar = useCallback(() => {
    if (!conCuenta) return;
    Promise.all([api.misAmigos(), api.misSolicitudes()])
      .then(([a, s]) => {
        setAmigos(a);
        setSolicitudes(s);
        setError('');
      })
      .catch((e) => setError((e as Error).message));
  }, [conCuenta]);

  // al entrar y cada 20 s mientras la pantalla está abierta (para ver quién se conecta)
  useFocusEffect(
    useCallback(() => {
      cargar();
      const t = setInterval(cargar, REFRESCAR_MS);
      return () => clearInterval(t);
    }, [cargar]),
  );

  // buscar mientras se escribe (con una pausa, para no consultar en cada letra)
  const busqueda = texto.trim();
  useEffect(() => {
    if (busqueda.length < 2) return;
    let vivo = true;
    const t = setTimeout(() => {
      api
        .buscarJugadores(busqueda)
        .then((r) => vivo && setResultados(r))
        .catch((e) => vivo && setError((e as Error).message));
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [busqueda]);

  const marcar = (id: string, estado: api.JugadorEncontrado['estado']) =>
    setResultados((r) => r?.map((x) => (x.id === id ? { ...x, estado } : x)) ?? null);

  const agregar = (j: api.JugadorEncontrado) => {
    api
      .enviarSolicitud(j.id)
      .then((res) => {
        // si él ya te había mandado una, quedan como amigos de una vez
        marcar(j.id, res === 'amigos' ? 'amigo' : 'enviada');
        cargar();
      })
      .catch((e) => Alert.alert('No se pudo enviar', (e as Error).message));
  };

  const responder = (id: string, acepta: boolean) => {
    api
      .responderSolicitud(id, acepta)
      .then(() => {
        marcar(id, acepta ? 'amigo' : null);
        cargar();
      })
      .catch((e) => Alert.alert('No se pudo responder', (e as Error).message));
  };

  const cancelar = (s: api.Solicitud) =>
    Alert.alert('Cancelar solicitud', `¿Cancelar la solicitud a ${s.nombre}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancelar solicitud',
        style: 'destructive',
        onPress: () =>
          api
            .cancelarSolicitud(s.id)
            .then(cargar)
            .catch((e) => Alert.alert('No se pudo cancelar', (e as Error).message)),
      },
    ]);

  const quitar = (a: api.Amigo) =>
    Alert.alert('Quitar amigo', `¿Quitar a ${a.nombre} de tus amigos? Dejarán de ser amigos los dos.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () =>
          api
            .quitarAmigo(a.id)
            .then(cargar)
            .catch((e) => Alert.alert('No se pudo quitar', (e as Error).message)),
      },
    ]);

  // mirar la partida de un amigo: la pantalla del juego la muestra desde su lugar, sin jugar
  const [abriendo, setAbriendo] = useState('');
  const verPartida = (a: api.Amigo) => {
    if (!a.sala || abriendo) return;
    setAbriendo(a.id);
    api
      .verSala(a.sala)
      .then((s) => {
        guardarSala({ ...s, jugadores: s.jugadores.map((j) => ({ ...j, tu: j.user_id === a.id })) });
        router.push({ pathname: '/juego', params: { modo: 'linea', dificultad: s.dificultad, sala: s.id, ver: a.id } });
      })
      .catch((e) => {
        Alert.alert('No se pudo abrir la partida', (e as Error).message);
        cargar();
      })
      .finally(() => setAbriendo(''));
  };

  const conectados = amigos?.filter((a) => a.conectado) ?? [];
  const desconectados = amigos?.filter((a) => !a.conectado) ?? [];
  const recibidas = solicitudes.filter((x) => x.tipo === 'recibida');
  const enviadas = solicitudes.filter((x) => x.tipo === 'enviada');
  const buscando = busqueda.length >= 2;

  return (
    <SafeAreaView style={styles.pantalla} edges={['top', 'bottom']}>
      <View style={styles.cabeza}>
        <Pressable accessibilityLabel="Volver" onPress={() => router.back()} style={styles.icono}>
          <Flecha />
        </Pressable>
        <Text style={styles.titulo}>Amigos</Text>
      </View>

      {!conCuenta ? (
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={styles.vacio}>Inicia sesión para agregar amigos y ver cuándo están conectados.</Text>
          <Boton titulo="Iniciar sesión o crear cuenta" onPress={() => router.push('/login')} />
        </View>
      ) : (
        <>
          <View style={{ paddingHorizontal: 16 }}>
            <TextInput
              value={texto}
              onChangeText={(t) => {
                setTexto(t);
                if (t.trim().length < 2) setResultados(null);
              }}
              placeholder="Buscar jugador por nombre"
              placeholderTextColor={C.apagado2}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.buscador}
              accessibilityLabel="Buscar jugador por nombre"
            />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
            {error ? <Text style={styles.vacio}>{error}</Text> : null}

            {buscando ? (
              resultados == null ? (
                <ActivityIndicator color={C.tinta} />
              ) : resultados.length === 0 ? (
                <Text style={styles.vacio}>Nadie con ese nombre.</Text>
              ) : (
                resultados.map((j) => {
                  const av = { ...AVATAR_DEFAULT, ...j.avatar };
                  return (
                    <View key={j.id} style={styles.fila}>
                      <MiniAvatar piel={av.piel} camisa={av.camisa} size={44} />
                      <Text style={styles.nombre} numberOfLines={1}>
                        {j.nombre}
                      </Text>
                      {j.estado === 'amigo' ? (
                        <Text style={styles.etiquetaFila}>Tu amigo</Text>
                      ) : j.estado === 'enviada' ? (
                        <Text style={styles.etiquetaFila}>Pendiente</Text>
                      ) : j.estado === 'recibida' ? (
                        <Pressable accessibilityLabel={`Aceptar a ${j.nombre}`} onPress={() => responder(j.id, true)} style={styles.agregar}>
                          <Text style={styles.agregarTxt}>Aceptar</Text>
                        </Pressable>
                      ) : (
                        <Pressable accessibilityLabel={`Agregar a ${j.nombre}`} onPress={() => agregar(j)} style={styles.agregar}>
                          <Text style={styles.agregarTxt}>Agregar</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })
              )
            ) : amigos == null ? (
              error ? null : <ActivityIndicator color={C.tinta} />
            ) : (
              <>
                {recibidas.length > 0 ? (
                  <>
                    <Etiqueta style={styles.seccion}>Solicitudes · {recibidas.length}</Etiqueta>
                    {recibidas.map((x) => {
                      const av = { ...AVATAR_DEFAULT, ...x.avatar };
                      return (
                        <View key={x.id} style={[styles.fila, styles.filaSolicitud]}>
                          <MiniAvatar piel={av.piel} camisa={av.camisa} size={44} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.nombre} numberOfLines={1}>
                              {x.nombre}
                            </Text>
                            <Text style={styles.estado}>Quiere ser tu amigo</Text>
                          </View>
                          <Pressable accessibilityLabel={`Rechazar a ${x.nombre}`} onPress={() => responder(x.id, false)} style={styles.rechazar}>
                            <Text style={styles.rechazarTxt}>Rechazar</Text>
                          </Pressable>
                          <Pressable accessibilityLabel={`Aceptar a ${x.nombre}`} onPress={() => responder(x.id, true)} style={styles.agregar}>
                            <Text style={styles.agregarTxt}>Aceptar</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </>
                ) : null}
                {amigos.length === 0 ? <Text style={styles.vacio}>Todavía no tienes amigos. Búscalos por su nombre de jugador.</Text> : null}
              </>
            )}
            {!buscando && amigos && amigos.length > 0 ? (
              <>
                <Etiqueta style={styles.seccion}>Conectados · {conectados.length}</Etiqueta>
                {conectados.length === 0 ? <Text style={styles.vacioChico}>Ninguno ahora.</Text> : null}
                {conectados.map((a) => (
                  <FilaAmigo key={a.id} amigo={a} onQuitar={() => quitar(a)} onVer={() => verPartida(a)} abriendo={abriendo === a.id} />
                ))}
                <Etiqueta style={styles.seccion}>Desconectados · {desconectados.length}</Etiqueta>
                {desconectados.length === 0 ? <Text style={styles.vacioChico}>Todos están conectados.</Text> : null}
                {desconectados.map((a) => (
                  <FilaAmigo key={a.id} amigo={a} onQuitar={() => quitar(a)} />
                ))}
                <Text style={styles.nota}>Mantén presionado a un amigo para quitarlo.</Text>
              </>
            ) : null}
            {!buscando && enviadas.length > 0 ? (
              <>
                <Etiqueta style={styles.seccion}>Enviadas · {enviadas.length}</Etiqueta>
                {enviadas.map((x) => {
                  const av = { ...AVATAR_DEFAULT, ...x.avatar };
                  return (
                    <Pressable key={x.id} onLongPress={() => cancelar(x)} accessibilityHint="Mantén presionado para cancelar la solicitud" style={[styles.fila, { opacity: 0.75 }]}>
                      <MiniAvatar piel={av.piel} camisa={av.camisa} size={44} />
                      <Text style={[styles.nombre, { flex: 1 }]} numberOfLines={1}>
                        {x.nombre}
                      </Text>
                      <Text style={styles.etiquetaFila}>Pendiente</Text>
                    </Pressable>
                  );
                })}
              </>
            ) : null}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

function FilaAmigo({ amigo, onQuitar, onVer, abriendo }: { amigo: api.Amigo; onQuitar: () => void; onVer?: () => void; abriendo?: boolean }) {
  const av = { ...AVATAR_DEFAULT, ...amigo.avatar };
  const jugando = amigo.conectado && !!amigo.sala;
  return (
    <Pressable onLongPress={onQuitar} accessibilityHint="Mantén presionado para quitarlo de tus amigos" style={[styles.fila, !amigo.conectado && { opacity: 0.75 }]}>
      <View>
        <MiniAvatar piel={av.piel} camisa={av.camisa} size={44} />
        <View style={[styles.punto, { backgroundColor: amigo.conectado ? C.turquesa : C.apagado2 }]} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.nombre} numberOfLines={1}>
          {amigo.nombre}
        </Text>
        <Text style={[styles.estado, jugando && { color: C.turquesa }]}>{jugando ? 'Jugando una partida' : amigo.conectado ? 'Conectado' : haceCuanto(amigo.visto)}</Text>
      </View>
      {jugando && onVer ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Ver la partida de ${amigo.nombre}`} onPress={onVer} disabled={abriendo} style={styles.agregar}>
          {abriendo ? <ActivityIndicator color={C.fondo} /> : <Text style={styles.agregarTxt}>Ver partida</Text>}
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.pantalla },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 8 },
  icono: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.tarjeta, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: F.titulo, fontSize: 28, lineHeight: 38, color: C.tinta },
  buscador: { height: 48, borderRadius: 14, backgroundColor: C.tarjeta, paddingHorizontal: 16, fontFamily: F.texto, fontSize: 16, color: C.texto },
  seccion: { color: C.tinta2, marginTop: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.tarjeta, borderRadius: 16, padding: 10 },
  punto: { position: 'absolute', right: -1, bottom: -1, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: C.tarjeta },
  nombre: { flexShrink: 1, fontFamily: F.fuerte, fontSize: 16, color: C.texto },
  estado: { fontFamily: F.texto, fontSize: 13, color: C.apagado },
  agregar: { marginLeft: 'auto', backgroundColor: C.amarillo, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  agregarTxt: { fontFamily: F.fuerte, fontSize: 14, color: C.fondo },
  etiquetaFila: { marginLeft: 'auto', fontFamily: F.fuerte, fontSize: 13, color: C.apagado },
  filaSolicitud: { borderWidth: 2, borderColor: C.amarillo },
  rechazar: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
  rechazarTxt: { fontFamily: F.fuerte, fontSize: 14, color: C.apagado },
  vacio: { fontFamily: F.fuerte, fontSize: 15, color: C.tinta2, textAlign: 'center', paddingVertical: 16 },
  vacioChico: { fontFamily: F.texto, fontSize: 14, color: C.tinta2 },
  nota: { fontFamily: F.texto, fontSize: 13, color: C.tinta2, textAlign: 'center', marginTop: 12 },
});

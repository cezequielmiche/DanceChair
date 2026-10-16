// Ajustes (desde el engrane del inicio): tu cuenta, el sonido, la dificultad de los bots, acerca de y cerrar sesión.
import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import * as api from '@/lib/api';
import { useJugador } from '@/store/jugador';
import { Boton, Etiqueta, Interruptor, Opciones } from '@/ui/comunes';
import { Flecha } from '@/ui/iconos';
import { C, F } from '@/ui/tema';

export default function Ajustes() {
  const { modo, nombre, salir, silencio, setSilencio, dificultad, setDificultad } = useJugador();
  const conCuenta = modo === 'cuenta';
  const [correo, setCorreo] = useState('');

  useEffect(() => {
    if (conCuenta) api.usuarioActual().then((u) => setCorreo(u?.email ?? '')).catch(() => {});
  }, [conCuenta]);

  const cerrarSesion = () => {
    const [titulo, texto] = conCuenta
      ? ['Cerrar sesión', 'Tu avatar, monedas y compras quedan guardados en tu cuenta.']
      : ['Salir', 'No tienes cuenta: tu avatar, monedas y compras de este teléfono se borrarán.'];
    Alert.alert(titulo, texto, [
      { text: 'Cancelar', style: 'cancel' },
      { text: titulo, style: 'destructive', onPress: () => salir().then(() => router.replace('/login')) },
    ]);
  };

  return (
    <SafeAreaView style={styles.pantalla} edges={['top', 'bottom']}>
      <View style={styles.cabeza}>
        <Pressable accessibilityLabel="Volver" onPress={() => router.back()} style={styles.icono}>
          <Flecha />
        </Pressable>
        <Text style={styles.titulo}>Ajustes</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        <Etiqueta style={{ color: C.tinta2 }}>Cuenta</Etiqueta>
        <View style={styles.caja}>
          <Text style={styles.nombre}>{nombre}</Text>
          <Text style={styles.detalle}>{conCuenta ? correo || '…' : 'Sin cuenta: juegas solo en este teléfono.'}</Text>
          {!conCuenta ? <Boton titulo="Iniciar sesión o crear cuenta" onPress={() => router.push('/login')} style={{ marginTop: 12 }} /> : null}
        </View>

        <Etiqueta style={{ color: C.tinta2 }}>Juego</Etiqueta>
        <View style={styles.caja}>
          <Interruptor
            titulo="Música y sonidos"
            valor={!silencio}
            onCambio={(v) => setSilencio(!v)}
          />
        </View>

        <Etiqueta style={{ color: C.tinta2 }}>Dificultad de los bots</Etiqueta>
        <View style={[styles.caja, { gap: 12 }]}>
          <Opciones items={[['Fácil', 'Fácil'], ['Normal', 'Normal'], ['Difícil', 'Difícil']]} valor={dificultad} onCambio={setDificultad} />
          <Text style={styles.detalle}>Qué tan rápido se sientan los bots cuando juegas sin internet. En las partidas en línea todos juegan en Normal.</Text>
        </View>

        <Etiqueta style={{ color: C.tinta2 }}>Acerca de</Etiqueta>
        <View style={[styles.caja, { gap: 12 }]}>
          <View style={styles.app}>
            <Image source={require('../../assets/images/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
            <View style={{ flex: 1 }}>
              <Text style={styles.nombre}>{Constants.expoConfig?.name ?? 'Sillas Bailarinas'}</Text>
              <Text style={styles.detalle}>Versión {Constants.expoConfig?.version ?? '1.0.0'}</Text>
            </View>
          </View>
          <Text style={styles.detalle}>
            El juego de las sillas musicales en tu teléfono: baila alrededor de las sillas y, cuando pare la música, toca Sentarse antes que los demás. Juega contra bots
            sin internet o en salas en línea con tus amigos.
          </Text>
          <Text style={styles.detalle}>La música y los sonidos fueron hechos para este juego.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/reglas')} style={styles.fila}>
            <Text style={styles.filaTxt}>Reglas del juego</Text>
            <View style={{ transform: [{ rotate: '180deg' }] }}>
              <Flecha size={18} color={C.apagado} />
            </View>
          </Pressable>
        </View>

        <View style={{ height: 16 }} />
        <Boton tipo="secundario" titulo={conCuenta ? 'Cerrar sesión' : 'Salir'} onPress={cerrarSesion} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.pantalla },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 8 },
  icono: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.tarjeta, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: F.titulo, fontSize: 28, lineHeight: 38, color: C.tinta },
  caja: { backgroundColor: C.tarjeta, borderRadius: 16, padding: 16 },
  nombre: { fontFamily: F.fuerte, fontSize: 18, color: C.texto },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.linea },
  filaTxt: { fontFamily: F.fuerte, fontSize: 16, color: C.texto },
  app: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 56, height: 56, borderRadius: 14 },
  detalle: { fontFamily: F.texto, fontSize: 14, color: C.apagado, marginTop: 2 },
});

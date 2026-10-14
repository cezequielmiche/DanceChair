// Ajustes (desde el engrane del inicio): tu cuenta, el sonido y cerrar sesión.
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import * as api from '@/lib/api';
import { useJugador } from '@/store/jugador';
import { Boton, Etiqueta, Interruptor } from '@/ui/comunes';
import { Flecha } from '@/ui/iconos';
import { C, F } from '@/ui/tema';

export default function Ajustes() {
  const { modo, nombre, salir, silencio, setSilencio } = useJugador();
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
  detalle: { fontFamily: F.texto, fontSize: 14, color: C.apagado, marginTop: 2 },
});

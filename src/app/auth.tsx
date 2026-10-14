// Aquí vuelven los enlaces de Supabase (confirmar el correo, Google): cambia el código por la sesión y va al inicio.
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import * as api from '@/lib/api';
import { useJugador } from '@/store/jugador';
import { Boton } from '@/ui/comunes';
import { C, F } from '@/ui/tema';

export default function VolverDeEnlace() {
  const { code, error_description } = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    (async () => {
      if (error_description) return setAviso(`El enlace no sirvió: ${error_description}`);
      try {
        // si ya hay sesión (por ejemplo, Google ya la cambió) no hace falta el código
        if (!(await api.usuarioActual())) {
          if (!code) throw new Error('sin código');
          await api.completarEnlace(code);
        }
        await useJugador.getState().entrarConCuenta();
        router.replace('/');
      } catch {
        // el código solo se puede cambiar en el teléfono donde se creó la cuenta; el correo igual quedó confirmado
        setAviso('Tu correo quedó confirmado. Inicia sesión con tu correo y contraseña.');
      }
    })();
  }, [code, error_description]);

  return (
    <View style={styles.pantalla}>
      {aviso ? (
        <>
          <Text style={styles.texto}>{aviso}</Text>
          <Boton titulo="Ir a iniciar sesión" onPress={() => router.replace('/login')} style={{ alignSelf: 'stretch' }} />
        </>
      ) : (
        <>
          <ActivityIndicator color={C.tinta} size="large" />
          <Text style={styles.texto}>Entrando…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.pantalla, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 },
  texto: { fontFamily: F.fuerte, fontSize: 17, color: C.tinta, textAlign: 'center' },
});

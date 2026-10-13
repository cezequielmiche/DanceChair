// Iniciar sesión / crear cuenta. Sin servidor configurado se juega sin cuenta (modo local).
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar3D } from '@/avatar/Avatar3D';
import { AVATAR_CHICA, AVATAR_CHICO } from '@/avatar/types';
import * as api from '@/lib/api';
import { hayServidor } from '@/lib/supabase';
import { useJugador } from '@/store/jugador';
import { Boton } from '@/ui/comunes';
import { Ojo } from '@/ui/iconos';
import { C, F } from '@/ui/tema';

const ELENCO = [
  { config: { ...AVATAR_CHICA, audifonos: 'si' as const }, anim: 'caminar' as const, x: -1.15 },
  { config: { ...AVATAR_CHICO, piel: '#8D5A3B', colorPelo: '#1B1410', disfraz: 'dino' as const }, anim: 'brazos' as const, x: 0 },
  { config: { ...AVATAR_CHICO, cuerpo: 'mujer' as const, pelo: 'corto' as const, colorPelo: '#7A4FD6', camisa: '#4ED6B0', lentes: 'si' as const }, anim: 'balanceo' as const, x: 1.15 },
];

export default function Login() {
  const entrarLocal = useJugador((s) => s.entrarLocal);
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [nombre, setNombre] = useState('');
  const [ver, setVer] = useState(false);
  const [intento, setIntento] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const crear = modo === 'crear';
  const correoOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());
  const claveOk = clave.length >= 6;
  const nombreOk = !crear || nombre.trim().length >= 2;
  const valido = correoOk && claveOk && nombreOk;
  const problema = !nombreOk
    ? 'Escribe un nombre de jugador (mínimo 2 letras).'
    : !correoOk
      ? 'Revisa tu correo, parece incompleto.'
      : !claveOk
        ? 'La contraseña necesita al menos 6 caracteres.'
        : '';

  const correr = async (fn: () => Promise<unknown>) => {
    setError('');
    setOcupado(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const enviar = () => {
    setIntento(true);
    if (!valido) return;
    correr(async () => {
      if (crear) {
        const r = await api.crearCuenta(correo, clave, nombre);
        if (r.necesitaConfirmar) {
          setAviso('Te enviamos un correo para confirmar tu cuenta. Luego inicia sesión.');
          setModo('entrar');
          return;
        }
      } else await api.entrarConCorreo(correo, clave);
      await useJugador.getState().entrarConCuenta();
      router.replace('/');
    });
  };

  const sinCuenta = () => {
    entrarLocal(nombre.trim() || 'Tú');
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.pantalla} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
          <Avatar3D avatares={ELENCO} style={styles.elenco} girar={false} />
          <Text style={styles.titulo}>Sillas Bailarinas</Text>
          <Text style={styles.sub}>Baila, corre y no te quedes sin silla.</Text>

          {hayServidor ? (
            <>
              {crear && (
                <Campo etiqueta="Nombre de jugador">
                  <TextInput value={nombre} onChangeText={setNombre} maxLength={12} placeholder="Cómo te verán en el ranking" placeholderTextColor={C.apagado2} style={styles.input} />
                </Campo>
              )}
              <Campo etiqueta="Correo">
                <TextInput
                  value={correo}
                  onChangeText={setCorreo}
                  placeholder="tucorreo@ejemplo.com"
                  placeholderTextColor={C.apagado2}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  style={[styles.input, intento && !correoOk && styles.mal]}
                />
              </Campo>
              <Campo etiqueta="Contraseña">
                <View>
                  <TextInput
                    value={clave}
                    onChangeText={setClave}
                    placeholder="Mínimo 6 caracteres"
                    placeholderTextColor={C.apagado2}
                    secureTextEntry={!ver}
                    autoComplete={crear ? 'new-password' : 'current-password'}
                    style={[styles.input, { paddingRight: 52 }, intento && !claveOk && styles.mal]}
                  />
                  <Pressable accessibilityLabel={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} onPress={() => setVer(!ver)} style={styles.ojo}>
                    <Ojo />
                  </Pressable>
                </View>
              </Campo>

              {(intento && problema) || error ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {error || problema}
                </Text>
              ) : null}
              {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}

              {!crear && (
                <Pressable
                  style={{ alignSelf: 'flex-end', paddingVertical: 6 }}
                  onPress={() => (correoOk ? correr(() => api.recuperarClave(correo).then(() => setAviso('Te enviamos un correo para cambiar tu contraseña.'))) : setError('Escribe tu correo primero.'))}
                >
                  <Text style={styles.link}>¿Olvidaste tu contraseña?</Text>
                </Pressable>
              )}

              <Boton titulo={ocupado ? 'Un momento…' : crear ? 'Crear cuenta' : 'Entrar'} onPress={enviar} deshabilitado={ocupado} />

              <View style={styles.o}>
                <View style={styles.raya} />
                <Text style={styles.oTxt}>o</Text>
                <View style={styles.raya} />
              </View>
              <Boton tipo="secundario" titulo="Continuar con Google" onPress={() => correr(api.entrarConGoogle)} deshabilitado={ocupado} />
              {Platform.OS === 'ios' ? (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                  cornerRadius={14}
                  style={{ height: 52 }}
                  onPress={() => correr(api.entrarConApple)}
                />
              ) : null}

              <View style={styles.cambiar}>
                <Text style={styles.oTxt}>{crear ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}</Text>
                <Pressable
                  onPress={() => {
                    setModo(crear ? 'entrar' : 'crear');
                    setIntento(false);
                    setError('');
                  }}
                  style={{ padding: 10 }}
                >
                  <Text style={styles.link}>{crear ? 'Inicia sesión' : 'Crear cuenta'}</Text>
                </Pressable>
              </View>
              <Pressable onPress={sinCuenta} style={{ alignSelf: 'center', padding: 8 }}>
                <Text style={[styles.oTxt, { textDecorationLine: 'underline' }]}>Jugar sin cuenta</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Campo etiqueta="Nombre de jugador">
                <TextInput value={nombre} onChangeText={setNombre} maxLength={12} placeholder="Tu nombre" placeholderTextColor={C.apagado2} style={styles.input} />
              </Campo>
              <Boton titulo="Jugar" onPress={sinCuenta} />
              <Text style={styles.nota}>Modo local: tu avatar, monedas y puntos se guardan en este teléfono. Conecta Supabase (archivo .env) para cuentas y ranking en línea.</Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.fondo },
  contenido: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  elenco: { height: 230, marginHorizontal: -24 },
  titulo: { fontFamily: F.titulo, fontSize: 40, lineHeight: 44, color: C.amarillo, textAlign: 'center' },
  sub: { fontFamily: F.texto, fontSize: 15, color: C.texto2, textAlign: 'center', marginBottom: 6 },
  etiqueta: { fontFamily: F.fuerte, fontSize: 13, color: C.apagado },
  input: { height: 50, borderRadius: 14, borderWidth: 2, borderColor: C.borde, backgroundColor: C.tarjeta, color: '#FFF', paddingHorizontal: 16, fontFamily: F.texto, fontSize: 16 },
  mal: { borderColor: C.coral },
  ojo: { position: 'absolute', right: 3, top: 3, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  error: { padding: 10, borderRadius: 12, backgroundColor: C.errorFondo, color: C.errorTexto, fontFamily: F.fuerte, fontSize: 14 },
  aviso: { padding: 10, borderRadius: 12, backgroundColor: C.turquesaFondo, color: C.turquesa, fontFamily: F.fuerte, fontSize: 14 },
  link: { fontFamily: F.fuerte, fontSize: 14, color: C.amarillo },
  o: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  raya: { flex: 1, height: 2, backgroundColor: C.linea },
  oTxt: { fontFamily: F.texto, fontSize: 14, color: C.texto2 },
  cambiar: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  nota: { fontFamily: F.texto, fontSize: 13, color: C.apagado2, textAlign: 'center' },
});

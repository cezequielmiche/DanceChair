// Piezas de interfaz que se repiten: botones, pestañas, muestras de color, aviso flotante.
import React, { useEffect } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

import { C, F } from './tema';

export function Boton({
  titulo,
  onPress,
  tipo = 'principal',
  deshabilitado,
  style,
  children,
  grande,
}: {
  titulo?: string;
  onPress?: () => void;
  tipo?: 'principal' | 'secundario' | 'ok';
  deshabilitado?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  grande?: boolean;
}) {
  const fondo = tipo === 'principal' ? C.amarillo : tipo === 'ok' ? C.turquesa : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={deshabilitado}
      onPress={onPress}
      style={({ pressed }) => [
        styles.boton,
        grande && { height: 64, borderRadius: 20 },
        { backgroundColor: fondo, opacity: deshabilitado ? 0.6 : 1, transform: [{ translateY: pressed ? 2 : 0 }] },
        tipo === 'secundario' && { borderWidth: 2, borderColor: C.borde, backgroundColor: C.tarjeta },
        tipo !== 'secundario' && !deshabilitado && styles.sombra,
        style,
      ]}
    >
      {children}
      {titulo ? <Text style={[styles.botonTxt, grande && { fontSize: 28 }, tipo === 'secundario' && { color: C.texto, fontFamily: F.fuerte, fontSize: 16 }]}>{titulo}</Text> : null}
    </Pressable>
  );
}

export function Pestanas<T extends string>({ items, valor, onCambio }: { items: [T, string][]; valor: T; onCambio: (v: T) => void }) {
  return (
    <View style={styles.pestanas} accessibilityRole="tablist">
      {items.map(([v, l]) => {
        const on = v === valor;
        return (
          <Pressable key={v} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onCambio(v)} style={[styles.pestana, on && { backgroundColor: C.amarillo }]}>
            <Text style={[styles.pestanaTxt, { color: on ? C.fondo : C.texto2 }]}>{l}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Opciones<T extends string>({ items, valor, onCambio }: { items: [T, string][]; valor: T; onCambio: (v: T) => void }) {
  return (
    <View style={styles.pestanas} accessibilityRole="radiogroup">
      {items.map(([v, l]) => {
        const on = v === valor;
        return (
          <Pressable key={v} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onCambio(v)} style={[styles.pestana, { height: 44 }, on && { backgroundColor: C.amarillo }]}>
            <Text style={[styles.pestanaTxt, { fontSize: 15, color: on ? C.fondo : C.texto2 }]}>{l}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Muestras({ colores, valor, onCambio }: { colores: readonly (readonly [string, string])[]; valor?: string; onCambio: (c: string) => void }) {
  return (
    <View style={styles.muestras}>
      {colores.map(([c, nombre]) => (
        <Pressable
          key={c}
          accessibilityRole="radio"
          accessibilityLabel={nombre}
          accessibilityState={{ checked: c === valor }}
          onPress={() => onCambio(c)}
          style={[styles.muestra, { borderColor: c === valor ? '#FFFFFF' : 'transparent' }]}
        >
          <View style={[styles.muestraColor, { backgroundColor: c }]} />
        </Pressable>
      ))}
    </View>
  );
}

export function Interruptor({ titulo, valor, onCambio }: { titulo: string; valor: boolean; onCambio: (v: boolean) => void }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: valor }} onPress={() => onCambio(!valor)} style={styles.interruptor}>
      <Text style={styles.interruptorTxt}>{titulo}</Text>
      <View style={[styles.riel, { backgroundColor: valor ? C.turquesa : '#3A4877', justifyContent: valor ? 'flex-end' : 'flex-start' }]}>
        <View style={styles.bolita} />
      </View>
    </Pressable>
  );
}

export function Etiqueta({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.etiqueta, style]}>{children}</Text>;
}

/** Aviso verde arriba que se va solo. */
export function Aviso({ texto, onFin }: { texto: string; onFin: () => void }) {
  useEffect(() => {
    if (!texto) return;
    const t = setTimeout(onFin, 2400);
    return () => clearTimeout(t);
  }, [texto, onFin]);
  if (!texto) return null;
  return (
    <View style={styles.aviso} pointerEvents="none" accessibilityLiveRegion="polite">
      <Text style={styles.avisoTxt}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  boton: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  sombra: { shadowColor: '#000', shadowOpacity: 0.35, shadowOffset: { width: 0, height: 5 }, shadowRadius: 0, elevation: 4 },
  botonTxt: { fontFamily: F.titulo, fontSize: 22, color: C.fondo },
  pestanas: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 14, backgroundColor: C.tarjeta },
  pestana: { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pestanaTxt: { fontFamily: F.fuerte, fontSize: 14 },
  muestras: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  muestra: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, padding: 3 },
  muestraColor: { flex: 1, borderRadius: 20 },
  interruptor: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderColor: C.linea },
  interruptorTxt: { fontFamily: F.fuerte, fontSize: 15, color: C.texto },
  riel: { width: 48, height: 28, borderRadius: 14, padding: 3, flexDirection: 'row' },
  bolita: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' },
  etiqueta: { fontFamily: F.fuerte, fontSize: 13, color: C.apagado },
  aviso: { position: 'absolute', left: 16, right: 16, top: 64, zIndex: 30, padding: 14, borderRadius: 14, backgroundColor: C.turquesa },
  avisoTxt: { fontFamily: F.fuerte, fontSize: 14, color: C.fondo },
});

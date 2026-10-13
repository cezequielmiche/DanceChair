// Mis pasos: los pasos que tienes y cuáles 4 van en la rueda del juego.
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar3D } from '@/avatar/Avatar3D';
import type { DanceId } from '@/avatar/types';
import { PASOS, paso as datosPaso } from '@/data/catalogo';
import { Rueda } from '@/game/Rueda';
import { useJugador } from '@/store/jugador';
import { Aviso, Boton, Etiqueta } from '@/ui/comunes';
import { Candado, Moneda } from '@/ui/iconos';
import { C, F, fmt, RUEDA } from '@/ui/tema';

export default function MisPasos() {
  const { avatar, tiene, favoritos, setFavorito } = useJugador();
  const mios = PASOS.filter((p) => tiene.includes(p.id));
  const faltan = PASOS.filter((p) => !tiene.includes(p.id));
  const [sel, setSel] = useState<DanceId>(favoritos.find(Boolean) ?? 'brazos');
  const [lugar, setLugar] = useState<number | null>(null);
  const [aviso, setAviso] = useState('');
  const elegido = datosPaso(sel)!;
  const enRueda = favoritos.indexOf(sel);

  const ponerEn = (i: number, id: DanceId) => {
    setFavorito(i, id);
    setLugar(null);
    setAviso(`${datosPaso(id)!.nombre} va en la rueda`);
  };

  const tocarPaso = (id: DanceId) => {
    setSel(id);
    if (lugar != null) ponerEn(lugar, id);
  };

  const botonRueda = () => {
    if (enRueda >= 0) {
      setFavorito(enRueda, null);
      setAviso(`${elegido.nombre} salió de la rueda`);
      return;
    }
    const libre = favoritos.findIndex((f) => !f);
    if (libre >= 0) ponerEn(libre, sel);
    else setAviso('La rueda está llena: toca un lugar de la rueda para cambiarlo.');
  };

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <Aviso texto={aviso} onFin={() => setAviso('')} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={styles.titulo}>Mis pasos</Text>
        <View style={styles.hero}>
          <Avatar3D avatares={[{ config: avatar, anim: sel }]} style={{ width: 130, height: 170 }} girar={false} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.nombre}>{elegido.nombre}</Text>
            <Text style={styles.texto}>{elegido.desc}</Text>
            <Boton tipo={enRueda >= 0 ? 'secundario' : 'principal'} titulo={enRueda >= 0 ? 'Quitar de la rueda' : 'Agregar a la rueda'} onPress={botonRueda} style={{ height: 44 }} />
          </View>
        </View>

        <Etiqueta>Tu rueda en el juego {lugar != null ? '· elige un paso para ese lugar' : '· toca un lugar para cambiarlo'}</Etiqueta>
        <View style={{ alignItems: 'center' }}>
          <Rueda
            favoritos={favoritos.map((f) => (f ? datosPaso(f) ?? null : null))}
            tam={220}
            habilitado
            marcado={lugar}
            onPaso={(i, p) => {
              setSel(p.id);
              setLugar(lugar === i ? null : i);
            }}
            onVacio={(i) => setLugar(lugar === i ? null : i)}
          >
            <View style={styles.centro}>
              <Text style={styles.centroTxt}>Sentarse</Text>
            </View>
          </Rueda>
        </View>

        <Etiqueta>Los que tienes</Etiqueta>
        <View style={styles.rejilla}>
          {mios.map((p) => {
            const i = favoritos.indexOf(p.id);
            return (
              <Pressable key={p.id} onPress={() => tocarPaso(p.id)} style={[styles.carta, { borderColor: sel === p.id ? C.amarillo : 'transparent' }]}>
                <Text style={styles.cartaNombre}>{p.nombre}</Text>
                {i >= 0 ? (
                  <Text style={[styles.marca, { backgroundColor: RUEDA[i].c, color: RUEDA[i].t }]}>En la rueda</Text>
                ) : (
                  <Text style={[styles.marca, { color: C.turquesa }]}>Tuyo</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {faltan.length > 0 && (
          <>
            <Etiqueta>Consíguelos en la tienda</Etiqueta>
            <View style={styles.rejilla}>
              {faltan.map((p) => (
                <Pressable key={p.id} onPress={() => router.push({ pathname: '/tienda', params: { sel: p.id } })} style={[styles.carta, { opacity: 0.8, borderColor: 'transparent' }]}>
                  <Candado />
                  <Text style={styles.cartaNombre}>{p.nombre}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Moneda size={12} />
                    <Text style={[styles.marca, { color: '#FFF' }]}>{fmt(p.precio)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.fondo },
  titulo: { fontFamily: F.titulo, fontSize: 28, color: C.amarillo },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.tarjeta, borderRadius: 20, padding: 10 },
  nombre: { fontFamily: F.titulo, fontSize: 26, color: C.texto },
  texto: { fontFamily: F.texto, fontSize: 13, color: C.texto2 },
  centro: { width: 104, height: 104, borderRadius: 52, backgroundColor: C.tarjeta2, alignItems: 'center', justifyContent: 'center' },
  centroTxt: { fontFamily: F.titulo, fontSize: 20, color: C.apagado2 },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  carta: { width: '31%', flexGrow: 1, minHeight: 76, borderRadius: 16, borderWidth: 3, backgroundColor: C.tarjeta, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8 },
  cartaNombre: { fontFamily: F.fuerte, fontSize: 14, color: C.texto },
  marca: { fontFamily: F.fuerte, fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
});

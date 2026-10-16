// Reglas del juego (desde Ajustes → Acerca de). Los números salen de la lógica del juego para no desfasarse.
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CASTIGO_ADELANTO } from '@/game/juego';
import { TOPE_DIARIO_BOTS } from '@/game/modo';
import { Etiqueta } from '@/ui/comunes';
import { Flecha } from '@/ui/iconos';
import { C, F } from '@/ui/tema';

const SECCIONES: [string, string[]][] = [
  [
    'Cómo se juega',
    [
      'Hay una silla menos que jugadores. Mientras suena la música, todos bailan alrededor de las sillas.',
      'Cuando la música para aparece ¡ALTO!: toca Sentarse lo más rápido que puedas. Corres a la silla libre más cercana.',
      'El que se queda sin silla sale de la partida y se quita una silla para la siguiente ronda.',
      'Gana el último que queda con silla.',
    ],
  ],
  [
    'No te adelantes',
    [
      `Si tocas Sentarse mientras la música todavía suena, te adelantaste: no podrás sentarte hasta ${CASTIGO_ADELANTO / 1000} segundo después de ese toque.`,
      'Espera a que pare la música: tocar sin parar te hace perder la silla.',
    ],
  ],
  [
    'Pasos de baile',
    [
      'Mientras suena la música, toca un paso de la rueda para bailarlo. Cada paso suma estilo: puntos y monedas.',
      'No se pueden encimar: espera a que termine un paso para hacer el siguiente.',
    ],
  ],
  [
    'Sin internet: contra bots',
    [
      'Si no hay internet juegas contra bots. Elige qué tan rápido se sientan en Ajustes → Dificultad de los bots.',
      `Contra bots solo se ganan monedas, hasta ${TOPE_DIARIO_BOTS} por día. No dan puntos de ranking.`,
    ],
  ],
  [
    'En línea: salas',
    [
      'Con internet y una cuenta juegas en salas de hasta 6 personas. La partida empieza cuando se llena la sala o a los 20 segundos; los lugares vacíos se completan con bots.',
      'Entre rondas hay una cuenta de 3 segundos y la siguiente ronda empieza sola.',
      'Si quedas fuera puedes quedarte a ver cómo termina la partida.',
    ],
  ],
  [
    'Premios',
    [
      'Monedas: +4 por cada ronda que sobrevives, +6 por ganar y +2 por cada 15 pasos de baile.',
      'Puntos de ranking (solo en línea): +4 por cada persona que queda fuera mientras sigues, +10 por ganar si había otra persona en la sala y +1 por paso de baile (uno por ronda).',
      'Eliminar a un bot no da puntos de ranking, pero sí monedas.',
      'Usa tus monedas en la tienda para vestir a tu personaje y comprar pasos de baile.',
    ],
  ],
];

export default function Reglas() {
  return (
    <SafeAreaView style={styles.pantalla} edges={['top', 'bottom']}>
      <View style={styles.cabeza}>
        <Pressable accessibilityLabel="Volver" onPress={() => router.back()} style={styles.icono}>
          <Flecha />
        </Pressable>
        <Text style={styles.titulo}>Reglas del juego</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        {SECCIONES.map(([titulo, puntos]) => (
          <React.Fragment key={titulo}>
            <Etiqueta style={{ color: C.tinta2 }}>{titulo}</Etiqueta>
            <View style={styles.caja}>
              {puntos.map((p) => (
                <View key={p} style={styles.punto}>
                  <View style={styles.bolita} />
                  <Text style={styles.texto}>{p}</Text>
                </View>
              ))}
            </View>
          </React.Fragment>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.pantalla },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 8 },
  icono: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.tarjeta, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: F.titulo, fontSize: 28, lineHeight: 38, color: C.tinta },
  caja: { backgroundColor: C.tarjeta, borderRadius: 16, padding: 16, gap: 10 },
  punto: { flexDirection: 'row', gap: 10 },
  bolita: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.amarillo, marginTop: 8 },
  texto: { flex: 1, fontFamily: F.texto, fontSize: 15, lineHeight: 21, color: C.texto2 },
});

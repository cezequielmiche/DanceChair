// Rueda de 4 pasos favoritos alrededor del botón central (Sentarse).
// Lugares: arriba-izq amarillo, arriba-der rojo, abajo-der verde, abajo-izq azul.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, Path, Text as SvgText, TextPath } from 'react-native-svg';

import type { Paso } from '@/data/catalogo';
import { F, RUEDA } from '@/ui/tema';

const CUARTOS: [number, number][] = [
  [180, 270],
  [270, 360],
  [0, 90],
  [90, 180],
];

type Props = {
  favoritos: (Paso | null)[];
  /** Tamaño total (ancho = alto). */
  tam: number;
  /** Paso que se está bailando (se llena de color). */
  activo?: string | null;
  /** Se pueden tocar los pasos (suena la música). */
  habilitado: boolean;
  /** Lugar elegido (en Mis pasos). */
  marcado?: number | null;
  onPaso?: (i: number, p: Paso) => void;
  /** Tocar un lugar vacío (solo en Mis pasos). Sin esto, los lugares vacíos se ven deshabilitados. */
  onVacio?: (i: number) => void;
  children?: React.ReactNode; // botón central
};

export function Rueda({ favoritos, tam, activo, habilitado, marcado, onPaso, onVacio, children }: Props) {
  const s = tam / 246;
  const cx = tam / 2;
  const cy = tam / 2;
  const RO = 123 * s;
  const RI = 66 * s;
  const RT = 95 * s;
  const rad = Math.PI / 180;
  const pt = (r: number, d: number) => `${(cx + r * Math.cos(d * rad)).toFixed(1)} ${(cy + r * Math.sin(d * rad)).toFixed(1)}`;

  return (
    <View style={{ width: tam, height: tam }}>
      <Svg width={tam} height={tam}>
        <Defs>
          {CUARTOS.map(([a0, a1], i) => {
            const arriba = i < 2;
            const d = arriba
              ? `M${pt(RT, a0 + 4)} A${RT} ${RT} 0 0 1 ${pt(RT, a1 - 4)}`
              : `M${pt(RT, a1 - 4)} A${RT} ${RT} 0 0 0 ${pt(RT, a0 + 4)}`;
            return <Path key={i} id={`arco${i}`} d={d} />;
          })}
        </Defs>
        {CUARTOS.map(([a0, a1], i) => {
          const p = favoritos[i];
          const k = RUEDA[i];
          const on = !!p && activo === p.id;
          let relleno = k.bg;
          let letra = '#FFFFFF';
          let borde = k.c;
          let guion: string | undefined;
          if (!p && onVacio) {
            relleno = '#18213A';
            letra = k.c;
            guion = '6 5';
          } else if (!p) {
            // en el juego: lugar sin paso, apagado y sin acción (los pasos se eligen en Mis pasos)
            relleno = '#1C2540';
            letra = '#5A6585';
            borde = '#2C3961';
          } else if (on) {
            relleno = k.c;
            letra = k.t;
          } else if (!habilitado && marcado == null) {
            borde = k.dim;
            letra = '#A9B6D6';
          }
          if (marcado === i) {
            borde = '#FFFFFF';
          }
          const d = `M${pt(RO, a0)} A${RO} ${RO} 0 0 1 ${pt(RO, a1)} L${pt(RI, a1)} A${RI} ${RI} 0 0 0 ${pt(RI, a0)} Z`;
          return (
            <React.Fragment key={i}>
              <Path d={d} fill={relleno} stroke={borde} strokeWidth={marcado === i ? 4 : 3} strokeDasharray={guion} />
              {/* textAnchor va en <Text>: en iOS se ignora en <TextPath> y el nombre empezaba a la mitad del arco y se cortaba.
                  Sin fontWeight: con una fuente propia, iOS cambia a la del sistema si además se pide un peso. */}
              <SvgText fill={letra} fontSize={(p ? 18 : 14) * s} fontFamily={F.titulo} textAnchor="middle">
                <TextPath href={`#arco${i}`} startOffset="50%">
                  {p ? p.nombre.toUpperCase() : onVacio ? '+ ELEGIR' : 'SIN PASO'}
                </TextPath>
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
      {CUARTOS.map(([a0, a1], i) => {
        const m = ((a0 + a1) / 2) * rad;
        const p = favoritos[i];
        const lado = 64 * s;
        return (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={p ? `Bailar ${p.nombre}` : onVacio ? 'Elegir un paso favorito' : 'Lugar sin paso'}
            accessibilityState={{ disabled: p ? !habilitado : !onVacio }}
            disabled={p ? !habilitado : !onVacio}
            onPress={() => (p ? onPaso?.(i, p) : onVacio?.(i))}
            style={[styles.hit, { width: lado, height: lado, borderRadius: lado / 2, left: cx + RT * Math.cos(m) - lado / 2, top: cy + RT * Math.sin(m) - lado / 2 }]}
          />
        );
      })}
      <View style={[StyleSheet.absoluteFill, styles.centro]} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { position: 'absolute' },
  centro: { alignItems: 'center', justifyContent: 'center' },
});

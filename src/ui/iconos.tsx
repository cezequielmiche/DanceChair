// Íconos dibujados con SVG (sin depender de fuentes de íconos).
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type P = { size?: number; color?: string };

export const Moneda = ({ size = 20 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={10} fill="#FFC233" stroke="#B9822A" strokeWidth={1.5} />
    <Circle cx={12} cy={12} r={6} fill="none" stroke="#B9822A" strokeWidth={1.5} />
  </Svg>
);

export const Pulgar = ({ size = 14, color = '#18213A', abajo = false }: P & { abajo?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={abajo ? { transform: [{ rotate: '180deg' }] } : undefined}>
    <Path d="M7 10v11H3V10h4zm2 11h8.5a2 2 0 0 0 2-1.6l1.4-7A2 2 0 0 0 18.9 10H14l.8-4.2A2 2 0 0 0 12.8 3.5L9 10v11z" fill={color} />
  </Svg>
);

export const Trofeo = ({ size = 22, color = '#A9B6D6' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M8 21h8" />
    <Path d="M12 17v4" />
    <Path d="M7 4h10v5a5 5 0 0 1-10 0z" />
    <Path d="M17 5h3v2a3 3 0 0 1-3 3" />
    <Path d="M7 5H4v2a3 3 0 0 0 3 3" />
  </Svg>
);

export const Persona = ({ size = 22, color = '#A9B6D6' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={8} r={4} />
    <Path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </Svg>
);

export const Estrella = ({ size = 22, color = '#A9B6D6' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21.1l1.4-7L2 9.3l7-.8z" />
  </Svg>
);

export const Bolsa = ({ size = 22, color = '#A9B6D6' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 8h14l-1 12H6z" />
    <Path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </Svg>
);

export const Jugar = ({ size = 24, color = '#18213A' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z" fill={color} />
  </Svg>
);

export const Flecha = ({ size = 22, color = '#E9EEF8' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);

export const Bocina = ({ size = 22, color = '#E9EEF8', mudo = false }: P & { mudo?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M11 5L6 9H2v6h4l5 4z" />
    {mudo ? <Path d="M23 9l-6 6M17 9l6 6" /> : <Path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />}
  </Svg>
);

export const Candado = ({ size = 16, color = '#A9B6D6' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
    <Path d="M6 11h12v10H6z" />
    <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Svg>
);

export const Ojo = ({ size = 22, color = '#A9B6D6' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <Circle cx={12} cy={12} r={3} />
  </Svg>
);

export const Check = ({ size = 20, color = '#18213A' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 12l5 5L20 7" />
  </Svg>
);

export const Engrane = ({ size = 22, color = '#E9EEF8' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={3} />
    <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
);

export const Amigos = ({ size = 22, color = '#E9EEF8' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={9} cy={7} r={4} />
    <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
  </Svg>
);

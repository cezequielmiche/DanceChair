// Colores y tipografías del juego (los mismos del prototipo).
export const C = {
  fondo: '#18213A',
  tarjeta: '#202B4A',
  tarjeta2: '#2C3961',
  borde: '#33406A',
  linea: '#26335A',
  piso: '#223056',
  amarillo: '#FFC233',
  turquesa: '#4ED6B0',
  turquesaFondo: '#1F4A43',
  coral: '#F2784B',
  rojo: '#E54B4B',
  rosa: '#F25F9C',
  celeste: '#7FD1FF',
  lila: '#B18CFF',
  texto: '#E9EEF8',
  texto2: '#C9D3EA',
  apagado: '#A9B6D6',
  apagado2: '#8D9AC0',
  amarilloFondo: '#3A3320',
  errorFondo: '#3A2A3A',
  errorTexto: '#FFB3A6',
};

export const F = {
  titulo: 'Baloo2_800ExtraBold',
  tituloMedio: 'Baloo2_600SemiBold',
  texto: 'Nunito_700Bold',
  fuerte: 'Nunito_800ExtraBold',
  normal: 'Nunito_400Regular',
};

export const ETIQUETA_COLOR: Record<string, string> = {
  Gratis: '#4ED6B0',
  Nuevo: '#7FD1FF',
  Popular: '#F25F9C',
  Premium: '#FFC233',
  Tendencia: '#B18CFF',
  Leyenda: '#FF9F80',
};

/** Colores fijos de la rueda de pasos (arriba-izq, arriba-der, abajo-der, abajo-izq). */
export const RUEDA = [
  { c: '#FFC233', bg: '#3A3320', dim: '#7D6A2E', t: '#18213A' },
  { c: '#E54B4B', bg: '#3E2230', dim: '#743443', t: '#FFFFFF' },
  { c: '#3DBE6E', bg: '#1E3A33', dim: '#2D6449', t: '#18213A' },
  { c: '#3A7BD5', bg: '#1E2D50', dim: '#2D4878', t: '#FFFFFF' },
];

export const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

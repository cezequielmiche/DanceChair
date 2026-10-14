// Colores y tipografías del juego (los mismos del prototipo).
export const C = {
  /** Fondo de las pantallas (crema). Las tarjetas siguen en azul marino. */
  pantalla: '#F5EFE0',
  /** Texto que va directo sobre el fondo crema. */
  tinta: '#18213A',
  tinta2: '#4A5578',
  /** Enlaces y acentos sobre crema (el amarillo no se lee sobre crema). */
  acento: '#9A5B00',
  rayaCrema: '#E0D6BF',
  /** Azul marino: barra de pestañas y tinta oscura sobre botones amarillos. */
  fondo: '#18213A',
  /** Recuadros y tarjetas (antes #202B4A: muy oscuro, costaba ver los detalles). */
  tarjeta: '#3A4877',
  tarjeta2: '#2C3961',
  borde: '#33406A',
  linea: '#26335A',
  piso: '#223056',
  /** Piso claro de la pista del juego (donde están las sillas). */
  pista: '#8CA0D5',
  pistaAro: '#6B7FB8',
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
  apagado: '#BAC4E0',
  apagado2: '#A6B1D2',
  amarilloFondo: '#3A3320',
  errorFondo: '#3A2A3A',
  errorTexto: '#FFB3A6',
};

/**
 * Tipografías. Baloo (titulo) tiene letras muy altas: si se le pone lineHeight, que sea al menos 1.35 × fontSize,
 * o iOS recorta la parte de arriba de las letras (pasaba con la "D" de Dino en la tienda).
 */
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

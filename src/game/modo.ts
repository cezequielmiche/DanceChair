// Modo de la partida: sin internet (o sin servidor) se juega contra bots y solo se ganan monedas;
// con internet y cuenta, partidas en línea contra otros jugadores.
export type ModoPartida = 'bots' | 'linea';
/** Lo que pasa al tocar Jugar: 'sesion' = hay internet pero falta iniciar sesión para jugar en línea. */
export type Decision = ModoPartida | 'sesion';

export function elegirModo(o: { internet: boolean; servidor: boolean; cuenta: boolean }): Decision {
  if (!o.internet || !o.servidor) return 'bots';
  return o.cuenta ? 'linea' : 'sesion';
}

/** Cómo te fue en una partida, para calcular el premio (el servidor hace la misma cuenta en cobrar_partida). */
export interface Desempeno {
  /** Rondas que sobreviviste (alguien más quedó fuera mientras seguías). */
  rondas: number;
  /** De esas, en cuántas quedó fuera una persona (no un bot). */
  personasFuera: number;
  /** Rondas que jugaste, contando en la que quedaste fuera. */
  rondasJugadas: number;
  gano: boolean;
  /** Había otra persona en la sala (si no, ganar no da puntos de ranking). */
  hayPersonas: boolean;
  pasos: number;
  /** Cuántos jugaron (contándote). Sin dato se toma una sala de 6. */
  jugadores?: number;
  /** Todavía no quedas fuera (la cuenta que se ve durante la partida). */
  sigue?: boolean;
}

/** Castigo por quedar fuera en las primeras rondas (puntos de ranking). */
export const CASTIGO_TEMPRANO = 3;

/** ¿Quedó fuera en la ronda 1 o 2 de una partida de 5 o más? (no gana nada y pierde puntos). */
export function salioTemprano(d: Desempeno) {
  return !d.gano && !d.sigue && d.rondasJugadas <= 2 && (d.jugadores ?? 6) >= 5;
}

/** "+5", "−3", "+0". */
export function conSigno(n: number) {
  return n < 0 ? `−${-n}` : `+${n}`;
}

/**
 * Puntos de ranking: +4 por cada persona que quedó fuera mientras seguías, +10 por ganar si había otra
 * persona, y +1 por paso con máximo uno por ronda jugada. Ganar una sala de 6 personas da 35.
 */
export function puntosRanking(d: Desempeno) {
  // el servidor además no deja que tus puntos de la semana bajen de 0
  if (salioTemprano(d)) return -CASTIGO_TEMPRANO;
  return 4 * d.personasFuera + (d.gano && d.hayPersonas ? 10 : 0) + Math.min(d.pasos, d.rondasJugadas);
}

/**
 * Monedas: +4 por ronda sobrevivida (personas o bots), +6 por ganar y +2 por cada 15 pasos (máximo 6 pasos
 * por ronda jugada). Ganar una sala de 6 da 30.
 */
export function monedasPartida(d: Desempeno) {
  if (salioTemprano(d)) return 0;
  const pasos = Math.min(d.pasos, 6 * d.rondasJugadas);
  return 4 * d.rondas + (d.gano ? 6 : 0) + 2 * Math.floor(pasos / 15);
}

/** Tope de monedas por día jugando contra bots (para que no se junten sin límite). */
export const TOPE_DIARIO_BOTS = 150;

/** Día local como "2026-10-14" (el tope se reinicia a medianoche). */
export function diaDe(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Cuántas de las monedas ganadas se pueden dar hoy, según las que ya se llevan. */
export function conTopeDiario(ganadas: number, yaHoy: number, tope = TOPE_DIARIO_BOTS) {
  return Math.max(0, Math.min(ganadas, tope - yaHoy));
}

// Modo de la partida: sin internet (o sin servidor) se juega contra bots y solo se ganan monedas;
// con internet y cuenta, partidas en línea contra otros jugadores.
export type ModoPartida = 'bots' | 'linea';
/** Lo que pasa al tocar Jugar: 'sesion' = hay internet pero falta iniciar sesión para jugar en línea. */
export type Decision = ModoPartida | 'sesion';

export function elegirModo(o: { internet: boolean; servidor: boolean; cuenta: boolean }): Decision {
  if (!o.internet || !o.servidor) return 'bots';
  return o.cuenta ? 'linea' : 'sesion';
}

/** Monedas por una partida contra bots: una por cada 10 puntos que habría dado. */
export function monedasContraBots(puntos: number) {
  return Math.floor(puntos / 10);
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

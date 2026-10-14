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

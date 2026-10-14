// Partida en línea: aplica al juego lo que dice el servidor y ajusta su reloj al del teléfono.
// Sin nada de pantalla ni de red: se puede probar solo.
import type { EstadoPartida } from '@/lib/api';
import type { Juego } from './juego';

/**
 * Diferencia entre el reloj del servidor (ms desde 1970) y el del juego (performance.now()). Se queda con la
 * medición de la consulta más rápida: es la que menos se equivoca.
 */
export class Reloj {
  private desfase = 0;
  private mejorIda = Infinity;
  medido = false;

  /** `antes` y `despues`: hora local al mandar la consulta y al recibir la respuesta. */
  medir(servidor: number, antes: number, despues: number) {
    const ida = despues - antes;
    if (ida > this.mejorIda) return;
    this.mejorIda = ida;
    this.desfase = (antes + despues) / 2 - servidor;
    this.medido = true;
  }

  local(servidor: number) {
    return servidor + this.desfase;
  }
}

/**
 * Pone el juego al día con el estado del servidor. Primero los que se sentaron en la ronda que se ve (si la
 * ronda se cerró entre dos consultas, vienen en `anteriores`), luego quiénes quedaron fuera y al final las
 * horas de la ronda siguiente.
 */
export function aplicarPartida(g: Juego, e: EstadoPartida, reloj: Reloj, ahora: number) {
  const sentados = e.ronda === g.ronda ? e.reclamos : e.ronda === g.ronda + 1 ? (e.anteriores ?? []) : [];
  for (const r of sentados) g.reclamoRemoto(r.quien, ahora);
  for (const f of e.fuera) g.resolverRonda(f.quien, ahora);
  if (e.estado === 'jugando' && e.inicio != null && e.alto != null) g.programarRonda(e.ronda, reloj.local(e.inicio), reloj.local(e.alto), ahora);
}

/** Cada cuánto consultar: seguido cerca del alto y mientras se reparten las sillas; si no, cada segundo. */
export function esperaConsulta(g: Juego, e: EstadoPartida | null, reloj: Reloj, ahora: number) {
  if (!e || e.estado !== 'jugando') return 1000;
  const alto = e.alto != null ? reloj.local(e.alto) : Infinity;
  return g.fase === 'alto' || (alto - ahora < 600 && g.fase !== 'fin') ? 250 : 1000;
}

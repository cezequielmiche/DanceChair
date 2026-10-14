// La sala en línea que acaba de arrancar: la pantalla de espera la deja aquí y la del juego la lee
// (los parámetros de la ruta solo llevan texto).
import type { EstadoSala } from './api';

let actual: EstadoSala | null = null;

export function guardarSala(s: EstadoSala) {
  actual = s;
}

export function salaGuardada(id: string | undefined) {
  return id && actual?.id === id ? actual : null;
}

/// <reference types="node" />
// Pruebas de la lógica del juego (sin pantalla). Correr con: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AVATAR_DEFAULT } from '../src/avatar/types';
import { CASTIGO_ADELANTO, ESPERA_RONDA, Juego, type Dificultad } from '../src/game/juego';

// números al azar repetibles
function semilla(s: number) {
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function nuevo(jugadores = 6, dificultad: Dificultad = 'Normal', s = 7) {
  return new Juego({ jugadores, dificultad, tuNombre: 'Tú', tuAvatar: AVATAR_DEFAULT, favoritos: ['brazos', 'robot', null, null], random: semilla(s) });
}

/** Avanza el reloj en pasos de 16 ms hasta que se cumpla la condición. */
function hasta(g: Juego, t: { v: number }, cond: () => boolean, max = 60000) {
  const fin = t.v + max;
  while (!cond() && t.v < fin) {
    t.v += 16;
    g.actualizar(t.v, 16);
  }
  assert.ok(cond(), 'no se cumplió a tiempo');
}

test('cuenta regresiva y empieza la música', () => {
  const g = nuevo();
  const t = { v: 1000 };
  g.iniciar(t.v);
  assert.equal(g.fase, 'cuenta');
  hasta(g, t, () => g.fase === 'musica');
  assert.equal(g.ronda, 1);
  assert.equal(g.enRonda.length, 6);
  assert.equal(g.geometria(t.v).C, 5);
});

test('bailar suma estilo (uno por ronda en el ranking) y no deja encimar pasos', () => {
  const g = nuevo();
  const t = { v: 0 };
  g.iniciar(t.v);
  hasta(g, t, () => g.fase === 'musica');
  assert.ok(g.bailar('robot', t.v));
  assert.equal(g.pts, 1);
  assert.equal(g.bailar('brazos', t.v + 100), false);
  assert.ok(g.bailar('brazos', t.v + 2000));
  assert.equal(g.pasosBailados, 2);
  assert.equal(g.pts, 1);
});

test('tocar Sentarse con la música sonando bloquea la silla un rato (salida en falso)', () => {
  const g = nuevo(4, 'Fácil');
  const t = { v: 0 };
  g.iniciar(t.v);
  hasta(g, t, () => g.fase === 'musica');
  // el que toca sin parar mientras suena la música
  let ultimo = 0;
  while (g.fase === 'musica') {
    assert.equal(g.sentarse(t.v), false);
    ultimo = t.v;
    t.v += 16;
    g.actualizar(t.v, 16);
  }
  assert.equal(g.fase, 'alto');
  assert.equal(g.flash, '¡Te adelantaste!');
  assert.equal(g.sentarse(t.v), false);
  assert.equal(g.reclamos[0], undefined);
  assert.ok(g.sentarse(ultimo + CASTIGO_ADELANTO));
});

test('el castigo no pasa a la ronda siguiente', () => {
  const g = nuevo(4, 'Fácil');
  const t = { v: 0 };
  g.iniciar(t.v);
  hasta(g, t, () => g.fase === 'musica');
  g.sentarse(t.v);
  assert.ok(g.adelantoHasta > 0);
  hasta(g, t, () => g.fase === 'alto');
  hasta(g, t, () => g.fase === 'resultado' || g.fase === 'fin');
  if (g.fase === 'resultado') {
    g.siguiente(t.v);
    assert.equal(g.adelantoHasta, 0);
  }
});

test('si te sientas rápido sobrevives y ganas 4 puntos y 4 monedas', () => {
  const g = nuevo(4, 'Fácil');
  const t = { v: 0 };
  g.iniciar(t.v);
  hasta(g, t, () => g.fase === 'alto');
  assert.ok(g.sentarse(t.v));
  hasta(g, t, () => g.fase === 'resultado' || g.fase === 'fin');
  assert.equal(g.fase, 'resultado');
  assert.equal(g.tu.vivo, true);
  assert.equal(g.pts, 4);
  assert.equal(g.monedas, 4);
  assert.equal(g.jugadores.filter((p) => p.vivo).length, 3);
});

test('si no te sientas quedas fuera y puedes espectar hasta que haya ganador', () => {
  const g = nuevo(5, 'Difícil');
  const t = { v: 0 };
  g.iniciar(t.v);
  hasta(g, t, () => g.fase === 'fin');
  assert.equal(g.gano, false);
  assert.equal(g.tu.vivo, false);
  assert.equal(g.puesto, 5);
  assert.ok(g.puedeEspectar);
  g.espectar(t.v);
  hasta(g, t, () => g.fase === 'fin' && g.ganadorId != null, 120000);
  assert.equal(g.jugadores.filter((p) => p.vivo).length, 1);
  assert.notEqual(g.ganadorId, 0);
  assert.equal(g.pts, 0, 'al espectar no se suman puntos');
  // el ganador celebra bailando
  const pose = g.pose(g.ganadorId!, t.v + 1000);
  assert.equal(pose.celebra, true);
});

test('ganar la partida da +10 puntos y +6 monedas, y el resumen cuadra', () => {
  const g = nuevo(3, 'Fácil');
  const t = { v: 0 };
  g.iniciar(t.v);
  for (let r = 0; r < 10 && (g.fase as string) !== 'fin'; r++) {
    hasta(g, t, () => g.fase === 'alto' || g.fase === 'fin');
    if ((g.fase as string) === 'fin') break;
    g.sentarse(t.v);
    hasta(g, t, () => g.fase === 'resultado' || g.fase === 'fin');
    if (g.fase === 'resultado') g.siguiente(t.v);
  }
  assert.equal(g.gano, true);
  assert.equal(g.pts, 4 * 2 + 10);
  assert.deepEqual(g.resumen(), { puntos: 18, monedas: 4 * 2 + 6, gano: true, puesto: 1, jugadores: 3, rondas: 2, pasos: 0 });
});

test('cada jugador queda en una silla distinta', () => {
  const g = nuevo(8, 'Normal', 99);
  const t = { v: 0 };
  g.iniciar(t.v);
  hasta(g, t, () => g.fase === 'alto');
  g.sentarse(t.v);
  hasta(g, t, () => g.fase !== 'alto');
  const sillas = Object.values(g.reclamos).map((r) => r.silla);
  assert.equal(new Set(sillas).size, sillas.length);
  assert.equal(sillas.length, 7);
});

test('al final el ganador baila y después la partida queda quieta', () => {
  const g = nuevo(3, 'Fácil');
  const t = { v: 0 };
  g.iniciar(t.v);
  for (let r = 0; r < 10 && (g.fase as string) !== 'fin'; r++) {
    hasta(g, t, () => g.fase === 'alto' || g.fase === 'fin');
    if ((g.fase as string) === 'fin') break;
    g.sentarse(t.v);
    hasta(g, t, () => g.fase === 'resultado' || g.fase === 'fin');
    if (g.fase === 'resultado') g.siguiente(t.v);
  }
  const id = g.ganadorId!;
  assert.equal(g.quieto(t.v + 1000), false);
  assert.equal(g.pose(id, g.finEn + 4000).anim, 'dab');
  assert.equal(g.pose(id, g.finEn + 20000).anim, 'idle');
  assert.equal(g.quieto(g.finEn + 20000), true);
  g.iniciar(g.finEn + 20000);
  assert.equal(g.quieto(g.finEn + 20000), false);
});

test('en línea: los jugadores de la sala van primero y el resto se completa con bots', () => {
  const g = new Juego({
    jugadores: 6,
    dificultad: 'Normal',
    tuNombre: 'Tú',
    tuAvatar: AVATAR_DEFAULT,
    favoritos: [null, null, null, null],
    rivales: [
      { nombre: 'Ana', avatar: AVATAR_DEFAULT },
      { nombre: 'Leo', avatar: AVATAR_DEFAULT },
    ],
  });
  assert.equal(g.jugadores.length, 6);
  assert.deepEqual(
    g.jugadores.slice(0, 3).map((p) => p.nombre),
    ['Tú', 'Ana', 'Leo'],
  );
});

test('en línea la siguiente ronda arranca sola a los 3 s (sin tocar Siguiente)', () => {
  const g = new Juego({ jugadores: 4, dificultad: 'Normal', tuNombre: 'Tú', tuAvatar: AVATAR_DEFAULT, favoritos: [null, null, null, null], automatico: true });
  let t = 0;
  g.iniciar(t);
  // avanzar hasta que haya resultado de la primera ronda, sentándose apenas para la música
  while (g.fase !== 'resultado' && g.fase !== 'fin' && t < 60000) {
    t += 50;
    g.actualizar(t, 50);
    if (g.fase === 'alto') g.sentarse(t);
  }
  if (g.fase === 'fin') return; // te quedaste sin silla: no aplica
  assert.equal(g.ronda, 1);
  assert.equal(g.siguienteEn, t + ESPERA_RONDA);
  const fin = t + ESPERA_RONDA;
  while (t < fin + 100) {
    t += 50;
    g.actualizar(t, 50);
  }
  assert.equal(g.ronda, 2);
  assert.equal(g.siguienteEn, 0);
});

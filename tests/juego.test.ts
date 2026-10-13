/// <reference types="node" />
// Pruebas de la lógica del juego (sin pantalla). Correr con: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AVATAR_DEFAULT } from '../src/avatar/types';
import { Juego, type Dificultad } from '../src/game/juego';

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

test('bailar suma 5 puntos y no deja encimar pasos', () => {
  const g = nuevo();
  const t = { v: 0 };
  g.iniciar(t.v);
  hasta(g, t, () => g.fase === 'musica');
  assert.ok(g.bailar('robot', t.v));
  assert.equal(g.pts, 5);
  assert.equal(g.bailar('brazos', t.v + 100), false);
  assert.equal(g.pts, 5);
});

test('si te sientas rápido sobrevives y ganas 20 puntos', () => {
  const g = nuevo(4, 'Fácil');
  const t = { v: 0 };
  g.iniciar(t.v);
  hasta(g, t, () => g.fase === 'alto');
  assert.ok(g.sentarse(t.v));
  hasta(g, t, () => g.fase === 'resultado' || g.fase === 'fin');
  assert.equal(g.fase, 'resultado');
  assert.equal(g.tu.vivo, true);
  assert.equal(g.pts, 20);
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

test('ganar la partida da +100 y el resumen cuadra', () => {
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
  assert.equal(g.pts, 20 * 2 + 100);
  assert.deepEqual(g.resumen(), { puntos: 140, gano: true, puesto: 1, jugadores: 3, rondas: 2, pasos: 0 });
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

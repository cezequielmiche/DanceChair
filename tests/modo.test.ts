/// <reference types="node" />
// Pruebas de cómo se elige el modo al tocar Jugar. Correr con: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { conTopeDiario, diaDe, elegirModo, monedasPartida, puntosRanking, type Desempeno } from '../src/game/modo';

test('sin internet se juega contra bots, con o sin cuenta', () => {
  assert.equal(elegirModo({ internet: false, servidor: true, cuenta: true }), 'bots');
  assert.equal(elegirModo({ internet: false, servidor: true, cuenta: false }), 'bots');
});

test('sin servidor configurado se juega contra bots aunque haya internet', () => {
  assert.equal(elegirModo({ internet: true, servidor: false, cuenta: true }), 'bots');
});

test('con internet y cuenta se juega en línea; sin cuenta se pide iniciar sesión', () => {
  assert.equal(elegirModo({ internet: true, servidor: true, cuenta: true }), 'linea');
  assert.equal(elegirModo({ internet: true, servidor: true, cuenta: false }), 'sesion');
});

// sala de 6: el ganador sobrevive 5 rondas
const gana = (personasFuera: number, pasos: number): Desempeno => ({ rondas: 5, personasFuera, rondasJugadas: 5, gano: true, hayPersonas: personasFuera > 0, pasos });

test('ganar una sala de 6 da como mucho 35 puntos y 30 monedas', () => {
  assert.equal(puntosRanking(gana(5, 30)), 35);
  assert.equal(monedasPartida(gana(5, 30)), 30);
  assert.equal(puntosRanking(gana(5, 0)), 30);
  assert.equal(monedasPartida(gana(5, 0)), 26);
});

test('en el ranking solo cuentan las personas; en las monedas también los bots', () => {
  assert.equal(puntosRanking(gana(1, 30)), 19);
  assert.equal(puntosRanking(gana(0, 30)), 5);
  assert.equal(monedasPartida(gana(0, 30)), 30);
});

test('los que pierden: 2.º, 4.º y 6.º de 6 bailando lo más posible', () => {
  const fuera = (ronda: number): Desempeno => ({ rondas: ronda - 1, personasFuera: ronda - 1, rondasJugadas: ronda, gano: false, hayPersonas: true, pasos: 6 * ronda });
  assert.deepEqual([5, 3, 1].map((r) => [puntosRanking(fuera(r)), monedasPartida(fuera(r))]), [[21, 20], [11, 10], [1, 0]]);
});

test('los pasos tienen tope: uno por ronda en el ranking, seis por ronda en las monedas', () => {
  const d: Desempeno = { rondas: 0, personasFuera: 0, rondasJugadas: 1, gano: false, hayPersonas: true, pasos: 100 };
  assert.equal(puntosRanking(d), 1);
  assert.equal(monedasPartida(d), 0);
});

test('tope diario contra bots: no pasa de 150 en el día', () => {
  assert.equal(conTopeDiario(20, 0), 20);
  assert.equal(conTopeDiario(20, 140), 10);
  assert.equal(conTopeDiario(20, 150), 0);
  assert.equal(conTopeDiario(20, 170), 0);
});

test('el día se cuenta en hora local', () => {
  assert.equal(diaDe(new Date(2026, 9, 14, 23, 59).getTime()), '2026-10-14');
  assert.equal(diaDe(new Date(2026, 9, 15, 0, 1).getTime()), '2026-10-15');
});

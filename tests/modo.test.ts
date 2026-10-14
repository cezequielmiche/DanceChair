/// <reference types="node" />
// Pruebas de cómo se elige el modo al tocar Jugar. Correr con: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { conTopeDiario, diaDe, elegirModo, monedasContraBots } from '../src/game/modo';

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

test('contra bots: una moneda por cada 10 puntos', () => {
  assert.equal(monedasContraBots(0), 0);
  assert.equal(monedasContraBots(9), 0);
  assert.equal(monedasContraBots(135), 13);
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

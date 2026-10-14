/// <reference types="node" />
// Pruebas de cómo se elige el modo al tocar Jugar. Correr con: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { elegirModo, monedasContraBots } from '../src/game/modo';

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

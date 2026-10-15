/// <reference types="node" />
// Pruebas de la partida en línea: el juego obedece lo que manda el servidor. Correr con: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AVATAR_DEFAULT } from '../src/avatar/types';
import { aplicarPartida, Reloj } from '../src/game/enLinea';
import { Juego } from '../src/game/juego';
import type { EstadoPartida } from '../src/lib/api';

function nuevo() {
  return new Juego({
    jugadores: 4,
    dificultad: 'Normal',
    tuNombre: 'Tú',
    tuAvatar: AVATAR_DEFAULT,
    favoritos: [null, null, null, null],
    automatico: true,
    remoto: true,
    tuClave: 'yo',
    rivales: [{ nombre: 'Ana', avatar: AVATAR_DEFAULT, clave: 'ana' }],
    random: () => 0.5,
  });
}

/** Reloj sin desfase: la hora del servidor es la local. */
function reloj() {
  const r = new Reloj();
  r.medir(0, 0, 0);
  return r;
}

function estado(e: Partial<EstadoPartida>): EstadoPartida {
  return { estado: 'jugando', ronda: 1, ahora: 0, inicio: 3000, alto: 8000, vivos: ['yo', 'ana', 'bot1', 'bot2'], fuera: [], ganador: null, reclamos: [], ...e };
}

function avanzar(g: Juego, desde: number, hasta: number) {
  for (let t = desde; t <= hasta; t += 16) g.actualizar(t, 16);
}

test('la ronda empieza y para a la hora del servidor (sin sortear nada)', () => {
  const g = nuevo();
  const r = reloj();
  g.iniciar(0);
  assert.deepEqual(g.jugadores.map((p) => p.clave), ['yo', 'ana', 'bot1', 'bot2']);
  aplicarPartida(g, estado({}), r, 0);
  assert.equal(g.fase, 'cuenta');
  assert.equal(g.cuenta, 3);
  avanzar(g, 0, 2990);
  assert.equal(g.fase, 'cuenta');
  avanzar(g, 3000, 7990);
  assert.equal(g.fase, 'musica');
  assert.equal(g.ronda, 1);
  avanzar(g, 8000, 9000);
  assert.equal(g.fase, 'alto');
  // los bots no se sientan solos: esperan al servidor
  assert.equal(Object.keys(g.reclamos).length, 0);
});

test('los reclamos y quién queda fuera llegan del servidor', () => {
  const g = nuevo();
  const r = reloj();
  g.iniciar(0);
  aplicarPartida(g, estado({}), r, 0);
  avanzar(g, 0, 8100);
  assert.ok(g.sentarse(8100));
  aplicarPartida(g, estado({ reclamos: [{ quien: 'bot1', hora: 8300 }, { quien: 'yo', hora: 8400 }, { quien: 'bot2', hora: 8500 }] }), r, 8600);
  // todas las sillas ocupadas, pero la ronda solo se cierra cuando lo dice el servidor
  assert.equal(g.fase, 'alto');
  aplicarPartida(g, estado({ ronda: 2, inicio: 12000, alto: 16000, vivos: ['yo', 'bot1', 'bot2'], fuera: [{ quien: 'ana', ronda: 1 }] }), r, 8700);
  assert.equal(g.fase, 'resultado');
  assert.equal(g.ultimoFuera, 'Ana');
  assert.equal(g.siguienteEn, 12000);
  assert.equal(g.pts, 4);
  // "Siguiente" no adelanta la ronda en línea
  g.siguiente(9000);
  assert.equal(g.fase, 'resultado');
  avanzar(g, 8700, 12100);
  assert.equal(g.fase, 'musica');
  assert.equal(g.ronda, 2);
});

test('si el servidor te saca, pierdes aunque te hayas sentado; luego puedes ver cómo termina', () => {
  const g = nuevo();
  const r = reloj();
  g.iniciar(0);
  aplicarPartida(g, estado({}), r, 0);
  avanzar(g, 0, 8100);
  g.sentarse(8100);
  aplicarPartida(g, estado({ ronda: 2, inicio: 12000, alto: 16000, vivos: ['ana', 'bot1', 'bot2'], fuera: [{ quien: 'yo', ronda: 1 }] }), r, 8700);
  assert.equal(g.fase, 'fin');
  assert.equal(g.gano, false);
  assert.equal(g.puesto, 4);
  assert.ok(g.puedeEspectar);
  g.espectar(9000);
  avanzar(g, 9000, 16100);
  assert.equal(g.ronda, 2);
  assert.equal(g.fase, 'alto');
  aplicarPartida(g, estado({ ronda: 3, inicio: 20000, alto: 24000, vivos: ['ana', 'bot1'], fuera: [{ quien: 'yo', ronda: 1 }, { quien: 'bot2', ronda: 2 }] }), r, 16500);
  avanzar(g, 16500, 24100);
  aplicarPartida(g, estado({ estado: 'terminada', ronda: 3, alto: null, vivos: ['ana'], ganador: 'ana', fuera: [{ quien: 'yo', ronda: 1 }, { quien: 'bot2', ronda: 2 }, { quien: 'bot1', ronda: 3 }] }), r, 24500);
  assert.equal(g.fase, 'fin');
  assert.equal(g.ganador, 'Ana');
});

test('un teléfono atrasado se pone al día de golpe', () => {
  const g = nuevo();
  const r = reloj();
  g.iniciar(0);
  // llega tarde: ya pasaron la ronda 1 y el inicio de la 2
  aplicarPartida(g, estado({ ronda: 2, inicio: 12000, alto: 16000, vivos: ['yo', 'ana', 'bot1'], fuera: [{ quien: 'bot2', ronda: 1 }] }), r, 13000);
  avanzar(g, 13000, 13100);
  assert.equal(g.fase, 'musica');
  assert.equal(g.jugadores.find((p) => p.clave === 'bot2')?.vivo, false);
  assert.equal(g.enRonda.length, 3);
});

test('el reloj se queda con la medición más rápida', () => {
  const r = new Reloj();
  r.medir(1000, 5000, 5400); // tardó 400 ms
  assert.equal(r.local(1000), 5200);
  r.medir(2000, 6000, 6100); // tardó 100 ms: mejor
  assert.equal(r.local(2000), 6050);
  r.medir(3000, 7000, 7600); // lenta: se ignora
  assert.equal(r.local(3000), 7050);
});

test('si el reloj se corrige, la ronda se vuelve a programar (antes y durante la música)', () => {
  const g = nuevo();
  g.iniciar(0);
  const r = new Reloj();
  // primera consulta lenta: el reloj queda 1 s adelantado
  r.medir(0, 0, 2000);
  aplicarPartida(g, estado({}), r, 2000);
  // una consulta rápida lo corrige: inicio 3000 y alto 8000 locales otra vez
  r.medir(2100, 2100, 2150);
  r.medir(2125, 2100, 2150);
  assert.equal(r.local(3000), 3000);
  aplicarPartida(g, estado({}), r, 2150);
  avanzar(g, 2150, 2990);
  assert.equal(g.fase, 'cuenta');
  avanzar(g, 3000, 3100);
  assert.equal(g.fase, 'musica');
  // ya sonando, otro ajuste mueve el alto 200 ms más tarde
  aplicarPartida(g, estado({ alto: 8200 }), r, 3100);
  avanzar(g, 3100, 8150);
  assert.equal(g.fase, 'musica');
  avanzar(g, 8150, 8300);
  assert.equal(g.fase, 'alto');
});

test('el que mira ve sentarse a todos aunque la ronda se cierre entre dos consultas', () => {
  const g = nuevo();
  const r = reloj();
  g.iniciar(0);
  aplicarPartida(g, estado({}), r, 0);
  avanzar(g, 0, 8100);
  aplicarPartida(g, estado({ ronda: 2, inicio: 12000, alto: 16000, vivos: ['ana', 'bot1', 'bot2'], fuera: [{ quien: 'yo', ronda: 1 }] }), r, 8700);
  g.espectar(9000);
  avanzar(g, 9000, 16100);
  assert.equal(g.fase, 'alto');
  // la siguiente consulta ya trae la ronda 3: los sentados de la 2 vienen en `anteriores`
  aplicarPartida(
    g,
    estado({
      ronda: 3, inicio: 20000, alto: 24000, vivos: ['ana', 'bot1'],
      fuera: [{ quien: 'yo', ronda: 1 }, { quien: 'bot2', ronda: 2 }],
      anteriores: [{ quien: 'bot1', hora: 16400 }, { quien: 'ana', hora: 16600 }],
    }),
    r,
    16900,
  );
  assert.equal(g.fase, 'resultado');
  const sentados = g.jugadores.filter((p) => g.reclamos[p.id]).map((p) => p.clave);
  assert.deepEqual(sentados.sort(), ['ana', 'bot1']);
  assert.equal(g.ultimoFuera, g.jugadores.find((p) => p.clave === 'bot2')!.nombre);
});

test('en línea, eliminar bots no da puntos de ranking; eliminar personas sí', () => {
  const g = nuevo();
  const r = reloj();
  g.iniciar(0);
  aplicarPartida(g, estado({}), r, 0);
  avanzar(g, 0, 8100);
  g.sentarse(8100);
  aplicarPartida(g, estado({ ronda: 2, inicio: 12000, alto: 16000, vivos: ['yo', 'ana', 'bot1'], fuera: [{ quien: 'bot2', ronda: 1 }] }), r, 8700);
  assert.equal(g.pts, 0);
  assert.equal(g.monedas, 4, 'eliminar un bot sí da monedas');
  assert.equal(g.resumen().rondas, 1);
  avanzar(g, 8700, 16100);
  g.sentarse(16100);
  aplicarPartida(g, estado({ ronda: 3, inicio: 20000, alto: 24000, vivos: ['yo', 'bot1'], fuera: [{ quien: 'bot2', ronda: 1 }, { quien: 'ana', ronda: 2 }] }), r, 16700);
  assert.equal(g.pts, 4);
  avanzar(g, 16700, 24100);
  g.sentarse(24100);
  // gana: había otra persona (Ana), así que los +10 sí cuentan
  aplicarPartida(g, estado({ estado: 'terminada', ronda: 3, alto: null, vivos: ['yo'], ganador: 'yo', fuera: [{ quien: 'bot2', ronda: 1 }, { quien: 'ana', ronda: 2 }, { quien: 'bot1', ronda: 3 }] }), r, 24500);
  assert.equal(g.gano, true);
  assert.equal(g.pts, 14);
  assert.equal(g.monedas, 3 * 4 + 6);
});

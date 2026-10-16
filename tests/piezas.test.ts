/// <reference types="node" />
// Pruebas de cómo se viste el modelo 3D (colores y piezas visibles). Correr con: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';

import { dress, visibility } from '../src/avatar/piezas';
import { AVATAR_CHICA, AVATAR_CHICO, AVATAR_DEFAULT } from '../src/avatar/types';
import { GRATIS, soloLoQueTiene } from '../src/data/catalogo';

/** Modelo mínimo: una malla por pieza, con el nombre de material que trae el .glb. */
function modelo(piezas: Record<string, string>) {
  const raiz = new THREE.Group();
  Object.entries(piezas).forEach(([pieza, material]) => {
    const g = new THREE.Group();
    g.name = pieza;
    const m = new THREE.MeshStandardMaterial({ color: '#123456' });
    m.name = material;
    g.add(new THREE.Mesh(new THREE.BufferGeometry(), m));
    raiz.add(g);
  });
  return raiz;
}
const color = (raiz: THREE.Object3D, pieza: string) =>
  '#' + ((raiz.getObjectByName(pieza)!.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHexString().toUpperCase();
const visible = (raiz: THREE.Object3D, pieza: string) => raiz.getObjectByName(pieza)!.children[0].visible;

test('el pelo corto de la chica toma el color elegido aunque su material se llame tint_pelo.001', () => {
  const m = modelo({ Pelo_corto: 'tint_pelo.001', Pelo_largo: 'tint_pelo' });
  dress(m, { ...AVATAR_CHICA, pelo: 'corto', colorPelo: '#E8742A' });
  assert.equal(visible(m, 'Pelo_corto'), true);
  assert.equal(visible(m, 'Pelo_largo'), false);
  assert.equal(color(m, 'Pelo_corto'), '#E8742A');
});

test('las prendas cruzadas (falda del chico, chaqueta de la chica) toman su color', () => {
  const chico = modelo({ Pant_falda: 'tint_pantalon.001', Camisa_blusa: 'tint_camisa.001' });
  dress(chico, { ...AVATAR_CHICO, pantalonTipo: 'falda', pantalon: '#E54B4B', camisaTipo: 'blusa', camisa: '#FFFFFF' });
  assert.equal(color(chico, 'Pant_falda'), '#E54B4B');
  assert.equal(color(chico, 'Camisa_blusa'), '#FFFFFF');
  const chica = modelo({ Camisa_chaqueta: 'tint_camisa.001' });
  dress(chica, { ...AVATAR_CHICA, camisaTipo: 'chaqueta', camisa: '#3A7BD5' });
  assert.equal(color(chica, 'Camisa_chaqueta'), '#3A7BD5');
});

test('los materiales que no son de color elegible conservan el suyo', () => {
  const m = modelo({ Pant_falda: 'chica_celeste.001' });
  dress(m, AVATAR_CHICA);
  assert.equal(color(m, 'Pant_falda'), '#123456');
});

test('sudadera y mezclilla: se ven si las llevas y se quitan si no son tuyas', () => {
  const llaves = ['Camisa_chaqueta', 'Camisa_blusa', 'Camisa_sudadera', 'Camisa_mezclilla'];
  const v = visibility({ ...AVATAR_DEFAULT, camisaTipo: 'sudadera' }, llaves);
  assert.equal(v.Camisa_sudadera, true);
  assert.equal(v.Camisa_chaqueta, false);
  const sinComprar = soloLoQueTiene({ ...AVATAR_DEFAULT, camisaTipo: 'mezclilla' }, GRATIS);
  assert.equal(sinComprar.camisaTipo, undefined);
  assert.equal(visibility(sinComprar, llaves).Camisa_chaqueta, true);
  assert.equal(soloLoQueTiene({ ...AVATAR_DEFAULT, camisaTipo: 'mezclilla' }, [...GRATIS, 'mezclilla']).camisaTipo, 'mezclilla');
});

test('el pingüino tapa pelo, ropa, zapatos y audífonos; el dino solo las piernas', () => {
  const llaves = ['Pelo_corto', 'Camisa_chaqueta', 'Pant_jeans', 'Zap_tenis', 'Acc_lentes', 'Acc_audifonos', 'Disf_dino', 'Disf_pinguino'];
  const p = visibility({ ...AVATAR_DEFAULT, disfraz: 'pinguino', lentes: 'si', audifonos: 'si' }, llaves);
  assert.equal(p.Disf_pinguino, true);
  assert.equal(p.Disf_dino, false);
  for (const k of ['Pelo_corto', 'Camisa_chaqueta', 'Pant_jeans', 'Zap_tenis', 'Acc_audifonos']) assert.equal(p[k], false, k);
  assert.equal(p.Acc_lentes, true);
  const d = visibility({ ...AVATAR_DEFAULT, disfraz: 'dino' }, llaves);
  assert.equal(d.Camisa_chaqueta, true);
  assert.equal(d.Pelo_corto, true);
  assert.equal(d.Pant_jeans, false);
});

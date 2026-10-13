// Piezas intercambiables y colores. Misma lógica que el motor del prototipo (sillas3d.js).
// Cada malla del .glb se llama Grupo_valor: Pelo_corto, Camisa_blusa, Pant_jeans, Zap_tenis, Acc_lentes…
import * as THREE from 'three';
import { AvatarConfig } from './types';

const GROUP_RE = /^(Pelo|Camisa|Pant|Zap|Acc|Disf)_([a-z]+)/;

/** Pieza a la que pertenece un objeto (busca en sus padres), o null si es del cuerpo. */
export function pieceKey(o: THREE.Object3D | null): string | null {
  for (let x = o; x; x = x.parent) {
    const m = x.name ? x.name.match(GROUP_RE) : null;
    if (m) return `${m[1]}_${m[2]}`;
  }
  return null;
}

/** Valor elegido para cada grupo, con los valores por defecto según el cuerpo. */
export function choice(c: AvatarConfig) {
  const mujer = c.cuerpo === 'mujer';
  return {
    Pelo: c.pelo ?? (mujer ? 'largo' : 'corto'),
    Camisa: c.camisaTipo ?? (mujer ? 'blusa' : 'chaqueta'),
    Pant: c.pantalonTipo ?? (mujer ? 'falda' : 'jeans'),
    Zap: c.zapatos ?? (mujer ? 'zapatos' : 'tenis'),
    Acc: { lentes: c.lentes === 'si', audifonos: c.audifonos === 'si' } as Record<string, boolean>,
    Disf: c.disfraz ?? 'ninguno',
  };
}

/** Visibilidad de las piezas que trae el modelo. Si falta la elegida, se muestra la primera del grupo. */
export function visibility(c: AvatarConfig, keys: string[]): Record<string, boolean> {
  const ch = choice(c);
  const vis: Record<string, boolean> = {};
  const byGroup: Record<string, string[]> = {};
  keys.forEach((k) => (byGroup[k.split('_')[0]] ??= []).push(k));
  Object.entries(byGroup).forEach(([g, list]) => {
    if (g === 'Acc') {
      const largo = ch.Pelo === 'largo';
      return list.forEach((k) => {
        const n = k.split('_')[1];
        // audífonos en dos tallas: 'audifonosl' para pelo largo
        if (n === 'audifonos') vis[k] = !!ch.Acc.audifonos && !(largo && list.includes('Acc_audifonosl'));
        else if (n === 'audifonosl') vis[k] = !!ch.Acc.audifonos && largo;
        else vis[k] = !!ch.Acc[n];
      });
    }
    if (g === 'Disf') return list.forEach((k) => (vis[k] = k === `Disf_${ch.Disf}`));
    if (g === 'Pelo' && ch.Pelo === 'ninguno') return list.forEach((k) => (vis[k] = false));
    const want = `${g}_${(ch as unknown as Record<string, string>)[g]}`;
    const pick = list.includes(want) ? want : list[0];
    list.forEach((k) => (vis[k] = k === pick));
  });
  // con disfraz, las piernas van dentro de las patas del dino
  if (ch.Disf !== 'ninguno' && keys.includes(`Disf_${ch.Disf}`))
    Object.keys(vis).forEach((k) => { if (/^(Pant|Zap)_/.test(k)) vis[k] = false; });
  return vis;
}

/** Colores por material. `null` deja el color original del modelo. Los "_osc"/"_claro" son tonos derivados. */
function tints(c: AvatarConfig): Record<string, string | null> {
  const shade = (hex: string | undefined, k: number) => {
    if (!hex) return null;
    const col = new THREE.Color(hex).lerp(new THREE.Color(k > 0 ? 0xffffff : 0x000000), Math.abs(k));
    return '#' + col.getHexString();
  };
  return {
    piel: c.piel,
    piel_osc: shade(c.piel, -0.18),
    ojos_iris: c.colorOjos ?? null,
    tint_pelo: c.colorPelo ?? null,
    tint_pelo_claro: shade(c.colorPelo, 0.22),
    tint_camisa: c.camisa,
    tint_camisa_osc: shade(c.camisa, -0.35),
    tint_pantalon: c.pantalon,
    tint_zapato: c.colorZapatos ?? null,
    tint_tenis: c.colorZapatos ?? null,
    tint_acc: c.colorAcc ?? null,
    tint_disfraz: c.colorDisfraz ?? null,
    tint_disfraz_osc: shade(c.colorDisfraz, -0.55),
  };
}

/** Viste un modelo clonado (con materiales propios): colores y piezas visibles. */
export function dress(model: THREE.Object3D, c: AvatarConfig) {
  const parts: Record<string, THREE.Object3D[]> = {};
  const t = tints(c);
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (mat && mat.name && mat.name in t) {
      if (!mat.userData.base) mat.userData.base = '#' + mat.color.getHexString();
      mat.color.set(t[mat.name] ?? mat.userData.base); // r3f maneja sRGB: set() recibe hex normal
    }
    const k = pieceKey(o);
    if (k) (parts[k] ??= []).push(o);
  });
  const vis = visibility(c, Object.keys(parts));
  Object.entries(parts).forEach(([k, list]) => list.forEach((o) => (o.visible = vis[k] !== false)));
}

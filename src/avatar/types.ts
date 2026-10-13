// AvatarConfig: lo que se guarda por jugador. Coincide con el prototipo del lienzo de diseño.

export type Cuerpo = 'hombre' | 'mujer';
export type Pelo = 'corto' | 'largo' | 'ninguno';
export type CamisaTipo = 'chaqueta' | 'blusa';
export type PantalonTipo = 'jeans' | 'falda';
export type ZapatosTipo = 'tenis' | 'zapatos';
export type Disfraz = 'ninguno' | 'dino';
export type SiNo = 'si' | 'no';

export interface AvatarConfig {
  cuerpo: Cuerpo; // elige el modelo: Chico.glb o Chica.glb
  piel: string; // colores en hex, ej. '#F1C7A5'
  colorOjos?: string;
  pelo?: Pelo; // si falta: corto para hombre, largo para mujer
  colorPelo?: string;
  camisaTipo?: CamisaTipo; // si falta: chaqueta / blusa según el cuerpo
  camisa: string;
  pantalonTipo?: PantalonTipo; // si falta: jeans / falda
  pantalon: string;
  zapatos?: ZapatosTipo; // si falta: tenis / zapatos
  colorZapatos?: string;
  lentes?: SiNo;
  audifonos?: SiNo;
  colorAcc?: string; // color de los audífonos
  disfraz?: Disfraz; // va encima de la ropa: esconde pantalón y zapatos
  colorDisfraz?: string;
}

/** Poses que puede mostrar un avatar: quieto, caminando, sentado o un paso de baile. */
export type DanceId = 'brazos' | 'balanceo' | 'disco' | 'robot' | 'macarena' | 'aura' | 'dab' | 'moonwalk';
export type AvatarAnim = 'idle' | 'caminar' | DanceId;

// Clip del .glb para cada animación. El moonwalk usa 'caminar' reproducido hacia atrás.
export const CLIP_BY_ANIM: Record<AvatarAnim, string> = {
  idle: 'idle',
  caminar: 'caminar',
  brazos: 'paso_brazos',
  balanceo: 'paso_balanceo',
  disco: 'paso_disco',
  robot: 'paso_robot',
  macarena: 'paso_macarena',
  aura: 'paso_aura',
  dab: 'paso_combo_dab',
  moonwalk: 'caminar',
};

export const AVATAR_CHICO: AvatarConfig = {
  cuerpo: 'hombre',
  piel: '#F1C7A5',
  colorOjos: '#3A2418',
  pelo: 'corto',
  colorPelo: '#2B2E4A',
  camisaTipo: 'chaqueta',
  camisa: '#E54B4B',
  pantalonTipo: 'jeans',
  pantalon: '#2E3B5E',
  zapatos: 'tenis',
  colorZapatos: '#FFC233',
  lentes: 'no',
  audifonos: 'no',
  colorAcc: '#F25F9C',
  disfraz: 'ninguno',
  colorDisfraz: '#3DBE4A',
};

export const AVATAR_CHICA: AvatarConfig = {
  ...AVATAR_CHICO,
  cuerpo: 'mujer',
  colorOjos: '#2E5E9E',
  pelo: 'largo',
  colorPelo: '#E8742A',
  camisaTipo: 'blusa',
  camisa: '#FFFFFF',
  pantalonTipo: 'falda',
  pantalon: '#E54B4B',
  zapatos: 'zapatos',
  colorZapatos: '#7FD1FF',
};

export const AVATAR_DEFAULT = AVATAR_CHICO;

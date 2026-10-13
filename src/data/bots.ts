// Jugadores de la computadora (modo contra bots).
import type { AvatarConfig } from '@/avatar/types';

type B = AvatarConfig & { nombre: string };

const b = (
  nombre: string, cuerpo: 'hombre' | 'mujer', piel: string, pelo: 'corto' | 'largo' | 'ninguno', colorPelo: string,
  camisaTipo: 'chaqueta' | 'blusa', camisa: string, pantalonTipo: 'jeans' | 'falda', pantalon: string,
  zapatos: 'tenis' | 'zapatos', colorZapatos: string, lentes: 'si' | 'no', audifonos: 'si' | 'no', colorAcc: string, colorOjos: string,
  extra: Partial<AvatarConfig> = {},
): B => ({ nombre, cuerpo, piel, pelo, colorPelo, camisaTipo, camisa, pantalonTipo, pantalon, zapatos, colorZapatos, lentes, audifonos, colorAcc, colorOjos, disfraz: 'ninguno', ...extra });

export const BOTS: B[] = [
  b('Luna', 'mujer', '#F1C7A5', 'largo', '#2B1D16', 'blusa', '#7FD1FF', 'falda', '#33406A', 'zapatos', '#FFFFFF', 'no', 'si', '#F25F9C', '#2E5E9E'),
  b('Max', 'hombre', '#8D5A3B', 'corto', '#1B1410', 'chaqueta', '#9BE564', 'jeans', '#2C2C3A', 'tenis', '#F2F2F2', 'no', 'si', '#F2784B', '#3A2418'),
  b('Coco', 'hombre', '#E0AC85', 'corto', '#C2692B', 'chaqueta', '#FFFFFF', 'jeans', '#6B6B4A', 'tenis', '#FFC233', 'si', 'no', '#1E1E28', '#3B7A4A', { disfraz: 'dino', colorDisfraz: '#3DBE4A' }),
  b('Pipo', 'hombre', '#5C3A28', 'corto', '#121014', 'blusa', '#B18CFF', 'jeans', '#2A3350', 'tenis', '#E54B4B', 'no', 'si', '#4ED6B0', '#3A2418'),
  b('Nina', 'mujer', '#FFDCC2', 'largo', '#E8B04A', 'chaqueta', '#4ED6B0', 'jeans', '#4A3B6B', 'tenis', '#F25F9C', 'no', 'no', '#FFFFFF', '#2E5E9E'),
  b('Tito', 'hombre', '#B97B56', 'ninguno', '#2B1D16', 'chaqueta', '#FF9F80', 'jeans', '#2E3B5E', 'zapatos', '#7FD1FF', 'si', 'si', '#7FD1FF', '#7A4A22'),
  b('Bea', 'mujer', '#A86B4C', 'largo', '#3A2418', 'blusa', '#E8E8E8', 'falda', '#B9462A', 'zapatos', '#B9462A', 'si', 'no', '#1E1E28', '#3A2418'),
];

/** Elige bots al azar para una partida. */
export function elegirBots(n: number, rnd: () => number = Math.random): B[] {
  const pool = BOTS.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

// Catálogo de la tienda: ropa, accesorios, disfraces y pasos de baile.
// Los precios también viven en la tabla `catalogo` de Supabase, que es la que vale al comprar.
import type { AvatarConfig, DanceId } from '@/avatar/types';

export type Etiqueta = 'Gratis' | 'Nuevo' | 'Popular' | 'Premium' | 'Tendencia' | 'Leyenda';

export interface Prenda {
  id: string;
  tipo: 'ropa';
  /** Campo del AvatarConfig que cambia y valor que pone. */
  slot: 'camisaTipo' | 'pantalonTipo' | 'zapatos' | 'lentes' | 'audifonos' | 'disfraz';
  val: string;
  nombre: string;
  precio: number;
  etiqueta: Etiqueta;
  desc: string;
  /** Valor para quitárselo (solo accesorios y disfraces). */
  quitar?: string;
  /** Color de muestra en la tarjeta. */
  muestra: string;
  /** Se ve mejor de cerca (lentes, audífonos). */
  busto?: boolean;
}

export interface Paso {
  id: DanceId;
  tipo: 'paso';
  nombre: string;
  precio: number;
  etiqueta: Etiqueta;
  desc: string;
  /** Cuánto dura el paso en el juego (ms); mientras dura no se puede empezar otro. */
  dura: number;
}

export type Articulo = Prenda | Paso;

export const PRENDAS: Prenda[] = [
  { id: 'chaqueta', tipo: 'ropa', slot: 'camisaTipo', val: 'chaqueta', nombre: 'Chaqueta', precio: 0, etiqueta: 'Gratis', muestra: '#E54B4B', desc: 'Chaqueta con cierre sobre playera. Cámbiale el color en el creador.' },
  { id: 'blusa', tipo: 'ropa', slot: 'camisaTipo', val: 'blusa', nombre: 'Blusa', precio: 0, etiqueta: 'Gratis', muestra: '#FFFFFF', desc: 'Blusa con mangas abombadas y moño en el cuello.' },
  { id: 'jeans', tipo: 'ropa', slot: 'pantalonTipo', val: 'jeans', nombre: 'Jeans', precio: 0, etiqueta: 'Gratis', muestra: '#2E3B5E', desc: 'Pantalón de mezclilla con dobladillo.' },
  { id: 'falda', tipo: 'ropa', slot: 'pantalonTipo', val: 'falda', nombre: 'Falda', precio: 0, etiqueta: 'Gratis', muestra: '#E54B4B', desc: 'Falda con vuelo y calcetas largas.' },
  { id: 'tenis', tipo: 'ropa', slot: 'zapatos', val: 'tenis', nombre: 'Tenis', precio: 0, etiqueta: 'Gratis', muestra: '#FFC233', desc: 'Tenis con calcetín de franja.' },
  { id: 'zapatos', tipo: 'ropa', slot: 'zapatos', val: 'zapatos', nombre: 'Zapatos', precio: 0, etiqueta: 'Gratis', muestra: '#7FD1FF', desc: 'Zapatos de correa, cómodos para bailar.' },
  { id: 'lentes', tipo: 'ropa', slot: 'lentes', val: 'si', quitar: 'no', nombre: 'Lentes', precio: 200, etiqueta: 'Nuevo', muestra: '#1E1E28', busto: true, desc: 'Lentes redondos. Se ponen y se quitan cuando quieras.' },
  { id: 'audifonos', tipo: 'ropa', slot: 'audifonos', val: 'si', quitar: 'no', nombre: 'Audífonos', precio: 350, etiqueta: 'Popular', muestra: '#F25F9C', busto: true, desc: 'Audífonos de diadema. Elige su color en el creador.' },
  { id: 'dino', tipo: 'ropa', slot: 'disfraz', val: 'dino', quitar: 'ninguno', nombre: 'Dino', precio: 900, etiqueta: 'Premium', muestra: '#3DBE4A', desc: 'Disfraz inflable: vas montado en un dinosaurio. Se pone encima de tu ropa y le cambias el color en el creador.' },
];

export const PASOS: Paso[] = [
  { id: 'brazos', tipo: 'paso', nombre: 'Brazos', precio: 0, etiqueta: 'Gratis', dura: 1700, desc: 'Brazos arriba, saludando al ritmo de la música.' },
  { id: 'balanceo', tipo: 'paso', nombre: 'Balanceo', precio: 0, etiqueta: 'Gratis', dura: 1700, desc: 'Brazos abiertos y el cuerpo se mece de lado a lado.' },
  { id: 'disco', tipo: 'paso', nombre: 'Disco', precio: 250, etiqueta: 'Nuevo', dura: 1700, desc: 'Mano a la cintura y el dedo apuntando al cielo, estilo disco.' },
  { id: 'robot', tipo: 'paso', nombre: 'Robot', precio: 400, etiqueta: 'Popular', dura: 1700, desc: 'Movimientos cortados y brazos rígidos, como un robot.' },
  { id: 'macarena', tipo: 'paso', nombre: 'Macarena', precio: 500, etiqueta: 'Premium', dura: 3350, desc: 'Brazos al frente, manos a los hombros, a la nuca, a la cadera y ¡a mover la cadera!' },
  { id: 'aura', tipo: 'paso', nombre: 'Aura', precio: 600, etiqueta: 'Tendencia', dura: 3350, desc: 'Ondas lentas con los brazos, cadera suelta y cara de calma total.' },
  { id: 'dab', tipo: 'paso', nombre: 'Dab', precio: 700, etiqueta: 'Tendencia', dura: 3350, desc: 'Dedo en la barbilla, risa, agachado con la lengua afuera y ¡dab!' },
  { id: 'moonwalk', tipo: 'paso', nombre: 'Moonwalk', precio: 800, etiqueta: 'Leyenda', dura: 3350, desc: 'El deslizamiento legendario: el cuerpo flota hacia atrás.' },
];

export const CATALOGO: Articulo[] = [...PRENDAS, ...PASOS];

/** Lo que todos tienen desde el inicio. */
export const GRATIS = CATALOGO.filter((a) => a.precio === 0).map((a) => a.id);

export const articulo = (id: string) => CATALOGO.find((a) => a.id === id);
export const paso = (id: string) => PASOS.find((p) => p.id === id);

/** Valor que un artículo pone en el avatar (para probárselo o ponérselo). */
export function conPrenda(a: AvatarConfig, p: Prenda): AvatarConfig {
  return { ...a, [p.slot]: p.val };
}

/** ¿El avatar lleva puesta esta prenda? */
export function llevaPuesta(a: AvatarConfig, p: Prenda): boolean {
  return (a as unknown as Record<string, unknown>)[p.slot] === p.val;
}

/** Quita del avatar las prendas de pago que el jugador no tiene (por si cambió de cuenta). */
export function soloLoQueTiene(a: AvatarConfig, tiene: string[]): AvatarConfig {
  let out = { ...a };
  PRENDAS.forEach((p) => {
    if (p.precio > 0 && !tiene.includes(p.id) && llevaPuesta(out, p) && p.quitar) out = { ...out, [p.slot]: p.quitar };
  });
  return out;
}

/** Paquetes de monedas (compra dentro de la app; precios reales en App Store / Google Play). */
export const PAQUETES = [
  { id: 'monedas_500', monedas: 500 },
  { id: 'monedas_1200', monedas: 1200 },
  { id: 'monedas_2500', monedas: 2500 },
];

/** Paleta de colores del creador. */
export const COLORES: Record<string, readonly (readonly [string, string])[]> = {
  piel: [['#FFDCC2', 'Piel muy clara'], ['#F1C7A5', 'Piel clara'], ['#E0AC85', 'Piel media clara'], ['#C68B62', 'Piel media'], ['#8D5A3B', 'Piel oscura'], ['#5C3A28', 'Piel muy oscura']],
  colorOjos: [['#3A2418', 'Café oscuro'], ['#7A4A22', 'Café claro'], ['#2E5E9E', 'Azules'], ['#3B7A4A', 'Verdes'], ['#6A6F7A', 'Grises'], ['#7A4FD6', 'Morados']],
  colorPelo: [['#2B2E4A', 'Negro azulado'], ['#2B1D16', 'Negro'], ['#5A3A22', 'Castaño'], ['#C2692B', 'Pelirrojo'], ['#E8B04A', 'Rubio'], ['#7A4FD6', 'Morado'], ['#4ED6B0', 'Turquesa']],
  camisa: [['#E54B4B', 'Roja'], ['#FFFFFF', 'Blanca'], ['#FFC233', 'Amarilla'], ['#7FD1FF', 'Celeste'], ['#9BE564', 'Verde'], ['#F25F9C', 'Rosa'], ['#B18CFF', 'Lila'], ['#4ED6B0', 'Turquesa'], ['#FF9F80', 'Durazno']],
  pantalon: [['#2E3B5E', 'Azul marino'], ['#2C2C3A', 'Negro'], ['#4A3B6B', 'Morado'], ['#B9462A', 'Rojo'], ['#3B6B5A', 'Verde'], ['#7A5A3A', 'Café'], ['#E54B4B', 'Rojo claro']],
  colorZapatos: [['#FFC233', 'Amarillo'], ['#7FD1FF', 'Celeste'], ['#8A5530', 'Café'], ['#2C2C3A', 'Negro'], ['#F2F2F2', 'Blanco'], ['#E54B4B', 'Rojo'], ['#3A6EA5', 'Azul'], ['#F25F9C', 'Rosa']],
  colorAcc: [['#E8742A', 'Naranja'], ['#F25F9C', 'Rosa'], ['#F2784B', 'Coral'], ['#7FD1FF', 'Celeste'], ['#4ED6B0', 'Turquesa'], ['#FFC233', 'Amarillo'], ['#1E1E28', 'Negro']],
  colorDisfraz: [['#3DBE4A', 'Verde'], ['#3A7BD5', 'Azul'], ['#F25F9C', 'Rosa'], ['#B18CFF', 'Lila'], ['#FF9F40', 'Naranja'], ['#E54B4B', 'Rojo']],
};

// Estado del jugador: avatar, monedas, lo que tiene, pasos favoritos y puntos.
// Se guarda en el teléfono; con cuenta, también en Supabase (el servidor manda en monedas e inventario).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import * as audio from '@/audio/sonidos';
import { AVATAR_DEFAULT, type AvatarConfig, type DanceId } from '@/avatar/types';
import { articulo, GRATIS, soloLoQueTiene } from '@/data/catalogo';
import * as api from '@/lib/api';
import { conTopeDiario, diaDe, monedasContraBots, type ModoPartida } from '@/game/modo';
import { hayServidor } from '@/lib/supabase';

export type Modo = 'local' | 'cuenta';

export interface PartidaLocal {
  puntos: number;
  gano: boolean;
  fecha: number;
}

interface Estado {
  modo: Modo | null; // null = no ha entrado
  nombre: string;
  avatar: AvatarConfig;
  monedas: number;
  tiene: string[];
  favoritos: (DanceId | null)[];
  partidas: PartidaLocal[]; // historial local (para el ranking sin servidor)
  /** Monedas ganadas contra bots con cuenta, que el servidor todavía no tiene (ya están sumadas en `monedas`). */
  monedasPendientes: number;
  /** Música y sonidos apagados: se queda así (aun al cerrar la app o la sesión) hasta que se vuelvan a prender. */
  silencio: boolean;
  /** Monedas ganadas hoy contra bots (tienen tope diario). No se reinicia al cerrar sesión. */
  monedasHoy: { dia: string; n: number };
  ultimaGanancia: number;
  cargando: boolean;
  aviso: string;

  entrarLocal: (nombre?: string) => void;
  entrarConCuenta: () => Promise<void>;
  salir: () => Promise<void>;
  setSilencio: (v: boolean) => void;
  setNombre: (n: string) => void;
  setAvatar: (a: AvatarConfig) => void;
  setFavorito: (i: number, id: DanceId | null) => void;
  comprar: (id: string) => Promise<void>;
  sumarMonedas: (n: number) => void;
  /** Guarda el resultado y devuelve las monedas ganadas. Contra bots solo se ganan monedas (no puntos de ranking). */
  registrarPartida: (r: { puntos: number; gano: boolean; puesto: number; jugadores: number }, modo: ModoPartida) => Promise<number>;
  limpiarAviso: () => void;
}

const INICIAL = {
  modo: null as Modo | null,
  nombre: 'Tú',
  avatar: AVATAR_DEFAULT,
  monedas: 600,
  tiene: GRATIS,
  favoritos: ['brazos', 'balanceo', null, null] as (DanceId | null)[],
  partidas: [] as PartidaLocal[],
  monedasPendientes: 0,
  silencio: false,
  monedasHoy: { dia: '', n: 0 },
  ultimaGanancia: 0,
  cargando: false,
  aviso: '',
};

// Guardado en el servidor con un pequeño retraso (para no mandar cada toque del creador).
let pendiente: ReturnType<typeof setTimeout> | null = null;
function guardarLuego(get: () => Estado) {
  if (get().modo !== 'cuenta') return;
  if (pendiente) clearTimeout(pendiente);
  pendiente = setTimeout(() => {
    const s = get();
    api.guardarPerfil({ nombre: s.nombre, avatar: s.avatar, favoritos: s.favoritos }).catch(() => {});
  }, 800);
}

export const useJugador = create<Estado>()(
  persist(
    (set, get) => ({
      ...INICIAL,

      entrarLocal: (nombre) => set({ modo: 'local', nombre: (nombre || get().nombre || 'Tú').slice(0, 12) }),

      entrarConCuenta: async () => {
        set({ cargando: true });
        try {
          const p = await api.cargarPerfil();
          const tiene = Array.from(new Set([...GRATIS, ...p.tiene]));
          const avatar = soloLoQueTiene({ ...AVATAR_DEFAULT, ...(p.avatar as AvatarConfig) }, tiene);
          const fav = [0, 1, 2, 3].map((i) => {
            const f = p.favoritos?.[i] ?? null;
            return f && tiene.includes(f) ? f : null;
          });
          set({ modo: 'cuenta', nombre: p.nombre, avatar, monedas: p.monedas + get().monedasPendientes, tiene, favoritos: fav, cargando: false });
        } catch (e) {
          set({ cargando: false, aviso: (e as Error).message });
          throw e;
        }
      },

      salir: async () => {
        if (get().modo === 'cuenta' && hayServidor) {
          // antes de cerrar la sesión (después ya no se puede): que tus amigos te vean desconectado
          await api.desconectar().catch(() => {});
          await api.salir().catch(() => {});
        }
        set({ ...INICIAL, silencio: get().silencio, monedasHoy: get().monedasHoy });
      },

      setSilencio: (v) => {
        audio.setSilencio(v);
        set({ silencio: v });
      },

      setNombre: (n) => {
        set({ nombre: n.slice(0, 12) });
        guardarLuego(get);
      },

      setAvatar: (a) => {
        set({ avatar: soloLoQueTiene(a, get().tiene) });
        guardarLuego(get);
      },

      setFavorito: (i, id) => {
        const fav = get().favoritos.slice();
        // si ya estaba en otro lugar, se mueve
        const antes = id ? fav.indexOf(id) : -1;
        if (antes >= 0) fav[antes] = fav[i];
        fav[i] = id;
        set({ favoritos: fav });
        guardarLuego(get);
      },

      comprar: async (id) => {
        const a = articulo(id);
        const s = get();
        if (!a) throw new Error('Ese artículo no existe.');
        if (s.tiene.includes(id)) return;
        if (s.monedas < a.precio) throw new Error('No te alcanzan las monedas.');
        if (s.modo === 'cuenta') {
          const quedan = await api.comprar(id);
          set({ monedas: quedan, tiene: [...get().tiene, id] });
        } else {
          set({ monedas: s.monedas - a.precio, tiene: [...s.tiene, id] });
        }
      },

      sumarMonedas: (n) => set({ monedas: get().monedas + n }),

      registrarPartida: async (r, modoPartida) => {
        const s = get();
        if (modoPartida === 'bots') {
          // TODO(fase 4): subir monedasPendientes al servidor cuando vuelva la conexión
          const dia = diaDe(Date.now());
          const yaHoy = s.monedasHoy.dia === dia ? s.monedasHoy.n : 0;
          const ganadas = conTopeDiario(monedasContraBots(r.puntos), yaHoy);
          set({
            monedasHoy: { dia, n: yaHoy + ganadas },
            monedas: s.monedas + ganadas,
            monedasPendientes: s.modo === 'cuenta' ? s.monedasPendientes + ganadas : 0,
            ultimaGanancia: 0,
          });
          return ganadas;
        }
        const partidas = [...s.partidas, { puntos: r.puntos, gano: r.gano, fecha: Date.now() }].slice(-200);
        if (s.modo === 'cuenta') {
          try {
            const { monedas, ganadas } = await api.registrarPartida(r);
            set({ monedas, partidas, ultimaGanancia: r.puntos });
            return ganadas;
          } catch (e) {
            set({ partidas, ultimaGanancia: r.puntos, aviso: (e as Error).message });
            return 0;
          }
        }
        const ganadas = Math.floor(r.puntos / 10);
        set({ monedas: s.monedas + ganadas, partidas, ultimaGanancia: r.puntos });
        return ganadas;
      },

      limpiarAviso: () => set({ aviso: '' }),
    }),
    {
      name: 'sillas-jugador',
      storage: createJSONStorage(() => AsyncStorage),
      // al abrir la app, el audio arranca como se dejó
      onRehydrateStorage: () => (s) => {
        if (s) audio.setSilencio(s.silencio);
      },
      partialize: (s) => ({
        modo: s.modo,
        nombre: s.nombre,
        avatar: s.avatar,
        monedas: s.monedas,
        tiene: s.tiene,
        favoritos: s.favoritos,
        partidas: s.partidas,
        monedasPendientes: s.monedasPendientes,
        silencio: s.silencio,
        monedasHoy: s.monedasHoy,
        ultimaGanancia: s.ultimaGanancia,
      }),
    },
  ),
);

/** Puntos de esta semana (desde el lunes) con el historial local. */
export function puntosSemana(partidas: PartidaLocal[]) {
  const d = new Date();
  const lunes = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime();
  return partidas.filter((p) => p.fecha >= lunes).reduce((a, p) => a + p.puntos, 0);
}

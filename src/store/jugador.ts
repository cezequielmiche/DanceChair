// Estado del jugador: avatar, monedas, lo que tiene, pasos favoritos y puntos.
// Se guarda en el teléfono; con cuenta, también en Supabase (el servidor manda en monedas e inventario).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import * as audio from '@/audio/sonidos';
import { AVATAR_DEFAULT, type AvatarConfig, type DanceId } from '@/avatar/types';
import { articulo, GRATIS, soloLoQueTiene } from '@/data/catalogo';
import * as api from '@/lib/api';
import type { Dificultad } from '@/game/juego';
import { conTopeDiario, diaDe, type ModoPartida } from '@/game/modo';
import { hayServidor } from '@/lib/supabase';

export type Modo = 'local' | 'cuenta';

type Resumen = { puntos: number; monedas: number; gano: boolean; puesto: number; jugadores: number; pasos: number };

const sumar = (m: Record<string, number>) => Object.values(m).reduce((a, n) => a + n, 0);

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
  /**
   * Monedas ganadas contra bots con cuenta que el servidor todavía no tiene, por día local ("2026-10-14"):
   * el servidor acepta hasta 150 por día. Ya están sumadas en `monedas`.
   */
  monedasPendientes: Record<string, number>;
  /** Música y sonidos apagados: se queda así (aun al cerrar la app o la sesión) hasta que se vuelvan a prender. */
  silencio: boolean;
  /** Qué tan rápido se sientan los bots al jugar sin internet (en línea siempre es Normal). Es del teléfono: no se borra al cerrar sesión. */
  dificultad: Dificultad;
  /** Monedas ganadas hoy contra bots (tienen tope diario). No se reinicia al cerrar sesión. */
  monedasHoy: { dia: string; n: number };
  ultimaGanancia: number;
  /** Monedas que dio la última partida (en línea o contra bots). */
  ultimasMonedas: number;
  cargando: boolean;
  aviso: string;

  entrarLocal: (nombre?: string) => void;
  entrarConCuenta: () => Promise<void>;
  salir: () => Promise<void>;
  setSilencio: (v: boolean) => void;
  setDificultad: (d: Dificultad) => void;
  setNombre: (n: string) => void;
  setAvatar: (a: AvatarConfig) => void;
  setFavorito: (i: number, id: DanceId | null) => void;
  comprar: (id: string) => Promise<void>;
  sumarMonedas: (n: number) => void;
  /**
   * Guarda el resultado y devuelve las monedas ganadas y los puntos de ranking. Contra bots solo se ganan
   * monedas; en línea, puntos y monedas los calcula el servidor (`sala`).
   */
  registrarPartida: (r: Resumen, modo: ModoPartida, sala?: string) => Promise<{ monedas: number; puntos: number }>;
  /** Sube al servidor las monedas ganadas contra bots sin conexión (si se puede; si no, se queda para después). */
  subirPendientes: () => Promise<void>;
  limpiarAviso: () => void;
}

const INICIAL = {
  modo: null as Modo | null,
  nombre: 'Tú',
  avatar: AVATAR_DEFAULT,
  monedas: 250,
  tiene: GRATIS,
  favoritos: ['brazos', 'balanceo', null, null] as (DanceId | null)[],
  partidas: [] as PartidaLocal[],
  monedasPendientes: {} as Record<string, number>,
  silencio: false,
  dificultad: 'Normal' as Dificultad,
  monedasHoy: { dia: '', n: 0 },
  ultimaGanancia: 0,
  ultimasMonedas: 0,
  cargando: false,
  aviso: '',
};

let subiendo = false;

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
          set({ modo: 'cuenta', nombre: p.nombre, avatar, monedas: p.monedas + sumar(get().monedasPendientes), tiene, favoritos: fav, cargando: false });
          get().subirPendientes();
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
        set({ ...INICIAL, silencio: get().silencio, dificultad: get().dificultad, monedasHoy: get().monedasHoy });
      },

      setSilencio: (v) => {
        audio.setSilencio(v);
        set({ silencio: v });
      },

      setDificultad: (d) => set({ dificultad: d }),

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

      registrarPartida: async (r, modoPartida, sala) => {
        const s = get();
        if (modoPartida === 'bots') {
          const dia = diaDe(Date.now());
          const yaHoy = s.monedasHoy.dia === dia ? s.monedasHoy.n : 0;
          const ganadas = conTopeDiario(r.monedas, yaHoy);
          const pendientes = s.modo === 'cuenta' ? { ...s.monedasPendientes, [dia]: (s.monedasPendientes[dia] ?? 0) + ganadas } : {};
          set({ monedasHoy: { dia, n: yaHoy + ganadas }, monedas: s.monedas + ganadas, monedasPendientes: pendientes, ultimaGanancia: 0, ultimasMonedas: ganadas });
          // por si se jugó contra bots porque el servidor no respondía y ya volvió
          if (s.modo === 'cuenta') get().subirPendientes();
          return { monedas: ganadas, puntos: 0 };
        }
        if (s.modo === 'cuenta' && sala) {
          // en línea manda el servidor; si se corta la conexión se reintenta (solo cobra una vez)
          for (let intento = 0; ; intento++) {
            try {
              const c = await api.cobrarPartida(sala, r.pasos);
              set({
                monedas: c.monedas_total + sumar(get().monedasPendientes),
                partidas: [...get().partidas, { puntos: c.puntos, gano: c.gano, fecha: Date.now() }].slice(-200),
                ultimaGanancia: c.puntos,
                ultimasMonedas: c.ganadas,
              });
              return { monedas: c.ganadas, puntos: c.puntos };
            } catch (e) {
              if (intento >= 2) {
                set({ aviso: (e as Error).message });
                return { monedas: 0, puntos: 0 };
              }
              await new Promise((ok) => setTimeout(ok, 1500));
            }
          }
        }
        const ganadas = r.monedas;
        set({ monedas: s.monedas + ganadas, partidas: [...s.partidas, { puntos: r.puntos, gano: r.gano, fecha: Date.now() }].slice(-200), ultimaGanancia: r.puntos, ultimasMonedas: ganadas });
        return { monedas: ganadas, puntos: r.puntos };
      },

      subirPendientes: async () => {
        if (subiendo || get().modo !== 'cuenta') return;
        subiendo = true;
        try {
          for (const [dia, n] of Object.entries(get().monedasPendientes)) {
            const r = await api.subirMonedasBots(dia, n);
            // lo que no aceptó (pasó el tope del día o es muy viejo) se descarta; si mientras tanto se ganaron
            // más ese día, esas se quedan para la próxima
            const resto = { ...get().monedasPendientes };
            const quedan = (resto[dia] ?? 0) - n;
            if (quedan > 0) resto[dia] = quedan;
            else delete resto[dia];
            set({ monedasPendientes: resto, monedas: r.monedas_total + sumar(resto) });
          }
        } catch {
          // sin conexión: se intenta después
        } finally {
          subiendo = false;
        }
      },

      limpiarAviso: () => set({ aviso: '' }),
    }),
    {
      name: 'sillas-jugador',
      storage: createJSONStorage(() => AsyncStorage),
      // v1: monedasPendientes pasó de un número a monedas por día
      version: 1,
      migrate: (viejo, version) => {
        const s = viejo as Partial<Estado> & { monedasPendientes?: unknown };
        if (version < 1) {
          const n = typeof s.monedasPendientes === 'number' ? s.monedasPendientes : 0;
          s.monedasPendientes = n > 0 ? { [diaDe(Date.now())]: n } : {};
        }
        return s as Estado;
      },
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
        dificultad: s.dificultad,
        monedasHoy: s.monedasHoy,
        ultimaGanancia: s.ultimaGanancia,
        ultimasMonedas: s.ultimasMonedas,
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

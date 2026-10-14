// Mientras la app está abierta con cuenta, avisa al servidor cada 45 s que sigues conectado (así tus amigos
// te ven en línea). Al mandar la app al fondo o cerrar sesión, te marca desconectado de inmediato.
import { useEffect } from 'react';
import { AppState } from 'react-native';

import * as api from './api';

const CADA_MS = 45_000;

export function useLatido(conCuenta: boolean) {
  useEffect(() => {
    if (!conCuenta) return;
    let t: ReturnType<typeof setInterval> | null = null;
    const prender = () => {
      if (t) return;
      api.latido().catch(() => {});
      t = setInterval(() => api.latido().catch(() => {}), CADA_MS);
    };
    const apagar = () => {
      if (t) clearInterval(t);
      t = null;
      api.desconectar().catch(() => {});
    };
    if (AppState.currentState === 'active') prender();
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? prender() : apagar()));
    return () => {
      sub.remove();
      apagar();
    };
  }, [conCuenta]);
}

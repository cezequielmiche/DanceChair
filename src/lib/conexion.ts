// Revisa si hay internet antes de jugar (el modo se elige con elegirModo, en src/game/modo.ts).
import * as Network from 'expo-network';

import { hayServidor } from './supabase';

const ESPERA_MS = 3000;

/**
 * true si hay internet de verdad. El estado de la red solo dice si hay wifi o datos (en iOS
 * `isInternetReachable` es lo mismo que `isConnected`), así que con servidor se le pregunta a Supabase.
 */
export async function hayInternet(): Promise<boolean> {
  const red = await Network.getNetworkStateAsync().catch(() => null);
  if (red && red.isConnected === false) return false;
  if (red && red.isInternetReachable === false) return false;
  if (!hayServidor) return !!red?.isConnected;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
  const corte = new AbortController();
  const t = setTimeout(() => corte.abort(), ESPERA_MS);
  try {
    // cualquier respuesta (aunque sea un error HTTP) quiere decir que el servidor se alcanza
    await fetch(`${url}/auth/v1/health`, { headers: { apikey: key }, signal: corte.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

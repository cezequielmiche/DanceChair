// Cliente de Supabase. Si no hay URL/clave en .env, la app funciona en "modo local" (sin cuentas).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const hayServidor = /^https:\/\//.test(url) && key.length > 20 && !url.includes('TU-PROYECTO');

export const supabase: SupabaseClient | null = hayServidor
  ? createClient(url, key, {
      auth: {
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
        flowType: 'pkce',
      },
    })
  : null;

// En el teléfono, la sesión se refresca solo mientras la app está abierta.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (s) => {
    if (s === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

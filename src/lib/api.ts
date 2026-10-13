// Llamadas al servidor (Supabase). Todas fallan con un Error con mensaje en español.
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import type { AvatarConfig, DanceId } from '@/avatar/types';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export interface PerfilServidor {
  id: string;
  nombre: string;
  avatar: Partial<AvatarConfig>;
  favoritos: (DanceId | null)[];
  monedas: number;
  tiene: string[];
}

export interface FilaRanking {
  puesto: number;
  user_id: string;
  nombre: string;
  avatar: Partial<AvatarConfig>;
  puntos: number;
  es_tu: boolean;
}

function sb() {
  if (!supabase) throw new Error('El servidor no está configurado.');
  return supabase;
}

function error(e: unknown): Error {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/Invalid login credentials/i.test(m)) return new Error('Correo o contraseña incorrectos.');
  if (/already registered/i.test(m)) return new Error('Ese correo ya tiene cuenta. Inicia sesión.');
  if (/Email not confirmed/i.test(m)) return new Error('Confirma tu correo desde el mensaje que te enviamos.');
  if (/network|fetch/i.test(m)) return new Error('Sin conexión. Revisa tu internet.');
  return new Error(m);
}

// ---------------------------------------------------------------- Cuentas
export async function entrarConCorreo(correo: string, clave: string) {
  const { error: e } = await sb().auth.signInWithPassword({ email: correo.trim(), password: clave });
  if (e) throw error(e);
}

export async function crearCuenta(correo: string, clave: string, nombre: string) {
  const { data, error: e } = await sb().auth.signUp({
    email: correo.trim(),
    password: clave,
    options: { data: { nombre: nombre.trim().slice(0, 12) } },
  });
  if (e) throw error(e);
  // Si el proyecto pide confirmar el correo, todavía no hay sesión.
  return { necesitaConfirmar: !data.session };
}

export async function recuperarClave(correo: string) {
  const { error: e } = await sb().auth.resetPasswordForEmail(correo.trim());
  if (e) throw error(e);
}

/** Google (y cualquier proveedor OAuth de Supabase) con el navegador del sistema. */
export async function entrarConGoogle() {
  const redirectTo = AuthSession.makeRedirectUri({ scheme: 'sillasbailarinas', path: 'auth' });
  const { data, error: e } = await sb().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' },
  });
  if (e) throw error(e);
  if (Platform.OS === 'web' || !data?.url) return;
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') return;
  const code = new URL(res.url).searchParams.get('code');
  if (!code) throw new Error('Google no devolvió la sesión.');
  const { error: e2 } = await sb().auth.exchangeCodeForSession(code);
  if (e2) throw error(e2);
}

/** Apple: solo en iPhone, con la hoja nativa. */
export async function entrarConApple() {
  const cred = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
  });
  if (!cred.identityToken) throw new Error('Apple no devolvió la sesión.');
  const { error: e } = await sb().auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken });
  if (e) throw error(e);
}

export async function salir() {
  await sb().auth.signOut();
}

export async function usuarioActual() {
  const { data } = await sb().auth.getSession();
  return data.session?.user ?? null;
}

// ---------------------------------------------------------------- Perfil e inventario
export async function cargarPerfil(): Promise<PerfilServidor> {
  const user = await usuarioActual();
  if (!user) throw new Error('Inicia sesión.');
  const [p, inv] = await Promise.all([
    sb().from('perfiles').select('id, nombre, avatar, favoritos, monedas').eq('id', user.id).single(),
    sb().from('inventario').select('item_id'),
  ]);
  if (p.error) throw error(p.error);
  if (inv.error) throw error(inv.error);
  return { ...(p.data as Omit<PerfilServidor, 'tiene'>), tiene: (inv.data ?? []).map((r) => r.item_id as string) };
}

export async function guardarPerfil(cambios: { nombre?: string; avatar?: AvatarConfig; favoritos?: (DanceId | null)[] }) {
  const user = await usuarioActual();
  if (!user) return;
  const { error: e } = await sb().from('perfiles').update(cambios).eq('id', user.id);
  if (e) throw error(e);
}

/** Compra con monedas (el precio y el saldo los revisa el servidor). Devuelve las monedas que quedan. */
export async function comprar(itemId: string): Promise<number> {
  const { data, error: e } = await sb().rpc('comprar', { p_item: itemId });
  if (e) throw error(e);
  return data as number;
}

export async function registrarPartida(r: { puntos: number; gano: boolean; puesto: number; jugadores: number }) {
  const { data, error: e } = await sb().rpc('registrar_partida', {
    p_puntos: r.puntos,
    p_gano: r.gano,
    p_puesto: r.puesto,
    p_jugadores: r.jugadores,
  });
  if (e) throw error(e);
  const fila = (data as { monedas_total: number; ganadas: number }[])[0];
  return { monedas: fila.monedas_total, ganadas: fila.ganadas };
}

export async function ranking(tipo: 'semanal' | 'global' | 'amigos'): Promise<FilaRanking[]> {
  const { data, error: e } = await sb().rpc('ranking', { p_tipo: tipo, p_limite: 50 });
  if (e) throw error(e);
  return (data ?? []) as FilaRanking[];
}

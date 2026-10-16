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
    // el enlace del correo de confirmación abre la app (si no, Supabase manda a localhost:3000)
    options: { data: { nombre: nombre.trim().slice(0, 12) }, emailRedirectTo: urlDeVuelta() },
  });
  if (e) throw error(e);
  // Si el proyecto pide confirmar el correo, todavía no hay sesión.
  return { necesitaConfirmar: !data.session };
}

export async function recuperarClave(correo: string) {
  const { error: e } = await sb().auth.resetPasswordForEmail(correo.trim());
  if (e) throw error(e);
}

/**
 * A dónde vuelven los enlaces de Supabase (confirmar correo, Google): la pantalla src/app/auth.tsx.
 * En Expo Go es exp://<ip>:8081/--/auth; en un build propio, sillasbailarinas://auth. Ambas deben estar en
 * Supabase → Authentication → URL Configuration → Redirect URLs.
 */
export function urlDeVuelta() {
  return AuthSession.makeRedirectUri({ scheme: 'sillasbailarinas', path: 'auth' });
}

/** Cambia el código que trae un enlace de Supabase por la sesión (inicia sesión en este teléfono). */
export async function completarEnlace(codigo: string) {
  const { error: e } = await sb().auth.exchangeCodeForSession(codigo);
  if (e) throw error(e);
}

/** Google (y cualquier proveedor OAuth de Supabase) con el navegador del sistema. */
export async function entrarConGoogle() {
  const redirectTo = urlDeVuelta();
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

export interface Cobro {
  /** Puntos de ranking (solo cuentan las personas que eliminaste, no los bots). */
  puntos: number;
  /** Monedas que ganaste en esta partida. */
  ganadas: number;
  gano: boolean;
  puesto: number;
  jugadores: number;
  /** Tus monedas en el servidor después de cobrar. */
  monedas_total: number;
}

/**
 * Cobra una partida en línea: el servidor calcula puesto, puntos y monedas con lo que él arbitró. Del
 * teléfono solo toma los pasos bailados (con tope). Se puede llamar varias veces: solo cobra la primera.
 */
export async function cobrarPartida(sala: string, pasos: number): Promise<Cobro> {
  const { data, error: e } = await sb().rpc('cobrar_partida', { p_sala: sala, p_pasos: pasos });
  if (e) throw error(e);
  return data as Cobro;
}

/** Sube las monedas ganadas contra bots en un día (el servidor acepta hasta 150 por día). */
export async function subirMonedasBots(dia: string, monedas: number): Promise<{ aceptadas: number; monedas_total: number }> {
  const { data, error: e } = await sb().rpc('subir_monedas_bots', { p_dia: dia, p_monedas: monedas });
  if (e) throw error(e);
  return data as { aceptadas: number; monedas_total: number };
}

export async function ranking(tipo: 'semanal' | 'global' | 'amigos'): Promise<FilaRanking[]> {
  const { data, error: e } = await sb().rpc('ranking', { p_tipo: tipo, p_limite: 50 });
  if (e) throw error(e);
  return (data ?? []) as FilaRanking[];
}

// ---------------------------------------------------------------- Salas (partidas en línea)
export interface JugadorSala {
  user_id: string;
  nombre: string;
  avatar: Partial<AvatarConfig>;
  tu: boolean;
}

export interface EstadoSala {
  id: string;
  estado: 'esperando' | 'jugando' | 'terminada';
  dificultad: 'Fácil' | 'Normal' | 'Difícil';
  semilla: number;
  /** Lugares que se completan con bots (se sabe al arrancar). */
  bots: number;
  /** Hora del servidor (para medir la cuenta regresiva aunque el reloj del teléfono esté mal). */
  ahora: string;
  /** Cuándo arranca la sala aunque no se llene. */
  empieza: string;
  inicio: string | null;
  jugadores: JugadorSala[];
}

/** Entra a una sala en espera (o crea una) y devuelve su id. */
export async function buscarSala(dificultad: EstadoSala['dificultad']): Promise<string> {
  const { data, error: e } = await sb().rpc('buscar_sala', { p_dificultad: dificultad });
  if (e) throw error(e);
  return data as string;
}

/** Cómo va la sala. Si ya se llenó o pasó el tiempo, el servidor la arranca. */
export async function estadoSala(id: string): Promise<EstadoSala> {
  const { data, error: e } = await sb().rpc('estado_sala', { p_sala: id });
  if (e) throw error(e);
  return data as EstadoSala;
}

export async function salirSala(id: string) {
  const { error: e } = await sb().rpc('salir_sala', { p_sala: id });
  if (e) throw error(e);
}

// ---------------------------------------------------------------- Partida en línea
/** Lo que manda el servidor durante la partida. Horas en milisegundos desde 1970 (reloj del servidor). */
export interface EstadoPartida {
  estado: EstadoSala['estado'];
  ronda: number;
  ahora: number;
  /** Cuándo empieza la música de la ronda actual y cuándo para. */
  inicio: number | null;
  alto: number | null;
  /** Claves de los que siguen: user_id de los jugadores, 'bot1', 'bot2'… de los bots. */
  vivos: string[];
  /** Quiénes quedaron fuera, en orden. */
  fuera: { quien: string; ronda: number }[];
  ganador: string | null;
  /** Quiénes ya llegaron a una silla en la ronda actual. */
  reclamos: { quien: string; hora: number }[];
  /** Quiénes se sentaron en la ronda anterior (sin el que quedó fuera), por si la ronda se cerró entre consultas. */
  anteriores?: { quien: string; hora: number }[];
  /** Cuándo llega cada bot en la ronda actual (ya decidido aunque no haya pasado). */
  bots_llegan?: { quien: string; hora: number }[];
}

/** Cómo va la partida. Si ya toca cerrar la ronda, el servidor la cierra al consultar. */
export async function estadoPartida(sala: string): Promise<EstadoPartida> {
  const { data, error: e } = await sb().rpc('estado_partida', { p_sala: sala });
  if (e) throw error(e);
  return data as EstadoPartida;
}

/**
 * Sentarse. `hora`: cuándo tocaste, en el reloj del servidor (ms); el servidor la acepta si no es de más de
 * 250 ms antes de que llegue el aviso (así el retraso de internet no cuenta en tu contra).
 */
export async function reclamarSilla(sala: string, ronda: number, hora?: number): Promise<EstadoPartida> {
  const { data, error: e } = await sb().rpc('reclamar_silla', { p_sala: sala, p_ronda: ronda, ...(hora != null ? { p_hora: Math.round(hora) } : {}) });
  if (e) throw error(e);
  return data as EstadoPartida;
}

/** La sala de la partida de un amigo, para mirarla (nadie sale como "tú"). */
export async function verSala(sala: string): Promise<EstadoSala> {
  const { data, error: e } = await sb().rpc('ver_sala', { p_sala: sala });
  if (e) throw error(e);
  return data as EstadoSala;
}

/** Cómo va la partida de un amigo (como estadoPartida, pero solo para mirar). */
export async function verPartida(sala: string): Promise<EstadoPartida> {
  const { data, error: e } = await sb().rpc('ver_partida', { p_sala: sala });
  if (e) throw error(e);
  return data as EstadoPartida;
}

// ---------------------------------------------------------------- Amigos y conexión
export interface Amigo {
  id: string;
  nombre: string;
  avatar: Partial<AvatarConfig>;
  conectado: boolean;
  /** Último latido (null si nunca abrió la app con esta versión). */
  visto: string | null;
  /** Sala en la que está jugando ahora (para ver su partida), o null. */
  sala: string | null;
}

export interface JugadorEncontrado {
  id: string;
  nombre: string;
  avatar: Partial<AvatarConfig>;
  /** 'amigo', 'enviada' (pendiente), 'recibida' (te la mandó) o null. */
  estado: 'amigo' | 'enviada' | 'recibida' | null;
}

export interface Solicitud {
  id: string;
  nombre: string;
  avatar: Partial<AvatarConfig>;
  /** 'recibida' = puedes aceptarla o rechazarla; 'enviada' = la mandaste tú (pendiente). */
  tipo: 'recibida' | 'enviada';
}

/** Mis amigos, primero los conectados. */
export async function misAmigos(): Promise<Amigo[]> {
  const { data, error: e } = await sb().rpc('mis_amigos');
  if (e) throw error(e);
  return (data ?? []) as Amigo[];
}

export async function buscarJugadores(texto: string): Promise<JugadorEncontrado[]> {
  const { data, error: e } = await sb().rpc('buscar_jugadores', { p_texto: texto });
  if (e) throw error(e);
  return (data ?? []) as JugadorEncontrado[];
}

/** Manda solicitud de amistad. Devuelve 'amigos' si el otro ya te había mandado una (quedan como amigos). */
export async function enviarSolicitud(id: string): Promise<'enviada' | 'amigos'> {
  const { data, error: e } = await sb().rpc('enviar_solicitud', { p_para: id });
  if (e) throw error(e);
  return data as 'enviada' | 'amigos';
}

export async function responderSolicitud(de: string, acepta: boolean) {
  const { error: e } = await sb().rpc('responder_solicitud', { p_de: de, p_acepta: acepta });
  if (e) throw error(e);
}

export async function cancelarSolicitud(para: string) {
  const { error: e } = await sb().rpc('cancelar_solicitud', { p_para: para });
  if (e) throw error(e);
}

/** Deja de ser amigos (para los dos). */
export async function quitarAmigo(id: string) {
  const { error: e } = await sb().rpc('quitar_amigo', { p_amigo: id });
  if (e) throw error(e);
}

/** Recibidas primero y luego las que mandaste. */
export async function misSolicitudes(): Promise<Solicitud[]> {
  const { data, error: e } = await sb().rpc('mis_solicitudes');
  if (e) throw error(e);
  return (data ?? []) as Solicitud[];
}

/** Para el numerito del ícono de amigos. */
export async function solicitudesRecibidas(): Promise<number> {
  const { data, error: e } = await sb().rpc('solicitudes_recibidas');
  if (e) throw error(e);
  return (data as number) ?? 0;
}

/** "Sigo conectado" (la app lo manda cada 45 s mientras está abierta con cuenta). */
export async function latido() {
  const { error: e } = await sb().rpc('latido');
  if (e) throw error(e);
}

export async function desconectar() {
  const { error: e } = await sb().rpc('desconectar');
  if (e) throw error(e);
}

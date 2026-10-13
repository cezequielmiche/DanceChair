// Música del juego y efectos (archivos propios en assets/audio, generados para el juego).
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const ARCHIVOS = {
  musica: require('../../assets/audio/musica.wav'),
  alto: require('../../assets/audio/alto.wav'),
  sentado: require('../../assets/audio/sentado.wav'),
  ganaste: require('../../assets/audio/ganaste.wav'),
  paso: require('../../assets/audio/paso.wav'),
};
type Efecto = Exclude<keyof typeof ARCHIVOS, 'musica'>;

let listo = false;
let musica: AudioPlayer | null = null;
const efectos: Partial<Record<Efecto, AudioPlayer>> = {};
let silencio = false;

export async function prepararAudio() {
  if (listo) return;
  listo = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' });
  } catch {}
  musica = createAudioPlayer(ARCHIVOS.musica);
  musica.loop = true;
  (Object.keys(ARCHIVOS) as (keyof typeof ARCHIVOS)[]).forEach((k) => {
    if (k !== 'musica') efectos[k] = createAudioPlayer(ARCHIVOS[k]);
  });
}

export function setSilencio(v: boolean) {
  silencio = v;
  if (v) musica?.pause();
}
export const enSilencio = () => silencio;

/** La música se acelera un poco cada ronda. */
export function musicaOn(ronda: number) {
  if (!musica || silencio) return;
  try {
    musica.playbackRate = Math.min(1.5, 1 + (ronda - 1) * 0.06);
    musica.play();
  } catch {}
}

export function musicaOff() {
  try {
    musica?.pause();
  } catch {}
}

export function efecto(e: Efecto) {
  if (!silencio) {
    const p = efectos[e];
    if (p) {
      try {
        p.seekTo(0);
        p.play();
      } catch {}
    }
  }
  if (Platform.OS === 'web') return;
  if (e === 'alto') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  else if (e === 'sentado') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  else if (e === 'ganaste') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else Haptics.selectionAsync().catch(() => {});
}

export function liberarAudio() {
  musica?.release();
  Object.values(efectos).forEach((p) => p?.release());
  musica = null;
  listo = false;
}

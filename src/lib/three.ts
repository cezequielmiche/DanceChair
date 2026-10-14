// Ajustes globales de three. Se importa una vez desde los visores 3D.
import * as THREE from 'three';

// Avisos que no son nuestros y salen cada vez que se monta o se cierra un visor; los demás avisos siguen.
// - @react-three/fiber 9 crea un THREE.Clock (deprecado desde three r183) en cada <Canvas>.
// - expo-gl no tiene esas extensiones de WebGL; three las pide por si acaso y sigue sin ellas.
const AVISOS_IGNORADOS = [
  'THREE.Clock: This module has been deprecated',
  'THREE.WebGLRenderer: WEBGL_lose_context extension not supported',
  'THREE.WebGLRenderer: EXT_color_buffer_float extension not supported',
];

THREE.setConsoleFunction((tipo, mensaje, ...resto) => {
  if (tipo === 'warn' && AVISOS_IGNORADOS.some((a) => mensaje.startsWith(a))) return;
  const log = tipo === 'error' ? console.error : tipo === 'warn' ? console.warn : console.log;
  log(mensaje, ...resto);
});

/** Render de los visores 3D: tone mapping neutral (ACES oscurecía y apagaba los colores de los avatares). */
export const GL_VISOR = { toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.15 };

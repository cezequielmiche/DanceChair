// Ajustes globales de three. Se importa una vez desde los visores 3D.
import * as THREE from 'three';

// @react-three/fiber 9 crea un THREE.Clock (deprecado desde three r183) en cada <Canvas>: el aviso no es
// nuestro y sale cada vez que se monta un visor. Se calla solo ese; los demás avisos de three siguen.
const AVISOS_IGNORADOS = ['THREE.Clock: This module has been deprecated'];

THREE.setConsoleFunction((tipo, mensaje, ...resto) => {
  if (tipo === 'warn' && AVISOS_IGNORADOS.some((a) => mensaje.startsWith(a))) return;
  const log = tipo === 'error' ? console.error : tipo === 'warn' ? console.warn : console.log;
  log(mensaje, ...resto);
});

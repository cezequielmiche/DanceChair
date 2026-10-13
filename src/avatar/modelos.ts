// Carga de los modelos (Chico.glb y Chica.glb) una sola vez para toda la app.
import { useLoader } from '@react-three/fiber/native';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import type { ModeloGLTF } from './rig';
import type { Cuerpo } from './types';

const ARCHIVOS = {
  hombre: require('../../assets/models/Chico.glb'),
  mujer: require('../../assets/models/Chica.glb'),
};

// En el teléfono react-three-fiber abre los require() directamente; en la web se usa la URL del archivo.
const fuente = (m: number | string) => (Platform.OS === 'web' ? Asset.fromModule(m).uri : m) as unknown as string;
const FUENTES = [fuente(ARCHIVOS.hombre), fuente(ARCHIVOS.mujer)];

/** Úsalo dentro de un <Canvas> (con <Suspense>). Devuelve los dos modelos. */
export function useModelos(): Record<Cuerpo, ModeloGLTF> {
  const [hombre, mujer] = useLoader(GLTFLoader, FUENTES) as unknown as ModeloGLTF[];
  return { hombre, mujer };
}

export function precargarModelos() {
  useLoader.preload(GLTFLoader, FUENTES);
}

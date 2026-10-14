// Genera las imágenes de la tienda (assets/images/tienda) dibujando cada artículo con los modelos 3D en un
// teléfono Android conectado por USB, y manda los píxeles a la computadora (receptor.cjs). Ver LEEME.md.
// Para los pasos de baile saca 8 poses candidatas (paso_0 … paso_7): se elige una y se copia como paso.png.
import { Canvas, useThree } from '@react-three/fiber/native';
import type { ExpoWebGLRenderingContext } from 'expo-gl';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useModelos } from '@/avatar/modelos';
import { AvatarRig } from '@/avatar/rig';
import { AVATAR_CHICA, AVATAR_CHICO, type AvatarAnim, type AvatarConfig } from '@/avatar/types';
import { GL_VISOR } from '@/lib/three';

type Toma = { id: string; config: AvatarConfig; anim: AvatarAnim; t: number; busto?: boolean; giro: number };

const CHICO = AVATAR_CHICO;
const CHICA = AVATAR_CHICA;
const DURA: Partial<Record<AvatarAnim, number>> = { brazos: 1.67, balanceo: 1.67, disco: 1.67, robot: 1.67, macarena: 3.33, aura: 1.67, dab: 3.33, moonwalk: 0.83 };
const TOMAS: Toma[] = [
  { id: 'chaqueta', config: CHICO, anim: 'idle', t: 0.3, giro: 0.35 },
  { id: 'blusa', config: CHICA, anim: 'idle', t: 0.3, giro: 0.35 },
  { id: 'jeans', config: CHICO, anim: 'idle', t: 0.3, giro: 0.35 },
  { id: 'falda', config: CHICA, anim: 'idle', t: 0.3, giro: 0.35 },
  { id: 'tenis', config: CHICO, anim: 'idle', t: 0.3, giro: 0.35 },
  { id: 'zapatos', config: CHICA, anim: 'idle', t: 0.3, giro: 0.35 },
  { id: 'lentes', config: { ...CHICO, lentes: 'si' }, anim: 'idle', t: 0.3, busto: true, giro: 0.3 },
  { id: 'audifonos', config: { ...CHICA, audifonos: 'si' }, anim: 'idle', t: 0.3, busto: true, giro: 0.3 },
  { id: 'dino', config: { ...CHICO, disfraz: 'dino' }, anim: 'idle', t: 0.3, giro: 0.45 },
  ...(['brazos', 'balanceo', 'disco', 'robot', 'macarena', 'aura', 'dab', 'moonwalk'] as const).flatMap((a) =>
    [0, 1, 2, 3, 4, 5, 6, 7].map((k) => ({ id: `${a}_${k}`, config: CHICO, anim: a, t: ((k + 0.5) / 8) * DURA[a]!, giro: a === 'moonwalk' ? Math.PI / 2 : 0.15 })),
  ),
];

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function aBase64(b: Uint8Array) {
  let s = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    s += ABC[(n >> 18) & 63] + ABC[(n >> 12) & 63] + (i + 1 < b.length ? ABC[(n >> 6) & 63] : '=') + (i + 2 < b.length ? ABC[n & 63] : '=');
  }
  return s;
}

function Fotografo({ log }: { log: (s: string) => void }) {
  const modelos = useModelos();
  const { gl, scene, camera } = useThree();
  const hecho = useRef(false);
  useEffect(() => {
    // una sola vez: useModelos() da un objeto nuevo en cada render y el efecto se volvía a lanzar
    if (hecho.current) return;
    hecho.current = true;
    (async () => {
      const cam = camera as import('three').PerspectiveCamera;
      for (const toma of TOMAS) {
        const rig = new AvatarRig(modelos[toma.config.cuerpo], toma.config);
        rig.setAnim(toma.anim, 0);
        rig.actualizar(toma.t);
        rig.raiz.rotation.y = toma.giro;
        scene.add(rig.raiz);
        if (toma.busto) {
          cam.position.set(0, 1.1, 2.5);
          cam.fov = 26;
          cam.updateProjectionMatrix();
          cam.lookAt(0, 1.0, 0);
        } else {
          cam.position.set(0, 0.85, 3.5);
          cam.fov = 30;
          cam.updateProjectionMatrix();
          cam.lookAt(0, 0.62, 0);
        }
        gl.setClearColor(0x000000, 0);
        gl.clear(true, true, true);
        gl.render(scene, cam);
        const ctx = gl.getContext() as unknown as ExpoWebGLRenderingContext;
        const w = ctx.drawingBufferWidth;
        const h = ctx.drawingBufferHeight;
        const px = new Uint8Array(w * h * 4);
        ctx.readPixels(0, 0, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
        const r = await fetch('http://127.0.0.1:8099/guardar', { method: 'POST', body: JSON.stringify({ id: toma.id, w, h, rgba: aBase64(px) }) });
        log(`${toma.id}: ${r.status} ${w}x${h} objetos=${scene.children.length}`);
        rig.liberar();
      }
      log('listo');
    })().catch((e) => log(`error: ${(e as Error).message}`));
  }, [modelos, gl, scene, camera, log]);
  return null;
}

export default function Miniaturas() {
  const [lineas, setLineas] = useState<string[]>([]);
  const [log] = useState(() => (s: string) => setLineas((l) => [...l, s]));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ width: 110, height: 132 }}>
        <Canvas frameloop="never" gl={GL_VISOR} camera={{ fov: 30, near: 0.05, far: 50 }} onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}>
          <hemisphereLight args={['#dfe8ff', '#8a7fae', 1.2]} />
          <directionalLight position={[0, 2, 6]} intensity={0.5} />
          <directionalLight position={[-2, 3.5, 3]} intensity={1.4} />
          <directionalLight position={[2, 2, -3]} intensity={0.6} color="#b18cff" />
          <Suspense fallback={null}>
            <Fotografo log={log} />
          </Suspense>
        </Canvas>
      </View>
      <ScrollView>
        {lineas.map((l, i) => (
          <Text key={i}>{l}</Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

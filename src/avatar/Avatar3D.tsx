// Visor 3D de uno o varios avatares (Creador, Tienda, Mis pasos, podio del Inicio).
// Arrastrando el dedo se gira. Un solo <Canvas> por visor: los celulares aguantan pocos a la vez.
import { Canvas, useFrame } from '@react-three/fiber/native';
import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { useIsFocused } from 'expo-router';
import { PanResponder, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import * as THREE from 'three';

import { Limitador } from '@/lib/Limitador';
import { GL_VISOR } from '@/lib/three';
import { C } from '@/ui/tema';
import { useModelos } from './modelos';
import { AvatarRig } from './rig';
import type { AvatarAnim, AvatarConfig } from './types';

export interface AvatarEnEscena {
  config: AvatarConfig;
  anim?: AvatarAnim;
  /** Posición en x (metros). */
  x?: number;
  /** Escala (1 = tamaño normal). */
  escala?: number;
  /** Base debajo (por ejemplo, el escalón del podio): altura en metros. */
  alto?: number;
  /** Color de esa base. */
  colorBase?: string;
}

type Props = {
  avatares: AvatarEnEscena[];
  style?: StyleProp<ViewStyle>;
  /** 'cuerpo' = de cuerpo entero; 'busto' = cabeza y hombros. */
  encuadre?: 'cuerpo' | 'busto';
  girar?: boolean;
  piso?: boolean;
  /** Sombras: en visores pequeños casi no se notan y le cuestan a la GPU. */
  sombras?: boolean;
};

export function Avatar3D({ avatares, style, encuadre = 'cuerpo', girar = true, piso = true, sombras = true }: Props) {
  'use no memo'; // se anima cada cuadro: fuera del React Compiler
  const giro = useRef({ y: 0.35, base: 0, tocando: false });
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => girar,
        onMoveShouldSetPanResponder: (_, g) => girar && Math.abs(g.dx) > 4,
        onPanResponderGrant: () => {
          giro.current.tocando = true;
          giro.current.base = giro.current.y;
        },
        onPanResponderMove: (_, g) => {
          giro.current.y = giro.current.base + g.dx * 0.012;
        },
        onPanResponderRelease: () => {
          giro.current.tocando = false;
        },
        onPanResponderTerminate: () => {
          giro.current.tocando = false;
        },
      }),
    [girar],
  );
  const enfocado = useIsFocused();
  const busto = encuadre === 'busto';
  const ancho = avatares.length > 1;
  const cam: [number, number, number] = busto ? [0, 1.12, 1.9] : ancho ? [0, 1.15, 4.7] : [0, 0.9, 4.1];
  const mira: [number, number, number] = busto ? [0, 1.08, 0] : ancho ? [0, 0.8, 0] : [0, 0.68, 0];

  return (
    <View style={[styles.caja, style]} {...pan.panHandlers}>
      <Canvas
        // Las pestañas siguen montadas aunque no se vean: fuera de foco el visor no dibuja nada.
        // En foco dibuja a 30 cuadros por segundo (ver Limitador), no a 60.
        frameloop={enfocado ? 'demand' : 'never'}
        gl={GL_VISOR}
        shadows={sombras ? 'percentage' : false}
        camera={{ position: cam, fov: busto ? 26 : 30, near: 0.05, far: 50 }}
        onCreated={({ camera, gl }) => {
          camera.lookAt(...mira);
          gl.setClearColor(0x000000, 0);
        }}
      >
        <Limitador />
        <hemisphereLight args={['#dfe8ff', '#8a7fae', 1.2]} />
        <directionalLight position={[0, 2, 6]} intensity={0.5} />
        <directionalLight
          position={[-2, 3.5, 3]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[512, 512]}
          shadow-camera-left={-3}
          shadow-camera-right={3}
          shadow-camera-top={3}
          shadow-camera-bottom={-1}
        />
        <directionalLight position={[2, 2, -3]} intensity={0.6} color="#b18cff" />
        {avatares.map((a, i) =>
          a.alto ? (
            <mesh key={i} position={[a.x ?? 0, a.alto / 2, 0]} receiveShadow castShadow>
              <boxGeometry args={[1.05, a.alto, 0.9]} />
              <meshStandardMaterial color={a.colorBase ?? C.tarjeta2} roughness={0.7} />
            </mesh>
          ) : null,
        )}
        <Suspense fallback={null}>
          <Grupo avatares={avatares} giro={giro} individual={!ancho} />
        </Suspense>
        {piso && !busto && (
          <mesh rotation-x={-Math.PI / 2} receiveShadow>
            <circleGeometry args={[ancho ? 3.2 : 1.1, 48]} />
            <meshStandardMaterial color={C.piso} roughness={0.9} />
          </mesh>
        )}
      </Canvas>
    </View>
  );
}

function Grupo({
  avatares,
  giro,
  individual,
}: {
  avatares: AvatarEnEscena[];
  giro: React.MutableRefObject<{ y: number; tocando: boolean }>;
  individual: boolean;
}) {
  'use no memo';
  const modelos = useModelos();
  const grupo = useRef<THREE.Group>(null);
  const rigs = useRef<(AvatarRig | null)[]>([]);
  const cuerpos = avatares.map((a) => a.config.cuerpo).join(',');

  // (Re)crea un rig cuando cambia el cuerpo de un avatar; si solo cambia la ropa, lo viste.
  useEffect(() => {
    const g = grupo.current!;
    avatares.forEach((a, i) => {
      let r = rigs.current[i];
      if (!r || r.cuerpo !== a.config.cuerpo) {
        r?.liberar();
        r = new AvatarRig(modelos[a.config.cuerpo] ?? modelos.hombre, a.config);
        rigs.current[i] = r;
        g.add(r.raiz);
      }
    });
    rigs.current.slice(avatares.length).forEach((r) => r?.liberar());
    rigs.current.length = avatares.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuerpos, avatares.length, modelos]);

  // al limpiar también se vacía la lista: si React vuelve a montar el efecto (recarga en caliente),
  // los personajes se crean de nuevo en vez de quedarse liberados y fuera de la escena
  useEffect(
    () => () => {
      rigs.current.forEach((r) => r?.liberar());
      rigs.current = [];
    },
    [],
  );

  useFrame((_, dt) => {
    avatares.forEach((a, i) => {
      const r = rigs.current[i];
      if (!r) return;
      r.vestir(a.config);
      r.setAnim(a.anim ?? 'idle');
      r.actualizar(Math.min(dt, 0.05));
      r.raiz.position.set(a.x ?? 0, a.alto ?? 0, 0);
      r.raiz.scale.setScalar(a.escala ?? 1);
      if (!individual) r.raiz.rotation.y = 0.15 * -(a.x ?? 0);
    });
    if (individual && grupo.current) {
      if (!giro.current.tocando) giro.current.y += dt * 0.25;
      grupo.current.rotation.y = giro.current.y;
    }
  });

  return <group ref={grupo} />;
}

const styles = StyleSheet.create({
  caja: { overflow: 'hidden' },
});

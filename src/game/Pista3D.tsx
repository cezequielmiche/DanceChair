// La pista del juego en 3D: jugadores girando, sillas y la cámara que se acerca al ganador.
// Solo dibuja: lee el estado de `Juego` en cada cuadro (la lógica vive en juego.ts).
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import * as THREE from 'three';

import '@/lib/three';
import { useModelos } from '@/avatar/modelos';
import { AvatarRig } from '@/avatar/rig';
import { C } from '@/ui/tema';
import type { Juego } from './juego';

export interface Etiqueta {
  id: number;
  nombre: string;
  x: number;
  y: number;
  tu: boolean;
  fuera: boolean;
}

const ESCALA = 0.68; // tamaño de los personajes en la pista
const CAM_PISTA = new THREE.Vector3(0, 5.2, 6.6);
const MIRA_PISTA = new THREE.Vector3(0, 0.25, 0.25);

type Props = {
  juego: React.MutableRefObject<Juego>;
  etiquetas: React.MutableRefObject<Etiqueta[]>;
  style?: StyleProp<ViewStyle>;
};

export function Pista3D({ juego, etiquetas, style }: Props) {
  'use no memo'; // se anima cada cuadro: fuera del React Compiler
  return (
    <View style={style}>
      <Canvas
        shadows="percentage"
        camera={{ position: CAM_PISTA.toArray() as [number, number, number], fov: 36, near: 0.1, far: 60 }}
        onCreated={({ camera, gl }) => {
          camera.lookAt(MIRA_PISTA);
          gl.setClearColor(0x000000, 0);
        }}
      >
        <hemisphereLight args={['#dfe8ff', '#3a2f50', 0.95]} />
        <directionalLight
          position={[-3, 6, 4]}
          intensity={1.1}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-3.5}
          shadow-camera-right={3.5}
          shadow-camera-top={3.5}
          shadow-camera-bottom={-3.5}
        />
        <directionalLight position={[3, 3, -4]} intensity={0.5} color="#b18cff" />
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[3, 64]} />
          <meshStandardMaterial color={C.piso} roughness={0.9} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position-y={0.005}>
          <ringGeometry args={[1.97, 2.03, 96]} />
          <meshBasicMaterial color="#3a4877" />
        </mesh>
        <Suspense fallback={null}>
          <Escena juego={juego} etiquetas={etiquetas} />
        </Suspense>
      </Canvas>
    </View>
  );
}

function Escena({ juego, etiquetas }: { juego: Props['juego']; etiquetas: Props['etiquetas'] }) {
  'use no memo'; // se anima cada cuadro: fuera del React Compiler
  const modelos = useModelos();
  const { camera, size, scene } = useThree();
  const rigs = useRef<Record<number, AvatarRig>>({});
  const sillas = useRef<THREE.Group[]>([]);
  const mira = useRef(MIRA_PISTA.clone());
  const posGanador = useRef<[number, number] | null>(null);

  // Las sillas miden lo mismo que la rodilla del personaje (el asiento queda a su altura).
  const kSilla = useMemo(() => {
    const r = new AvatarRig(modelos.hombre, { cuerpo: 'hombre', piel: '#fff', camisa: '#fff', pantalon: '#fff' });
    const k = Math.max(0.5, (r.rodilla * ESCALA - 0.02) / 0.3);
    r.liberar();
    return k;
  }, [modelos]);

  useEffect(
    () => () => {
      Object.values(rigs.current).forEach((r) => r.liberar());
      sillas.current.forEach((s) => s.removeFromParent());
    },
    [],
  );

  useFrame((_, dtSeg) => {
    const g = juego.current;
    const ahora = performance.now();
    const dt = Math.min(50, dtSeg * 1000);
    const geo = g.geometria(ahora);

    // ---------------- sillas
    if (sillas.current.length !== geo.C) {
      sillas.current.forEach((s) => s.removeFromParent());
      sillas.current = geo.sillas.map(() => {
        const s = crearSilla(kSilla);
        scene.add(s);
        return s;
      });
    }
    const ocupadas = new Set(Object.values(g.reclamos).map((r) => r.silla));
    geo.sillas.forEach(([x, z], i) => {
      const s = sillas.current[i];
      s.position.set(x, 0, z);
      s.rotation.y = geo.C === 1 ? 0 : Math.atan2(x, z); // el respaldo mira al centro
      const col = ocupadas.has(i) ? 0x4ed6b0 : 0xffc233; // marca del piso: amarilla libre, verde ocupada
      (s.userData.luz as THREE.MeshBasicMaterial).color.setHex(col);
      (s.userData.borde as THREE.MeshBasicMaterial).color.setHex(col);
    });

    // ---------------- jugadores
    const vivos = new Set<number>();
    const tags: Etiqueta[] = [];
    const ganador = g.fase === 'fin' ? g.ganadorId : null;
    g.enRonda.forEach((id, j) => {
      const p = g.jugadores.find((q) => q.id === id);
      if (!p) return;
      vivos.add(id);
      let r = rigs.current[id];
      if (!r || r.cuerpo !== p.avatar.cuerpo) {
        r?.liberar();
        r = new AvatarRig(modelos[p.avatar.cuerpo] ?? modelos.hombre, p.avatar);
        r.raiz.scale.setScalar(ESCALA);
        scene.add(r.raiz);
        rigs.current[id] = r;
      }
      r.vestir(p.avatar);
      const pose = g.pose(id, ahora);
      r.setAnim(pose.anim);
      let [x, z] = geo.pos[id];
      let yaw = r.yaw;
      let sentado = 0;
      const reclamo = g.reclamos[id];
      if (pose.celebra) {
        // se levanta de la silla, da un paso hacia la cámara y baila
        if (reclamo) [x, z] = geo.sillas[reclamo.silla];
        const dx = camera.position.x - x;
        const dz = camera.position.z - z;
        const L = Math.hypot(dx, dz) || 1;
        x += (dx / L) * 0.32;
        z += (dz / L) * 0.32;
        yaw = Math.atan2(camera.position.x - x, camera.position.z - z);
        posGanador.current = [x, z];
      } else if (reclamo) {
        const [sx, sz] = geo.sillas[reclamo.silla];
        const t = Math.min(1, (ahora - reclamo.t0) / 320);
        const L = Math.hypot(sx, sz);
        const afuera = geo.C === 1 || L < 0.01 ? [0, 1] : [sx / L, sz / L];
        if (t >= 1) {
          x = sx - afuera[0] * 0.035;
          z = sz - afuera[1] * 0.035;
        }
        yaw = t < 1 ? Math.atan2(sx - r.raiz.position.x, sz - r.raiz.position.z) : Math.atan2(afuera[0], afuera[1]);
        sentado = Math.min(1, t * 1.2);
      } else if (pose.anim === 'caminar' || pose.anim === 'moonwalk') {
        const a = g.theta + (2 * Math.PI * j) / geo.N;
        yaw = Math.atan2(-Math.sin(a), Math.cos(a)); // mira hacia donde camina
      } else if (!pose.fuera && pose.anim !== 'idle') {
        yaw = 0; // los pasos se lucen de frente
      }
      r.setSentado(sentado);
      r.actualizar(dt / 1000);
      r.mirarA(yaw, dt);
      r.raiz.position.set(x, 0, z);
      r.raiz.visible = true;
      r.modelo.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m && 'opacity' in m) {
          m.transparent = pose.fuera;
          m.opacity = pose.fuera ? 0.45 : 1;
        }
      });

      // etiqueta con el nombre sobre la cabeza
      const v = new THREE.Vector3(x, 1.18 - r.bajada * ESCALA * sentado, z).project(camera);
      tags.push({ id, nombre: p.nombre, x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height, tu: p.tu, fuera: pose.fuera });
    });
    Object.keys(rigs.current).forEach((k) => {
      const id = Number(k);
      if (!vivos.has(id)) {
        rigs.current[id].liberar();
        delete rigs.current[id];
      }
    });
    etiquetas.current = ganador != null ? [] : tags;

    // ---------------- cámara: se acerca al ganador; en otra partida vuelve a la pista
    const k = Math.min(1, dt * 0.0035);
    let camT = CAM_PISTA;
    let lookT = MIRA_PISTA;
    if (ganador != null && posGanador.current && ahora - g.finEn > 300) {
      const [wx, wz] = posGanador.current;
      camT = new THREE.Vector3(wx * 0.8, 1.35, wz * 0.8 + 2.3);
      lookT = new THREE.Vector3(wx, 0.55, wz);
    } else if (ganador == null) posGanador.current = null;
    camera.position.lerp(camT, k);
    mira.current.lerp(lookT, k);
    camera.lookAt(mira.current);
  });

  return null;
}

/** Silla: asiento a la altura de la rodilla, ancha y con respaldo alto (los personajes son cabezones). */
function crearSilla(k: number) {
  const g = new THREE.Group();
  g.scale.set(k * 1.7, k, k * 1.45);
  const mat = (c: number, e: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, emissive: e });
  const caja = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    o.castShadow = true;
    g.add(o);
  };
  const luz = new THREE.MeshBasicMaterial({ color: 0xffc233, transparent: true, opacity: 0.22, depthWrite: false });
  const disco = new THREE.Mesh(new THREE.CircleGeometry(0.4, 40), luz);
  disco.rotation.x = -Math.PI / 2;
  disco.position.y = 0.006;
  g.add(disco);
  const borde = new THREE.MeshBasicMaterial({ color: 0xffc233, transparent: true, opacity: 0.85 });
  const aro = new THREE.Mesh(new THREE.RingGeometry(0.37, 0.41, 40), borde);
  aro.rotation.x = -Math.PI / 2;
  aro.position.y = 0.008;
  g.add(aro);
  const madera = mat(0xd9502f, 0x2a0800);
  const asiento = mat(0xff7a4f, 0x331000);
  const respaldo = mat(0xffc233, 0x2a1d00);
  caja(0.46, 0.07, 0.42, 0, 0.255, 0, madera);
  caja(0.42, 0.025, 0.38, 0, 0.29, 0.005, asiento);
  [[-0.19, -0.17], [0.19, -0.17], [-0.19, 0.17], [0.19, 0.17]].forEach(([x, z]) => caja(0.055, 0.23, 0.055, x, 0.115, z, madera));
  [-0.2, 0.2].forEach((x) => caja(0.055, 0.78, 0.055, x, 0.66, -0.185, madera));
  caja(0.44, 0.46, 0.05, 0, 0.78, -0.19, respaldo);
  caja(0.5, 0.07, 0.08, 0, 1.06, -0.19, madera);
  g.userData.luz = luz;
  g.userData.borde = borde;
  return g;
}

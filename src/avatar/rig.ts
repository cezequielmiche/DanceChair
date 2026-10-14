// Un personaje listo para animar: copia del modelo con su esqueleto, colores, bailes y pose de sentado.
// Se usa en el visor de un avatar y en la pista del juego (varios a la vez).
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

import { dress } from './piezas';
import { CLIP_BY_ANIM, type AvatarAnim, type AvatarConfig } from './types';

export interface ModeloGLTF {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
}

const PIERNAS = ['LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg'] as const;
const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);
const q = new THREE.Quaternion();
const qPadre = new THREE.Quaternion();
const qModelo = new THREE.Quaternion();
const eje = new THREE.Vector3();
const hombro = new THREE.Vector3();
const mano = new THREE.Vector3();
/**
 * En el paso "brazos" los brazos suben casi verticales y, con la cabeza grande, las manos quedaban detrás de
 * ella. Encima de la animación, cada brazo que va más vertical que este ángulo (hombro → mano, visto de
 * frente) se abre hasta llegar a él: queda una Y. Los que ya van más abiertos no se tocan, así ningún brazo
 * termina horizontal (girar siempre lo mismo hacía que pareciera que quería volar).
 */
const ABRIR_BRAZOS = (30 * Math.PI) / 180;

export class AvatarRig {
  /** Grupo que se mueve y gira en la escena. */
  readonly raiz = new THREE.Group();
  readonly modelo: THREE.Object3D;
  /** Cuánto baja la cadera al sentarse (hasta la rodilla), en unidades del modelo. */
  readonly bajada: number;
  /** Altura de la rodilla (para medir la silla). */
  readonly rodilla: number;
  readonly cuerpo: AvatarConfig['cuerpo'];
  anim: AvatarAnim | null = null;
  yaw = 0;
  private mixer: THREE.AnimationMixer;
  private clips: Record<string, THREE.AnimationClip> = {};
  private accion: THREE.AnimationAction | null = null;
  private reposo: Record<string, { hueso: THREE.Object3D; local: THREE.Quaternion; mundo: THREE.Quaternion }> = {};
  private sentado = 0;
  /** 0..1: cuánto se abren los brazos (sube y baja suave al entrar y salir del paso). */
  private abrir = 0;
  private brazos: { hueso: THREE.Object3D; mano: THREE.Object3D; signo: number }[] = [];
  private config: AvatarConfig;

  constructor(gltf: ModeloGLTF, config: AvatarConfig) {
    // copia propia: esqueleto propio (para bailar distinto) y materiales propios (colores propios)
    this.modelo = cloneSkinned(gltf.scene);
    this.modelo.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.frustumCulled = false; // las mallas con esqueleto se salen de su caja original al bailar
        m.material = (m.material as THREE.Material).clone();
      }
    });
    this.modelo.updateMatrixWorld(true);
    PIERNAS.forEach((n) => {
      const h = this.modelo.getObjectByName(n);
      if (h) this.reposo[n] = { hueso: h, local: h.quaternion.clone(), mundo: h.getWorldQuaternion(new THREE.Quaternion()) };
    });
    (
      [
        ['Left', -1],
        ['Right', 1],
      ] as const
    ).forEach(([lado, signo]) => {
      const h = this.modelo.getObjectByName(`${lado}Arm`);
      const m = this.modelo.getObjectByName(`${lado}Hand`);
      if (h && m) this.brazos.push({ hueso: h, mano: m, signo });
    });
    const y = (n: string) => this.modelo.getObjectByName(n)?.getWorldPosition(new THREE.Vector3()).y ?? 0;
    this.rodilla = y('LeftLeg') || 0.23;
    this.bajada = Math.max(0, y('LeftUpLeg') - y('LeftLeg'));
    this.raiz.add(this.modelo);
    this.mixer = new THREE.AnimationMixer(this.modelo);
    gltf.animations.forEach((c) => (this.clips[c.name] = c));
    this.config = config;
    this.cuerpo = config.cuerpo;
    dress(this.modelo, config);
    this.setAnim('idle', 0);
  }

  vestir(config: AvatarConfig) {
    if (config === this.config) return;
    this.config = config;
    dress(this.modelo, config);
  }

  setAnim(anim: AvatarAnim, fundido = 0.2) {
    if (anim === this.anim) return;
    const clip = this.clips[CLIP_BY_ANIM[anim]] ?? this.clips.idle;
    if (!clip) return;
    const nueva = this.mixer.clipAction(clip);
    nueva.reset().setLoop(THREE.LoopRepeat, Infinity);
    nueva.timeScale = anim === 'moonwalk' ? -0.9 : 1;
    nueva.play();
    if (this.accion && this.accion !== nueva && fundido > 0) this.accion.crossFadeTo(nueva, fundido, false);
    else if (this.accion && this.accion !== nueva) this.accion.stop();
    this.accion = nueva;
    this.anim = anim;
  }

  /** 0 = de pie, 1 = sentado. Dobla cadera y rodillas encima de la animación y baja la cadera. */
  setSentado(k: number) {
    this.sentado = Math.max(0, Math.min(1, k));
  }

  actualizar(dt: number) {
    this.mixer.update(dt);
    this.abrir += ((this.anim === 'brazos' ? 1 : 0) - this.abrir) * Math.min(1, dt * 8);
    if (this.abrir > 0.01) {
      // giro alrededor del eje frontal del personaje, pasado al espacio del hombro (que ya movió la animación)
      eje.copy(Z).applyQuaternion(this.modelo.getWorldQuaternion(qModelo));
      this.modelo.updateMatrixWorld(true);
      this.brazos.forEach(({ hueso, mano: m, signo }) => {
        // ángulo del brazo desde la vertical, visto de frente (en el modelo, girar en +Z lleva el brazo derecho a -x)
        this.modelo.worldToLocal(hueso.getWorldPosition(hombro));
        this.modelo.worldToLocal(m.getWorldPosition(mano)).sub(hombro);
        if (mano.y <= 0) return;
        const falta = ABRIR_BRAZOS - Math.atan2(-signo * mano.x, mano.y);
        if (falta <= 0) return;
        hueso.parent!.getWorldQuaternion(qPadre);
        q.setFromAxisAngle(eje, signo * falta * this.abrir);
        hueso.quaternion.premultiply(qPadre.clone().invert().multiply(q).multiply(qPadre));
      });
    }
    const k = this.sentado;
    if (k > 0) {
      const girar = (n: string, grados: number) => {
        const r = this.reposo[n];
        if (!r) return;
        const eje = X.clone().applyQuaternion(r.mundo.clone().invert());
        r.hueso.quaternion.copy(r.local).multiply(q.setFromAxisAngle(eje, (grados * k * Math.PI) / 180));
      };
      girar('LeftUpLeg', -85);
      girar('RightUpLeg', -85);
      girar('LeftLeg', 88);
      girar('RightLeg', 88);
    } else {
      // de pie: las rodillas vuelven a su pose (los bailes no animan las rodillas)
      ['LeftLeg', 'RightLeg'].forEach((n) => this.reposo[n] && this.reposo[n].hueso.quaternion.copy(this.reposo[n].local));
    }
    this.modelo.position.y = -this.bajada * k;
  }

  /** Gira suavemente hacia un ángulo. */
  mirarA(objetivo: number, dtMs: number) {
    let d = objetivo - this.yaw;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    this.yaw += d * Math.min(1, dtMs * 0.012);
    this.raiz.rotation.y = this.yaw;
  }

  liberar() {
    this.mixer.stopAllAction();
    this.raiz.removeFromParent();
    this.modelo.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) (m.material as THREE.Material).dispose();
    });
  }
}

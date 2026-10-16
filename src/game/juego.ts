// Lógica del juego de las sillas, sin nada de pantalla: se puede probar sola.
// Todo avanza con `actualizar(ahora, dt)`; no usa setTimeout, así es predecible.
import type { AvatarAnim, AvatarConfig, DanceId } from '@/avatar/types';
import { elegirBots } from '@/data/bots';
import { paso as datosPaso } from '@/data/catalogo';
import { monedasPartida, puntosRanking, type Desempeno } from '@/game/modo';

export type Fase = 'cuenta' | 'musica' | 'alto' | 'resultado' | 'fin';
export type Dificultad = 'Fácil' | 'Normal' | 'Difícil';
export type Evento = 'cuenta' | 'musica' | 'alto' | 'sentado' | 'paso' | 'fuera' | 'ganaste' | 'fin';

export interface Jugador {
  id: number;
  nombre: string;
  tu: boolean;
  vivo: boolean;
  avatar: AvatarConfig;
  /** En línea: cómo lo llama el servidor (user_id, o 'bot1', 'bot2'…). */
  clave: string;
}

export interface Reclamo {
  silla: number;
  t0: number;
  desde: [number, number];
}

export interface Opciones {
  jugadores: number; // 3 a 8, contándote a ti
  dificultad: Dificultad;
  tuNombre: string;
  tuAvatar: AvatarConfig;
  favoritos: (DanceId | null)[];
  /** Otros jugadores de la sala (en línea). Los lugares que falten se completan con bots. */
  rivales?: { nombre: string; avatar: AvatarConfig; clave?: string }[];
  /** En línea nadie toca "Siguiente": la ronda siguiente arranca sola tras ESPERA_RONDA. */
  automatico?: boolean;
  /**
   * En línea: el servidor manda. Las horas de cada ronda llegan con `programarRonda`, quién se sienta con
   * `reclamoRemoto` y quién queda fuera con `resolverRonda`; aquí no se sortea nada ni se mueve a los bots.
   */
  remoto?: boolean;
  /** En línea: tu user_id. */
  tuClave?: string;
  /**
   * Solo mirar la partida de un amigo: "tú" es el amigo (su nombre, avatar y clave), no se puede sentar ni
   * bailar, y cuando queda fuera la partida sigue mostrándose hasta el final.
   */
  observador?: boolean;
  random?: () => number;
}

export interface Geometria {
  sillas: [number, number][];
  pos: Record<number, [number, number]>;
  orbita: Record<number, [number, number]>;
  N: number;
  C: number;
}

// Medidas de la pista (metros): los jugadores giran en un círculo de 2 m alrededor de las sillas.
export const RADIO_ORBITA = 2;
const radioSillas = (C: number) => (C === 1 ? 0 : C === 2 ? 0.74 : 1.185);
/** Al quedar fuera, el aviso "¡Te quedaste sin silla!" espera esto (ms) para que se vea quién se sentó. */
export const PAUSA_PERDER = 3000;
/** El ganador baila sus 3 pasos al final (ms desde que termina la partida); luego se queda quieto. */
const FIN_BAILE = 500 + 3 * 3400;
/** En línea: espera entre el resultado de una ronda y la siguiente (ms). */
export const ESPERA_RONDA = 3000;
/** En línea: si el reloj se corrige menos que esto (ms), no se vuelve a programar la ronda. */
const AJUSTE_MIN = 30;

/** Tocar Sentarse con la música sonando bloquea la silla este tiempo (ms): así no gana el que toca sin parar. */
export const CASTIGO_ADELANTO = 1000;
const RANGO_BOTS: Record<Dificultad, [number, number]> = {
  Fácil: [650, 1500],
  Normal: [420, 1050],
  Difícil: [230, 700],
};

const esBot = (p: Jugador) => p.clave.startsWith('bot');

export class Juego {
  fase: Fase = 'cuenta';
  cuenta = 3;
  ronda = 0;
  jugadores: Jugador[] = [];
  enRonda: number[] = [];
  reclamos: Record<number, Reclamo> = {};
  theta = 0;
  andar = 0;
  pasosBailados = 0;
  rondasSobrevividas = 0;
  /** Rondas sobrevividas en las que quedó fuera una persona (sin servidor, todos cuentan como personas). */
  personasFuera = 0;
  /** Ronda en la que quedaste fuera (0 si sigues). */
  rondaFuera = 0;
  gano = false;
  puesto = 0;
  total = 0;
  ganadorId: number | null = null;
  ganador = '';
  finEn = 0;
  espectando = false;
  /** En línea: hora en que arranca sola la siguiente ronda (para la cuenta regresiva); 0 si no hay. */
  siguienteEn = 0;
  ultimoFuera = '';
  baile: DanceId | null = null;
  baileHasta = 0;
  flash = '';
  flashHasta = 0;
  /** El aviso es un regaño (te adelantaste) y no un premio. */
  flashMal = false;
  /** Hasta cuándo no puedes sentarte por haber tocado Sentarse antes del alto. */
  adelantoHasta = 0;
  /** Sube con cada cambio importante (para que la pantalla sepa cuándo redibujar). */
  version = 0;

  private opts: Opciones;
  private rnd: () => number;
  private agenda: { en: number; fn: (ahora: number) => void }[] = [];
  private oyentes: ((e: Evento) => void)[] = [];
  /** En línea: la última ronda que mandó el servidor (horas en el reloj local). */
  private prog: { ronda: number; inicio: number; alto: number } | null = null;
  /** En línea: a qué hora (local) llega cada bot a su silla en la ronda, según el servidor. */
  private llegadas: { ronda: number; lista: { clave: string; en: number }[] } | null = null;

  constructor(opts: Opciones) {
    this.opts = opts;
    this.rnd = opts.random ?? Math.random;
    this.armarJugadores();
  }

  get favoritos() {
    return this.opts.favoritos;
  }
  get tu() {
    return this.jugadores.find((p) => p.tu)!;
  }
  get remoto() {
    return !!this.opts.remoto;
  }
  get observador() {
    return !!this.opts.observador;
  }

  on(fn: (e: Evento) => void) {
    this.oyentes.push(fn);
    return () => {
      this.oyentes = this.oyentes.filter((f) => f !== fn);
    };
  }
  private emitir(e: Evento) {
    this.version++;
    this.oyentes.forEach((f) => f(e));
  }
  // lo agendado recibe la hora real en que se ejecuta (si un cuadro tarda, nada se encima)
  private en(ahora: number, ms: number, fn: (ahora: number) => void) {
    this.agenda.push({ en: ahora + ms, fn });
  }
  private limpiarAgenda() {
    this.agenda = [];
  }

  private armarJugadores() {
    const n = Math.max(3, Math.min(8, Math.round(this.opts.jugadores)));
    const rivales = (this.opts.rivales ?? []).slice(0, n - 1);
    const bots = elegirBots(n - 1 - rivales.length, this.rnd).map((b) => ({ nombre: b.nombre, avatar: b as AvatarConfig }));
    this.jugadores = [
      { id: 0, nombre: this.opts.tuNombre || 'Tú', tu: true, vivo: true, avatar: this.opts.tuAvatar, clave: this.opts.tuClave ?? '0' },
      ...rivales.map((r, i) => ({ id: i + 1, nombre: r.nombre, tu: false, vivo: true, avatar: r.avatar, clave: r.clave ?? String(i + 1) })),
      ...bots.map((r, i) => ({ id: rivales.length + i + 1, nombre: r.nombre, tu: false, vivo: true, avatar: r.avatar, clave: `bot${i + 1}` })),
    ];
    this.enRonda = this.jugadores.map((p) => p.id);
    this.reclamos = {};
    this.total = this.jugadores.length;
  }

  /** Cuenta regresiva 3, 2, 1 y empieza la partida. */
  iniciar(ahora: number) {
    this.limpiarAgenda();
    this.armarJugadores();
    this.fase = 'cuenta';
    this.siguienteEn = 0;
    this.cuenta = 3;
    this.ronda = 0;
    this.pasosBailados = 0;
    this.rondasSobrevividas = 0;
    this.personasFuera = 0;
    this.rondaFuera = 0;
    this.gano = false;
    this.espectando = !!this.opts.observador;
    this.llegadas = null;
    this.ganadorId = null;
    this.ganador = '';
    this.ultimoFuera = '';
    this.prog = null;
    // en línea la cuenta regresiva la marca la hora de inicio que manda el servidor
    if (this.opts.remoto) {
      this.emitir('cuenta');
      return;
    }
    const tic = (t: number) => {
      if (this.fase !== 'cuenta') return;
      this.cuenta -= 1;
      if (this.cuenta <= 0) this.empezarRonda(t, 1);
      else {
        this.emitir('cuenta');
        this.en(t, 800, tic);
      }
    };
    this.emitir('cuenta');
    this.en(ahora, 800, tic);
  }

  private empezarRonda(ahora: number, ronda: number) {
    this.ronda = ronda;
    this.reclamos = {};
    this.enRonda = this.jugadores.filter((p) => p.vivo).map((p) => p.id);
    this.fase = 'musica';
    this.baileHasta = 0;
    this.flashHasta = 0;
    this.adelantoHasta = 0;
    if (!this.opts.remoto) {
      const dura = 3000 + this.rnd() * 5500;
      this.en(ahora, dura, (t) => this.pararMusica(t));
    }
    this.emitir('musica');
  }

  /** Velocidad de giro (rad/ms): un poco más rápido cada ronda. */
  velocidad() {
    return 0.0011 * (1 + (Math.max(1, this.ronda) - 1) * 0.08);
  }

  private pararMusica(ahora: number) {
    if (this.fase !== 'musica') return;
    this.fase = 'alto';
    if (this.opts.remoto) return this.emitir('alto');
    const [a, b] = RANGO_BOTS[this.opts.dificultad];
    const f = Math.pow(0.92, this.ronda - 1);
    this.jugadores.forEach((p) => {
      if (!p.vivo || p.tu) return;
      const espera = (a + this.rnd() * (b - a)) * f;
      this.en(ahora, espera, (t) => this.reclamar(p.id, t));
    });
    // si tú ya estás fuera (espectando) no hay que esperarte
    this.emitir('alto');
  }

  geometria(ahora: number): Geometria {
    const N = this.enRonda.length;
    const C = Math.max(1, N - 1);
    const rc = radioSillas(C);
    const sillas: [number, number][] = [];
    for (let i = 0; i < C; i++) {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / C;
      sillas.push([rc * Math.cos(a), rc * Math.sin(a)]);
    }
    const orbita: Record<number, [number, number]> = {};
    const pos: Record<number, [number, number]> = {};
    this.enRonda.forEach((id, j) => {
      const a = this.theta + (2 * Math.PI * j) / N;
      const o: [number, number] = [RADIO_ORBITA * Math.cos(a), RADIO_ORBITA * Math.sin(a)];
      orbita[id] = o;
      const c = this.reclamos[id];
      if (c) {
        let t = Math.min(1, (ahora - c.t0) / 320);
        t = 1 - Math.pow(1 - t, 3);
        const [sx, sz] = sillas[c.silla];
        pos[id] = [c.desde[0] + (sx - c.desde[0]) * t, c.desde[1] + (sz - c.desde[1]) * t];
      } else pos[id] = o;
    });
    return { sillas, pos, orbita, N, C };
  }

  /** Un jugador corre a la silla libre más cercana. */
  reclamar(id: number, ahora: number) {
    if (this.fase !== 'alto' || this.reclamos[id]) return false;
    const p = this.jugadores.find((q) => q.id === id);
    if (!p || !p.vivo) return false;
    const geo = this.geometria(ahora);
    const yo = geo.orbita[id];
    if (!yo) return false;
    const ocupadas = new Set(Object.values(this.reclamos).map((r) => r.silla));
    let mejor = -1;
    let dist = Infinity;
    geo.sillas.forEach(([x, z], i) => {
      if (ocupadas.has(i)) return;
      const d = Math.hypot(x - yo[0], z - yo[1]);
      if (d < dist) {
        dist = d;
        mejor = i;
      }
    });
    if (mejor < 0) return false;
    this.reclamos[id] = { silla: mejor, t0: ahora, desde: yo };
    if (p.tu) this.emitir('sentado');
    else this.version++;
    if (!this.opts.remoto && Object.keys(this.reclamos).length >= geo.C) this.terminarRonda(ahora);
    return true;
  }

  /** Botón Sentarse. Si la música aún suena, es una salida en falso: te deja sin poder sentarte un rato. */
  sentarse(ahora: number) {
    if (this.opts.observador) return false;
    if (this.fase === 'musica' && this.tu.vivo && !this.espectando) {
      this.adelantoHasta = ahora + CASTIGO_ADELANTO;
      this.flash = '¡Te adelantaste!';
      this.flashMal = true;
      this.flashHasta = ahora + 1100;
      this.version++;
      return false;
    }
    if (ahora < this.adelantoHasta) return false;
    return this.reclamar(0, ahora);
  }

  /** Tocar un paso de la rueda mientras suena la música (suma estilo: puntos y monedas). */
  bailar(id: DanceId, ahora: number) {
    if (this.opts.observador) return false;
    if (this.fase !== 'musica' || !this.tu.vivo || ahora < this.baileHasta) return false;
    this.baile = id;
    this.baileHasta = ahora + (datosPaso(id)?.dura ?? 1700);
    this.pasosBailados++;
    this.flash = '¡Estilo!';
    this.flashMal = false;
    this.flashHasta = ahora + 1100;
    this.emitir('paso');
    return true;
  }

  private terminarRonda(ahora: number, perdedorId = this.enRonda.find((id) => !this.reclamos[id])) {
    this.limpiarAgenda();
    const perdedor = this.jugadores.find((p) => p.id === perdedorId);
    if (!perdedor) return;
    perdedor.vivo = false;
    this.ultimoFuera = perdedor.nombre;
    if (!perdedor.tu && this.tu.vivo) {
      // al espectar ya no se suma nada; en línea, eliminar a un bot no da puntos de ranking (sí monedas)
      if (!this.opts.remoto || !esBot(perdedor)) this.personasFuera++;
      this.rondasSobrevividas++;
    }
    const vivos = this.jugadores.filter((p) => p.vivo);
    if (perdedor.tu && !this.opts.observador) {
      this.rondaFuera = this.ronda;
      this.fase = 'fin';
      // sin esto la pista se quedaba congelada al instante (quieto) y no se veía quién te ganó la silla
      this.finEn = ahora;
      if (vivos.length === 1) {
        // última ronda: el otro ganó y baila su festejo
        this.ganador = vivos[0].nombre;
        this.ganadorId = vivos[0].id;
      }
      this.gano = false;
      this.puesto = vivos.length + 1;
      this.emitir('fuera');
    } else if (vivos.length === 1) {
      this.fase = 'fin';
      this.ganador = vivos[0].nombre;
      this.ganadorId = vivos[0].id;
      this.finEn = ahora;
      if (vivos[0].tu && !this.opts.observador) {
        this.gano = true;
        this.puesto = 1;
        this.emitir('ganaste');
      } else this.emitir('fin');
    } else {
      this.fase = 'resultado';
      if (this.opts.remoto) {
        // la siguiente ronda la programa el servidor
      } else if (this.espectando) this.en(ahora, 1800, (t) => this.siguiente(t));
      else if (this.opts.automatico) {
        this.siguienteEn = ahora + ESPERA_RONDA;
        this.en(ahora, ESPERA_RONDA, (t) => this.siguiente(t));
      }
      this.emitir('fuera');
    }
  }

  /** Botón Siguiente ronda (en línea no hace nada: la ronda arranca a la hora del servidor). */
  siguiente(ahora: number) {
    if (!this.opts.remoto) this.pasarRonda(ahora, this.ronda + 1);
  }

  private pasarRonda(ahora: number, ronda: number) {
    if (this.fase !== 'resultado') return;
    this.siguienteEn = 0;
    this.empezarRonda(ahora, ronda);
  }

  // ---------------------------------------------------------------- En línea (lo que manda el servidor)

  /**
   * Horas de una ronda (ya pasadas al reloj local): cuándo empieza la música y cuándo para. Se puede llamar
   * en cada consulta. Si las horas ya pasaron (el teléfono se atrasó), todo ocurre de inmediato y en orden.
   * Las primeras consultas al entrar son lentas y el reloj sale con error (hasta ~1 s): cuando se corrige
   * y las horas se mueven, la ronda se vuelve a programar.
   */
  programarRonda(ronda: number, inicio: number, alto: number, ahora: number) {
    const p = this.prog;
    if (!this.opts.remoto || (p && p.ronda > ronda)) return;
    if (p && p.ronda === ronda && Math.abs(p.inicio - inicio) < AJUSTE_MIN && Math.abs(p.alto - alto) < AJUSTE_MIN) return;
    this.prog = { ronda, inicio, alto };
    if (this.ronda !== ronda) return this.aplicarProg(ahora);
    // la ronda ya empezó: solo se puede mover el alto, si todavía no llegó
    if (this.fase !== 'musica') return;
    this.limpiarAgenda();
    this.en(ahora, alto - ahora, (t) => {
      if (this.ronda === ronda) this.pararMusica(t);
    });
  }

  private aplicarProg(ahora: number) {
    const p = this.prog;
    if (!p || p.ronda <= this.ronda || this.fase === 'fin') return;
    this.limpiarAgenda();
    if (this.fase === 'cuenta') {
      this.cuenta = Math.max(1, Math.min(3, Math.ceil((p.inicio - ahora) / 1000)));
      for (const k of [2, 1]) {
        if (p.inicio - k * 1000 > ahora)
          this.en(ahora, p.inicio - k * 1000 - ahora, () => {
            this.cuenta = k;
            this.emitir('cuenta');
          });
      }
      this.en(ahora, p.inicio - ahora, (t) => {
        if (this.fase === 'cuenta') this.empezarRonda(t, p.ronda);
      });
    } else {
      if (!this.espectando) this.siguienteEn = p.inicio;
      this.en(ahora, p.inicio - ahora, (t) => this.pasarRonda(t, p.ronda));
    }
    this.en(ahora, p.alto - ahora, (t) => {
      if (this.ronda === p.ronda) this.pararMusica(t);
    });
    this.version++;
  }

  /** En línea: cuándo llega cada bot en la ronda (hora local, ya ordenadas por el servidor). */
  llegadasBots(ronda: number, lista: { clave: string; en: number }[]) {
    if (!this.opts.remoto || ronda < this.ronda) return;
    this.llegadas = { ronda, lista: [...lista].sort((a, b) => a.en - b.en) };
  }

  /** Alguien llegó a su silla según el servidor (los tuyos ya se ven al tocar Sentarse). */
  reclamoRemoto(clave: string, ahora: number) {
    const p = this.jugadores.find((q) => q.clave === clave);
    if (!p || this.reclamos[p.id]) return;
    // si alguien ya se sentó, en el servidor ya pasó el alto aunque este reloj vaya un poco atrasado
    if (this.fase === 'musica') this.pararMusica(ahora);
    this.reclamar(p.id, ahora);
  }

  /** El servidor cerró la ronda: `clave` quedó fuera. */
  resolverRonda(clave: string, ahora: number) {
    const p = this.jugadores.find((q) => q.clave === clave);
    if (!p || !p.vivo) return;
    if (this.fase === 'fin') {
      // ya perdiste y no estás viendo: solo se lleva la cuenta, por si decides ver cómo termina
      p.vivo = false;
      this.ultimoFuera = p.nombre;
      const vivos = this.jugadores.filter((q) => q.vivo);
      if (vivos.length === 1) {
        this.ganador = vivos[0].nombre;
        this.ganadorId = vivos[0].id;
      }
      this.version++;
      return;
    }
    if (this.fase === 'musica' || this.fase === 'cuenta') this.fase = 'alto';
    this.siguienteEn = 0;
    this.terminarRonda(ahora, p.id);
  }

  get puedeEspectar() {
    return this.fase === 'fin' && !this.gano && this.jugadores.filter((p) => p.vivo).length >= 2;
  }

  /** Después de perder: ver cómo termina la partida (las rondas siguen solas). */
  espectar(ahora: number) {
    if (!this.puedeEspectar) return;
    this.espectando = true;
    this.fase = 'resultado';
    if (this.opts.remoto) this.aplicarProg(ahora);
    else this.en(ahora, 900, (t) => this.siguiente(t));
    this.emitir('musica');
  }

  /** Avanza el tiempo. `dt` en milisegundos. */
  actualizar(ahora: number, dt: number) {
    if (this.fase === 'musica') {
      this.theta += dt * this.velocidad();
      this.andar += dt * 0.012;
    } else if (this.fase === 'cuenta') {
      this.theta += dt * 0.00035;
      this.andar += dt * 0.006;
    }
    // ejecuta lo agendado en orden (lo que se agenda dentro entra en la siguiente vuelta)
    const listos = this.agenda.filter((e) => e.en <= ahora).sort((a, b) => a.en - b.en);
    if (listos.length) {
      this.agenda = this.agenda.filter((e) => e.en > ahora);
      listos.forEach((e) => e.fn(ahora));
    }
    // en línea: los bots se sientan a la hora que decidió el servidor (en orden; si ya no hay silla, se quedan parados)
    const ll = this.llegadas;
    if (ll && this.fase === 'alto' && ll.ronda === this.ronda) {
      for (const l of ll.lista) {
        if (l.en > ahora) break;
        const p = this.jugadores.find((q) => q.clave === l.clave);
        if (p && p.vivo && !this.reclamos[p.id]) this.reclamar(p.id, ahora);
      }
    }
  }

  /**
   * La partida terminó y el ganador ya acabó de bailar: no cambia nada en pantalla hasta que se toque
   * "Otra vez". La pista 3D y la interfaz dejan de dibujar (es cuando más se calentaba el teléfono).
   */
  quieto(ahora: number) {
    return this.fase === 'fin' && ahora - this.finEn > FIN_BAILE + 1000;
  }

  /** Qué hace cada avatar en este momento (para la escena 3D). */
  pose(id: number, ahora: number): { anim: AvatarAnim; sentado: boolean; celebra: boolean; fuera: boolean } {
    const j = this.enRonda.indexOf(id);
    const p = this.jugadores.find((q) => q.id === id);
    const reclamo = this.reclamos[id];
    const fuera = !!p && !p.vivo;
    const desdeFin = ahora - this.finEn;
    if (this.fase === 'fin' && this.ganadorId === id && desdeFin > 500) {
      const pasos: AvatarAnim[] = ['brazos', 'dab', 'macarena'];
      const anim = desdeFin < FIN_BAILE ? pasos[Math.floor((desdeFin - 500) / 3400)] : 'idle';
      return { anim, sentado: false, celebra: true, fuera };
    }
    if (reclamo) return { anim: 'idle', sentado: true, celebra: false, fuera };
    if (fuera) return { anim: 'idle', sentado: false, celebra: false, fuera };
    if (this.fase === 'musica') {
      if (p?.tu) return { anim: ahora < this.baileHasta && this.baile ? this.baile : 'caminar', sentado: false, celebra: false, fuera };
      const k = Math.floor(this.andar / 4 + j * 1.7) % 6;
      const extra: AvatarAnim[] = ['macarena', 'aura', 'dab', 'moonwalk'];
      const anim: AvatarAnim = k === 0 ? 'brazos' : k === 1 ? 'balanceo' : k === 2 ? extra[j % 4] : 'caminar';
      return { anim, sentado: false, celebra: false, fuera };
    }
    if (this.fase === 'cuenta') return { anim: 'caminar', sentado: false, celebra: false, fuera };
    return { anim: 'idle', sentado: false, celebra: false, fuera };
  }

  /** Cómo vas (o cómo te fue) para calcular el premio. */
  get desempeno(): Desempeno {
    return {
      rondas: this.rondasSobrevividas,
      personasFuera: this.personasFuera,
      rondasJugadas: this.rondaFuera || this.ronda,
      gano: this.gano,
      // en línea, ganar solo da puntos de ranking si había otra persona en la sala
      hayPersonas: !this.opts.remoto || this.jugadores.some((p) => !p.tu && !esBot(p)),
      pasos: this.pasosBailados,
    };
  }

  /** Puntos de ranking que llevas. */
  get pts() {
    return puntosRanking(this.desempeno);
  }

  /** Monedas que llevas. */
  get monedas() {
    return monedasPartida(this.desempeno);
  }

  /** Resumen al terminar (para guardar puntos y monedas). */
  resumen() {
    return {
      puntos: this.pts,
      monedas: this.monedas,
      gano: this.gano,
      puesto: this.gano ? 1 : this.puesto,
      jugadores: this.total,
      rondas: this.rondasSobrevividas,
      pasos: this.pasosBailados,
    };
  }
}

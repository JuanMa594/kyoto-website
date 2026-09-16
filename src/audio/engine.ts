'use client';

import type { SoundLayer } from '@/config/journey';
import { clamp, lerp } from '@/lib/procedural';
import type { FaunaSound } from '@/scene/systems/fauna/bestiary';
import { WIND } from '@/scene/systems/WindField';

/**
 * El ambiente sonoro, **sintetizado en el navegador**. Ni un archivo de audio.
 *
 * La regla de assets del proyecto —generarlo por código antes que descargarlo—
 * vale también para el sonido, y aquí paga el doble: el viento no es un bucle
 * que se repite, es ruido filtrado **cuyo volumen y color siguen a `WIND`**. La
 * ráfaga que arrastra los pétalos es literalmente la que se oye crecer. Con un
 * mp3 eso no se puede.
 *
 * Nada suena de forma continua, que es lo que pide el §9 del PLAN: los lechos
 * (viento, arroyo, ciudad, bambú) respiran y en reposo quedan casi en silencio,
 * y el resto —fūrin, grillos, pájaros, el fuego— son eventos sueltos separados
 * por decenas de segundos.
 *
 * Nada de esto arranca solo: ningún navegador deja sonar nada antes de un gesto
 * de la persona, y aunque dejara, el PLAN lo prohíbe. El interruptor está
 * siempre a la vista.
 */

type BedKind = Extract<SoundLayer, 'viento' | 'arroyo' | 'ciudad' | 'bambu'>;
type EventKind = Extract<SoundLayer, 'furin' | 'grillos' | 'pajaros' | 'fuego'>;

const BED_KINDS: readonly BedKind[] = ['viento', 'arroyo', 'ciudad', 'bambu'];

interface Bed {
  gain: GainNode;
  filter: BiquadFilterNode;
  source: AudioBufferSourceNode;
}

interface EngineState {
  ctx: AudioContext | null;
  master: GainNode | null;
  noise: AudioBuffer | null;
  beds: Map<BedKind, Bed>;
  layers: Set<SoundLayer>;
  /** Cuándo toca el próximo evento de cada capa, en segundos del reloj de audio. */
  due: Map<EventKind, number>;
  volume: number;
  /** Lo último que sonó, para poder enseñarlo en `/diagnostico`. */
  lastEvent: string;
  lastEventAt: number;
}

const state: EngineState = {
  ctx: null,
  master: null,
  noise: null,
  beds: new Map(),
  layers: new Set(),
  due: new Map(),
  volume: 0.35,
  lastEvent: '—',
  lastEventAt: 0,
};

/**
 * Ruido marrón de dos segundos, en bucle.
 *
 * Marrón y no blanco porque el blanco suena a interferencia de televisor: el
 * viento y el agua tienen mucha más energía en los graves. El último paso —
 * restar la deriva para que el primer y el último valor coincidan— es lo que
 * evita el chasquido en cada vuelta del bucle.
 */
function buildNoise(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.2;
  }

  const drift = data[length - 1]! - data[0]!;
  for (let i = 0; i < length; i += 1) {
    data[i] = clamp(data[i]! - (i / (length - 1)) * drift, -1, 1);
  }

  return buffer;
}

interface BedConfig {
  type: BiquadFilterType;
  frequency: number;
  q: number;
  gain: number;
}

/** Cada lecho es el mismo ruido visto por un filtro distinto. */
const BED_CONFIG: Record<BedKind, BedConfig> = {
  // Silbido ancho que se abre con la ráfaga.
  viento: { type: 'bandpass', frequency: 520, q: 0.7, gain: 0.55 },
  // Agua corriendo: mucho más agudo y mucho más estrecho.
  arroyo: { type: 'bandpass', frequency: 1500, q: 1.1, gain: 0.3 },
  // Rumor de ciudad al fondo: sólo graves, casi por debajo del umbral.
  ciudad: { type: 'lowpass', frequency: 260, q: 0.6, gain: 0.32 },
  // Hojas de bambú: el roce vive en los agudos.
  bambu: { type: 'highpass', frequency: 2600, q: 0.5, gain: 0.26 },
};

function createBed(ctx: AudioContext, master: GainNode, kind: BedKind, noise: AudioBuffer): Bed {
  const config = BED_CONFIG[kind];

  const source = ctx.createBufferSource();
  source.buffer = noise;
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = config.type;
  filter.frequency.value = config.frequency;
  filter.Q.value = config.q;

  const gain = ctx.createGain();
  gain.gain.value = 0;

  source.connect(filter).connect(gain).connect(master);
  source.start();

  return { gain, filter, source };
}

/** Enciende el motor. Sólo puede llamarse después de un gesto de la persona. */
export function startAudio(): boolean {
  if (typeof window === 'undefined') return false;
  if (state.ctx) {
    void state.ctx.resume();
    return true;
  }

  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return false;

  const ctx = new Ctor();
  const master = ctx.createGain();
  master.gain.value = 0;

  // Un limitador suave: con varias capas sumándose, un pico puede saturar y lo
  // que se oye entonces es un chasquido, no un jardín.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.ratio.value = 6;
  master.connect(limiter).connect(ctx.destination);

  state.ctx = ctx;
  state.master = master;
  state.noise = buildNoise(ctx);

  for (const kind of BED_KINDS) {
    state.beds.set(kind, createBed(ctx, master, kind, state.noise));
  }

  applyVolume();
  return true;
}

export function stopAudio(): void {
  const { ctx, master } = state;
  if (!ctx || !master) return;

  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
  void ctx.suspend();
}

export function isAudioRunning(): boolean {
  return state.ctx?.state === 'running' && state.volume > 0;
}

function applyVolume(): void {
  const { ctx, master } = state;
  if (!ctx || !master) return;
  master.gain.setTargetAtTime(state.volume, ctx.currentTime, 0.25);
}

export function setAudioVolume(volume: number): void {
  state.volume = clamp(volume, 0, 1);
  applyVolume();
}

/** Qué capas existen en esta zona. Sale de `station.ambient.sounds`. */
export function setAudioLayers(layers: readonly SoundLayer[]): void {
  state.layers = new Set(layers);

  // Los eventos de una zona no empiezan todos a la vez ni nada más llegar.
  const now = state.ctx?.currentTime ?? 0;
  for (const layer of layers) {
    if (!state.due.has(layer as EventKind) && !BED_KINDS.includes(layer as BedKind)) {
      state.due.set(layer as EventKind, now + 4 + Math.random() * 14);
    }
  }
}

/* ── Primitivas de síntesis ─────────────────────────────────────────────── */

function envelope(ctx: AudioContext, attack: number, decay: number, peak: number): GainNode {
  const gain = ctx.createGain();
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return gain;
}

function panned(ctx: AudioContext, pan: number): StereoPannerNode {
  const node = ctx.createStereoPanner();
  node.pan.value = clamp(pan, -1, 1);
  return node;
}

/**
 * Una campanilla. Tres parciales **inarmónicos**: es lo que distingue el metal
 * de una flauta — una campana no suena a múltiplos enteros de su fundamental.
 */
function bell(frequency: number, pan: number, level: number): void {
  const { ctx, master } = state;
  if (!ctx || !master) return;

  const out = panned(ctx, pan);
  out.connect(master);

  [1, 2.76, 5.4].forEach((ratio, index) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = frequency * ratio;

    const gain = envelope(ctx, 0.005, 2.6 / (1 + index * 1.4), level / (1 + index * 2.2));
    osc.connect(gain).connect(out);
    osc.start();
    osc.stop(ctx.currentTime + 3);
  });
}

/** Un canto: un barrido de frecuencia con la forma que se le pida. */
function chirp(
  from: number,
  to: number,
  duration: number,
  pan: number,
  level: number,
  type: OscillatorType = 'sine',
): void {
  const { ctx, master } = state;
  if (!ctx || !master) return;

  const osc = ctx.createOscillator();
  osc.type = type;
  const t = ctx.currentTime;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + duration);

  const gain = envelope(ctx, duration * 0.25, duration * 0.8, level);
  osc.connect(gain).connect(panned(ctx, pan)).connect(master);
  osc.start();
  osc.stop(t + duration + 0.3);
}

/** Un golpe de ruido: chasquidos del fuego, aleteos, chapoteos. */
function burst(frequency: number, q: number, duration: number, pan: number, level: number): void {
  const { ctx, master, noise } = state;
  if (!ctx || !master || !noise) return;

  const source = ctx.createBufferSource();
  source.buffer = noise;
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = frequency;
  filter.Q.value = q;

  const gain = envelope(ctx, duration * 0.2, duration, level);
  source.connect(filter).connect(gain).connect(panned(ctx, pan)).connect(master);
  source.start();
  source.stop(ctx.currentTime + duration * 2 + 0.2);
}

function mark(name: string): void {
  state.lastEvent = name;
  state.lastEventAt = state.ctx?.currentTime ?? 0;
}

/* ── Los eventos de cada capa ───────────────────────────────────────────── */

/**
 * El uguisu, el ruiseñor japonés: **la única especie del bestiario que no se ve
 * nunca**. Su canto es el sonido de la primavera en Kyoto, y tiene una forma
 * muy reconocible: un tono largo sostenido y después la figura rápida de tres
 * notas — el "ho… ho-ke-kyo".
 */
function uguisu(pan: number): void {
  const { ctx } = state;
  if (!ctx) return;

  chirp(1180, 1240, 0.55, pan, 0.16);
  window.setTimeout(() => chirp(1750, 1700, 0.12, pan, 0.14), 700);
  window.setTimeout(() => chirp(1420, 1380, 0.1, pan, 0.12), 860);
  window.setTimeout(() => chirp(2050, 1900, 0.22, pan, 0.15), 990);
  mark('uguisu');
}

function fireEvent(kind: EventKind): void {
  const pan = (Math.random() - 0.5) * 1.2;

  switch (kind) {
    case 'furin':
      // La campanilla de viento sólo suena si hay viento que la mueva.
      bell(1560 + Math.random() * 320, pan, 0.1 + WIND.gust * 0.14);
      mark('fūrin');
      break;

    case 'grillos': {
      const chirps = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < chirps; i += 1) {
        window.setTimeout(() => burst(4200 + Math.random() * 900, 22, 0.035, pan, 0.07), i * 165);
      }
      mark('grillos');
      break;
    }

    case 'pajaros':
      // Uno de cada tres cantos es el ruiseñor; el resto, gorriones sueltos.
      if (Math.random() < 0.34) uguisu(pan);
      else {
        const notes = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < notes; i += 1) {
          window.setTimeout(
            () => chirp(2300 + Math.random() * 900, 3100, 0.07, pan, 0.08),
            i * 120,
          );
        }
        mark('pájaros');
      }
      break;

    case 'fuego': {
      const crackles = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < crackles; i += 1) {
        window.setTimeout(
          () => burst(900 + Math.random() * 1600, 6, 0.02, pan, 0.05),
          i * (40 + Math.random() * 120),
        );
      }
      mark('fuego');
      break;
    }
  }
}

/** Cada cuánto vuelve a sonar una capa de eventos, en segundos. */
const EVENT_GAP: Record<EventKind, readonly [number, number]> = {
  furin: [14, 40],
  grillos: [6, 18],
  pajaros: [10, 30],
  fuego: [3, 11],
};

/* ── El latido ──────────────────────────────────────────────────────────── */

/**
 * Un paso del ambiente sonoro. Lo llama la escena una vez por frame, con lo que
 * el sonido **comparte reloj con la imagen**: si el canvas se para —modo 静—, el
 * aire también deja de soplar en los altavoces.
 */
export function updateAudio(): void {
  const { ctx } = state;
  if (!ctx || ctx.state !== 'running') return;

  const now = ctx.currentTime;

  for (const kind of BED_KINDS) {
    const bed = state.beds.get(kind);
    if (!bed) continue;

    if (!state.layers.has(kind)) {
      bed.gain.gain.setTargetAtTime(0, now, 0.4);
      continue;
    }

    const config = BED_CONFIG[kind];
    let level = 0;

    switch (kind) {
      case 'viento':
        // Casi nada en calma, y crece con la ráfaga: es la capa que ata el
        // sonido a lo que se está viendo.
        level = (0.06 + WIND.gust * 0.94) * config.gain;
        // Y además se vuelve más aguda al apretar, como el viento de verdad.
        bed.filter.frequency.setTargetAtTime(
          lerp(380, 1100, clamp(WIND.strength, 0, 1)),
          now,
          0.3,
        );
        break;

      case 'bambu':
        // Las hojas sólo rozan cuando algo las mueve.
        level = WIND.gust ** 1.3 * config.gain;
        break;

      case 'arroyo':
        // El agua va y viene, como si el camino se acercara y se alejara de la
        // orilla. Nunca es un zumbido plano de fondo.
        level = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * 0.06))) * config.gain;
        break;

      case 'ciudad':
        level = (0.3 + 0.2 * Math.sin(now * 0.04)) * config.gain;
        break;
    }

    bed.gain.gain.setTargetAtTime(level, now, 0.35);
  }

  for (const [kind, due] of state.due) {
    if (!state.layers.has(kind)) continue;
    if (now < due) continue;

    fireEvent(kind);
    const [min, max] = EVENT_GAP[kind];
    state.due.set(kind, now + lerp(min, max, Math.random()));
  }
}

/**
 * La voz de un animal que acaba de entrar en cuadro. Es lo que cierra el
 * círculo entre lo que se ve y lo que se oye: la garza que cruza es la que
 * grazna, y grazna por el lado por el que entró.
 */
export function playFauna(sound: FaunaSound, pan: number): void {
  if (!state.ctx || state.ctx.state !== 'running') return;

  switch (sound) {
    case 'graznido':
      // Ronco y descendente: una garza no canta, protesta.
      chirp(420, 210, 0.3, pan, 0.16, 'sawtooth');
      burst(700, 3, 0.16, pan, 0.06);
      mark('graznido');
      break;

    case 'trino':
      for (let i = 0; i < 3; i += 1) {
        window.setTimeout(() => chirp(2600, 3300, 0.06, pan, 0.07), i * 90);
      }
      mark('trino');
      break;

    case 'silbido':
      // El "pi-hyororo" del milano: sube y se queda temblando.
      chirp(1500, 2400, 0.18, pan, 0.11);
      window.setTimeout(() => chirp(2350, 1900, 0.9, pan, 0.09), 200);
      mark('silbido del milano');
      break;
  }
}

/** Lo que enseña `/diagnostico`. */
export function audioReadout(): {
  running: boolean;
  layers: string;
  lastEvent: string;
  secondsAgo: number;
} {
  return {
    running: state.ctx?.state === 'running',
    layers: [...state.layers].join(' · ') || '—',
    lastEvent: state.lastEvent,
    secondsAgo: state.ctx ? state.ctx.currentTime - state.lastEventAt : 0,
  };
}

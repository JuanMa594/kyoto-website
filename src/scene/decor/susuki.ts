/**
 * La susuki (すすき) del valle de Ubicación (Fase 5B), como datos y geometría.
 * Puro: lo usan `SusukiField` y `check:path`.
 *
 * Cada macizo se llena de matas con semilla fija —como el bambú, con
 * separación mínima y aclarándose hacia su final (`taper`)—. Cada mata es un
 * haz de hojas largas y finas que se abren y se arquean hacia fuera, y unas
 * pocas espigas plateadas por encima. Hojas y espigas se instancian; se mecen
 * con el viento de siempre (`windSway`, modo hoja: giran sobre su base y se
 * tienden a sotavento con la flexión de su mata).
 */

import { BufferGeometry, Euler, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { lerp, mulberry32 } from '@/lib/procedural';
import { pathX } from '@/scene/path/journeyPath';
import { groundY } from '@/scene/systems/elevation';

import { areaU, type PlacedSusuki } from './placement';

/** Radio de una mata en planta: lo que ocupa su pie. */
export const SUSUKI_TUFT_RADIUS = 0.3;
/** Separación mínima entre dos matas. */
const MIN_GAP = 0.55;
/** Hojas por mata y espigas (de–a). */
export const SUSUKI_BLADES = 20;
const PLUMES: readonly [number, number] = [2, 4];

/** El muelle de la susuki (índice en `SPRINGS`): ágil, con retardo. */
export const SUSUKI_SPRING = 3;

export interface Tuft {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly height: number;
  readonly phase: number;
  /** 0 = verde; 1 = pajiza. */
  readonly tone: number;
  readonly plumes: number;
}

export function susukiTufts(patch: PlacedSusuki, densityScale: number): Tuft[] {
  const { area, item, stationD } = patch;
  const random = mulberry32(item.seed * 613 + 29);
  const [u0, u1] = areaU(area);
  const length = area.to - area.from;
  const width = u1 - u0;
  const taper = item.taper ?? 1;
  const expected = Math.round((length * width * item.density * densityScale * (1 + taper)) / 2);

  const tufts: Tuft[] = [];
  for (let attempt = 0; tufts.length < expected && attempt < expected * 40; attempt += 1) {
    const along = random();
    const across = random();
    if (random() > lerp(1, taper, along)) continue;
    const d = stationD + area.from + along * length;
    const x = pathX(d) + u0 + across * width;
    const z = -d;
    if (tufts.some((t) => Math.hypot(t.x - x, t.z - z) < MIN_GAP)) continue;
    tufts.push({
      x,
      y: groundY(x, z) - 0.03,
      z,
      height: lerp(item.height[0], item.height[1], random() ** 0.7),
      phase: random(),
      tone: random(),
      plumes: PLUMES[0] + Math.floor(random() * (PLUMES[1] - PLUMES[0] + 1)),
    });
  }
  return tufts;
}

export interface BladePlacement {
  readonly matrix: Matrix4;
  /** Índice de su mata: se mece con ella. */
  readonly tuft: number;
}

/** Las hojas de cada mata: abiertas en abanico, más largas las del centro. */
export function tuftBlades(tufts: readonly Tuft[], seed: number): BladePlacement[] {
  const random = mulberry32(seed);
  const out: BladePlacement[] = [];
  const euler = new Euler(0, 0, 0, 'YXZ');
  tufts.forEach((tuft, index) => {
    for (let k = 0; k < SUSUKI_BLADES; k += 1) {
      const outward = lerp(0.12, 0.75, random() ** 1.4);
      euler.set(outward, random() * Math.PI * 2, (random() - 0.5) * 0.2);
      const length = tuft.height * lerp(0.55, 0.95, 1 - outward / 0.9 + random() * 0.2);
      out.push({
        matrix: new Matrix4().compose(
          new Vector3(tuft.x + (random() - 0.5) * 0.14, tuft.y, tuft.z + (random() - 0.5) * 0.14),
          new Quaternion().setFromEuler(euler),
          new Vector3(1, length, 1),
        ),
        tuft: index,
      });
    }
  });
  return out;
}

/** Las espigas de cada mata: tallos casi rectos que sobresalen de las hojas. */
export function tuftPlumes(tufts: readonly Tuft[], seed: number): BladePlacement[] {
  const random = mulberry32(seed);
  const out: BladePlacement[] = [];
  const euler = new Euler(0, 0, 0, 'YXZ');
  tufts.forEach((tuft, index) => {
    for (let k = 0; k < tuft.plumes; k += 1) {
      euler.set(lerp(0.05, 0.3, random()), random() * Math.PI * 2, 0);
      const size = tuft.height * lerp(1.0, 1.2, random());
      out.push({
        matrix: new Matrix4().compose(
          new Vector3(tuft.x + (random() - 0.5) * 0.1, tuft.y, tuft.z + (random() - 0.5) * 0.1),
          new Quaternion().setFromEuler(euler),
          new Vector3(size, size, size),
        ),
        tuft: index,
      });
    }
  });
  return out;
}

const BLADE_SEGMENTS = 6;
export const BLADE_TRIANGLES = BLADE_SEGMENTS * 2;

/**
 * Una hoja de susuki de largo 1: una cinta estrecha que se afina hacia la
 * punta y se arquea hacia +z (hacia fuera de la mata, tras su giro).
 */
export function susukiBladeGeometry(): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= BLADE_SEGMENTS; i += 1) {
    const t = i / BLADE_SEGMENTS;
    const half = 0.034 * (1 - t * 0.8);
    const bend = 0.32 * t * t;
    const y = t * (1 - 0.12 * t * t);
    positions.push(-half, y, bend, half, y, bend);
    normals.push(0, -bend, 1, 0, -bend, 1);
    uvs.push(0, t, 1, t);
    if (i < BLADE_SEGMENTS) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Una cinta recta entre dos puntos, de un ancho dado (en el plano que contiene a +x). */
function strip(from: Vector3, to: Vector3, width: number, tipWidth: number): BufferGeometry {
  const geometry = new BufferGeometry();
  const side = new Vector3(1, 0, 0);
  const a = from.clone().addScaledVector(side, -width / 2);
  const b = from.clone().addScaledVector(side, width / 2);
  const c = to.clone().addScaledVector(side, -tipWidth / 2);
  const d = to.clone().addScaledVector(side, tipWidth / 2);
  geometry.setAttribute('position', new Float32BufferAttribute([a, b, c, d].flatMap((v) => [v.x, v.y, v.z]), 3));
  geometry.setAttribute('uv', new Float32BufferAttribute([0, from.y, 1, from.y, 0, to.y, 1, to.y], 2));
  geometry.setIndex([0, 1, 2, 1, 3, 2]);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Una espiga de alto 1: el tallo y, arriba, un abanico de barbas finas que
 * cuelgan un poco, como la panícula plateada de la susuki.
 */
export function susukiPlumeGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [strip(new Vector3(0, 0, 0), new Vector3(0, 0.78, 0.02), 0.012, 0.008)];
  const barbs = 7;
  for (let k = 0; k < barbs; k += 1) {
    const t = k / (barbs - 1);
    const start = new Vector3(0, lerp(0.74, 0.84, t), 0.02);
    const spread = (t - 0.5) * 0.9;
    const tip = new Vector3(Math.sin(spread) * 0.16, start.y + 0.2 - Math.abs(spread) * 0.12, 0.05 + Math.cos(spread) * 0.06);
    parts.push(strip(start, tip, 0.03, 0.006));
  }
  const geometry = mergeGeometries(parts)!;
  for (const part of parts) part.dispose();
  return geometry;
}

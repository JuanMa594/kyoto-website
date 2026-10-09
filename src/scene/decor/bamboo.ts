/**
 * El bambú, como datos y geometría. Puro: lo usan `BambooGrove` y `check:path`.
 *
 * Cada macizo se llena con semilla fija —el mismo bosquecillo en cada carga—,
 * con una separación mínima entre cañas y, si el macizo se aclara (`taper`),
 * con menos cañas hacia su final. Las hojas son **la misma hoja lanceolada que
 * cae** en la Home (`bambuOutline`): las de la planta y las que vuelan son una.
 */

import { CylinderGeometry, Euler, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';

import { bambuOutline } from '@/lib/petalOutlines';
import { lerp, mulberry32 } from '@/lib/procedural';
import { outlineGeometry } from '@/scene/objects/PetalGeometry';
import { pathX } from '@/scene/path/journeyPath';
import { groundY } from '@/scene/systems/elevation';
import { culmSpring } from '@/scene/systems/sway';

import { areaU, type PlacedGrove } from './placement';

export interface Culm {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly height: number;
  readonly radius: number;
  readonly tiltX: number;
  readonly tiltZ: number;
  readonly phase: number;
  readonly spring: number;
  /** 0 = caña joven (verde); 1 = vieja (más amarilla). */
  readonly tone: number;
}

/** Separación mínima entre dos cañas. */
const MIN_GAP = 0.42;

export function groveCulms(grove: PlacedGrove, densityScale: number): Culm[] {
  const { area, item, stationD } = grove;
  const random = mulberry32(item.seed * 977 + 13);
  const [u0, u1] = areaU(area);
  const length = area.to - area.from;
  const width = u1 - u0;
  const taper = item.taper ?? 1;
  const expected = Math.round((length * width * item.density * densityScale * (1 + taper)) / 2);

  const culms: Culm[] = [];
  for (let attempt = 0; culms.length < expected && attempt < expected * 40; attempt += 1) {
    const along = random();
    const across = random();
    // Se aclara hacia el final: se acepta con la densidad local relativa.
    if (random() > lerp(1, taper, along)) continue;
    const d = stationD + area.from + along * length;
    const x = pathX(d) + u0 + across * width;
    const z = -d;
    if (culms.some((c) => Math.hypot(c.x - x, c.z - z) < MIN_GAP)) continue;

    const height = lerp(item.height[0], item.height[1], random() ** 0.8);
    culms.push({
      x,
      y: groundY(x, z) - 0.05,
      z,
      height,
      radius: (0.03 + 0.0065 * height) * (0.85 + random() * 0.3),
      tiltX: (random() - 0.5) * 0.12,
      tiltZ: (random() - 0.5) * 0.12,
      phase: random(),
      spring: culmSpring(height, random()),
      tone: random(),
    });
  }
  return culms;
}

export interface LeafPlacement {
  readonly matrix: Matrix4;
  /** Índice de su caña: se dobla con ella. */
  readonly culm: number;
}

/** Ramilletes de hojas a lo largo de la mitad alta de cada caña, caídos hacia fuera. */
export function culmLeaves(culms: readonly Culm[], seed: number, perCulm = 34): LeafPlacement[] {
  const random = mulberry32(seed);
  const leaves: LeafPlacement[] = [];
  const euler = new Euler(0, 0, 0, 'YXZ');

  culms.forEach((culm, index) => {
    const tilt = new Quaternion().setFromEuler(new Euler(culm.tiltX, 0, culm.tiltZ));
    const sprays = 5 + Math.floor(random() * 2);
    const perSpray = Math.round(perCulm / sprays);
    for (let k = 0; k < sprays; k += 1) {
      const along = lerp(0.28, 0.97, (k + random() * 0.6) / sprays);
      const anchor = new Vector3(0, along * culm.height, 0)
        .applyQuaternion(tilt)
        .add(new Vector3(culm.x, culm.y, culm.z));
      const yaw = random() * Math.PI * 2;
      for (let j = 0; j < perSpray; j += 1) {
        euler.set(lerp(0.7, 1.35, random()), yaw + (random() - 0.5) * 1.4, (random() - 0.5) * 0.5);
        const size = lerp(0.42, 0.62, random());
        leaves.push({
          matrix: new Matrix4().compose(
            anchor,
            new Quaternion().setFromEuler(euler),
            new Vector3(size * 0.9, size, size),
          ),
          culm: index,
        });
      }
    }
  });
  return leaves;
}

/** Lados y tramos de una caña: la cuenta de triángulos sale de aquí. */
const CULM_SIDES = 6;
const CULM_RINGS = 16;
export const CULM_TRIANGLES = CULM_SIDES * CULM_RINGS * 2;

/**
 * Una caña de radio 1 y alto 1, con la base en el origen. Los anillos pares
 * engordan un 14 %: son los nudos, y entre ellos el entrenudo queda liso.
 */
export function culmGeometry(): BufferGeometry {
  const geometry = new CylinderGeometry(0.72, 1, 1, CULM_SIDES, CULM_RINGS, true);
  geometry.translate(0, 0.5, 0);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i += 1) {
    const ring = Math.round(position.getY(i) * CULM_RINGS);
    const node = ring > 0 && ring < CULM_RINGS && ring % 2 === 0 ? 1.14 : 1;
    position.setX(i, position.getX(i) * node);
    position.setZ(i, position.getZ(i) * node);
  }
  geometry.computeVertexNormals();
  return geometry;
}

const LEAF_SEGMENTS = 5;
export const LEAF_TRIANGLES = LEAF_SEGMENTS * 2;

/** Una hoja de bambú de largo 1, con la base en el origen y la punta hacia +y. */
export function bambooLeafGeometry(): BufferGeometry {
  const geometry = outlineGeometry(bambuOutline(LEAF_SEGMENTS), 0.07, 1);
  geometry.translate(0, 0.5, 0);
  return geometry;
}

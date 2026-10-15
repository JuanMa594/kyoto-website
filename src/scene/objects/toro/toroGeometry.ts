/**
 * La geometría de los faroles de piedra, generada por código.
 *
 * Cada pieza es un torno (`LatheGeometry`) de pocos lados: con seis, el perfil
 * sale hexagonal, como se tallan los faroles; con doce, el poste redondo del
 * kasuga. El tejado es un torno de muchos lados llevado a hexágono, con las
 * puntas levantadas (la curva de las esquinas del kasa). Caras planas, como
 * las piedras del camino.
 *
 * Dos geometrías por farol, una por material: la **piedra** y el **papel** de
 * las ventanas de la cámara del fuego, que el modo noche encenderá. La piedra
 * lleva en `color` su moteado y su humedad al pie, y en `aMoss` cuánto musgo
 * tiene cada vértice —en lo alto del tejado y en la base—; el color del musgo
 * lo pone el material, desde la paleta.
 *
 * Medidas generales: `toro.ts`. Se calcula una vez por variante y se comparte.
 */

import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { smoothstep } from '@/lib/procedural';

import { LANTERN_SIZE, type LanternVariant } from './toro';

export interface LanternParts {
  readonly stone: BufferGeometry;
  readonly paper: BufferGeometry;
}

/** Con una cara (no una arista) mirando a ±z: ahí van las ventanas. */
const HEX_START = Math.PI / 6;

type Profile = readonly (readonly [number, number])[];

/**
 * Sin índices ni uv, con normal por cara: lo que se fusiona. Un torno que
 * empieza o acaba en el eje deja triángulos de área cero allí (dos vértices
 * en el mismo punto): su normal sería nula, y una normal nula es un punto
 * negro (ver CLAUDE.md, «Un punto negro… es un NaN»). Se quitan.
 */
function prepared(geometry: BufferGeometry): BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  const source = flat.getAttribute('position');
  const kept: number[] = [];
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  for (let i = 0; i < source.count; i += 3) {
    a.fromBufferAttribute(source, i);
    b.fromBufferAttribute(source, i + 1);
    c.fromBufferAttribute(source, i + 2);
    if (b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() < 1e-14) continue;
    kept.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  flat.dispose();
  const clean = new BufferGeometry();
  clean.setAttribute('position', new Float32BufferAttribute(kept, 3));
  clean.computeVertexNormals();
  return clean;
}

/** Un torno: el perfil va del eje, por fuera, de abajo arriba, y vuelve al eje. */
function lathe(profile: Profile, segments: number, phiStart = HEX_START): BufferGeometry {
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    segments,
    phiStart,
  );
}

/**
 * El tejado: un torno de 36 lados llevado a hexágono (el perfil da la
 * apotema) y con las esquinas levantadas, más cuanto más fuera.
 */
function roof(profile: Profile, sori: number): BufferGeometry {
  const geometry = lathe(profile, 36);
  const eave = Math.max(...profile.map(([r]) => r));
  const position = geometry.getAttribute('position');
  const sixth = Math.PI / 3;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-6) continue;
    const phi = Math.atan2(x, z);
    const local = (((phi - HEX_START) % sixth) + sixth) % sixth;
    const fromCenter = local - sixth / 2;
    const corner = Math.abs(fromCenter) / (sixth / 2);
    const stretch = 1 / Math.cos(fromCenter);
    position.setX(i, x * stretch);
    position.setZ(i, z * stretch);
    position.setY(i, position.getY(i) + sori * corner ** 3 * (r / eave) ** 2);
  }
  return geometry;
}

/** La pendiente cóncava de un tejado: de la cara de arriba del alero a la cumbrera. */
function slope(from: readonly [number, number], to: readonly [number, number], power: number): [number, number][] {
  const points: [number, number][] = [];
  for (let k = 0; k <= 8; k += 1) {
    const t = k / 8;
    points.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t ** power]);
  }
  return points;
}

/** Una pata curva del yukimi: de fuera abajo a dentro arriba, combada hacia fuera. */
function leg(angle: number, height: number): BufferGeometry {
  const geometry = new CylinderGeometry(0.055, 0.075, height, 6, 6);
  geometry.translate(0, height / 2, 0);
  const position = geometry.getAttribute('position');
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  for (let i = 0; i < position.count; i += 1) {
    const t = position.getY(i) / height;
    const reach = 0.5 + (0.26 - 0.5) * t + 0.07 * Math.sin(Math.PI * t);
    position.setX(i, position.getX(i) + sin * reach);
    position.setZ(i, position.getZ(i) + cos * reach);
  }
  return geometry;
}

/** Las dos ventanas de papel, en las caras ±z de la cámara del fuego. */
function windows(apothem: number, y: number, width: number, height: number): BufferGeometry[] {
  return [1, -1].map((side) => {
    const geometry = new BoxGeometry(width, height, 0.012);
    geometry.translate(0, y, side * (apothem + 0.004));
    return geometry;
  });
}

function kasuga(): { stone: BufferGeometry[]; paper: BufferGeometry[] } {
  const fire = 0.22;
  return {
    stone: [
      // Kiso: la base.
      lathe([[0, 0], [0.44, 0], [0.44, 0.12], [0.38, 0.16], [0.3, 0.22], [0, 0.22]], 6),
      // Sao: el poste, con su anillo.
      lathe(
        [[0, 0.2], [0.15, 0.2], [0.14, 0.62], [0.165, 0.64], [0.165, 0.7], [0.135, 0.72], [0.12, 1.1], [0, 1.1]],
        12,
        0,
      ),
      // Chūdai: la plataforma, abierta hacia arriba.
      lathe([[0, 1.06], [0.16, 1.06], [0.2, 1.1], [0.36, 1.22], [0.38, 1.26], [0.38, 1.3], [0, 1.3]], 6),
      // Hibukuro: la cámara del fuego, entre dos losas.
      lathe(
        [[0, 1.3], [0.27, 1.3], [0.27, 1.34], [fire, 1.34], [fire, 1.62], [0.27, 1.62], [0.27, 1.66], [0, 1.66]],
        6,
      ),
      // Kasa: el tejado.
      roof([[0, 1.66], [0.5, 1.66], ...slope([0.5, 1.7], [0.11, 1.94], 1.7), [0.09, 1.96], [0, 1.96]], 0.07),
      // Hōju: la joya, sobre su flor.
      lathe(
        [[0, 1.95], [0.09, 1.95], [0.1, 1.985], [0.06, 2.005], [0.075, 2.04], [0.072, 2.09], [0.048, 2.14], [0.018, 2.2], [0, 2.24]],
        10,
        0,
      ),
    ],
    paper: windows(fire * Math.cos(Math.PI / 6), 1.48, 0.14, 0.2),
  };
}

function yukimi(): { stone: BufferGeometry[]; paper: BufferGeometry[] } {
  const fire = 0.25;
  return {
    stone: [
      ...[0, 1, 2].map((k) => leg(Math.PI / 3 + (k * 2 * Math.PI) / 3, 0.56)),
      lathe([[0, 0.5], [0.34, 0.5], [0.38, 0.54], [0.38, 0.6], [0, 0.6]], 6),
      lathe(
        [[0, 0.6], [0.3, 0.6], [0.3, 0.63], [fire, 0.63], [fire, 0.84], [0.3, 0.84], [0.3, 0.87], [0, 0.87]],
        6,
      ),
      // Un tejado grueso, de piedra: el alero mide 0,09 y apenas se levanta.
      roof([[0, 0.87], [0.62, 0.87], [0.78, 0.9], [0.78, 0.96], ...slope([0.74, 0.99], [0.13, 1.12], 1.3), [0.1, 1.14], [0, 1.14]], 0.045),
      lathe([[0, 1.13], [0.08, 1.13], [0.085, 1.15], [0.05, 1.165], [0.06, 1.2], [0.05, 1.25], [0.02, 1.29], [0, 1.3]], 10, 0),
    ],
    paper: windows(fire * Math.cos(Math.PI / 6), 0.735, 0.16, 0.16),
  };
}

/** Ruido de senos, barato y determinista: el moteado del granito. */
function grain(x: number, y: number, z: number): number {
  return (
    0.5 * Math.sin(x * 7.1 + y * 3.3) * Math.cos(z * 6.7 - y * 4.1) +
    0.25 * Math.sin(x * 13.7 - z * 11.3 + y * 9.1) +
    0.25 * Math.sin(y * 17.9 + x * 5.3 + z * 15.1)
  );
}

/** El moteado, la humedad del pie y el musgo de lo alto, por vértice. */
function weather(geometry: BufferGeometry, height: number): void {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const colors = new Float32Array(position.count * 3);
  const moss = new Float32Array(position.count);
  const n = new Vector3();
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    n.set(normal.getX(i), normal.getY(i), normal.getZ(i));
    const speckle = 0.86 + 0.12 * grain(x, y, z);
    // El pie, húmedo: más oscuro y algo verde.
    const damp = 1 - smoothstep(0, 0.35, y);
    colors.set([speckle * (1 - 0.26 * damp), speckle * (1 - 0.18 * damp), speckle * (1 - 0.3 * damp)], i * 3);
    // El musgo: en lo que mira arriba de la mitad alta (tejado, losas) y en
    // la base, a manchas.
    const patches = smoothstep(-0.1, 0.45, grain(x * 1.7 + 3.1, y * 1.3, z * 1.7 - 1.2));
    const up = smoothstep(0.45, 0.9, n.y) * (y > height * 0.4 ? 1 : 0);
    moss[i] = Math.min(0.85, patches * (up * 0.85 + damp * 0.45));
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aMoss', new Float32BufferAttribute(moss, 1));
}

function build(variant: LanternVariant): LanternParts {
  const parts = variant === 'kasuga' ? kasuga() : yukimi();
  const { height } = LANTERN_SIZE[variant];
  const merge = (list: BufferGeometry[]): BufferGeometry => {
    const ready = list.map(prepared);
    const merged = mergeGeometries(ready);
    for (const part of ready) part.dispose();
    if (!merged) throw new Error(`farol ${variant}: no se pudo fusionar la geometría`);
    return merged;
  };
  const stone = merge(parts.stone);
  weather(stone, height);
  return { stone, paper: merge(parts.paper) };
}

const cache = new Map<LanternVariant, LanternParts>();

/** La geometría de un farol, calculada una vez por variante y compartida. */
export function lanternGeometry(variant: LanternVariant): LanternParts {
  let parts = cache.get(variant);
  if (!parts) {
    parts = build(variant);
    cache.set(variant, parts);
  }
  return parts;
}

/**
 * La geometría del torii ryōbu, generada por código (Fase 4).
 *
 * Cajas con las aristas redondeadas —el borde atrapa la luz rasante y evita el
 * aspecto de bloques ensamblados que se rechazó en la 2C—, pilares cónicos con
 * su inclinación hacia dentro, y un kasagi lofteado a lo largo de x cuya base
 * sigue la curva de las puntas levantadas. Se fusiona en tres geometrías, una
 * por material: tres draw calls para todo el torii.
 *
 * Origen y medidas: `ryobu.ts`. Se calcula una vez y se comparte.
 */

import { BufferGeometry, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Shape } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { kasagiLift, RYOBU } from './ryobu';

export interface ToriiParts {
  /** Bermellón: pilares, shimaki, nuki, puntal, pilares de apoyo. */
  readonly shu: BufferGeometry;
  /** Sumi: kasagi, bases, placa, tejadillos. */
  readonly sumi: BufferGeometry;
  /** El marco claro de la placa. */
  readonly placa: BufferGeometry;
}

/** Todo con los mismos atributos —posición y normal, sin índices— para fusionar. */
function prepared(geometry: BufferGeometry): BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  if (flat.getAttribute('uv')) flat.deleteAttribute('uv');
  if (!flat.getAttribute('normal')) flat.computeVertexNormals();
  return flat;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, radius = 0.03): BufferGeometry {
  const geometry = new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 2.5, h / 2.5, d / 2.5));
  geometry.translate(x, y, z);
  return prepared(geometry);
}

function cylinder(rTop: number, rBottom: number, height: number, x: number, y: number): BufferGeometry {
  const geometry = new CylinderGeometry(rTop, rBottom, height, 24, 1);
  geometry.translate(x, y, 0);
  return prepared(geometry);
}

/** Un pilar principal: cónico y con su uchikorobi (la cabeza hacia el centro). */
function pillar(x: number, inward: 1 | -1): BufferGeometry {
  const { baseHeight, shimakiBottom, pillarRadius, lean } = RYOBU;
  const height = shimakiBottom - baseHeight;
  const geometry = new CylinderGeometry(pillarRadius[1], pillarRadius[0], height, 24, 8, true);
  geometry.translate(0, baseHeight + height / 2, 0);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i += 1) {
    const t = (position.getY(i) - baseHeight) / height;
    position.setX(i, position.getX(i) + x + inward * lean * t);
  }
  geometry.computeVertexNormals();
  return prepared(geometry);
}

type V = readonly [number, number, number];

/**
 * Una viga curva: secciones rectangulares a lo largo de x, con la cara de
 * abajo en `bottom(x)`. Caras planas (normal por cara), con sus dos tapas.
 */
function loftBeam(
  from: number,
  to: number,
  depth: number,
  height: number,
  bottom: (x: number) => number,
  segments = 40,
): BufferGeometry {
  const positions: number[] = [];
  const section = (x: number): [V, V, V, V] => {
    const y = bottom(x);
    const z = depth / 2;
    return [
      [x, y, z],
      [x, y + height, z],
      [x, y + height, -z],
      [x, y, -z],
    ];
  };
  const quad = (a: V, b: V, c: V, d: V) => positions.push(...a, ...b, ...c, ...a, ...c, ...d);

  let previous = section(from);
  quad(previous[0], previous[1], previous[2], previous[3]); // tapa hacia −x
  for (let i = 1; i <= segments; i += 1) {
    const current = section(from + ((to - from) * i) / segments);
    quad(previous[0], current[0], current[1], previous[1]); // delante (+z)
    quad(previous[1], current[1], current[2], previous[2]); // arriba
    quad(previous[2], current[2], current[3], previous[3]); // detrás
    quad(previous[3], current[3], current[0], previous[0]); // abajo
    previous = current;
  }
  quad(previous[0], previous[3], previous[2], previous[1]); // tapa hacia +x

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** El tejadillo a dos aguas de un pilar de apoyo: el «▲» de 1.png. */
function gable(x: number, y: number, z: number): BufferGeometry {
  const shape = new Shape();
  shape.moveTo(-0.3, 0);
  shape.lineTo(0.3, 0);
  shape.lineTo(0, 0.24);
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false });
  geometry.translate(x, y, z - 0.25);
  return prepared(geometry);
}

function build(): ToriiParts {
  const { span, baseHeight, shimakiBottom, pillarRadius, lean } = RYOBU;
  const shu: BufferGeometry[] = [];
  const sumi: BufferGeometry[] = [];
  const placa: BufferGeometry[] = [];
  const center = span / 2;

  // Pilares principales, con su base negra y su collar (daiwa).
  for (const [x, inward] of [
    [0, 1],
    [span, -1],
  ] as const) {
    shu.push(pillar(x, inward));
    sumi.push(cylinder(0.44, 0.5, baseHeight, x, baseHeight / 2));
    shu.push(cylinder(0.41, 0.41, 0.2, x + inward * lean, shimakiBottom - 0.14));
  }

  // Kasagi (sumi) y shimaki (bermellón), con la misma curva: el shimaki
  // termina justo donde empieza el kasagi.
  sumi.push(
    loftBeam(-RYOBU.kasagiOverhang, span + RYOBU.kasagiOverhang, RYOBU.kasagiDepth, RYOBU.kasagiHeight, (x) =>
      shimakiBottom + RYOBU.shimakiHeight + kasagiLift(x),
    ),
  );
  shu.push(
    loftBeam(
      -RYOBU.shimakiOverhang,
      span + RYOBU.shimakiOverhang,
      RYOBU.shimakiDepth,
      RYOBU.shimakiHeight,
      (x) => shimakiBottom + kasagiLift(x),
    ),
  );

  // Nuki: atraviesa los pilares y asoma; y sus cuñas por fuera.
  shu.push(box(span + 2 * RYOBU.nukiOverhang, RYOBU.nukiHeight, RYOBU.nukiDepth, center, RYOBU.nukiY, 0));
  const wedge = pillarRadius[1] + 0.1;
  shu.push(box(0.12, 0.34, 0.5, -wedge, RYOBU.nukiY, 0));
  shu.push(box(0.12, 0.34, 0.5, span + wedge, RYOBU.nukiY, 0));

  // Gakuzuka (el puntal central) y la placa, con su marco claro delante.
  const strutBottom = RYOBU.nukiY + RYOBU.nukiHeight / 2;
  shu.push(box(0.3, shimakiBottom - strutBottom, 0.3, center, (strutBottom + shimakiBottom) / 2, 0));
  const plaqueY = (strutBottom + shimakiBottom) / 2;
  sumi.push(box(0.78, 1, 0.14, center, plaqueY, 0.22));
  const frontZ = 0.22 + 0.07 + 0.012;
  placa.push(box(0.62, 0.045, 0.02, center, plaqueY + 0.42, frontZ, 0.008));
  placa.push(box(0.62, 0.045, 0.02, center, plaqueY - 0.42, frontZ, 0.008));
  placa.push(box(0.045, 0.885, 0.02, center - 0.31, plaqueY, frontZ, 0.008));
  placa.push(box(0.045, 0.885, 0.02, center + 0.31, plaqueY, frontZ, 0.008));

  // Sode-bashira: delante y detrás de cada pilar, con base, tejadillo y las
  // dos vigas que los unen al pilar.
  const { offset, size, height, beams } = RYOBU.sode;
  for (const x of [0, span]) {
    for (const side of [1, -1]) {
      const z = side * offset;
      sumi.push(box(0.42, 0.45, 0.42, x, 0.225, z));
      shu.push(box(size, height - 0.45, size, x, 0.45 + (height - 0.45) / 2, z));
      shu.push(box(0.36, 0.12, 0.36, x, height + 0.06, z));
      sumi.push(gable(x, height + 0.12, z));
      const length = offset - pillarRadius[0] - size / 2;
      for (const y of beams) {
        shu.push(box(0.2, 0.24, length, x, y, side * (pillarRadius[0] + length / 2)));
      }
    }
  }

  const merge = (parts: BufferGeometry[]): BufferGeometry => {
    const merged = mergeGeometries(parts);
    for (const part of parts) part.dispose();
    if (!merged) throw new Error('torii: no se pudo fusionar la geometría');
    return merged;
  };

  return { shu: merge(shu), sumi: merge(sumi), placa: merge(placa) };
}

let cached: ToriiParts | null = null;

/** La geometría del ryōbu, calculada una vez y compartida. */
export function ryobuToriiGeometry(): ToriiParts {
  cached ??= build();
  return cached;
}

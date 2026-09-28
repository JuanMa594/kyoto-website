/**
 * Pipeline de modelos: `bun run models`
 *
 * Toma los originales de `assets/models/source/` y escribe versiones de web en
 * `public/models/`, igual que `bun run fonts` hace con las tipografías.
 *
 * El punto de partida es brutal: los originales suman ~215 MB y la garza sola
 * pesa 127,7 MB con 1,9 millones de triángulos — más que el sitio entero
 * multiplicado por cien. En pantalla una garza mide unos 70 px de alto; 6.000
 * triángulos bastan para que su silueta sea idéntica a la del original.
 *
 * Hay dos tratamientos:
 *
 *   · **estático** — modelos sin esqueleto (garza, ardilla, tanuki…). El color
 *     de la textura se **hornea en los vértices** y la textura se tira. Es la
 *     decisión que lo sostiene todo: las texturas son el 80 % del peso y su
 *     detalle fotográfico choca con el cartel; como color de vértice, en cambio,
 *     sobrevive exactamente lo que se ve a esa escala —el gris y negro de la
 *     garza, el rojizo de la ardilla, la máscara del tanuki— en forma de
 *     degradado suave, casi de acuarela. Después se simplifica, se orienta con
 *     el morro hacia +X, se apoya en y = 0 y se escala a largo 1. La escena
 *     anima estos modelos deformando regiones en el shader
 *     (`scene/objects/fauna/deform.ts`).
 *
 *   · **animado** — modelos con esqueleto y animaciones (mariposa, libélula).
 *     Se conservan huesos y clips; las texturas se reducen y pasan a WebP.
 *
 * Los originales NO se versionan: la garza supera los 100 MB que acepta GitHub.
 * Los generados sí, para que un clon nuevo compile sin regenerar nada.
 */

import { mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Document, NodeIO, Primitive, type Texture } from '@gltf-transform/core';
import {
  ALL_EXTENSIONS,
  EXTMeshoptCompression,
  EXTTextureWebP,
  KHRMeshQuantization,
} from '@gltf-transform/extensions';
import {
  dedup,
  prune,
  quantize,
  resample,
  simplify,
  textureCompress,
  weld,
} from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = join(ROOT, 'assets', 'models', 'source');
const OUT_DIR = join(ROOT, 'public', 'models');

interface StaticJob {
  kind: 'estatico';
  source: string;
  output: string;
  /** Presupuesto de triángulos. */
  triangles: number;
  /** Giro en Y, en grados, que lleva el morro del original a +X. */
  yaw: number;
}

interface AnimatedJob {
  kind: 'animado';
  source: string;
  output: string;
  triangles: number;
  yaw: number;
  /** Giro previo en X, en grados, para modelos que vienen tumbados. */
  pitch?: number;
  textureSize: number;
  /**
   * Las mallas planas (alas) y las gruesas (cuerpo) salen con materiales
   * distintos, llamados `ala` y `cuerpo`, para que la escena pueda pintarlas
   * por separado. Sólo hace falta en modelos cuyos materiales no lo distinguen.
   */
  splitWings?: boolean;
}

type Job = StaticJob | AnimatedJob;

/**
 * El manifiesto. Los giros salen de mirar cada original en planta y perfil: el
 * morro de la garza apunta a −X, el de la ardilla a +Z, etc.
 */
const JOBS: Job[] = [
  { kind: 'estatico', source: 'fauna/grey_heron__standing_rigged_bird.glb', output: 'fauna/garza.glb', triangles: 6000, yaw: 180 },
  { kind: 'estatico', source: 'fauna/Squirrel.glb', output: 'fauna/ardilla.glb', triangles: 4500, yaw: 90 },
  { kind: 'estatico', source: 'fauna/Tanuki3d.glb', output: 'fauna/tanuki.glb', triangles: 4500, yaw: 90 },
  { kind: 'estatico', source: 'fauna/Botail cat 3d model.glb', output: 'fauna/gato.glb', triangles: 4500, yaw: 0 },
  { kind: 'estatico', source: 'fauna/Milano Negro.glb', output: 'fauna/milano.glb', triangles: 3500, yaw: 90 },
  // Un cucarachero de cactus haciendo de gorrión: a 20 px y en bandada no se
  // distinguen, y es el único pájaro pequeño del lote.
  { kind: 'estatico', source: 'fauna/Cactus wren by Poly by Google - 6b7Ul6MeLrJ.glb', output: 'fauna/gorrion.glb', triangles: 1200, yaw: 90 },
  // Papilio xuthus: la ageha, la especie japonesa exacta.
  { kind: 'animado', source: 'fauna/cc0___swallowtail_butterfly_papilio_xuthus.glb', output: 'fauna/mariposa.glb', triangles: 6000, yaw: 180, textureSize: 256 },
  { kind: 'animado', source: 'fauna/dragonfly7687.glb', output: 'fauna/libelula.glb', triangles: 6000, yaw: 90, pitch: -90, textureSize: 256, splitWings: true },
];

/* ── Utilidades ─────────────────────────────────────────────────────────── */

function srgbToLinear(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

interface Decoded {
  width: number;
  height: number;
  data: Buffer;
}

async function decode(texture: Texture): Promise<Decoded | null> {
  const image = texture.getImage();
  if (!image) return null;
  const { data, info } = await sharp(Buffer.from(image)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}

/** Muestreo bilineal con repetición, devuelto en lineal. */
function sample(img: Decoded, u: number, v: number): [number, number, number] {
  const x = (((u % 1) + 1) % 1) * img.width - 0.5;
  const y = (((v % 1) + 1) % 1) * img.height - 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const px = (xx: number, yy: number, c: number) => {
    const cx = ((xx % img.width) + img.width) % img.width;
    const cy = ((yy % img.height) + img.height) % img.height;
    return img.data[(cy * img.width + cx) * 3 + c]!;
  };
  const out: [number, number, number] = [0, 0, 0];
  for (let c = 0; c < 3; c += 1) {
    const top = px(x0, y0, c) * (1 - fx) + px(x0 + 1, y0, c) * fx;
    const bottom = px(x0, y0 + 1, c) * (1 - fx) + px(x0 + 1, y0 + 1, c) * fx;
    out[c] = srgbToLinear(top * (1 - fy) + bottom * fy);
  }
  return out;
}

function transformPoint(m: number[], x: number, y: number, z: number): [number, number, number] {
  return [
    m[0]! * x + m[4]! * y + m[8]! * z + m[12]!,
    m[1]! * x + m[5]! * y + m[9]! * z + m[13]!,
    m[2]! * x + m[6]! * y + m[10]! * z + m[14]!,
  ];
}

function countTriangles(doc: Document): number {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      n += (idx ? idx.getCount() : (prim.getAttribute('POSITION')?.getCount() ?? 0)) / 3;
    }
  }
  return Math.round(n);
}

/* ── Estáticos: hornear, soldar, simplificar, normalizar ────────────────── */

async function processStatic(io: NodeIO, job: StaticJob): Promise<Document> {
  const source = await io.read(join(SOURCE_DIR, job.source));
  const decoded = new Map<Texture, Decoded | null>();

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const yaw = (job.yaw * Math.PI) / 180;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);

  for (const scene of source.getRoot().listScenes()) {
    const nodes: ReturnType<typeof scene.listChildren> = [];
    scene.traverse((node) => nodes.push(node));

    for (const node of nodes) {
      const mesh = node.getMesh();
      if (!mesh) continue;
      const world = node.getWorldMatrix() as unknown as number[];

      for (const prim of mesh.listPrimitives()) {
        if (prim.getMode() !== Primitive.Mode.TRIANGLES) continue;
        const position = prim.getAttribute('POSITION');
        if (!position) continue;

        const material = prim.getMaterial();
        const factor = material?.getBaseColorFactor() ?? [1, 1, 1, 1];
        const texture = material?.getBaseColorTexture() ?? null;
        const texCoord = material?.getBaseColorTextureInfo()?.getTexCoord() ?? 0;
        const uv = texture ? prim.getAttribute(`TEXCOORD_${texCoord}`) : null;
        const vertexColor = prim.getAttribute('COLOR_0');

        if (texture && !decoded.has(texture)) decoded.set(texture, await decode(texture));
        const image = texture ? decoded.get(texture) ?? null : null;

        const base = positions.length / 3;
        const p = [0, 0, 0];
        const t = [0, 0];
        const vc = [1, 1, 1, 1];

        for (let i = 0; i < position.getCount(); i += 1) {
          position.getElement(i, p);
          const [wx, wy, wz] = transformPoint(world, p[0]!, p[1]!, p[2]!);
          // Giro en Y: el morro pasa a +X.
          positions.push(wx * cos + wz * sin, wy, -wx * sin + wz * cos);

          let rgb: [number, number, number] = [factor[0]!, factor[1]!, factor[2]!];
          if (image && uv) {
            uv.getElement(i, t);
            const s = sample(image, t[0]!, t[1]!);
            rgb = [rgb[0] * s[0], rgb[1] * s[1], rgb[2] * s[2]];
          }
          if (vertexColor) {
            vertexColor.getElement(i, vc);
            rgb = [rgb[0] * vc[0]!, rgb[1] * vc[1]!, rgb[2] * vc[2]!];
          }
          colors.push(...rgb);
        }

        const idx = prim.getIndices();
        if (idx) {
          for (let i = 0; i < idx.getCount(); i += 1) indices.push(base + idx.getScalar(i));
        } else {
          for (let i = 0; i < position.getCount(); i += 1) indices.push(base + i);
        }
      }
    }
  }

  // Normalizar: pies en y = 0, centrado en X y Z, largo (morro a cola) = 1.
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let c = 0; c < 3; c += 1) {
      min[c] = Math.min(min[c]!, positions[i + c]!);
      max[c] = Math.max(max[c]!, positions[i + c]!);
    }
  }
  const length = max[0]! - min[0]!;
  const cx = (min[0]! + max[0]!) / 2;
  const cz = (min[2]! + max[2]!) / 2;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (positions[i]! - cx) / length;
    positions[i + 1] = (positions[i + 1]! - min[1]!) / length;
    positions[i + 2] = (positions[i + 2]! - cz) / length;
  }

  // Un mismo punto aparece varias veces —una por cada isla de UV que lo toca—
  // con colores apenas distintos. Se les da el color medio para que se puedan
  // soldar: sin soldar, el simplificador no puede colapsar aristas y la garza
  // se quedaba en 200.000 triángulos.
  const groups = new Map<string, number[]>();
  const key = (i: number) =>
    `${Math.round(positions[i * 3]! * 1e5)},${Math.round(positions[i * 3 + 1]! * 1e5)},${Math.round(positions[i * 3 + 2]! * 1e5)}`;
  for (let i = 0; i < positions.length / 3; i += 1) {
    const k = key(i);
    const list = groups.get(k);
    if (list) list.push(i);
    else groups.set(k, [i]);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const avg = [0, 0, 0];
    for (const i of list) for (let c = 0; c < 3; c += 1) avg[c]! += colors[i * 3 + c]!;
    for (const i of list) for (let c = 0; c < 3; c += 1) colors[i * 3 + c] = avg[c]! / list.length;
  }

  const doc = new Document();
  const buffer = doc.createBuffer();
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer))
    .setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(new Float32Array(colors)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(indices)).setBuffer(buffer))
    .setMaterial(doc.createMaterial('piel').setRoughnessFactor(0.9).setMetallicFactor(0));
  const mesh = doc.createMesh(job.output).addPrimitive(prim);
  doc.createScene().addChild(doc.createNode(job.output).setMesh(mesh));

  const before = indices.length / 3;
  await doc.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, job.triangles / before), error: 0.02 }),
    dedup(),
    prune(),
  );

  for (const mesh of doc.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) smoothNormals(doc, primitive);
  }

  return doc;
}

/**
 * Normales suaves, promediadas por área, sobre la malla ya soldada.
 *
 * No se usa `normals()` de gltf-transform a propósito: genera normales
 * **planas**, y para eso desuelda la malla — cada triángulo con sus tres
 * vértices propios. El resultado era justo lo que había que evitar: un animal
 * facetado, "poligonal", y archivos con el triple de vértices. Promediando las
 * normales de las caras que comparten cada vértice, la luz resbala por el
 * cuerpo y el color horneado se funde como una aguada.
 */
function smoothNormals(doc: Document, primitive: Primitive): void {
  const position = primitive.getAttribute('POSITION');
  const indices = primitive.getIndices();
  if (!position || !indices) return;

  const normals = new Float32Array(position.getCount() * 3);
  const a = [0, 0, 0];
  const b = [0, 0, 0];
  const c = [0, 0, 0];

  for (let t = 0; t < indices.getCount(); t += 3) {
    const i0 = indices.getScalar(t);
    const i1 = indices.getScalar(t + 1);
    const i2 = indices.getScalar(t + 2);
    position.getElement(i0, a);
    position.getElement(i1, b);
    position.getElement(i2, c);

    const e1 = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
    const e2 = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
    // El producto vectorial sin normalizar ya pesa por área: las caras grandes
    // mandan más en la normal de su vértice que las astillas pequeñas.
    const nx = e1[1]! * e2[2]! - e1[2]! * e2[1]!;
    const ny = e1[2]! * e2[0]! - e1[0]! * e2[2]!;
    const nz = e1[0]! * e2[1]! - e1[1]! * e2[0]!;

    for (const i of [i0, i1, i2]) {
      normals[i * 3]! += nx;
      normals[i * 3 + 1]! += ny;
      normals[i * 3 + 2]! += nz;
    }
  }

  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i]!, normals[i + 1]!, normals[i + 2]!) || 1;
    normals[i]! /= length;
    normals[i + 1]! /= length;
    normals[i + 2]! /= length;
  }

  const buffer = doc.getRoot().listBuffers()[0]!;
  primitive.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(normals).setBuffer(buffer));
}

/* ── Animados: conservar huesos y clips ─────────────────────────────────── */

type Mat4 = number[];

function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      for (let k = 0; k < 4; k += 1) out[c * 4 + r]! += a[k * 4 + r]! * b[c * 4 + k]!;
    }
  }
  return out;
}

/**
 * La caja de un modelo con esqueleto, **en su pose de reposo**.
 *
 * `getBounds()` no sirve aquí: en una malla con huesos, glTF ignora la
 * transformación del nodo de la malla y la coloca con las articulaciones
 * (articulación × matriz de enlace inversa). Los modelos de Sketchfab, además,
 * cuelgan malla y esqueleto de ramas distintas con escalas distintas, así que
 * medir el nodo de la malla da una caja que no tiene nada que ver con lo que se
 * ve. En reposo, todas las articulaciones llevan la malla al mismo sitio, así
 * que basta con la primera.
 */
function restBounds(doc: Document): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const p = [0, 0, 0];
  const ibm = new Array<number>(16);

  for (const scene of doc.getRoot().listScenes()) {
    scene.traverse((node) => {
      const mesh = node.getMesh();
      if (!mesh) return;

      let matrix = node.getWorldMatrix() as unknown as Mat4;
      const skin = node.getSkin();
      const joint = skin?.listJoints()[0];
      const inverse = skin?.getInverseBindMatrices();
      if (joint && inverse) {
        inverse.getElement(0, ibm);
        matrix = multiply(joint.getWorldMatrix() as unknown as Mat4, ibm);
      }

      for (const prim of mesh.listPrimitives()) {
        const position = prim.getAttribute('POSITION');
        if (!position) continue;
        for (let i = 0; i < position.getCount(); i += 1) {
          position.getElement(i, p);
          const w = transformPoint(matrix, p[0]!, p[1]!, p[2]!);
          for (let c = 0; c < 3; c += 1) {
            min[c] = Math.min(min[c]!, w[c]!);
            max[c] = Math.max(max[c]!, w[c]!);
          }
        }
      }
    });
  }

  return { min, max };
}

async function processAnimated(io: NodeIO, job: AnimatedJob): Promise<Document> {
  const doc = await io.read(join(SOURCE_DIR, job.source));
  const root = doc.getRoot();

  // Las alas se reconocen por su forma: una malla casi plana.
  if (job.splitWings) {
    const wing = doc.createMaterial('ala').setBaseColorFactor([1, 1, 1, 1]);
    const body = doc.createMaterial('cuerpo').setBaseColorFactor([1, 1, 1, 1]);
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const position = prim.getAttribute('POSITION');
        if (!position) continue;
        const lo = position.getMin([]);
        const hi = position.getMax([]);
        const extents = [0, 1, 2].map((c) => hi[c]! - lo[c]!).sort((a, b) => a - b);
        prim.setMaterial(extents[0]! < extents[2]! * 0.12 ? wing : body);
      }
    }
  }

  // El giro se aplica en un nodo raíz nuevo y no en los vértices: los huesos
  // guardan su pose de reposo respecto de la malla, y tocar la malla sin tocar
  // los huesos la despegaría del esqueleto.
  const scene = root.listScenes()[0]!;
  const pivot = doc.createNode('orientacion');
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    pivot.addChild(child);
  }
  scene.addChild(pivot);

  const yaw = (job.yaw * Math.PI) / 360;
  const pitch = ((job.pitch ?? 0) * Math.PI) / 360;
  // yaw ∘ pitch como cuaterniones: primero se endereza, luego se orienta.
  const qy = [0, Math.sin(yaw), 0, Math.cos(yaw)];
  const qx = [Math.sin(pitch), 0, 0, Math.cos(pitch)];
  const q = [
    qy[3]! * qx[0]! + qy[0]! * qx[3]! + qy[1]! * qx[2]! - qy[2]! * qx[1]!,
    qy[3]! * qx[1]! - qy[0]! * qx[2]! + qy[1]! * qx[3]! + qy[2]! * qx[0]!,
    qy[3]! * qx[2]! + qy[0]! * qx[1]! - qy[1]! * qx[0]! + qy[2]! * qx[3]!,
    qy[3]! * qx[3]! - qy[0]! * qx[0]! - qy[1]! * qx[1]! - qy[2]! * qx[2]!,
  ];
  pivot.setRotation(q as [number, number, number, number]);

  // Escala: la envergadura mayor —la de las alas en un insecto— pasa a medir 1,
  // y el centro del cuerpo queda en el origen.
  const bounds = restBounds(doc);
  const span = Math.max(bounds.max[0]! - bounds.min[0]!, bounds.max[2]! - bounds.min[2]!);
  const center = [0, 1, 2].map((c) => (bounds.max[c]! + bounds.min[c]!) / 2);
  pivot.setScale([1 / span, 1 / span, 1 / span]);
  pivot.setTranslation([-center[0]! / span, -center[1]! / span, -center[2]! / span]);

  await doc.transform(
    // Los clips vienen con un fotograma clave por frame aunque el hueso no se
    // mueva; `resample` quita los que caen sobre la interpolación.
    resample(),
    dedup(),
    weld(),
    simplify({
      simplifier: MeshoptSimplifier,
      ratio: Math.min(1, job.triangles / countTriangles(doc)),
      // Más permisivo que en los estáticos: las alas escaneadas vienen con
      // miles de vértices en una superficie casi plana, y un insecto ocupa
      // cuarenta píxeles en pantalla.
      error: 0.035,
    }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [job.textureSize, job.textureSize] }),
    prune(),
  );

  return doc;
}

/* ── Main ───────────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  await MeshoptSimplifier.ready;

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

  const only = process.argv[2];
  let totalIn = 0;
  let totalOut = 0;

  for (const job of JOBS) {
    if (only && !job.output.includes(only)) continue;

    const input = join(SOURCE_DIR, job.source);
    const output = join(OUT_DIR, job.output);
    const doc = job.kind === 'estatico' ? await processStatic(io, job) : await processAnimated(io, job);

    // En los estáticos, las posiciones NO se cuantizan: cuantizar las guarda
    // como enteros y mueve la escala al nodo, y entonces el shader recibiría
    // coordenadas que ya no son las del modelo normalizado — la cola dejaría de
    // estar en x < −0,14 y la deformación doblaría lo que no es. Normales y
    // color sí se comprimen.
    await doc.transform(
      job.kind === 'estatico' ? quantize({ pattern: /^(NORMAL|COLOR_0)$/ }) : quantize(),
    );
    doc.createExtension(KHRMeshQuantization).setRequired(true);
    doc
      .createExtension(EXTMeshoptCompression)
      .setRequired(true)
      .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    if (job.kind === 'animado') doc.createExtension(EXTTextureWebP).setRequired(true);

    await mkdir(dirname(output), { recursive: true });
    await io.write(output, doc);

    const inSize = (await stat(input)).size;
    const outSize = (await stat(output)).size;
    totalIn += inSize;
    totalOut += outSize;

    console.log(
      `${job.output.padEnd(22)} ${(inSize / 1048576).toFixed(1).padStart(6)} MB → ` +
        `${(outSize / 1024).toFixed(0).padStart(4)} KB  ·  ${countTriangles(doc)} triángulos`,
    );
  }

  console.log(`\ntotal: ${(totalIn / 1048576).toFixed(1)} MB → ${(totalOut / 1024).toFixed(0)} KB`);
}

await main();

/**
 * Muestreador de paleta: `bun run palette [archivos…]`
 *
 * Lee los PNG de referencia y ordena sus colores por superficie ocupada. Es la
 * herramienta con la que se calibraron los valores de `src/styles/tokens.css`:
 * la paleta del sitio no es una interpretación de las referencias, es una
 * medición de ellas.
 *
 * Decodifica el PNG a mano (cabecera, inflate del IDAT y deshacer los filtros
 * por línea) porque ni Bun ni Node traen decodificador de imagen y no merece la
 * pena una dependencia para esto.
 */

import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REFERENCE_DIR = join(ROOT, 'docs', 'referencias');

interface Decoded {
  width: number;
  height: number;
  colorType: number;
  bytesPerPixel: number;
  pixels: Buffer;
  palette: Buffer | null;
}

function decodePng(file: Buffer): Decoded {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!file.subarray(0, 8).equals(signature)) throw new Error('no es un PNG');

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let palette: Buffer | null = null;
  const idat: Buffer[] = [];

  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const data = file.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
      if (data.readUInt8(12) !== 0) throw new Error('PNG entrelazado no soportado');
    } else if (type === 'PLTE') {
      palette = Buffer.from(data);
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
  }

  if (bitDepth !== 8) throw new Error(`profundidad ${bitDepth} no soportada`);

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`colorType ${colorType} no soportado`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);

  let read = 0;
  let previous = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[read];
    read += 1;
    const line = Buffer.from(raw.subarray(read, read + stride));
    read += stride;

    // Los cinco filtros por línea del formato PNG.
    for (let i = 0; i < stride; i += 1) {
      const left = i >= channels ? (line[i - channels] ?? 0) : 0;
      const up = previous[i] ?? 0;
      const upLeft = i >= channels ? (previous[i - channels] ?? 0) : 0;
      const value = line[i] ?? 0;

      if (filter === 1) line[i] = (value + left) & 0xff;
      else if (filter === 2) line[i] = (value + up) & 0xff;
      else if (filter === 3) line[i] = (value + ((left + up) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        line[i] = (value + predictor) & 0xff;
      }
    }

    line.copy(pixels, y * stride);
    previous = line;
  }

  return { width, height, colorType, bytesPerPixel: channels, pixels, palette };
}

function pixelAt(image: Decoded, x: number, y: number): [number, number, number] {
  const i = (y * image.width + x) * image.bytesPerPixel;
  if (image.colorType === 3 && image.palette) {
    const index = (image.pixels[i] ?? 0) * 3;
    return [
      image.palette[index] ?? 0,
      image.palette[index + 1] ?? 0,
      image.palette[index + 2] ?? 0,
    ];
  }
  if (image.colorType === 0) {
    const v = image.pixels[i] ?? 0;
    return [v, v, v];
  }
  return [image.pixels[i] ?? 0, image.pixels[i + 1] ?? 0, image.pixels[i + 2] ?? 0];
}

const hex = ([r, g, b]: [number, number, number]) =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`.toUpperCase();

async function report(path: string, top = 10, step = 3) {
  const image = decodePng(await readFile(path));
  const counts = new Map<string, number>();
  let total = 0;

  for (let y = 0; y < image.height; y += step) {
    for (let x = 0; x < image.width; x += step) {
      const key = hex(pixelAt(image, x, y));
      counts.set(key, (counts.get(key) ?? 0) + 1);
      total += 1;
    }
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);

  console.log(`\n### ${basename(path)}  (${image.width}×${image.height})`);
  for (const [color, count] of ranked) {
    const share = ((100 * count) / total).toFixed(2).padStart(6);
    console.log(`   ${color}  ${share} %`);
  }
}

async function run() {
  const args = process.argv.slice(2);
  const files =
    args.length > 0
      ? args
      : (await readdir(REFERENCE_DIR))
          .filter((name) => name.endsWith('.png'))
          .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))
          .map((name) => join(REFERENCE_DIR, name));

  for (const file of files) await report(file);
}

run().catch((error: unknown) => {
  console.error('El muestreo falló:', error);
  process.exit(1);
});

/**
 * Las etiquetas de los mapas antiguos, como trazos de KanjiVG (Fase 5B).
 *
 * Un SVG usado como `<img>` no carga fuentes web, así que las etiquetas no
 * pueden ser `<text>`: son los trazos de KanjiVG (© Ulrich Apel, CC BY-SA 3.0),
 * la misma pincelada que dibuja `<InkKanji>`. Los SVG se guardan en
 * `assets/kanji/source/`, como hace `bun run kanji`.
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE = join(ROOT, 'assets', 'kanji', 'source');
const URL_BASE = 'https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji';

/** Formas antiguas que KanjiVG podría no tener, y su forma moderna. */
const FALLBACK: Record<string, string> = { 國: '国', 圖: '図' };

const cache = new Map<string, string[]>();

async function load(char: string): Promise<string[] | null> {
  const hex = char.codePointAt(0)!.toString(16).padStart(5, '0');
  const file = join(SOURCE, `${hex}.svg`);
  if (!existsSync(file)) {
    const response = await fetch(`${URL_BASE}/${hex}.svg`);
    if (!response.ok) return null;
    await mkdir(SOURCE, { recursive: true });
    await writeFile(file, await response.text());
    console.log(`↓ ${char} ${hex}.svg`);
  }
  const svg = await readFile(file, 'utf8');
  const found: [number, string][] = [];
  for (const tag of svg.match(/<path\b[^>]*>/g) ?? []) {
    const id = /\bid="kvg:[0-9a-f]+-s(\d+)"/.exec(tag);
    const d = /\bd="([^"]+)"/.exec(tag);
    if (id?.[1] && d?.[1]) found.push([Number(id[1]), d[1]]);
  }
  return found.sort((a, b) => a[0] - b[0]).map(([, d]) => d);
}

/** Los trazos de un kanji, en la caja de 109 × 109 de KanjiVG. Con la forma moderna si falta la antigua. */
export async function kanjiStrokes(char: string): Promise<string[]> {
  const cached = cache.get(char);
  if (cached) return cached;
  let strokes = await load(char);
  if (!strokes && FALLBACK[char]) {
    console.log(`· KanjiVG no tiene ${char}: se usa ${FALLBACK[char]}`);
    strokes = await load(FALLBACK[char]);
  }
  if (!strokes) throw new Error(`KanjiVG no tiene ${char}`);
  cache.set(char, strokes);
  return strokes;
}

export interface KanjiStyle {
  readonly size: number;
  readonly color: string;
  /** Grosor del trazo en px del mapa. */
  readonly weight: number;
  /** Separación entre kanji, en fracción del tamaño. */
  readonly gap?: number;
}

/**
 * Una etiqueta en vertical (tategaki), como en los mapas antiguos: el primer
 * kanji arriba, centrada en `x` y empezando en `y`.
 */
export async function verticalLabel(text: string, x: number, y: number, style: KanjiStyle): Promise<string> {
  const step = style.size * (1 + (style.gap ?? 0.08));
  const parts: string[] = [];
  let k = 0;
  for (const char of text) {
    parts.push(await glyph(char, x - style.size / 2, y + k * step, style));
    k += 1;
  }
  return parts.join('');
}

/** Una etiqueta en horizontal, centrada en `x`, con la parte de arriba en `y`. */
export async function horizontalLabel(text: string, x: number, y: number, style: KanjiStyle): Promise<string> {
  const chars = [...text];
  const step = style.size * (1 + (style.gap ?? 0.08));
  const width = chars.length * step - (step - style.size);
  const parts: string[] = [];
  for (const [k, char] of chars.entries()) parts.push(await glyph(char, x - width / 2 + k * step, y, style));
  return parts.join('');
}

/** Lo que mide una etiqueta en vertical, de arriba abajo. */
export function verticalLength(text: string, style: KanjiStyle): number {
  const n = [...text].length;
  const step = style.size * (1 + (style.gap ?? 0.08));
  return n * step - (step - style.size);
}

async function glyph(char: string, x: number, y: number, style: KanjiStyle): Promise<string> {
  const strokes = await kanjiStrokes(char);
  const scale = style.size / 109;
  const width = (style.weight / scale).toFixed(2);
  const paths = strokes.map((d) => `<path d="${d}"/>`).join('');
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(4)})" fill="none" stroke="${style.color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`;
}

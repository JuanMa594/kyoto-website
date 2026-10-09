/**
 * Los trazos de los kanji, de KanjiVG: `bun run kanji`
 *
 * La Home dibuja 京都 trazo a trazo (Fase 4). El orden y la forma de cada trazo
 * no están en la fuente: los da KanjiVG (CC BY-SA 3.0, ver
 * `assets/kanji/LICENSES.md`), un SVG por kanji con un trazado por trazo, en
 * orden. Este script toma los kanji de las estaciones de `journey.ts`, descarga
 * los SVG que falten a `assets/kanji/source/` y genera
 * `src/components/kanji/strokes.generated.ts`.
 *
 * Si la descarga falla en Windows por la revocación del certificado, bajar el
 * archivo a mano con `curl --ssl-no-revoke -o assets/kanji/source/<hex>.svg <url>`.
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JOURNEY } from '../src/config/journey';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'assets', 'kanji', 'source');
const OUT = join(ROOT, 'src', 'components', 'kanji', 'strokes.generated.ts');
const URL_BASE = 'https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji';

const chars = [...new Set(JOURNEY.flatMap((station) => [...station.kanji]))].sort();
await mkdir(SOURCE, { recursive: true });
await mkdir(dirname(OUT), { recursive: true });

const strokes: Record<string, string[]> = {};
for (const char of chars) {
  const hex = char.codePointAt(0)!.toString(16).padStart(5, '0');
  const file = join(SOURCE, `${hex}.svg`);
  if (!existsSync(file)) {
    const response = await fetch(`${URL_BASE}/${hex}.svg`);
    if (!response.ok) throw new Error(`KanjiVG no tiene ${char} (${hex}): ${response.status}`);
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
  strokes[char] = found.sort((a, b) => a[0] - b[0]).map(([, d]) => d);
  console.log(`✓ ${char}: ${strokes[char]!.length} trazos`);
}

const header = `/**
 * GENERADO por \`bun run kanji\` — no editar a mano.
 *
 * Trazos de KanjiVG (https://kanjivg.tagaini.net), © Ulrich Apel, CC BY-SA 3.0.
 * Este archivo es una obra derivada y se distribuye con la misma licencia. Un
 * trazado por trazo, en orden, en la caja de 109 × 109 de KanjiVG.
 */
`;
await writeFile(
  OUT,
  `${header}\nexport const KANJI_STROKES: Readonly<Record<string, readonly string[]>> = ${JSON.stringify(strokes, null, 2)};\n`,
);
console.log(`\n✓ ${chars.length} kanji → ${OUT}`);

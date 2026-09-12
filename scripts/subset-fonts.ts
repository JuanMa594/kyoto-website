/**
 * Pipeline de fuentes: `bun run fonts`
 *
 * Toma los originales de `assets/fonts/source/` y escribe .woff2 subseteados en
 * `src/styles/generated/`, que es lo que consume `src/styles/fonts.ts` vía
 * next/font/local.
 *
 * El punto interesante es el japonés. Las fuentes japonesas completas pesan
 * 5–8 MB porque llevan miles de kanji. Aquí el japonés es *decorativo* y sólo
 * aparece en títulos, así que el set de glifos se deduce del propio camino
 * (`requiredKanji()` en `src/config/journey.ts`): si mañana se añade una
 * estación con un kanji nuevo, basta volver a correr este script.
 *
 * Los .woff2 generados SÍ se versionan en git, para que un clon nuevo compile
 * sin tener que regenerar nada.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import subsetFont from 'subset-font';

import { requiredKanji } from '../src/config/journey';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = join(ROOT, 'assets', 'fonts', 'source');
const OUT_DIR = join(ROOT, 'src', 'styles', 'generated');

/**
 * Latín completo para textos de lectura: ASCII, acentos del español, signos de
 * apertura y la puntuación tipográfica que usamos (rayas, comillas, puntos
 * suspensivos, interpunto).
 */
const LATIN_SET = [
  ...Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)),
  'áéíóúüñÁÉÍÓÚÜÑ',
  'àèìòùâêîôûäëïöçÀÈÌÒÙÂÊÎÔÛÄËÏÖÇ',
  '¿¡ªº°€«»',
  '‘’“”–—…· →↑↓←',
].join('');

/** Los kanji los manda `journey.ts`; añadimos sólo puntuación japonesa mínima. */
const KANJI_SET = requiredKanji() + '、。・「」';

interface Job {
  /** Archivo dentro de `assets/fonts/source/`. */
  input: string;
  /** Nombre del .woff2 resultante, sin extensión. */
  output: string;
  /** Glifos a conservar. */
  text: string;
  note: string;
}

const JOBS: Job[] = [
  {
    input: 'OneJinja-Demo.otf',
    output: 'one-jinja',
    text: LATIN_SET,
    note: 'Titulares (display). Latín — no trae ni un kanji.',
  },
  {
    input: 'GazeNozarashi-Demo.ttf',
    output: 'gaze-nozarashi',
    text: LATIN_SET,
    note: 'Párrafos y pincelada. Latín — no trae ni un kanji.',
  },
  {
    input: 'ZenOldMincho-Regular.ttf',
    output: 'zen-old-mincho',
    text: KANJI_SET,
    note: 'Kanji decorativo, mincho clásico (OFL).',
  },
  {
    input: 'YujiSyuku-Regular.ttf',
    output: 'yuji-syuku',
    text: KANJI_SET,
    note: 'Kanji decorativo, trazo de pincel (OFL). Alternativa a comparar.',
  },
];

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

async function run() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log(`Glifos kanji requeridos por el camino (${[...KANJI_SET].length}): ${KANJI_SET}\n`);

  let totalBefore = 0;
  let totalAfter = 0;

  for (const job of JOBS) {
    const sourcePath = join(SOURCE_DIR, job.input);
    const source = await readFile(sourcePath);

    const subset = await subsetFont(source, job.text, {
      targetFormat: 'woff2',
      // El OFL obliga a conservar el aviso de copyright y la licencia.
      preserveNameIds: [0, 1, 2, 3, 4, 5, 6, 7, 13, 14],
    });

    const outPath = join(OUT_DIR, `${job.output}.woff2`);
    await writeFile(outPath, subset);

    totalBefore += source.byteLength;
    totalAfter += subset.byteLength;

    const saved = (100 * (1 - subset.byteLength / source.byteLength)).toFixed(1);
    console.log(
      `✓ ${basename(outPath).padEnd(22)} ${kb(source.byteLength).padStart(10)} → ` +
        `${kb(subset.byteLength).padStart(9)}  (−${saved} %)  ${job.note}`,
    );
  }

  console.log(`\nTotal: ${kb(totalBefore)} → ${kb(totalAfter)}`);
}

run().catch((error: unknown) => {
  console.error('El subsetting falló:', error);
  process.exit(1);
});

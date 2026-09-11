import { staticLocale } from '@/i18n/params';
import { candidateVariables } from '@/styles/fonts-candidates';

/**
 * Muestrario tipográfico — herramienta de decisión de la Fase 1, no una página
 * del sitio. Se borra en cuanto estén elegidas la japonesa de titulares y la
 * latina de lectura.
 *
 * Las tres frases de prueba son las del PLAN: KYOTO / Sakura / Kiyomizu-dera,
 * porque mezclan versal grande, una palabra suave y un guion largo con acento.
 */

export const metadata = {
  title: 'Tipografía — muestrario',
  robots: { index: false, follow: false },
};

const SAMPLE = 'KYOTO · Sakura · Kiyomizu-dera';
const PARAGRAPH =
  'Kyoto fue capital de Japón durante más de mil años. Sus calles guardan templos, ' +
  'jardines de musgo y callejones de madera donde todavía se encienden faroles al ' +
  'anochecer. El camino empieza aquí: ¿cuántas piedras hay hasta el monte Inari?';

interface Specimen {
  id: string;
  name: string;
  role: string;
  font: string;
  note: string;
}

const DISPLAY: Specimen[] = [
  {
    id: 'one-jinja',
    name: 'One Jinja',
    role: 'Titulares',
    font: 'var(--font-display)',
    note: 'Demo de Denustudios. 266 glifos, sólo latín — cero kanji.',
  },
  {
    id: 'gaze-nozarashi',
    name: 'Gaze Nozarashi',
    role: 'Pincelada',
    font: 'var(--font-brush)',
    note: 'Demo de Allouse.Studio. 233 glifos, sólo latín — cero kanji.',
  },
];

const KANJI: Specimen[] = [
  {
    id: 'zen-old-mincho',
    name: 'Zen Old Mincho',
    role: 'Kanji · propuesta',
    font: 'var(--font-kanji)',
    note: 'Mincho clásico. OFL. 11 KB subseteada.',
  },
  {
    id: 'yuji-syuku',
    name: 'Yuji Syuku',
    role: 'Kanji · alternativa',
    font: 'var(--font-yuji-syuku)',
    note: 'Trazo de pincel, más cerca del sumi de las referencias. OFL. 22 KB.',
  },
];

const BODY: Specimen[] = [
  {
    id: 'mplus',
    name: 'M PLUS Rounded 1c',
    role: 'Lectura · propuesta',
    font: 'var(--font-body)',
    note: 'Redondeada y amable, cubre latín y japonés. OFL.',
  },
  {
    id: 'rubik',
    name: 'Rubik',
    role: 'Lectura · alternativa',
    font: 'var(--font-cand-rubik)',
    note: 'Geométrica de esquinas suaves. Más neutra.',
  },
  {
    id: 'baloo',
    name: 'Baloo 2',
    role: 'Lectura · alternativa',
    font: 'var(--font-cand-baloo)',
    note: 'Más rotunda y con más carácter; cansa antes en párrafo largo.',
  },
];

function Block({ specimen, sample }: { specimen: Specimen; sample: string }) {
  return (
    <section className="paper px-6 py-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg">{specimen.name}</h2>
        <span className="text-xs tracking-[0.18em] uppercase opacity-55">{specimen.role}</span>
      </header>

      <p
        className="mt-4 break-words"
        style={{ fontFamily: specimen.font, fontSize: 'clamp(1.8rem, 5vw, 3.4rem)', lineHeight: 1.1 }}
      >
        {sample}
      </p>

      <p className="mt-4 max-w-prose" style={{ fontFamily: specimen.font, fontSize: '1rem' }}>
        {PARAGRAPH}
      </p>

      <p className="mt-3 text-xs opacity-55">{specimen.note}</p>
    </section>
  );
}

export default async function TypographyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await staticLocale(params);

  return (
    <main id="contenido" className={`${candidateVariables} mx-auto max-w-4xl px-6 py-24`}>
      <h1 className="text-4xl">Muestrario tipográfico</h1>
      <p className="mt-3 max-w-prose opacity-70">
        Decisión pendiente de la Fase 1: qué fuente lleva los kanji y cuál el texto de
        lectura. Las dos fuentes que aportaste son de latín puro — no traen ningún
        carácter japonés —, así que 京都 necesita una tercera familia sí o sí.
      </p>

      <h2 className="mt-14 mb-4 text-sm tracking-[0.22em] uppercase opacity-55">
        Las tuyas · display
      </h2>
      <div className="grid gap-4">
        {DISPLAY.map((s) => (
          <Block key={s.id} specimen={s} sample={SAMPLE} />
        ))}
      </div>

      <h2 className="mt-14 mb-4 text-sm tracking-[0.22em] uppercase opacity-55">
        Kanji decorativo · elegir una
      </h2>
      <div className="grid gap-4">
        {KANJI.map((s) => (
          <Block key={s.id} specimen={s} sample="京都 · 桜 · 伏見稲荷大社" />
        ))}
      </div>

      <h2 className="mt-14 mb-4 text-sm tracking-[0.22em] uppercase opacity-55">
        Texto de lectura · elegir una
      </h2>
      <div className="grid gap-4">
        {BODY.map((s) => (
          <Block key={s.id} specimen={s} sample={SAMPLE} />
        ))}
      </div>
    </main>
  );
}

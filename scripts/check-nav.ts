/**
 * Comprobaciones puras de la navegación (Fase 3C): de la ruta a la estación,
 * el riel y su progreso, el abanico, los íconos y sus textos. Lo que sólo se ve
 * en pantalla —el despliegue, el abanico, el viaje de la marca— es la revisión
 * visual.
 *
 * Uso: bun run check:path (corre después de check-path y check-fauna)
 */

import {
  barPoint,
  fanAngle,
  fanPose,
  RAIL_LAST,
  railPoint,
  railPosition,
} from '../src/components/nav/railProgress';
import { fanPickAction } from '../src/components/nav/fanHistory';
import { ICON_BUILDERS, isIconName } from '../src/components/nav/icons';
import { stoneOutline } from '../src/components/nav/icons/stone';
import { pathNumbers } from '../src/components/nav/icons/svg';
import type { IconName, IconShape } from '../src/components/nav/icons/types';
import {
  JOURNEY,
  localeHref,
  PATH_LENGTH,
  SIDEBAR_STATIONS,
  stationFromPathname,
} from '../src/config/journey';
import messagesEn from '../src/messages/en.json';
import messagesEs from '../src/messages/es.json';
import { STATION_DEPTHS } from '../src/scene/path/journeyPath';
import { check, finish, range, section } from './check-kit';

/* ── 1. De la ruta a la estación ───────────────────────────────────────── */

section('De la ruta a la estación');

const routeMisses = JOURNEY.filter((station) => {
  const bare = station.route ? `/${station.route}` : '/';
  const slashed = station.route ? `/${station.route}/` : '/';
  return (
    stationFromPathname(bare)?.slug !== station.slug ||
    stationFromPathname(slashed)?.slug !== station.slug
  );
});
check(
  'cada ruta del camino da su estación, con y sin barra final',
  routeMisses.length === 0,
  routeMisses.map((station) => station.slug).join(', '),
);
check(
  'fuera del camino no hay estación',
  stationFromPathname('/diagnostico') === null && stationFromPathname('/tipografia/') === null,
);

/* ── 2. El riel ────────────────────────────────────────────────────────── */

section('El riel');

check('siete paradas: 京都 y las seis del sidebar', RAIL_LAST === 6 && JOURNEY.length === 7);
check(
  'en cada estación la marca está justo en su parada',
  STATION_DEPTHS.every((d, i) => Math.abs(railPosition(d) - i) < 1e-9),
);

let previousS = railPosition(-50);
let monotonic = true;
let maxStep = 0;
for (const d of range(-50, PATH_LENGTH + 50, 0.05)) {
  const s = railPosition(d);
  if (s < previousS - 1e-12) monotonic = false;
  maxStep = Math.max(maxStep, s - previousS);
  previousS = s;
}
check('la marca avanza siempre y sin saltos', monotonic && maxStep < 0.01, `paso máx ${maxStep.toFixed(4)}`);
check(
  'fuera del camino se queda en sus extremos',
  railPosition(-100) === 0 && railPosition(PATH_LENGTH + 100) === RAIL_LAST,
);

const P = { x: 0, y: 0 };
const startOnEdge = railPoint(0, 500, 40, P).x === 0 && P.y === 0;
const endOnEdge = Math.abs(railPoint(RAIL_LAST, 500, 40, P).x) < 1e-9 && Math.abs(P.y - 500) < 1e-9;
const middleOut = Math.abs(railPoint(RAIL_LAST / 2, 500, 40, P).x + 40) < 1e-9;
check(
  'el arco toca el borde en sus extremos y se separa la flecha entera en medio',
  startOnEdge && endOnEdge && middleOut,
);
check(
  'la barra móvil va de 0 a su ancho',
  barPoint(0, 170, P).x === 0 && barPoint(RAIL_LAST, 170, P).x === 170,
);

/* ── 3. El abanico ─────────────────────────────────────────────────────── */

section('El abanico');

check(
  'va de la izquierda (π) a la derecha (0)',
  Math.abs(fanAngle(1) - Math.PI) < 1e-12 && Math.abs(fanAngle(RAIL_LAST)) < 1e-12,
);
const FAN_R = Math.min(0.4 * 360, 160);
check(
  'desplegado, cada círculo está en el semicírculo, por encima del centro',
  range(1, RAIL_LAST, 1).every((i) => {
    fanPose(i, 1, FAN_R, P);
    return Math.abs(Math.hypot(P.x, P.y) - FAN_R) < 1e-9 && P.y <= 1e-9;
  }),
);
check(
  'plegado, todos en el centro',
  range(1, RAIL_LAST, 1).every((i) => {
    fanPose(i, 0, FAN_R, P);
    return Math.abs(P.x) < 1e-12 && Math.abs(P.y) < 1e-12;
  }),
);
check('en 360 px cabe con 10 px de margen (círculos de 52 px)', FAN_R + 26 <= 180 - 10, `radio ${FAN_R} px`);

// Elegir la estación en la que ya se está no navega: con `router.replace` a la
// misma URL quedaría [… A, A] y el siguiente «atrás» no haría nada.
check(
  'elegir la estación actual cierra sin navegar; otra, sustituye la entrada del abanico',
  fanPickAction(3, 3, true) === 'dismiss' &&
    fanPickAction(0, 0, true) === 'dismiss' &&
    fanPickAction(5, 3, true) === 'replace' &&
    fanPickAction(5, 3, false) === 'push',
);

/* ── 3b. El idioma ─────────────────────────────────────────────────────── */

section('El idioma');

// ES ⇄ EN es una navegación completa (un `<a>` con la URL entera): así el
// contexto WebGL viejo muere con la página y nunca convive con el nuevo.
check(
  'la misma ruta en el otro idioma, con la barra final del export',
  localeHref('/', 'en') === '/en/' &&
    localeHref('/ubicacion', 'en') === '/en/ubicacion/' &&
    localeHref('/lugares/gion/', 'es') === '/es/lugares/gion/' &&
    localeHref('/diagnostico', 'en') === '/en/diagnostico/',
);

/* ── 4. Los textos ─────────────────────────────────────────────────────── */

section('Los textos');

type NavMessages = {
  nav?: Record<string, string>;
  ui?: Record<string, string>;
  stations?: Record<string, { name?: string }>;
};
const missingTexts: string[] = [];
for (const [lang, messages] of [
  ['es', messagesEs],
  ['en', messagesEn],
] as [string, NavMessages][]) {
  for (const key of ['label', 'open', 'close']) {
    if (!messages.nav?.[key]) missingTexts.push(`${lang}:nav.${key}`);
  }
  for (const key of ['languageEs', 'languageEn']) {
    if (!messages.ui?.[key]) missingTexts.push(`${lang}:ui.${key}`);
  }
  for (const station of JOURNEY) {
    if (!messages.stations?.[station.slug]?.name) missingTexts.push(`${lang}:stations.${station.slug}.name`);
  }
}
check(
  'la navegación tiene sus textos en español y en inglés',
  missingTexts.length === 0,
  missingTexts.join(', '),
);

/* ── 5. Los íconos ─────────────────────────────────────────────────────── */

section('Los íconos');

check(
  'la Home es texto (京都) y cada estación del sidebar tiene su propio ícono',
  JOURNEY[0]!.icon === 'kanji' &&
    SIDEBAR_STATIONS.every((station) => isIconName(station.icon)) &&
    new Set(SIDEBAR_STATIONS.map((station) => station.icon)).size === SIDEBAR_STATIONS.length,
);

/** Presupuesto por ícono, en caracteres de path. La sakura repite su pétalo ~45 veces. */
const ICON_BUDGET: Record<IconName, number> = {
  mapa: 6144,
  sakura: 6144,
  torii: 4096,
  pagoda: 4096,
  farol: 4096,
  naruto: 4096,
};
let iconsTotal = 0;
for (const [name, build] of Object.entries(ICON_BUILDERS) as [IconName, () => IconShape][]) {
  const shape = build();
  const text = shape.map((layer) => layer.d).join('');
  const numbers = shape.flatMap((layer) => pathNumbers(layer.d));
  const largest = Math.max(...numbers.map(Math.abs));
  iconsTotal += text.length;

  check(`${name}: tiene capas, todas con path`, shape.length > 0 && shape.every((layer) => layer.d.length > 0));
  check(
    `${name}: sin NaN y dentro del viewBox`,
    !/NaN|Infinity/.test(text) && numbers.every((n) => Number.isFinite(n)) && largest <= 1,
    `máx |${largest.toFixed(3)}|`,
  );
  check(`${name}: determinista`, JSON.stringify(build()) === JSON.stringify(shape));
  check(
    `${name}: pesa ≤ ${ICON_BUDGET[name] / 1024} KB`,
    text.length <= ICON_BUDGET[name],
    `${(text.length / 1024).toFixed(1)} KB`,
  );
  check(
    `${name}: sus colores salen de tokens.css`,
    shape.every((layer) =>
      [layer.fill, layer.stroke].every((color) => color === undefined || color.startsWith('var(--color-')),
    ),
  );
}
check('los seis juntos pesan ≤ 18 KB', iconsTotal <= 18 * 1024, `${(iconsTotal / 1024).toFixed(1)} KB`);

const stones = range(0, RAIL_LAST, 1).map((seed) => stoneOutline(seed));
check(
  'las piedrecitas del riel: cerradas, dentro del viewBox, deterministas y distintas',
  stones.every(
    (d, seed) => d.endsWith('Z') && pathNumbers(d).every((n) => Math.abs(n) <= 1) && d === stoneOutline(seed),
  ) && new Set(stones).size === stones.length,
);

/* ── Resumen ───────────────────────────────────────────────────────────── */

finish('La navegación en orden.');

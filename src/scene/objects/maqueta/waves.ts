/**
 * Las olas de la maqueta (Fase 5A): unas pocas pinceladas de índigo en el mar,
 * como las *nami* de la pintura japonesa. Módulo puro: la geometría la hace
 * `maquetaGeometry`, y `check:path` comprueba que ninguna toque tierra.
 *
 * Cada pincelada es una curva cuya curvatura crece a lo largo del trazo
 * (`k0 + k1·t³`): empieza como una cresta larga que sube y termina enroscándose
 * sobre sí misma, el rizo de la ola. El ancho se afina en las dos puntas,
 * más hacia el rizo, como un pincel que se levanta. Cada grupo es una cresta
 * y sus ecos, más pequeños y menos rizados, por detrás.
 *
 * Cada pincelada **sigue a su sitio del mapa** —su centro está en el espacio
 * del contenido— pero **conserva su tamaño**: el trazo está en unidades de la
 * bandeja. Así, en el zoom, las olas de Japón se alejan con el mar que las
 * lleva y se desvanecen, y aparecen las de Kinki, que sólo se ven de cerca.
 */

export type WaveSet = 'japon' | 'kinki';

export interface WavePoint {
  /** Respecto del centro de su grupo, en unidades de la bandeja. */
  readonly x: number;
  readonly z: number;
  readonly width: number;
  /** 0–1 a lo largo del trazo: lo usa el shader para el pincel seco. */
  readonly along: number;
}

export interface WaveStroke {
  /** El juego: el de Japón se ve sin zoom; el de Kinki, con él. */
  readonly set: WaveSet;
  /** El sitio del mapa que sigue, en el espacio del contenido (x al este, z al sur). */
  readonly center: { readonly x: number; readonly z: number };
  readonly points: readonly WavePoint[];
  /** 0–1: la variación del pincel de cada trazo. */
  readonly seed: number;
}

interface WaveGroup {
  readonly x: number;
  readonly z: number;
  /** Giro del grupo, en radianes (0 = la ola rompe hacia el este). */
  readonly angle: number;
  /** Largo del trazo principal, en unidades de la bandeja. */
  readonly size: number;
  /** La ola rompe hacia el oeste. */
  readonly mirror?: boolean;
}

/** Lo que flotan las olas sobre la cara de la bandeja: lejos, menos no se distingue de ella. */
export const WAVE_LIFT = 0.012;

/**
 * Dónde van: en los claros del mar, lejos de la costa. Calibrado con
 * `check:path` («ninguna pincelada toca tierra»), cada juego en su pose.
 */
const JAPAN: readonly WaveGroup[] = [
  { x: -1.2, z: -1.3, angle: 0.1, size: 1.05 }, // mar de Japón, al norte
  { x: -0.75, z: -0.35, angle: -0.1, size: 0.75, mirror: true }, // mar de Japón
  { x: -1.75, z: 0.1, angle: 0.15, size: 0.6 }, // mar de la China Oriental
  { x: 0.65, z: 1.7, angle: -0.05, size: 0.95, mirror: true }, // Pacífico, al sur
  { x: 1.6, z: 0.95, angle: 0.2, size: 0.8 }, // Pacífico
];

/** Las de cerca: alrededor de Kinki, para el zoom. */
const KINKI_WAVES: readonly WaveGroup[] = [
  { x: 0.05, z: 1.42, angle: 0.15, size: 0.62 }, // Pacífico, frente a Kii
  { x: -0.42, z: 1.55, angle: -0.1, size: 0.55, mirror: true }, // al sur de la península
  { x: -0.86, z: 0.63, angle: 0.1, size: 0.45, mirror: true }, // mar de Japón, frente a Hyōgo
];

const STEPS = 44;
/** Ancho máximo del trazo, por unidad de largo. */
const WIDTH = 0.11;

/** Un trazo en coordenadas locales: a lo largo (a) y hacia arriba (b), de largo 1. */
function strokeShape(curl: number): { a: number; b: number; t: number }[] {
  const points = [{ a: 0, b: 0, t: 0 }];
  let a = 0;
  let b = 0;
  let heading = 0.4;
  const ds = 1 / STEPS;
  for (let i = 1; i <= STEPS; i += 1) {
    const t = i / STEPS;
    heading -= (0.5 + curl * t * t * t) * ds;
    a += Math.cos(heading) * ds;
    b += Math.sin(heading) * ds;
    points.push({ a, b, t });
  }
  return points;
}

function stroke(
  set: WaveSet,
  group: WaveGroup,
  scale: number,
  offsetA: number,
  offsetB: number,
  curl: number,
  seed: number,
): WaveStroke {
  const size = group.size * scale;
  const cos = Math.cos(group.angle);
  const sin = Math.sin(group.angle);
  const flip = group.mirror ? -1 : 1;
  // Centrado en el grupo: el trazo mide ~0,7 de ancho y ~0,3 de alto.
  const points = strokeShape(curl).map(({ a, b, t }) => {
    const la = (a - 0.45 + offsetA) * flip * size;
    const lb = (b - 0.1 + offsetB) * size;
    const width = WIDTH * size * Math.pow(Math.sin(Math.PI * Math.min(t, 0.98)), 0.6) * (1 - 0.45 * t);
    // La b va hacia el norte: −z en la bandeja.
    return { x: la * cos - lb * sin, z: -(la * sin + lb * cos), width, along: t };
  });
  return { set, center: { x: group.x, z: group.z }, points, seed };
}

let cached: WaveStroke[] | null = null;

export function waveStrokes(): WaveStroke[] {
  if (cached) return cached;
  cached = [
    ...JAPAN.flatMap((group, i) => [
      stroke('japon', group, 1, 0, 0, 16, (i * 0.37) % 1),
      stroke('japon', group, 0.72, -0.3, -0.2, 12, (i * 0.37 + 0.33) % 1),
      stroke('japon', group, 0.5, -0.55, -0.36, 4, (i * 0.37 + 0.66) % 1),
    ]),
    ...KINKI_WAVES.flatMap((group, i) => [
      stroke('kinki', group, 1, 0, 0, 16, (i * 0.29 + 0.1) % 1),
      stroke('kinki', group, 0.66, -0.32, -0.22, 10, (i * 0.29 + 0.6) % 1),
    ]),
  ];
  return cached;
}

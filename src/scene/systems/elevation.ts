import { JOURNEY, PATH_LENGTH, type HillProfile, type Side } from '@/config/journey';
import { lerp, smoothstep } from '@/lib/procedural';
import { pathX, pathY, zoneBlend } from '@/scene/path/journeyPath';
import type { QualityTier } from '@/scene/quality/tiers';
import { stairTop, stairWalk } from '@/scene/path/stairs';

/**
 * El relieve del terreno, como función pura y **global**.
 *
 * Desde la Fase 3A el terreno ya no depende de la estación activa: es un solo
 * mundo, y la altura de cada punto es la del camino a esa profundidad más las
 * colinas de sus costados. La misma función la usan la malla del suelo, las
 * piedras, la cámara y la fauna, así que nada flota ni se hunde.
 *
 * La regla dura de composición vive aquí: las colinas se miden desde el **eje
 * del camino** (`u = x − pathX(d)`), no desde x = 0, y `sideMask()` vale 0 en
 * |u| < 7. Ninguna colina puede invadir el pasillo por donde va el sujeto —
 * tampoco en las curvas—, y no depende de acordarse: es imposible por
 * construcción.
 *
 * Lo que había en la Fase 1 para que el relieve no apareciera en primer plano
 * (una máscara por z) era relativo a una cámara quieta. Con la cámara
 * avanzando, las colinas pasan a los lados, casi siempre fuera de cuadro.
 */

/** Altura del plano base. Todo lo que pisa el suelo parte de aquí. */
export const GROUND_Y = -1;

/** Semiancho del pasillo central que el relieve nunca invade. */
export const CENTER_CLEAR = 7;

/** Cuánto tarda el relieve en alcanzar su amplitud plena a partir del pasillo. */
const CENTER_FADE = 11;

const HILL_AMPLITUDE: Record<HillProfile, number> = {
  ninguna: 0,
  suaves: 2.6,
  montanosa: 9,
};

/** Amplitud de cada costado en cada estación, precalculada. */
const SIDE_AMPLITUDE: readonly Record<Side, number>[] = JOURNEY.map((station) => {
  const env = station.environment;
  const amplitude = HILL_AMPLITUDE[env.hills];
  return {
    izquierda: env.hillSides.includes('izquierda') ? amplitude : 0,
    derecha: env.hillSides.includes('derecha') ? amplitude : 0,
  };
});

/**
 * Amplitud del relieve de un costado en `d`: la de cada estación, mezclada por
 * pesos de zona. Al ir de Eventos a Fushimi Inari las lomas suaves crecen
 * hasta montaña poco a poco, sin escalón.
 */
export function hillAmplitude(d: number, side: Side): number {
  const zone = zoneBlend(d);
  return lerp(SIDE_AMPLITUDE[zone.from]![side], SIDE_AMPLITUDE[zone.to]![side], zone.t);
}

/**
 * Ondulación del relieve. Suma de senos en vez de ruido: es continua, barata y
 * no deja costuras entre vértices vecinos.
 */
function ridge(x: number, z: number): number {
  return (
    0.55 * Math.sin(x * 0.11 + 1.7) +
    0.3 * Math.sin(z * 0.085 - 0.4) +
    0.22 * Math.sin((x + z) * 0.05 + 2.3) +
    0.62
  );
}

/**
 * Altura del terreno en (x, z), relativa a `GROUND_Y`: la del camino a esa
 * profundidad, más las colinas si el punto cae fuera del pasillo.
 */
export function terrainHeight(x: number, z: number): number {
  const d = -z;
  const u = x - pathX(d);
  const amplitude = hillAmplitude(d, u < 0 ? 'izquierda' : 'derecha');
  const hills =
    amplitude === 0
      ? 0
      : amplitude * smoothstep(CENTER_CLEAR, CENTER_CLEAR + CENTER_FADE, Math.abs(u)) * ridge(x, z);

  return pathY(d) + hills;
}

/**
 * La y del mundo del terreno liso, sin las gradas. Es lo que sigue la cámara
 * (`pathRig.ts`): subiendo las gradas de Fushimi, su altura sigue la ladera,
 * no los escalones, y sube sin saltos.
 */
export function terrainY(x: number, z: number): number {
  return GROUND_Y + terrainHeight(x, z);
}

/**
 * La y del mundo en la que está el suelo: el terreno o, donde las hay, las
 * gradas (Fase 6A, `scene/path/stairs.ts`), que nunca quedan por debajo de él.
 * Lo pisan las piedras y la decoración.
 */
export function groundY(x: number, z: number): number {
  return GROUND_Y + Math.max(terrainHeight(x, z), stairTop(x, z));
}

/** La malla del terreno (`Terrain`): todo lo que la niebla deja ver de ancho, y todo el largo. */
export const TERRAIN_GRID = {
  width: 360,
  nearZ: 60,
  farZ: -(PATH_LENGTH + 240),
} as const;

/** Unidades de mundo por segmento de la malla: ~2 en alto, ~2,5 en medio, ~4 en bajo. */
export const TERRAIN_SPACING: Record<QualityTier, number> = { high: 2, medium: 2.5, low: 4 };

/** Segmentos en X y en Z de la malla, con el mismo espaciado en los dos ejes. */
export function terrainSegments(spacing: number): [number, number] {
  const depth = TERRAIN_GRID.nearZ - TERRAIN_GRID.farZ;
  return [Math.round(TERRAIN_GRID.width / spacing), Math.round(depth / spacing)];
}

/**
 * El espaciado de la malla que se está dibujando. Un solo escritor, `Terrain`,
 * al construirla; lo lee `terrainMeshHeight`.
 */
export const TERRAIN_MESH = { spacing: TERRAIN_SPACING.high };

/** Las alturas de los vértices ya calculadas, para el espaciado de `TERRAIN_MESH`. */
let vertexCache: { spacing: number; heights: Float32Array } | null = null;

function vertexHeight(ix: number, iz: number, sx: number, stepX: number, stepZ: number): number {
  const cache = vertexCache!;
  const k = ix + (sx + 1) * iz;
  let h = cache.heights[k]!;
  if (Number.isNaN(h)) {
    h = terrainHeight(-TERRAIN_GRID.width / 2 + ix * stepX, TERRAIN_GRID.farZ + iz * stepZ);
    cache.heights[k] = h;
  }
  return h;
}

/**
 * La altura del terreno **tal como se dibuja**, relativa a `GROUND_Y`: la malla
 * es de triángulos planos cada 2–4 u, y donde la ladera se curva —al pie de las
 * colinas de Fushimi, que suben 9 u en 11— la malla queda hasta casi 1 u por
 * encima de `terrainHeight` (en el tier bajo). Lo que se apoya en el suelo y es
 * pequeño (la fauna) pisa esta, no la función: si no, se le hunden las patas.
 * Mismos vértices y misma diagonal que el `PlaneGeometry` de `Terrain`.
 */
export function terrainMeshHeight(x: number, z: number): number {
  const spacing = TERRAIN_MESH.spacing;
  const [sx, sz] = terrainSegments(spacing);
  const stepX = TERRAIN_GRID.width / sx;
  const stepZ = (TERRAIN_GRID.nearZ - TERRAIN_GRID.farZ) / sz;
  const fx = (x + TERRAIN_GRID.width / 2) / stepX;
  const fz = (z - TERRAIN_GRID.farZ) / stepZ;
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  // Fuera de la malla no hay nada que pisar: la función.
  if (ix < 0 || iz < 0 || ix >= sx || iz >= sz) return terrainHeight(x, z);
  if (vertexCache?.spacing !== spacing) {
    vertexCache = { spacing, heights: new Float32Array((sx + 1) * (sz + 1)).fill(Number.NaN) };
  }
  const tx = fx - ix;
  const tz = fz - iz;
  // Las dos mitades de cada celda del PlaneGeometry: (a, b, d) y (b, c, d),
  // con a en (ix, iz), b en (ix, iz + 1), c en (ix + 1, iz + 1) y d en (ix + 1, iz);
  // las filas van de lo lejano (farZ, la primera del PlaneGeometry) a lo cercano.
  const hb = vertexHeight(ix, iz + 1, sx, stepX, stepZ);
  const hd = vertexHeight(ix + 1, iz, sx, stepX, stepZ);
  if (tx + tz <= 1) {
    const ha = vertexHeight(ix, iz, sx, stepX, stepZ);
    return ha + tz * (hb - ha) + tx * (hd - ha);
  }
  const hc = vertexHeight(ix + 1, iz + 1, sx, stepX, stepZ);
  return hc + (1 - tx) * (hb - hc) + (1 - tz) * (hd - hc);
}

/**
 * Lo que pisa la fauna: el terreno dibujado (`terrainMeshHeight`) o, en las
 * gradas, cada huella, con cada contrahuella convertida en una rampa corta
 * (`stairWalk`), que sube por encima de la huella de abajo.
 */
export function walkY(x: number, z: number): number {
  return GROUND_Y + Math.max(terrainMeshHeight(x, z), stairWalk(x, z));
}

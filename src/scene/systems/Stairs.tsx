'use client';

import { useEffect, useMemo } from 'react';
import { BufferGeometry, Color, Float32BufferAttribute, MeshStandardMaterial } from 'three';

import { JOURNEY } from '@/config/journey';
import type { ScenePalette } from '@/lib/css-vars';
import { pathX, pathY, zoneBlend } from '@/scene/path/journeyPath';
import { allFlights, STAIR_BEVEL, STAIR_HALF, stairCover, type Flight } from '@/scene/path/stairs';
import type { QualityProfile } from '@/scene/quality/tiers';
import { withKomorebi } from '@/scene/shaders/komorebi';
import { CARPET_LAYERS, withPetalCarpet } from '@/scene/shaders/petalCarpet';

import { GROUND_Y } from './elevation';

/**
 * Las gradas de la subida a Fushimi Inari (Fase 6A): una malla para todas,
 * encima del terreno liso. Dónde va cada huella lo decide `path/stairs.ts`,
 * que es puro y lo comprueba `check:path`; aquí sólo se le da forma.
 *
 * Cada huella es una franja de tierra apisonada —el tinte de su zona, como el
 * terreno, un poco más oscuro— que a los lados baja hasta la ladera en un
 * bisel, y por delante asoma su contrahuella, de piedra. Las piedras del
 * camino van encima, una por huella (`path/stones.ts`).
 *
 * Una malla y un draw call para la subida entera.
 */

/** Qué parte del tinte de suelo llega a la huella (el terreno lleva 0,3). */
const TREAD_TINT = 0.36;
/** La huella, un poco más oscura que la ladera: tierra pisada. */
const TREAD_SHADE = 0.93;
/** Las columnas a lo ancho: el bisel en tres pasos a cada lado y la huella en cuatro. */
const COLUMNS = [
  -(STAIR_HALF + STAIR_BEVEL),
  -(STAIR_HALF + STAIR_BEVEL * 0.66),
  -(STAIR_HALF + STAIR_BEVEL * 0.33),
  -STAIR_HALF,
  -STAIR_HALF / 2,
  0,
  STAIR_HALF / 2,
  STAIR_HALF,
  STAIR_HALF + STAIR_BEVEL * 0.33,
  STAIR_HALF + STAIR_BEVEL * 0.66,
  STAIR_HALF + STAIR_BEVEL,
];
/** El borde del bisel se hunde un poco bajo la ladera: sin esto, una rendija. */
const BEVEL_SINK = 0.05;

interface StairsProps {
  palette: ScenePalette;
  profile: QualityProfile;
}

/** La altura de una huella `tread` con su bisel, en (d, u), relativa a GROUND_Y. */
function profileAt(tread: number, d: number, u: number): number {
  const slope = pathY(d) - BEVEL_SINK;
  return slope + (tread - slope) * stairCover(u);
}

function buildStairs(flights: readonly Flight[], palette: ScenePalette): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const tints = JOURNEY.map((station) => new Color(palette.washi).lerp(new Color(station.palette.ground), TREAD_TINT));
  const stone = new Color(palette.ishiDeep).lerp(new Color(palette.washi), 0.2);
  const stoneDark = stone.clone().multiplyScalar(0.82);
  const tint = new Color();
  const color = new Color();

  const tintAt = (d: number) => {
    const zone = zoneBlend(d);
    return tint.lerpColors(tints[zone.from]!, tints[zone.to]!, zone.t);
  };
  const push = (d: number, u: number, y: number, c: Color) => {
    positions.push(pathX(d) + u, GROUND_Y + y, -d);
    colors.push(c.r, c.g, c.b);
    return positions.length / 3 - 1;
  };

  for (const flight of flights) {
    const edges = [...flight.steps.map((s) => s.d), flight.to];
    for (let k = 0; k < flight.steps.length; k += 1) {
      const d0 = edges[k]!;
      const d1 = edges[k + 1]!;
      const tread = flight.steps[k]!.y;
      const below = k === 0 ? flight.base : flight.steps[k - 1]!.y;

      // La huella: una rejilla de filas a lo largo del camino.
      const rows = Math.max(1, Math.ceil((d1 - d0) / 1.2));
      const first = positions.length / 3;
      for (let r = 0; r <= rows; r += 1) {
        const d = d0 + ((d1 - d0) * r) / rows;
        const base = tintAt(d);
        for (const u of COLUMNS) {
          // En el bisel, el color vuelve al de la ladera.
          color.copy(base).multiplyScalar(1 - (1 - TREAD_SHADE) * stairCover(u));
          push(d, u, profileAt(tread, d, u), color);
        }
      }
      const width = COLUMNS.length;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c + 1 < width; c += 1) {
          const a = first + r * width + c;
          const b = a + 1;
          const e = a + width;
          const f = e + 1;
          // La normal hacia +y (x crece con la columna; z decrece con la fila).
          indices.push(a, b, f, a, f, e);
        }
      }

      // La contrahuella: de la huella de abajo a ésta, en la d de su borde.
      const riser = positions.length / 3;
      for (const u of COLUMNS) {
        const cover = stairCover(u);
        push(d0, u, profileAt(below, d0, u), color.copy(stoneDark).lerp(tintAt(d0), 1 - cover));
        push(d0, u, profileAt(tread, d0, u), color.copy(stone).lerp(tintAt(d0), 1 - cover));
      }
      for (let c = 0; c + 1 < width; c += 1) {
        const lo = riser + c * 2;
        const hi = lo + 1;
        const nextLo = lo + 2;
        const nextHi = lo + 3;
        // De cara a la cámara (+z del mundo, hacia d menores).
        indices.push(lo, nextLo, nextHi, lo, nextHi, hi);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function Stairs({ palette, profile }: StairsProps) {
  const flights = useMemo(() => allFlights().filter((f) => f.steps.length > 0), []);
  const geometry = useMemo(() => buildStairs(flights, palette), [flights, palette]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Con los pétalos caídos que llegan desde Eventos: sólo en las huellas.
  // Y bajo las galerías, la luz que cuela el bambú (komorebi).
  const material = useMemo(() => {
    const carpet = withPetalCarpet(new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }), palette, {
      tops: true,
      layers: CARPET_LAYERS[profile.tier],
    });
    return profile.tier === 'low' ? carpet : withKomorebi(carpet);
  }, [palette, profile.tier]);
  useEffect(() => () => material.dispose(), [material]);

  if (flights.length === 0) return null;
  return <mesh geometry={geometry} material={material} receiveShadow castShadow={profile.shadows} />;
}

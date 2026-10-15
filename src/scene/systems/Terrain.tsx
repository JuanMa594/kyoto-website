'use client';

import { useEffect, useMemo } from 'react';
import { Color, Float32BufferAttribute, PlaneGeometry, type BufferAttribute } from 'three';

import { JOURNEY, PATH_LENGTH } from '@/config/journey';
import type { ScenePalette } from '@/lib/css-vars';
import type { QualityProfile } from '@/scene/quality/tiers';
import { zoneBlend } from '@/scene/path/journeyPath';

import { GROUND_Y, terrainHeight } from './elevation';

/**
 * El suelo del camino entero, de antes de la Home a después de Gastronomía.
 *
 * Es **una sola malla**, calculada una vez al montar: el relieve ya no cambia
 * con la estación activa porque el mundo es uno solo (`elevation.ts`). Lo que
 * sí cambia a lo largo del camino es el color: cada vértice lleva el tinte de
 * suelo de su zona, mezclado con el de la vecina por los mismos pesos que el
 * relieve, la niebla y el viento.
 *
 * El color se mezcla casi del todo con el fondo a propósito (el 30 % del tinte
 * sobre el washi): ninguna referencia tiene un «piso» a color pleno, y el suelo
 * no debe competir con lo que se construya encima.
 */

/** Qué parte del tinte de suelo de cada estación llega al color final. */
const GROUND_TINT = 0.3;

/** Cobertura: el ancho de todo lo que la niebla deja ver, y todo el largo. */
const WIDTH = 360;
const NEAR_Z = 60;
const FAR_Z = -(PATH_LENGTH + 240);
const DEPTH = NEAR_Z - FAR_Z;
const CENTER_Z = (NEAR_Z + FAR_Z) / 2;

/** Unidades de mundo por segmento: ~2 en alto, ~2,5 en medio, ~4 en bajo. */
const SPACING: Record<QualityProfile['tier'], number> = { high: 2, medium: 2.5, low: 4 };

/** Segmentos en X y en Z, con el mismo espaciado en los dos ejes. */
function segmentsFor(tier: QualityProfile['tier']): [number, number] {
  const spacing = SPACING[tier];
  return [Math.round(WIDTH / spacing), Math.round(DEPTH / spacing)];
}

interface TerrainProps {
  palette: ScenePalette;
  profile: QualityProfile;
}

export function Terrain({ palette, profile }: TerrainProps) {
  const [segmentsX, segmentsZ] = segmentsFor(profile.tier);

  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(WIDTH, DEPTH, segmentsX, segmentsZ);
    const position = geo.attributes.position as BufferAttribute;
    const colors = new Float32Array(position.count * 3);

    const tints = JOURNEY.map((station) =>
      new Color(palette.washi).lerp(new Color(station.palette.ground), GROUND_TINT),
    );
    const mixed = new Color();

    // El mesh se rota −90° en X: el eje local Z es el "arriba" del mundo y el
    // local Y es el −Z del mundo, a partir del centro de la malla.
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const worldZ = CENTER_Z - position.getY(i);
      position.setZ(i, terrainHeight(x, worldZ));

      const zone = zoneBlend(-worldZ);
      mixed.lerpColors(tints[zone.from]!, tints[zone.to]!, zone.t);
      colors[i * 3] = mixed.r;
      colors[i * 3 + 1] = mixed.g;
      colors[i * 3 + 2] = mixed.b;
    }

    geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
    position.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [segmentsX, segmentsZ, palette.washi]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, GROUND_Y, CENTER_Z]}
      receiveShadow
    >
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  );
}

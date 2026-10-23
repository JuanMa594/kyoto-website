'use client';

import { useEffect, useMemo } from 'react';
import { Color, Float32BufferAttribute, MeshStandardMaterial, PlaneGeometry, type BufferAttribute } from 'three';

import { JOURNEY } from '@/config/journey';
import type { ScenePalette } from '@/lib/css-vars';
import type { QualityProfile } from '@/scene/quality/tiers';
import { zoneBlend } from '@/scene/path/journeyPath';
import { withKomorebi } from '@/scene/shaders/komorebi';
import { CARPET_LAYERS, withPetalCarpet } from '@/scene/shaders/petalCarpet';

import { GROUND_Y, TERRAIN_GRID, TERRAIN_MESH, TERRAIN_SPACING, terrainHeight, terrainSegments } from './elevation';

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

/**
 * Cobertura y espaciado: en `elevation.ts` (`TERRAIN_GRID`), porque la fauna
 * pisa esta misma malla (`terrainMeshHeight`), no la función.
 */
const WIDTH = TERRAIN_GRID.width;
const DEPTH = TERRAIN_GRID.nearZ - TERRAIN_GRID.farZ;
const CENTER_Z = (TERRAIN_GRID.nearZ + TERRAIN_GRID.farZ) / 2;

interface TerrainProps {
  palette: ScenePalette;
  profile: QualityProfile;
}

export function Terrain({ palette, profile }: TerrainProps) {
  const spacing = TERRAIN_SPACING[profile.tier];
  const [segmentsX, segmentsZ] = terrainSegments(spacing);

  const geometry = useMemo(() => {
    // Lo que pisa la fauna es esta malla: con este espaciado.
    TERRAIN_MESH.spacing = spacing;
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
  }, [spacing, segmentsX, segmentsZ, palette.washi]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  // Con los pétalos caídos de la estación que los declare (cerca de Eventos) y,
  // bajo las galerías de toriis de Fushimi, la luz que cuela el bambú (6A).
  const material = useMemo(() => {
    const carpet = withPetalCarpet(new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }), palette, {
      layers: CARPET_LAYERS[profile.tier],
    });
    return profile.tier === 'low' ? carpet : withKomorebi(carpet);
  }, [palette, profile.tier]);
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh
      geometry={geometry}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, GROUND_Y, CENTER_Z]}
      receiveShadow
    />
  );
}

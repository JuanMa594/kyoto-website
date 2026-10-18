'use client';

import { useEffect, useMemo } from 'react';
import { Color, Euler, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';

import type { ScenePalette } from '@/lib/css-vars';
import { createDecorMaterial } from '@/scene/decor/materials';
import { stationPebbles } from '@/scene/decor/pebbles';
import { pebbleGeometry } from '@/scene/objects/pebbleGeometry';
import type { QualityProfile } from '@/scene/quality/tiers';

interface PebblesProps {
  /** Índice de la estación en `JOURNEY`. */
  index: number;
  portrait: boolean;
  palette: ScenePalette;
  profile: QualityProfile;
}

/**
 * Las piedras de río de una estación (`decor/pebbles.ts`): un InstancedMesh,
 * una draw call. Una sola forma, que la escala en planta y en alto, el giro y
 * una pizca de ladeo vuelven distinta en cada piedra. No proyectan sombra
 * —son bajas, y sería otra pasada—: las pega al suelo su sombra de contacto
 * (`decor/contact.ts`). El color va de la piedra clara del camino a la de río,
 * mojada y oscura.
 */
export function Pebbles({ index, portrait, palette, profile }: PebblesProps) {
  const mesh = useMemo(() => {
    const pebbles = stationPebbles(index, portrait);
    if (pebbles.length === 0) return null;

    const material = createDecorMaterial({
      key: 'guijarro',
      color: '#ffffff',
      washi: palette.washi,
      ink: palette.sumi,
      roughness: 0.7,
      rim: 0.3,
    });
    material.flatShading = true;
    const instanced = new InstancedMesh(pebbleGeometry(17), material, pebbles.length);

    const light = new Color(palette.ishi);
    const deep = new Color(palette.ishiDeep);
    const wet = new Color(palette.ishiDeep).lerp(new Color(palette.sumiFaint), 0.45);
    const color = new Color();
    const matrix = new Matrix4();
    const euler = new Euler(0, 0, 0, 'YXZ');
    const rotation = new Quaternion();
    pebbles.forEach((p, i) => {
      const stretch = 0.8 + ((i * 0.618) % 1) * 0.4;
      euler.set((((i * 0.381) % 1) - 0.5) * 0.25, p.yaw, (((i * 0.727) % 1) - 0.5) * 0.25);
      rotation.setFromEuler(euler);
      matrix.compose(new Vector3(p.x, p.y, p.z), rotation, new Vector3(p.radius * stretch, p.height, p.radius / stretch));
      instanced.setMatrixAt(i, matrix);
      instanced.setColorAt(i, p.tone < 0.6 ? color.copy(light).lerp(deep, p.tone / 0.6) : color.copy(deep).lerp(wet, (p.tone - 0.6) / 0.4));
    });
    instanced.receiveShadow = profile.shadows;
    instanced.computeBoundingSphere();
    return instanced;
  }, [index, portrait, palette, profile.shadows]);

  useEffect(
    () => () => {
      if (!mesh) return;
      mesh.geometry.dispose();
      (mesh.material as { dispose(): void }).dispose();
      mesh.dispose();
    },
    [mesh],
  );

  return mesh ? <primitive object={mesh} /> : null;
}

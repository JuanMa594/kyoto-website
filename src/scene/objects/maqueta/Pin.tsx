'use client';

import { forwardRef, useEffect, useMemo } from 'react';
import type { Group } from 'three';

import type { ScenePalette } from '@/lib/css-vars';
import { createDecorMaterial } from '@/scene/decor/materials';
import type { QualityProfile } from '@/scene/quality/tiers';

import { maquetaGeometry } from './maquetaGeometry';

interface PinProps {
  palette: ScenePalette;
  profile: QualityProfile;
}

/**
 * El pin de Kyoto, como el de `2.png`: una gota blanca con su contorno shu y
 * el disco rojo de la bandera. Es un grupo del mundo: `MaquetaJapon` lo coloca en
 * cada frame sobre la losa de Kyoto y lo gira hacia la cámara, así que el
 * contorno —el bisel y el canto— se ve siempre, también con el parallax.
 */
export const Pin = forwardRef<Group, PinProps>(function Pin({ palette }, ref) {
  const parts = useMemo(maquetaGeometry, []);
  const materials = useMemo(() => {
    const common = { key: 'maqueta-pin', washi: palette.washi, ink: palette.sumi };
    return {
      face: createDecorMaterial({ ...common, color: palette.kami, roughness: 0.7, rim: 0 }),
      rim: createDecorMaterial({ ...common, color: palette.shu, roughness: 0.6, rim: 0.2 }),
    };
  }, [palette]);

  useEffect(
    () => () => {
      materials.face.dispose();
      materials.rim.dispose();
    },
    [materials],
  );

  return (
    <group ref={ref}>
      {/* Sin sombra: sobre la bandeja de pie del zoom era una banda oscura que la cruzaba.
          Después del agua del lago, que se adelanta y no escribe profundidad. */}
      <mesh geometry={parts.pinFace} material={[materials.face, materials.rim]} renderOrder={2} />
      <mesh geometry={parts.pinDisc} material={materials.rim} renderOrder={2} />
    </group>
  );
});

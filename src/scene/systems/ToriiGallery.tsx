'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  Color,
  Euler,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshDepthMaterial,
  Quaternion,
  RGBADepthPacking,
  Vector2,
  Vector3,
  type BufferGeometry,
  type MeshStandardMaterial,
} from 'three';

import type { ScenePalette } from '@/lib/css-vars';
import { smoothstep } from '@/lib/procedural';
import { TORII_FADE_SPEED, type PlacedGallery } from '@/scene/decor/gallery';
import { createDecorMaterial } from '@/scene/decor/materials';
import { INARI_STRETCH } from '@/scene/objects/torii/inari';
import { inariToriiGeometry } from '@/scene/objects/torii/toriiGeometry';
import { PATH, pathX } from '@/scene/path/journeyPath';
import type { QualityProfile } from '@/scene/quality/tiers';
import { KOMOREBI_AXIS, withKomorebi } from '@/scene/shaders/komorebi';

/**
 * Las galerías de toriis de una estación (Fase 6A): todos sus toriis en dos
 * `InstancedMesh`, una por material —bermellón y negro—. Dos draw calls para
 * la subida entera, por largas y densas que sean las galerías.
 *
 * Cada torii lleva por instancia su **alzada** (`aLift`: los pilares se
 * estiran en el vertex shader, las vigas suben enteras; la cuenta es
 * `inariLift`) y su **matiz**: el bermellón recién pintado o el que ya apagó el
 * sol, para que la galería no sea una fotocopia. La sombra se dibuja con la
 * misma alzada.
 *
 * **El viaje largo.** Caminando, la cámara pasa a ≥ 1,5 u de cada pilar. En un
 * viaje rápido entre estaciones lejanas, el encuadre recorta las curvas (lo
 * filtra contra el mareo) y puede rozar una hilera de pilares durante un
 * frame: a esa velocidad, lo que queda a menos de ~1,8 u de la cámara se
 * disuelve en un tramado (`uNearFade`), y nunca se ve el interior de un pilar.
 * Quieta o caminando, el tramado está apagado.
 */


interface ToriiGalleryProps {
  galleries: readonly PlacedGallery[];
  palette: ScenePalette;
  profile: QualityProfile;
}

const LIFT_PARS = /* glsl */ `
attribute float aLift;
uniform vec2 uStretch;
`;

const LIFT_VERTEX = /* glsl */ `
// La alzada: el pilar se estira entre su pie y el nuki; lo de arriba sube entero.
transformed.y += aLift * clamp((transformed.y - uStretch.x) / (uStretch.y - uStretch.x), 0.0, 1.0);
`;

const FADE_PARS = /* glsl */ `
uniform float uNearFade;
`;

const FADE_FRAGMENT = /* glsl */ `
// En un viaje rápido, lo que roza la cámara se disuelve en un tramado
// (ruido de gradiente entrelazado: estable en pantalla, sin bandas).
if (uNearFade > 0.0) {
  float nearKeep = smoothstep(1.0, 1.8, length(vViewPosition));
  float nearNoise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (nearNoise > mix(1.0, nearKeep, uNearFade)) discard;
}
`;

/** Le pone la alzada a un material (de color o de sombra). */
function withLift<M extends MeshStandardMaterial | MeshDepthMaterial>(material: M, key: string, fade = false): M {
  const base = material.onBeforeCompile;
  const stretch = { value: new Vector2(INARI_STRETCH[0], INARI_STRETCH[1]) };
  material.onBeforeCompile = (shader, renderer) => {
    base.call(material, shader, renderer);
    shader.uniforms.uStretch = stretch;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${LIFT_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${LIFT_VERTEX}`);
    if (fade) {
      shader.uniforms.uNearFade = (material.userData as { nearFade: { value: number } }).nearFade;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${FADE_PARS}`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${FADE_FRAGMENT}`);
    }
  };
  const previousKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${previousKey?.() ?? ''}-inari-${key}`;
  return material;
}

export default function ToriiGallery({ galleries, palette, profile }: ToriiGalleryProps) {
  const meshes = useMemo(() => {
    const toriis = galleries.flatMap((g) => g.toriis);
    const parts = inariToriiGeometry();
    const look = { washi: palette.washi, ink: palette.sumi };
    const nearFade = { value: 0 };

    const build = (source: BufferGeometry, key: 'shu' | 'sumi', colorOf: (tone: number, out: Color) => Color) => {
      const geometry = source.clone();
      const material = createDecorMaterial({ ...look, key: `inari-${key}`, color: '#ffffff', roughness: key === 'shu' ? 0.6 : 0.78 });
      material.userData.nearFade = nearFade;
      // El moteado del bambú de arriba (komorebi): en los tiers alto y medio.
      withLift(profile.tier === 'low' ? material : withKomorebi(material, 'pilar'), key, true);
      const mesh = new InstancedMesh(geometry, material, toriis.length);
      const lifts = new Float32Array(toriis.length);
      const matrix = new Matrix4();
      const rotation = new Quaternion();
      const euler = new Euler();
      const unit = new Vector3(1, 1, 1);
      const color = new Color();
      toriis.forEach((torii, i) => {
        rotation.setFromEuler(euler.set(0, torii.yaw, 0));
        mesh.setMatrixAt(i, matrix.compose(new Vector3(torii.x, torii.y, torii.z), rotation, unit));
        mesh.setColorAt(i, colorOf(torii.tone, color));
        lifts[i] = torii.lift;
      });
      geometry.setAttribute('aLift', new InstancedBufferAttribute(lifts, 1));
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = profile.shadows;
      mesh.receiveShadow = profile.shadows;
      mesh.customDepthMaterial = withLift(new MeshDepthMaterial({ depthPacking: RGBADepthPacking }), `${key}-sombra`);
      mesh.computeBoundingSphere();
      return mesh;
    };

    // El bermellón: del recién pintado al que apagó el sol (más claro y algo terroso).
    const fresh = new Color(palette.shu);
    const faded = new Color(palette.shu).lerp(new Color(palette.kohaku), 0.22).lerp(new Color(palette.sumiSoft), 0.12);
    const ink = new Color(palette.sumi);
    const inkWorn = new Color(palette.sumi).lerp(new Color(palette.sumiSoft), 0.35);
    const shu = build(parts.shu, 'shu', (tone, out) => out.copy(fresh).lerp(faded, tone * 0.85));
    const sumi = build(parts.sumi, 'sumi', (tone, out) => out.copy(ink).lerp(inkWorn, tone * 0.6));
    return { shu, sumi, nearFade };
  }, [galleries, palette, profile.shadows, profile.tier]);

  useEffect(
    () => () => {
      for (const mesh of [meshes.shu, meshes.sumi]) {
        mesh.geometry.dispose();
        (mesh.material as MeshStandardMaterial).dispose();
        mesh.customDepthMaterial?.dispose();
        mesh.dispose();
      }
    },
    [meshes],
  );

  // El tramado de cerca, sólo en un viaje rápido. Y el eje del moteado del
  // bambú: la tangente del camino en el punto de interés de la cámara.
  useFrame(() => {
    meshes.nearFade.value = smoothstep(TORII_FADE_SPEED[0], TORII_FADE_SPEED[1], Math.abs(PATH.velocity));
    const d = PATH.d;
    KOMOREBI_AXIS.value.set(pathX(d), d, (pathX(d + 1) - pathX(d - 1)) / 2);
  });

  return (
    <>
      <primitive object={meshes.shu} />
      <primitive object={meshes.sumi} />
    </>
  );
}

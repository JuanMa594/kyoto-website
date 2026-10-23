'use client';

import { useEffect, useMemo } from 'react';
import {
  Color,
  CylinderGeometry,
  Euler,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshDepthMaterial,
  PlaneGeometry,
  Quaternion,
  RGBADepthPacking,
  Vector3,
  type MeshStandardMaterial,
} from 'three';

import type { ScenePalette } from '@/lib/css-vars';
import { mulberry32 } from '@/lib/procedural';
import { createDecorMaterial } from '@/scene/decor/materials';
import type { PlacedObject } from '@/scene/decor/placement';
import type { QualityProfile } from '@/scene/quality/tiers';
import { SWAY_UNIFORMS } from '@/scene/systems/sway';

import { NOBORI } from './nobori';

interface NoboriProps {
  banners: readonly PlacedObject[];
  palette: ScenePalette;
  profile: QualityProfile;
}

/**
 * Los nobori de una estación (Fase 6A): todos los mástiles en una
 * `InstancedMesh` y todas las telas en otra. La tela se mece como tela, no
 * como una caña: la flexión crece hacia el borde libre y hacia abajo, cada
 * una con su fase, y con la ráfaga se tiende a sotavento. Su sombra se dibuja
 * con el mismo viento. La greca del borde la pinta el shader (`RAIMON`).
 */
export default function NoboriBanners({ banners, palette, profile }: NoboriProps) {
  const meshes = useMemo(() => {
    const random = mulberry32(6060);
    const matrix = new Matrix4();
    const rotation = new Quaternion();
    const euler = new Euler();
    const unit = new Vector3(1, 1, 1);

    const poleGeometry = new CylinderGeometry(NOBORI.poleRadius * 0.8, NOBORI.poleRadius, NOBORI.poleHeight, 8, 1, false);
    poleGeometry.translate(0, NOBORI.poleHeight / 2, 0);
    const poles = new InstancedMesh(
      poleGeometry,
      createDecorMaterial({ key: 'nobori-mastil', color: palette.sumiSoft, washi: palette.washi, ink: palette.sumi, roughness: 0.7 }),
      banners.length,
    );

    // La tela: de x = 0 (el mástil) a x = ancho, colgando desde arriba.
    const clothGeometry = new PlaneGeometry(NOBORI.clothWidth, NOBORI.clothHeight, 6, 24);
    clothGeometry.translate(NOBORI.poleRadius + NOBORI.clothWidth / 2, NOBORI.poleHeight - NOBORI.clothTop - NOBORI.clothHeight / 2, 0);
    const phases = new Float32Array(banners.length);
    const material = withCloth(
      createDecorMaterial({ key: 'nobori-tela', color: palette.shu, washi: palette.washi, ink: palette.sumi, roughness: 0.85, rim: 0.15, doubleSide: true }),
      palette,
    );
    const cloths = new InstancedMesh(clothGeometry, material, banners.length);

    banners.forEach((banner, i) => {
      rotation.setFromEuler(euler.set(0, banner.yaw, 0));
      matrix.compose(new Vector3(banner.x, banner.y, banner.z), rotation, unit);
      poles.setMatrixAt(i, matrix);
      cloths.setMatrixAt(i, matrix);
      phases[i] = random();
    });
    clothGeometry.setAttribute('aNobori', new InstancedBufferAttribute(phases, 1));
    for (const mesh of [poles, cloths]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = profile.shadows;
      mesh.receiveShadow = profile.shadows;
      mesh.computeBoundingSphere();
    }
    // La sombra de la tela, con el mismo viento.
    const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
    depth.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, { uSwayTime: SWAY_UNIFORMS.uSwayTime, uSwayStrength: SWAY_UNIFORMS.uSwayStrength });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${CLOTH_PARS}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${CLOTH_VERTEX}`);
    };
    depth.customProgramCacheKey = () => 'nobori-sombra';
    cloths.customDepthMaterial = depth;
    return { poles, cloths };
  }, [banners, palette, profile.shadows]);

  useEffect(
    () => () => {
      for (const mesh of [meshes.poles, meshes.cloths]) {
        mesh.geometry.dispose();
        (mesh.material as MeshStandardMaterial).dispose();
        mesh.customDepthMaterial?.dispose();
        mesh.dispose();
      }
    },
    [meshes],
  );

  return (
    <>
      <primitive object={meshes.poles} />
      <primitive object={meshes.cloths} />
    </>
  );
}

const CLOTH_PARS = /* glsl */ `
attribute float aNobori;
uniform float uSwayTime;
uniform float uSwayStrength;
const float NOBORI_WIDTH = ${NOBORI.clothWidth.toFixed(3)};
const float NOBORI_TOP = ${(NOBORI.poleHeight - NOBORI.clothTop).toFixed(3)};
const float NOBORI_HEIGHT = ${NOBORI.clothHeight.toFixed(3)};
// Lo que se aparta la tela de su plano en (x, y): crece hacia el borde libre
// y hacia abajo; una ola que baja por la tela y, con viento, se tiende.
float noboriWave(vec2 p) {
  float free = clamp((p.x - ${NOBORI.poleRadius.toFixed(3)}) / NOBORI_WIDTH, 0.0, 1.0);
  float hang = clamp((NOBORI_TOP - p.y) / NOBORI_HEIGHT, 0.0, 1.0);
  float give = pow(free, 1.3) * (0.35 + 0.65 * hang);
  float phase = aNobori * 6.2831853;
  float wave = sin(uSwayTime * (1.6 + aNobori * 0.6) + phase + p.y * 1.2 + p.x * 2.2) * (0.08 + 0.22 * uSwayStrength);
  return give * (wave + 0.25 * uSwayStrength);
}
`;

const CLOTH_VERTEX = /* glsl */ `
transformed.z += noboriWave(transformed.xy);
`;

const CLOTH_NORMAL = /* glsl */ `
// La normal de la tela ondulada, por diferencias.
float noboriDx = noboriWave(position.xy + vec2(0.05, 0.0)) - noboriWave(position.xy - vec2(0.05, 0.0));
float noboriDy = noboriWave(position.xy + vec2(0.0, 0.05)) - noboriWave(position.xy - vec2(0.0, 0.05));
objectNormal = normalize(vec3(-noboriDx / 0.1, -noboriDy / 0.1, 1.0));
`;

const CLOTH_FRAGMENT_PARS = /* glsl */ `
uniform vec3 uNoboriWhite;
varying vec2 vNoboriUv;
// La distancia de q al segmento ab.
float raimonSegment(vec2 q, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float h = clamp(dot(q - a, ab) / dot(ab, ab), 0.0, 1.0);
  return length(q - a - ab * h);
}
// El raimon: una espiral cuadrada por celda, que se encadena con la vecina.
float raimon(vec2 q) {
  float d = raimonSegment(q, vec2(0.0, 0.12), vec2(0.88, 0.12));
  d = min(d, raimonSegment(q, vec2(0.88, 0.12), vec2(0.88, 0.88)));
  d = min(d, raimonSegment(q, vec2(0.88, 0.88), vec2(0.3, 0.88)));
  d = min(d, raimonSegment(q, vec2(0.3, 0.88), vec2(0.3, 0.38)));
  d = min(d, raimonSegment(q, vec2(0.3, 0.38), vec2(0.64, 0.38)));
  d = min(d, raimonSegment(q, vec2(0.64, 0.38), vec2(0.64, 0.64)));
  return d;
}
`;

const CLOTH_FRAGMENT = /* glsl */ `
// El borde blanco con la greca: a lo largo del canto libre y del de abajo.
vec2 noboriSize = vec2(NOBORI_BAND_W, NOBORI_BAND_H);
float acrossFree = (1.0 - vNoboriUv.x) * noboriSize.x;
float acrossFoot = vNoboriUv.y * noboriSize.y;
float bandWidth = ${NOBORI.band.toFixed(3)};
float inBand = 1.0 - step(bandWidth, min(acrossFree, acrossFoot));
if (inBand > 0.5) {
  bool alongFree = acrossFree < acrossFoot;
  float along = alongFree ? vNoboriUv.y * noboriSize.y : vNoboriUv.x * noboriSize.x;
  float across = (alongFree ? acrossFree : acrossFoot) / bandWidth;
  vec2 cell = vec2(fract(along / bandWidth), across);
  float fret = raimon(cell);
  diffuseColor.rgb = mix(uNoboriWhite, diffuseColor.rgb, 1.0 - smoothstep(0.075, 0.11, fret));
}
`;

/** La tela: su ondulación con el viento y la greca del borde. */
function withCloth(material: MeshStandardMaterial, palette: ScenePalette): MeshStandardMaterial {
  const base = material.onBeforeCompile;
  const white = { value: new Color(palette.kami) };
  material.onBeforeCompile = (shader, renderer) => {
    base.call(material, shader, renderer);
    shader.uniforms.uSwayTime = SWAY_UNIFORMS.uSwayTime;
    shader.uniforms.uSwayStrength = SWAY_UNIFORMS.uSwayStrength;
    shader.uniforms.uNoboriWhite = white;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${CLOTH_PARS}\nvarying vec2 vNoboriUv;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${CLOTH_NORMAL}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvNoboriUv = uv;\n${CLOTH_VERTEX}`);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\n#define NOBORI_BAND_W ${NOBORI.clothWidth.toFixed(3)}\n#define NOBORI_BAND_H ${NOBORI.clothHeight.toFixed(3)}\n${CLOTH_FRAGMENT_PARS}`,
      )
      .replace('#include <color_fragment>', `#include <color_fragment>\n${CLOTH_FRAGMENT}`);
  };
  const previousKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${previousKey?.() ?? ''}-nobori`;
  return material;
}

'use client';

import { useEffect, useMemo } from 'react';
import {
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three';

import { JOURNEY } from '@/config/journey';
import type { ScenePalette } from '@/lib/css-vars';
import { stationMoss } from '@/scene/decor/moss';
import { DECOR_DENSITY } from '@/scene/decor/placement';
import type { QualityProfile } from '@/scene/quality/tiers';

interface MossPatchesProps {
  /** Índice de la estación en `JOURNEY`. */
  index: number;
  portrait: boolean;
  palette: ScenePalette;
  profile: QualityProfile;
}

/**
 * Cuánto se mezcla el verde con el color del suelo: el musgo es una aguada
 * sobre el cartel, no una pegatina. Con 0 sería verde de catálogo.
 */
const GROUND_BLEND = 0.16;
/** El mismo tinte del terreno que `Terrain` (GROUND_TINT): washi hacia el suelo de la zona. */
const TERRAIN_TINT = 0.3;
/** Cuánto se oscurece el suelo en el halo de tierra húmeda que rodea al musgo. */
const SOIL_DARKEN = 0.6;
/**
 * El cuadrado de cada parche es más grande que el musgo que dibuja: el sobrante
 * es el sitio del halo y del fundido, que así nunca tocan el lado del cuadrado
 * (se vería una arista recta).
 */
const PAD = 1.4;

/**
 * El musgo de una estación: un InstancedMesh de cuadrados tendidos sobre el
 * terreno —una draw call— cuyo contorno se dibuja en el shader. Nada es
 * textura: el borde irregular y deshecho, los cojines de musgo y el moteado
 * fino salen de ruido de valor con la semilla de cada parche. Es transparente
 * y no escribe profundidad: recibe sombras y niebla, y lo que está encima (las
 * piedras, los pies de los faroles) lo tapa sin más.
 */
export function MossPatches({ index, portrait, palette, profile }: MossPatchesProps) {
  const mesh = useMemo(() => {
    const patches = stationMoss(index, portrait, DECOR_DENSITY[profile.tier]);
    if (patches.length === 0) return null;

    const geometry = new PlaneGeometry(1, 1);
    geometry.rotateX(-Math.PI / 2);
    const seeds = new Float32Array(patches.length * 2);

    const ground = new Color(palette.washi).lerp(new Color(JOURNEY[index]?.palette.ground ?? palette.washi), TERRAIN_TINT);
    // La tierra húmeda del borde: el suelo de la zona, oscurecido hacia el sumi.
    const soil = ground.clone().lerp(new Color(palette.sumiFaint), SOIL_DARKEN);
    const instanced = new InstancedMesh(geometry, createMossMaterial(palette.koke, soil), patches.length);
    const deep = new Color(palette.kokeDeep).lerp(ground, GROUND_BLEND);
    const mid = new Color(palette.kokeMid).lerp(ground, GROUND_BLEND);
    // Algún parche más claro: el musgo al sol. Con dos tonos, todo el jardín
    // salía del mismo verde y los corros se leían como manchas.
    const light = new Color(palette.koke).lerp(ground, GROUND_BLEND + 0.12);
    const color = new Color();
    const matrix = new Matrix4();
    const up = new Vector3(0, 1, 0);
    const normal = new Vector3();
    const tilt = new Quaternion();
    const turn = new Quaternion();
    patches.forEach((patch, i) => {
      tilt.setFromUnitVectors(up, normal.set(...patch.normal));
      turn.setFromAxisAngle(up, patch.yaw);
      matrix.compose(
        new Vector3(patch.x, patch.y, patch.z),
        tilt.multiply(turn),
        new Vector3(patch.width * PAD, 1, patch.length * PAD),
      );
      instanced.setMatrixAt(i, matrix);
      instanced.setColorAt(
        i,
        patch.tone < 0.7 ? color.copy(deep).lerp(mid, patch.tone / 0.7) : color.copy(mid).lerp(light, (patch.tone - 0.7) / 0.3),
      );
      seeds.set([patch.seed, patch.tone], i * 2);
    });
    geometry.setAttribute('aMoss', new InstancedBufferAttribute(seeds, 2));
    instanced.receiveShadow = profile.shadows;
    instanced.computeBoundingSphere();
    // Lo plano y transparente se dibuja antes que lo demás transparente.
    instanced.renderOrder = -1;
    return instanced;
  }, [index, portrait, palette, profile.tier, profile.shadows]);

  useEffect(
    () => () => {
      if (!mesh) return;
      mesh.geometry.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
      mesh.dispose();
    },
    [mesh],
  );

  return mesh ? <primitive object={mesh} /> : null;
}

/** El material del musgo: estándar (sombras, niebla, color), con el dibujo en el shader. */
function createMossMaterial(tip: string, soil: Color): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color: '#ffffff',
    roughness: 1,
    metalness: 0,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const uMossTip = { value: new Color(tip) };
  const uMossSoil = { value: soil };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uMossTip = uMossTip;
    shader.uniforms.uMossSoil = uMossSoil;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${MOSS_VERTEX_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${MOSS_VERTEX}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${MOSS_FRAGMENT_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${MOSS_FRAGMENT}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${MOSS_NORMAL}`);
  };
  material.customProgramCacheKey = () => 'decor-musgo';
  return material;
}

const MOSS_VERTEX_PARS = /* glsl */ `
attribute vec2 aMoss;
varying vec2 vMossUv;
varying vec2 vMossSeed;
`;

// El cuadrado va de -0,5 a 0,5 en x y z: el uv del parche, de -PAD a PAD (el
// musgo ocupa el círculo de radio ~1; el resto es halo y fundido).
const MOSS_VERTEX = /* glsl */ `
vMossUv = position.xz * ${(2 * PAD).toFixed(2)};
vMossSeed = aMoss;
`;

/** Lo que se levantan los cojines del musgo, en unidades: el relieve que toma la luz. */
const MOSS_BUMP = '0.022';

/** Lo opaco del halo de tierra húmeda en su parte más densa, pegada al musgo. */
const HALO_ALPHA = 0.4;

const MOSS_FRAGMENT_PARS = /* glsl */ `
uniform vec3 uMossTip;
uniform vec3 uMossSoil;
varying vec2 vMossUv;
varying vec2 vMossSeed;

float mossHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float mossNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  vec2 s = f * f * (3.0 - 2.0 * f);
  float a = mossHash(cell);
  float b = mossHash(cell + vec2(1.0, 0.0));
  float c = mossHash(cell + vec2(0.0, 1.0));
  float d = mossHash(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}

float mossFbm(vec2 p) {
  float sum = 0.0;
  float weight = 0.5;
  for (int octave = 0; octave < 4; octave++) {
    sum += weight * mossNoise(p);
    p = p * 2.03 + 17.1;
    weight *= 0.5;
  }
  return sum;
}
`;

// El contorno: un círculo que el ruido grande deforma y el fino rompe en el
// borde, en matas e islitas. El borde se funde con el suelo, y más cuanto más
// lejos: de cerca se ven las matas; de lejos, nítido, se leía como una
// calcomanía. Alrededor, un halo de tierra húmeda —el suelo, más oscuro— que
// lo ancla: hace de sombra de contacto de algo que es plano. Dentro, cojines:
// más oscuros en las juntas, con puntas de verde claro. Las derivadas del
// relieve se toman aquí, antes del discard: después de él, en algunos GPU, no
// están definidas.
const MOSS_FRAGMENT = /* glsl */ `
vec2 mossAt = vMossUv + vMossSeed.x * 31.7;
float mossRadius = length(vMossUv);
float mossBody = mossFbm(vMossUv * 1.6 + vMossSeed.x * 31.7);
float mossFine = mossNoise(mossAt * 11.0);
float mossCushion = mossNoise(mossAt * 4.6);
float mossHeight = (mossCushion * 0.75 + mossFine * 0.25) * ${MOSS_BUMP};
vec2 mossSlope = vec2(dFdx(mossHeight), dFdy(mossHeight));
vec3 mossSigmaX = dFdx(-vViewPosition);
vec3 mossSigmaY = dFdy(-vViewPosition);
float mossFar = smoothstep(10.0, 45.0, length(vViewPosition));
float mossQuad = 1.0 - smoothstep(0.86, 0.99, max(abs(vMossUv.x), abs(vMossUv.y)) / ${PAD.toFixed(2)});
float mossCover = 1.0 - mossRadius + (mossBody - 0.5) * 1.0 + (mossFine - 0.5) * 0.45 * mossRadius;
float mossFeather = mix(0.12, 0.36, mossFar);
float mossAlpha = smoothstep(0.08, 0.08 + mossFeather, mossCover) * mix(0.86, 0.97, vMossSeed.y) * mix(1.0, 0.82, mossFar);
float mossHalo = smoothstep(-0.36, 0.12, mossCover) * ${HALO_ALPHA.toFixed(2)} * mix(1.0, 0.55, mossFar);
float mossTotal = (mossAlpha + mossHalo * (1.0 - mossAlpha)) * mossQuad;
if (mossTotal < 0.004) discard;
diffuseColor.rgb *= mix(0.62, 1.1, smoothstep(0.15, 0.85, mossCushion));
diffuseColor.rgb = mix(diffuseColor.rgb, uMossTip, smoothstep(0.62, 0.9, mossFine) * mossCushion * 0.55);
diffuseColor.rgb = mix(uMossSoil, diffuseColor.rgb, mossAlpha / max(mossAlpha + mossHalo * (1.0 - mossAlpha), 0.0001));
diffuseColor.a *= mossTotal;
`;

// El relieve: el mismo cálculo que el bump map de three (perturbNormalArb),
// con la altura de los cojines en vez de una textura.
const MOSS_NORMAL = /* glsl */ `
vec3 mossR1 = cross(mossSigmaY, normal);
vec3 mossR2 = cross(normal, mossSigmaX);
float mossDet = dot(mossSigmaX, mossR1);
vec3 mossGrad = sign(mossDet) * (mossSlope.x * mossR1 + mossSlope.y * mossR2);
normal = normalize(abs(mossDet) * normal - mossGrad);
`;


import { Color, Vector4, type MeshStandardMaterial } from 'three';

import type { ScenePalette } from '@/lib/css-vars';
import type { QualityTier } from '@/scene/quality/tiers';
import { PETAL_CARPET } from '@/scene/systems/petalCarpet';

/**
 * Los pétalos caídos, pintados en el suelo (5B): sin geometría ni draw calls
 * de más. Se inyecta con onBeforeCompile en el MeshStandardMaterial del
 * terreno y en el de las piedras del camino.
 *
 * El suelo se divide en celdas (tres estratos de tamaños distintos, para que
 * no se lea la cuadrícula) y cada celda lleva un pétalo de sakura —una gota
 * con la muesca en la punta, girada y desplazada al azar— o ninguno: cuántas
 * lo llevan lo dice la cobertura en esa `d` (`scene/systems/petalCarpet.ts`).
 * Debajo, un velo rosa que crece con la cobertura al cuadrado: al principio
 * sólo hay pétalos sueltos, y en la estación el suelo entero es rosa.
 *
 * Lejos, una celda mide menos que unos píxeles y los pétalos titilarían: ahí
 * se funden en su color medio. Las derivadas se toman fuera del `if`, que no
 * es uniforme entre píxeles vecinos.
 */

export interface PetalCarpetOptions {
  /** Las piedras sólo llevan pétalos en lo alto, no en los costados. */
  readonly tops?: boolean;
  /** Cuántos estratos de pétalos (1–3): menos en los tiers bajos. */
  readonly layers?: number;
}

/** Estratos de pétalos por tier: el shader corre en medio cuadro, el del suelo. */
export const CARPET_LAYERS: Record<QualityTier, number> = { high: 3, medium: 2, low: 1 };

const PARS_VERTEX = /* glsl */ `
varying vec3 vCarpetWorld;
`;

const WORLD_VERTEX = /* glsl */ `
vec4 carpetWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
carpetWorld = instanceMatrix * carpetWorld;
#endif
vCarpetWorld = (modelMatrix * carpetWorld).xyz;
`;

const PARS_FRAGMENT = /* glsl */ `
uniform vec4 uCarpetSpan;
uniform float uCarpetCover;
uniform vec3 uPetalLight;
uniform vec3 uPetalDeep;
uniform vec3 uPetalWash;
varying vec3 vCarpetWorld;

// La misma curva que petalCarpetAt: sube, se mantiene y baja.
float carpetCoverAt(float d) {
  float rise = smoothstep(uCarpetSpan.x, uCarpetSpan.y, d);
  float fall = 1.0 - smoothstep(uCarpetSpan.z, uCarpetSpan.w, d);
  return uCarpetCover * min(rise, fall);
}

// Hash sin seno: estable también lejos del origen (Dave Hoskins).
float carpetHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Un estrato: celdas de lado cell, con un pétalo o ninguno. Devuelve cuánto
// cubre el pétalo este punto y su tono. px: lo que mide un píxel en el suelo.
vec2 petalLayer(vec2 xz, float cell, float density, float seed, float px) {
  vec2 g = xz / cell;
  vec2 id = floor(g);
  if (carpetHash(id + seed) >= density) return vec2(0.0);
  float turn = carpetHash(id + seed + 7.13) * 6.2832;
  // Desplazado y de largo al azar, sin salirse nunca de su celda.
  vec2 shift = (vec2(carpetHash(id + seed + 3.31), carpetHash(id + seed + 5.97)) - 0.5) * 0.36;
  float reach = 0.22 + 0.08 * carpetHash(id + seed + 9.41);
  vec2 q = fract(g) - 0.5 - shift;
  float c = cos(turn);
  float s = sin(turn);
  q = vec2(c * q.x - s * q.y, s * q.x + c * q.y) / reach;
  // Una gota más ancha hacia la punta, con la muesca del pétalo de sakura.
  float body = length(vec2(q.x * (1.7 - 0.45 * q.y), q.y));
  float notch = length(q - vec2(0.0, 1.05));
  float soft = 1.5 * px / (cell * reach);
  float cover = (1.0 - smoothstep(1.0 - soft, 1.0 + soft, body)) * smoothstep(0.3 - soft, 0.3 + soft, notch);
  return vec2(cover, carpetHash(id + seed + 11.7));
}
`;

const COLOR_FRAGMENT = /* glsl */ `
// Fuera del if: las derivadas no están definidas en una rama no uniforme.
vec3 carpetDx = dFdx(vCarpetWorld);
vec3 carpetDy = dFdy(vCarpetWorld);
float carpetPx = max(length(carpetDx), length(carpetDy));
float carpetCover = carpetCoverAt(-vCarpetWorld.z);
#ifdef CARPET_TOPS
// Las piedras, sólo en lo alto: la normal de la cara, de las mismas derivadas.
carpetCover *= smoothstep(0.75, 0.92, abs(normalize(cross(carpetDx, carpetDy)).y));
#endif
if (carpetCover > 0.001) {
  vec2 carpetXZ = vCarpetWorld.xz;
  vec3 petalA = vec3(petalLayer(carpetXZ, 0.46, carpetCover, 0.0, carpetPx), 1.0);
  vec3 petalB = vec3(0.0);
  vec3 petalC = vec3(0.0);
  #if CARPET_LAYERS > 1
  petalB = vec3(petalLayer(carpetXZ + vec2(0.17, 0.29), 0.37, carpetCover, 17.0, carpetPx), 1.0);
  #endif
  #if CARPET_LAYERS > 2
  petalC = vec3(petalLayer(carpetXZ + vec2(0.41, 0.07), 0.29, carpetCover * 0.8, 41.0, carpetPx), 1.0);
  #endif
  float carpetMask = max(max(petalA.x, petalB.x), petalC.x);
  float carpetTone = (petalA.y * petalA.x + petalB.y * petalB.x + petalC.y * petalC.x)
    / max(petalA.x + petalB.x + petalC.x, 0.001);
  // Lejos, cuando una celda mide pocos píxeles, su color medio.
  float carpetDetail = 1.0 - smoothstep(0.03, 0.08, carpetPx);
  float carpetAmount = mix(0.12 * float(CARPET_LAYERS) * carpetCover, carpetMask, carpetDetail);
  carpetTone = mix(0.5, carpetTone, carpetDetail);
  // El velo: lo que no se distingue pétalo a pétalo. En lo alto de las
  // piedras, mucho menos: con el velo entero parecían de cristal.
  #ifdef CARPET_TOPS
  float carpetWash = 0.3;
  #else
  float carpetWash = 0.8;
  #endif
  diffuseColor.rgb = mix(diffuseColor.rgb, uPetalWash, carpetCover * carpetCover * carpetWash);
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(uPetalLight, uPetalDeep, carpetTone), carpetAmount);
}
`;

/**
 * Le pone los pétalos caídos a un MeshStandardMaterial. Si ninguna estación
 * declara alfombra, no lo toca.
 */
export function withPetalCarpet(
  material: MeshStandardMaterial,
  palette: ScenePalette,
  { tops = false, layers = 3 }: PetalCarpetOptions = {},
): MeshStandardMaterial {
  const span = PETAL_CARPET;
  if (!span) return material;
  const count = Math.min(3, Math.max(1, Math.round(layers)));
  const pale = new Color(palette.sakuraPale);
  const uniforms = {
    uCarpetSpan: { value: new Vector4(span.start, span.full, span.holdEnd, span.end) },
    uCarpetCover: { value: span.cover },
    uPetalLight: { value: pale.clone() },
    uPetalDeep: { value: pale.clone().lerp(new Color(palette.sakura), 0.38) },
    uPetalWash: { value: pale.clone().lerp(new Color(palette.sakura), 0.22) },
  };

  material.defines = { ...material.defines, CARPET_LAYERS: count, ...(tops ? { CARPET_TOPS: '' } : {}) };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${PARS_VERTEX}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${WORLD_VERTEX}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PARS_FRAGMENT}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${COLOR_FRAGMENT}`);
  };
  material.customProgramCacheKey = () => `petal-carpet-${count}-${tops ? 'tops' : 'all'}`;
  return material;
}

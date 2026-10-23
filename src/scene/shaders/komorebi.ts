import { Vector3, type MeshStandardMaterial } from 'three';

import { JOURNEY } from '@/config/journey';
import { gallerySpan } from '@/scene/decor/gallery';
import { SWAY_UNIFORMS } from '@/scene/systems/sway';

/**
 * El *komorebi* (木漏れ日, Fase 6A): la luz que se cuela entre las hojas del
 * bambú que cubre las galerías de toriis, pintada en el suelo, en las gradas y
 * en los pilares. Sin geometría ni draw calls: una cuenta en el fragmento.
 *
 * Es la tercera capa del bambú de arriba (spec §4.5): el dosel se ve, el sol
 * proyecta su sombra (en tier alto), y esto añade el moteado —manchas de hoja
 * que derivan despacio con el viento— **también en tier medio**, que no tiene
 * sombras: sin él, allí las galerías densas no tendrían luz.
 *
 * Sólo dentro de los tramos de galería (`KOMOREBI_SPANS`, de `gallery.ts`), con
 * un fundido de unas unidades en cada extremo, y más marcado en las densas:
 * bajo su techo de dinteles el suelo está en penumbra y la luz entra a manchas.
 * Y sólo bajo el dosel: hasta ~9 u del eje del camino, fundiéndose hasta 13.
 * El eje, en el shader, es la recta tangente al camino en el punto de interés
 * de la cámara (`KOMOREBI_AXIS`, que escribe `ToriiGallery` cada frame): en lo
 * que se ve, el camino apenas se aparta de ella.
 *
 * El dibujo se proyecta **desde el sol**: un punto alto y uno del suelo que
 * caen en la misma línea de luz reciben la misma mancha, así que el moteado de
 * un pilar continúa en el suelo a su pie, como una sombra de verdad.
 */

/** Los tramos con galería: de dónde a dónde (d) y cuánto moteado (densas 1, abiertas 0,55). */
export interface KomorebiSpan {
  readonly from: number;
  readonly to: number;
  readonly strength: number;
}

/** Cuántos tramos caben en el shader. */
const MAX_SPANS = 8;
/** El fundido en cada extremo de un tramo, en unidades. */
const SPAN_FADE = 3;

function collectSpans(): KomorebiSpan[] {
  const spans: KomorebiSpan[] = [];
  JOURNEY.forEach((station, i) => {
    for (const item of station.environment.decor) {
      if (item.kind !== 'galeria') continue;
      const span = gallerySpan(i, item.trecho);
      if (span) spans.push({ ...span, strength: item.variant === 'densa' ? 1 : 0.55 });
    }
  });
  return spans.slice(0, MAX_SPANS);
}

/** Los tramos de galería de todo el camino. */
export const KOMOREBI_SPANS: readonly KomorebiSpan[] = collectSpans();

/** Cuánto moteado hay en `d` (0–1, ya con su fuerza): la misma cuenta que el shader. */
export function komorebiAt(d: number): number {
  let weight = 0;
  for (const span of KOMOREBI_SPANS) {
    const rise = Math.min(1, Math.max(0, (d - (span.from - SPAN_FADE)) / SPAN_FADE));
    const fall = Math.min(1, Math.max(0, (span.to + SPAN_FADE - d) / SPAN_FADE));
    weight = Math.max(weight, Math.min(rise, fall) * span.strength);
  }
  return weight;
}

/**
 * El eje del camino junto a la cámara: x del punto de interés, su d y la
 * pendiente lateral (dx/dd). **Un solo escritor**: `ToriiGallery`, en su
 * `useFrame`. Lejos de las galerías el moteado no se pinta, así que da igual
 * lo que valga cuando no hay ninguna montada.
 */
export const KOMOREBI_AXIS = { value: new Vector3(0, 0, 0) };

/** Hacia dónde está el sol (el de `Atmosphere`: por la izquierda, alto y algo por delante). */
const SUN = new Vector3(-6, 7, 4).normalize();

const PARS_VERTEX = /* glsl */ `
varying vec3 vKomorebiWorld;
`;

const WORLD_VERTEX = /* glsl */ `
vec4 komorebiWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
komorebiWorld = instanceMatrix * komorebiWorld;
#endif
vKomorebiWorld = (modelMatrix * komorebiWorld).xyz;
`;

const PARS_FRAGMENT = /* glsl */ `
uniform vec3 uKomorebiSpans[${MAX_SPANS}];
uniform float uKomorebiTime;
uniform vec3 uKomorebiSun;
uniform float uKomorebiPillar;
uniform vec3 uKomorebiAxis;
varying vec3 vKomorebiWorld;

float komorebiHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float komorebiNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  vec2 s = f * f * (3.0 - 2.0 * f);
  return mix(mix(komorebiHash(cell), komorebiHash(cell + vec2(1.0, 0.0)), s.x),
             mix(komorebiHash(cell + vec2(0.0, 1.0)), komorebiHash(cell + vec2(1.0, 1.0)), s.x), s.y);
}

float komorebiWeight(float d) {
  float weight = 0.0;
  for (int i = 0; i < ${MAX_SPANS}; i++) {
    vec3 span = uKomorebiSpans[i];
    if (span.z <= 0.0) continue;
    float rise = clamp((d - (span.x - ${SPAN_FADE.toFixed(1)})) / ${SPAN_FADE.toFixed(1)}, 0.0, 1.0);
    float fall = clamp((span.y + ${SPAN_FADE.toFixed(1)} - d) / ${SPAN_FADE.toFixed(1)}, 0.0, 1.0);
    weight = max(weight, min(rise, fall) * span.z);
  }
  return weight;
}
`;

const COLOR_FRAGMENT = /* glsl */ `
float komorebiD = -vKomorebiWorld.z;
float komorebiU = vKomorebiWorld.x - (uKomorebiAxis.x + uKomorebiAxis.z * (komorebiD - uKomorebiAxis.y));
// Sólo bajo el dosel: el camino y sus dos orillas de bambú.
float komorebiShade = komorebiWeight(komorebiD) * (1.0 - smoothstep(9.0, 13.0, abs(komorebiU)));
if (komorebiShade > 0.001) {
  // Desde el sol: el punto del dosel por el que pasa la luz que llega aquí.
  vec2 komorebiUv = vKomorebiWorld.xz - vKomorebiWorld.y * (uKomorebiSun.xz / uKomorebiSun.y);
  vec2 komorebiDrift = vec2(0.11, 0.05) * uKomorebiTime;
  float leaves = komorebiNoise(komorebiUv * 0.85 + komorebiDrift) * 0.62
    + komorebiNoise(komorebiUv * 2.1 - komorebiDrift * 1.7) * 0.38;
  // Las manchas de luz: los huecos entre hojas, de borde blando.
  float komorebiLight = smoothstep(0.56, 0.7, leaves);
  // Bajo el dosel, penumbra; en cada hueco, el sol. Los pilares, menos.
  float komorebiDepth = mix(0.3, 0.2, uKomorebiPillar) * komorebiShade;
  float komorebiGain = mix(0.22, 0.14, uKomorebiPillar) * komorebiShade;
  diffuseColor.rgb *= mix(1.0 - komorebiDepth, 1.0 + komorebiGain, komorebiLight);
}
`;

/**
 * Le pone el moteado a un MeshStandardMaterial (encadenado a lo que ya traiga
 * en `onBeforeCompile`). `pilar`: los toriis, con el moteado más suave.
 */
export function withKomorebi(material: MeshStandardMaterial, surface: 'suelo' | 'pilar' = 'suelo'): MeshStandardMaterial {
  if (KOMOREBI_SPANS.length === 0) return material;
  const spans = Array.from({ length: MAX_SPANS }, (_, i) => {
    const span = KOMOREBI_SPANS[i];
    return span ? new Vector3(span.from, span.to, span.strength) : new Vector3(0, 0, 0);
  });
  const uniforms = {
    uKomorebiSpans: { value: spans },
    // El reloj del viento: avanza a ritmo constante, así que la deriva es continua.
    uKomorebiTime: SWAY_UNIFORMS.uSwayTime,
    uKomorebiSun: { value: SUN.clone() },
    uKomorebiPillar: { value: surface === 'pilar' ? 1 : 0 },
    uKomorebiAxis: KOMOREBI_AXIS,
  };
  const base = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    base.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${PARS_VERTEX}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${WORLD_VERTEX}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PARS_FRAGMENT}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${COLOR_FRAGMENT}`);
  };
  const previousKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${previousKey?.() ?? ''}-komorebi-${surface}`;
  return material;
}

import { Color, DoubleSide, MeshStandardMaterial, type Texture } from 'three';

/**
 * El papel del kakejiku (Fase 5B): el mapa antiguo sobre un washi envejecido,
 * que se desenrolla de arriba abajo.
 *
 * `uUnroll` (0–1) es cuánto papel cuelga. En el vértice, lo que aún está
 * enrollado se sube a la línea de corte —el papel enrollado no cuelga—; en el
 * fragmento, se descarta. Se ve la parte de arriba del mapa, como en un rollo
 * que se abre. El mapa (`uMap`, el WebP de `bun run maps`) trae la tinta con el
 * fondo transparente: el papel, sus bordes amarillentos y sus manchas los pone
 * este shader.
 *
 * Es un MeshStandardMaterial con sus chunks ampliados: luz, sombras recibidas
 * y niebla sin hacer nada.
 */
export interface ScrollUniforms {
  readonly uUnroll: { value: number };
  readonly uMap: { value: Texture | null };
  /** El largo del papel desenrollado entero, en unidades locales. */
  readonly uScrollHeight: { value: number };
}

/**
 * La geometría del papel tiene la parte de arriba en y = 0 y cuelga hasta
 * y = −alto (`uScrollHeight`), con las uv de three (v = 1 arriba).
 */
export function createScrollMaterial(paper: string, aged: string, stain: string, height: number): {
  material: MeshStandardMaterial;
  uniforms: ScrollUniforms;
} {
  const uniforms: ScrollUniforms = { uUnroll: { value: 0 }, uMap: { value: null }, uScrollHeight: { value: height } };
  const uAged = { value: new Color(aged) };
  const uStain = { value: new Color(stain) };
  const material = new MeshStandardMaterial({ color: paper, roughness: 0.95, metalness: 0, side: DoubleSide });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, { uScrollAged: uAged, uScrollStain: uStain });
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uUnroll;
uniform float uScrollHeight;
varying vec2 vScrollUv;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
// v va de 0 (arriba) a 1 (abajo). Lo enrollado sube a la línea de corte.
vScrollUv = vec2(uv.x, 1.0 - uv.y);
float scrollCut = clamp(uUnroll, 0.0, 1.0);
transformed.y = max(position.y, -scrollCut * uScrollHeight);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uUnroll;
uniform sampler2D uMap;
uniform vec3 uScrollAged;
uniform vec3 uScrollStain;
varying vec2 vScrollUv;
float scrollHash(vec2 q) { return fract(sin(dot(q, vec2(41.3, 289.1))) * 15731.7); }
float scrollNoise(vec2 q) {
  vec2 cell = floor(q);
  vec2 f = fract(q);
  vec2 s = f * f * (3.0 - 2.0 * f);
  return mix(mix(scrollHash(cell), scrollHash(cell + vec2(1.0, 0.0)), s.x),
             mix(scrollHash(cell + vec2(0.0, 1.0)), scrollHash(cell + vec2(1.0, 1.0)), s.x), s.y);
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
if (vScrollUv.y > uUnroll + 0.002) discard;
// El papel: amarillea hacia los bordes, con manchas sueltas de humedad.
float scrollEdge = min(min(vScrollUv.x, 1.0 - vScrollUv.x), min(vScrollUv.y, 1.0 - vScrollUv.y) * 0.52);
float scrollAge = 1.0 - smoothstep(0.0, 0.09, scrollEdge + (scrollNoise(vScrollUv * vec2(9.0, 17.0)) - 0.5) * 0.035);
diffuseColor.rgb = mix(diffuseColor.rgb, uScrollAged, scrollAge * 0.75);
float scrollSpots = smoothstep(0.74, 0.86, scrollNoise(vScrollUv * vec2(6.0, 11.0) + 3.7));
diffuseColor.rgb = mix(diffuseColor.rgb, uScrollStain, scrollSpots * 0.16);
diffuseColor.rgb *= 0.97 + 0.03 * scrollNoise(vScrollUv * vec2(160.0, 300.0));
// El mapa: tinta con su transparencia, algo absorbida por el papel.
// La textura llega con flipY: su parte de arriba está en v = 1.
vec4 scrollInk = texture2D(uMap, vec2(vScrollUv.x, 1.0 - vScrollUv.y));
scrollInk.rgb = mix(scrollInk.rgb, diffuseColor.rgb, 0.12);
diffuseColor.rgb = mix(diffuseColor.rgb, scrollInk.rgb, scrollInk.a);`,
      );
  };
  material.customProgramCacheKey = () => 'kosatsu-kakejiku';
  return { material, uniforms };
}

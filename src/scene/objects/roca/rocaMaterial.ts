import { Color, type MeshStandardMaterial } from 'three';

import { createDecorMaterial } from '@/scene/decor/materials';

export interface RocaColors {
  readonly stone: string;
  readonly sun: string;
  readonly ink: string;
  readonly snow: string;
  readonly washi: string;
}

/**
 * La piedra y su pintura (Fase 5B): la esquina de `2.png` —el sol rojo detrás,
 * el Fuji de base oscura con su nieve, y el torii delante— pintada en la cara
 * de la roca, en el shader.
 *
 * Las formas son funciones de distancia en la cara (`aFace.xy`, en unidades:
 * ±1,9 de ancho, ±1,4 de alto). Para que se lea como pintura sobre piedra y no
 * como una pegatina:
 *
 *   · **pincel seco** en los bordes: el ruido deshilacha el contorno;
 *   · **la pintura cede** donde la piedra se tuerce (`aFace.w`, cuánto mira al
 *     frente) y en las motas del grano;
 *   · **mate**: donde hay pintura, la superficie es más rugosa.
 *
 * Es el material de la decoración (luz, sombras, niebla y la mirada de cartel)
 * con la pintura encadenada después.
 */
export function createRocaMaterial(colors: RocaColors): MeshStandardMaterial {
  const material = createDecorMaterial({
    key: 'roca-pintada',
    color: colors.stone,
    washi: colors.washi,
    ink: colors.ink,
    roughness: 0.88,
  });
  const base = material.onBeforeCompile;
  const uniforms = {
    uPaintSun: { value: new Color(colors.sun) },
    uPaintInk: { value: new Color(colors.ink) },
    uPaintSnow: { value: new Color(colors.snow) },
  };
  material.onBeforeCompile = (shader, renderer) => {
    base.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aFace;\nvarying vec4 vFace;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFace = aFace;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uPaintSun;
uniform vec3 uPaintInk;
uniform vec3 uPaintSnow;
varying vec4 vFace;
float rocaHash(vec2 q) { return fract(sin(dot(q, vec2(91.7, 53.3))) * 24634.6); }
float rocaNoise(vec2 q) {
  vec2 cell = floor(q);
  vec2 f = fract(q);
  vec2 s = f * f * (3.0 - 2.0 * f);
  return mix(mix(rocaHash(cell), rocaHash(cell + vec2(1.0, 0.0)), s.x),
             mix(rocaHash(cell + vec2(0.0, 1.0)), rocaHash(cell + vec2(1.0, 1.0)), s.x), s.y);
}
float rocaBox(vec2 q, vec2 center, vec2 halfSize) {
  vec2 d = abs(q - center) - halfSize;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
// Cubre (1) donde la forma es negativa, con el borde de pincel seco.
float rocaCover(float shape, float brush) {
  return 1.0 - smoothstep(-0.012, 0.012, shape + brush);
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec2 face = vFace.xy;
float brush = (rocaNoise(face * 9.0) - 0.5) * 0.07 + (rocaNoise(face * 31.0) - 0.5) * 0.025;
// La pintura cede donde la piedra se tuerce y en las motas del grano.
float hold = smoothstep(0.25, 0.75, vFace.w) * smoothstep(0.18, 0.4, rocaNoise(face * 14.0 + 7.0) + 0.25);

// El sol, detrás.
float sun = length(face - vec2(0.1, 0.24)) - 0.86;
// El Fuji: la cima un poco plana, las laderas cóncavas.
float slopeX = max(abs(face.x - 0.06) - 0.14, 0.0);
float fuji = face.y - (-0.12 - 0.62 * slopeX - 0.1 * slopeX * slopeX);
float snowLine = -0.5 + sin(face.x * 23.0) * 0.045 + sin(face.x * 9.0 + 1.3) * 0.03;
float snow = max(fuji, snowLine - face.y);
// El torii: dos pilares, el nuki y el kasagi con las puntas levantadas.
float pillars = min(rocaBox(face, vec2(-0.86, -0.42), vec2(0.085, 1.02)), rocaBox(face, vec2(0.98, -0.42), vec2(0.085, 1.02)));
float nuki = rocaBox(face, vec2(0.06, 0.34), vec2(1.24, 0.07));
float span = abs(face.x - 0.06) / 1.42;
float kasagiY = 0.72 + pow(min(span, 1.0), 3.0) * 0.12;
float kasagi = max(abs(face.y - kasagiY) - 0.085, abs(face.x - 0.06) - 1.42);
float shimaki = rocaBox(face, vec2(0.06, 0.6), vec2(1.2, 0.045));
float torii = min(min(pillars, nuki), min(kasagi, shimaki));

vec3 painted = diffuseColor.rgb;
float paint = 0.0;
float layer = rocaCover(sun, brush) * hold;
painted = mix(painted, uPaintSun, layer);
paint = max(paint, layer);
layer = rocaCover(fuji, brush) * hold;
painted = mix(painted, uPaintInk * 1.6, layer);
paint = max(paint, layer);
layer = rocaCover(snow, brush * 0.6) * hold;
painted = mix(painted, uPaintSnow, layer);
layer = rocaCover(torii, brush * 0.5) * hold;
painted = mix(painted, uPaintInk, layer);
paint = max(paint, layer);
diffuseColor.rgb = painted;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.97, paint);`,
      );
  };
  material.customProgramCacheKey = () => 'decor-roca-pintada';
  return material;
}

/**
 * El viento en los vértices de lo que se mece: cañas, hojas y arbustos.
 *
 * Tres capas: la **flexión** (uBend, el muelle de sway.ts, ya integrado en la
 * CPU), que dobla la planta como una ménsula —el desplazamiento crece con el
 * cuadrado de la altura y la caña baja un poco para no estirarse—; un
 * **balanceo fino** de frecuencia fija y amplitud según la fuerza del viento;
 * y, en las hojas, un **aleteo** sobre su nervio.
 *
 * Se aplica **después** de la matriz de instancia, en el espacio del objeto
 * (el del mundo para los macizos, que no se mueven), así que la flexión va en
 * la dirección del viento aunque cada instancia esté girada.
 *
 * Atributo aSway, por vértice o por instancia: x = y de la base, y = alto,
 * z = fase, w = muelle (índice en uBend).
 */

import { SPRINGS } from '@/scene/systems/sway';

const PARS = /* glsl */ `
uniform vec2 uBend[${SPRINGS.length}];
uniform float uSwayTime;
uniform float uSwayStrength;
attribute vec4 aSway;

vec3 swayOffset(vec3 p) {
  float swayHeight = max(aSway.y, 0.01);
  float h = clamp((p.y - aSway.x) / swayHeight, 0.0, 1.0);
  float k = h * h * swayHeight;
  vec2 bend = uBend[int(aSway.w + 0.5)];
  float wobble = sin(uSwayTime * (1.6 + fract(aSway.z * 7.31) * 0.9) + aSway.z * 6.2831853);
  vec2 fine = vec2(wobble, wobble * 0.4) * 0.03 * uSwayStrength;
  vec3 swayed = vec3(bend.x + fine.x, 0.0, bend.y + fine.y) * k;
  swayed.y -= dot(swayed.xz, swayed.xz) / (2.0 * swayHeight);
  return swayed;
}
`;

const FLUTTER = /* glsl */ `
// Aleteo: la hoja gira sobre su nervio, más hacia la punta.
transformed.z += sin(uSwayTime * 9.0 + aSway.z * 17.0 + position.y * 3.0) * 0.18 * position.y * (0.25 + uSwayStrength);
`;

const PROJECT = /* glsl */ `
vec4 mvPosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition.xyz += swayOffset(mvPosition.xyz);
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
`;

/** Añade el viento a un vertex shader de MeshStandardMaterial o MeshDepthMaterial. */
export function withWindSway(vertexShader: string, flutter: boolean): string {
  let out = vertexShader.replace('#include <common>', `#include <common>\n${PARS}`);
  if (flutter) out = out.replace('#include <begin_vertex>', `#include <begin_vertex>\n${FLUTTER}`);
  return out.replace('#include <project_vertex>', PROJECT);
}

/**
 * El viento en los vértices de lo que se mece: cañas, hojas y arbustos.
 *
 * Tres capas: la **flexión** (uBend, el muelle de sway.ts, ya integrado en la
 * CPU), que dobla la planta como una ménsula —el desplazamiento crece con el
 * cuadrado de la altura y la caña baja un poco para no estirarse—; un
 * **balanceo fino** de frecuencia fija y amplitud según la fuerza del viento;
 * y, en las hojas, un **planeo**.
 *
 * El planeo sustituye al aleteo de la primera versión, que la revisión
 * rechazó: «parecen mariposas». La hoja se deformaba a lo largo de su normal
 * a 1,4 Hz y todas las de una caña con la misma fase, así que los ramilletes
 * batían a la vez. Ahora la hoja **no se dobla**: gira entera sobre su
 * peciolo —torsión lenta sobre el nervio y un cabeceo menor, con fase propia—
 * y, con viento, **se tiende hacia sotavento** siguiendo la flexión de su
 * caña, como una hoja larga que se deja llevar.
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

/**
 * El planeo de la hoja, en su espacio (base en el origen, punta hacia +y,
 * lámina en el plano XY). La fase sale de la propia matriz de instancia:
 * cada hoja la suya, aunque compartan caña.
 */
const LEAF_PARS = /* glsl */ `
vec3 leafTurn(vec3 v) {
  #ifdef USE_INSTANCING
    float leafSeed = fract(sin(dot(instanceMatrix[0].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  #else
    float leafSeed = aSway.z;
  #endif
  float leafRate = 1.9 + leafSeed * 1.4;
  float leafAmp = 0.1 + 0.28 * uSwayStrength;
  float twist = sin(uSwayTime * leafRate + leafSeed * 6.2831853) * leafAmp * 1.5;
  float pitch = sin(uSwayTime * leafRate * 0.71 + leafSeed * 11.0) * leafAmp * 0.45;
  float ct = cos(twist);
  float st = sin(twist);
  v.xz = mat2(ct, -st, st, ct) * v.xz;
  float cp = cos(pitch);
  float sp = sin(pitch);
  v.yz = mat2(cp, -sp, sp, cp) * v.yz;
  return v;
}

// Con viento la hoja se tiende hacia donde se dobla su caña: gira sobre su
// base sin cambiar de largo. Los rebotes del muelle la llevan y la traen.
vec3 leafStream(vec3 v) {
  vec2 bend = uBend[int(aSway.w + 0.5)];
  float push = length(bend);
  if (push < 0.0001) return v;
  float len = length(v);
  vec3 lee = vec3(bend.x, 0.0, bend.y) / push;
  float lean = min(push * 5.0, 0.65);
  return normalize(v + lee * len * lean + vec3(0.0, 0.00001, 0.0)) * len;
}
`;

const LEAF_NORMAL = /* glsl */ `
objectNormal = leafTurn(objectNormal);
`;

const LEAF_VERTEX = /* glsl */ `
transformed = leafTurn(transformed);
`;

const LEAF_STREAM = /* glsl */ `
#ifdef USE_INSTANCING
  vec3 leafBase = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  mvPosition.xyz = leafBase + leafStream(mvPosition.xyz - leafBase);
#endif
`;

function project(leaf: boolean): string {
  return /* glsl */ `
vec4 mvPosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
${leaf ? LEAF_STREAM : ''}
mvPosition.xyz += swayOffset(mvPosition.xyz);
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
`;
}

/** Añade el viento a un vertex shader de MeshStandardMaterial o MeshDepthMaterial. */
export function withWindSway(vertexShader: string, leaf: boolean): string {
  let out = vertexShader.replace('#include <common>', `#include <common>\n${PARS}${leaf ? LEAF_PARS : ''}`);
  if (leaf) {
    out = out
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${LEAF_NORMAL}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${LEAF_VERTEX}`);
  }
  return out.replace('#include <project_vertex>', project(leaf));
}

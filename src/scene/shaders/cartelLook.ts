import { Color, type IUniform } from 'three';

/**
 * La «mirada de cartel», compartida por todo lo que se dibuja en la escena con
 * volumen: la fauna (Fase 2C) y la decoración (Fase 4).
 *
 * Son dos gestos: un 5 % de washi en el color —el objeto toma la luz del papel
 * sin apagar el suyo— y un filo de tinta en la silueta, donde la superficie se
 * pone de canto respecto de la cámara. Es el contorno de una pincelada, sin
 * segunda pasada ni malla de silueta. Viven aquí para que un torii y una garza
 * se vean del mismo mundo.
 *
 * Se inyecta con onBeforeCompile sobre un MeshStandardMaterial.
 */

export function cartelUniforms(washi: string, ink: string, rim = 0.42): Record<string, IUniform> {
  return {
    uWashi: { value: new Color(washi) },
    uInk: { value: new Color(ink) },
    uRim: { value: rim },
  };
}

const PARS = /* glsl */ `
uniform vec3 uWashi;
uniform vec3 uInk;
uniform float uRim;
`;

const TINT = /* glsl */ `
// Un 5 % de washi: el objeto toma la luz del papel sin apagar su color.
diffuseColor.rgb = mix(diffuseColor.rgb, uWashi, 0.05);
`;

const RIM = /* glsl */ `
// Filo de tinta: donde la superficie se pone de canto respecto de la cámara,
// la luz se oscurece hacia el sumi.
float cartelRim = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
outgoingLight = mix(outgoingLight, uInk, smoothstep(0.6, 0.97, cartelRim) * uRim);
`;

/**
 * Añade la mirada de cartel a un fragment shader de MeshStandardMaterial.
 * Deja intactas las líneas include que reemplaza, así que otro material puede
 * inyectar código después en los mismos puntos: lo suyo queda entre el
 * include y el tinte.
 */
export function withCartelLook(fragmentShader: string): string {
  return fragmentShader
    .replace('#include <common>', `#include <common>\n${PARS}`)
    .replace('#include <color_fragment>', `#include <color_fragment>\n${TINT}`)
    .replace('#include <opaque_fragment>', `${RIM}\n#include <opaque_fragment>`);
}

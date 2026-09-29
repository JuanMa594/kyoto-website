import { Color, MeshStandardMaterial, type IUniform } from 'three';

/**
 * Deformación por regiones: cómo se anima un modelo que no tiene esqueleto.
 *
 * Los modelos de la fauna llegan como **una sola malla congelada en una pose**:
 * la ardilla es una escultura en cuatro patas, sin cola ni patas como piezas
 * aparte. Moverla entera la haría deslizarse como una figurita. En vez de
 * riggearla, el vertex shader dobla **regiones** de la malla alrededor de su
 * articulación —la cola desde la grupa, cada pata desde la cadera, el cuello
 * desde el pecho, las alas desde el hombro— con los ángulos que la propia
 * conducta ya calcula cada frame. Es la técnica de siempre para animar mallas
 * sin huesos, la misma con la que se hace nadar a un banco de peces.
 *
 * Todo trabaja en el **espacio normalizado** que produce `bun run models`: el
 * morro en x = +0,5, la cola en x = −0,5, los pies en y = 0. Por eso las
 * regiones de cada especie (`DeformProfile`) se pueden escribir como números
 * sencillos, leídos sobre una rejilla, y valen igual para cualquier tamaño en
 * pantalla.
 *
 * Los pesos se calculan siempre sobre la **pose de reposo**, no sobre la ya
 * deformada: así una región no arrastra a la siguiente y el orden de los pasos
 * no cambia el resultado.
 *
 * El material es uno por individuo —cada uno tiene su propia zancada— pero
 * todos comparten el mismo programa de GPU (`customProgramCacheKey`): lo que
 * cambia entre ellos son uniforms, no código.
 */

/** Las regiones de una especie, en unidades del modelo normalizado. */
export interface DeformProfile {
  /** Altura de la cadera: por debajo, patas. */
  readonly hipY: number;
  /** x que separa patas delanteras de traseras (sólo cuadrúpedos). */
  readonly splitX: number;
  /** x por detrás de la cual ya no hay patas (plumas o cola que cuelgan bajo). */
  readonly legMinX: number;
  /**
   * Cómo se coordinan las patas:
   *   · `paso`   — ave caminando: izquierda contra derecha (garza).
   *   · `brinco` — ave pequeña: las dos a la vez, a saltitos (gorrión).
   *   · `trote`  — cuadrúpedo al paso: diagonales en fase (gato, tanuki).
   *   · `galope` — cuadrúpedo que salta: delanteras contra traseras, con el
   *     cuerpo en arco (ardilla).
   */
  readonly gait: 'paso' | 'brinco' | 'trote' | 'galope';
  /** Amplitud máxima de la zancada, en radianes. */
  readonly legSwing: number;
  /** Largo de un paso o de un salto, en largos de cuerpo. */
  readonly stride: number;
  /**
   * Altura de cada brinco, en largos de cuerpo. En `galope` y `brinco` es lo que
   * de verdad se ve: a su tamaño en pantalla, las patas de una ardilla o de un
   * gorrión son dos píxeles, pero el cuerpo saltando se lee desde lejos.
   */
  readonly hop: number;
  /**
   * Para quien trota al paso y galopa al correr (el gato): entre `from` y `to`
   * cuerpos por segundo pasa del trote al galope deslizando el desfase de las
   * patas —sin saltos— y alargando la zancada hasta `stride`; `hop` es su
   * brinco al galope.
   */
  readonly run?: { readonly from: number; readonly to: number; readonly stride: number; readonly hop: number };

  /** Cola: de dónde a dónde, y por encima de qué altura (para no llevarse las patas). */
  readonly tail?: {
    readonly baseX: number;
    readonly tipX: number;
    readonly minY: number;
    readonly pivotY: number;
    /**
     * Segunda articulación, a media cola, para colas que **cambian de forma** y
     * no sólo de ángulo: la de la ardilla va enroscada en «?» cuando se para y
     * estirada detrás cuando corre. Girar la cola entera desde la base no la
     * estira nunca —sólo la sube o la baja—; para desenroscarla, la base tiene
     * que ir hacia atrás y la mitad final doblarse al revés.
     *
     * `x, y` es el codo; el peso crece con la **distancia a la base** entre
     * `from` y `to`, porque la cola sube vertical desde la grupa y la x no
     * recorre su largo.
     */
    readonly curl?: { readonly x: number; readonly y: number; readonly from: number; readonly to: number };
  };

  /** Cuello: base, dirección en la que crece el peso y alcance. */
  readonly neck?: { readonly baseX: number; readonly baseY: number; readonly dirX: number; readonly dirY: number; readonly reach: number };

  /** Cadera sobre la que se yergue (ardilla sentándose). */
  readonly sit?: { readonly hipX: number; readonly hipY: number };

  /** Alas: desde qué |z| hasta cuál, a qué altura del hombro y en qué caja. */
  readonly wings?: {
    /**
     * `planeo`: alas extendidas que respiran, con una tanda de aletazos lentos
     * cada tanto (milano). `batido`: aletazos sólo en el aire, a ráfagas
     * (gorrión). `zumbido`: batido continuo y rápido, siempre en el aire
     * (libélula).
     */
    readonly style: 'planeo' | 'batido' | 'zumbido';
    /** Batidos por segundo. */
    readonly beat: number;
    readonly rootZ: number;
    readonly tipZ: number;
    readonly shoulderY: number;
    readonly minX: number;
    readonly maxX: number;
    readonly minY: number;
    readonly maxY: number;
  };

  /**
   * Posturas de un cuadrúpedo parado (el gato): cuánto se inclina el cuerpo,
   * cuánto baja y cuánto giran delanteras y traseras en cada una. Radianes y
   * largos de cuerpo. Se calibran como las regiones: con los pies en el suelo.
   */
  readonly postures?: {
    /** Sentado: el lomo se levanta, las manos quedan verticales, las patas se pliegan. */
    readonly sitTilt: number;
    readonly sitDrop: number;
    readonly sitFold: number;
    /** Echado: manos al frente, patas recogidas bajo el vientre. */
    readonly lieFront: number;
    readonly lieHind: number;
    readonly lieDrop: number;
    /** Desperezo, primer tiempo: manos estiradas al frente y el pecho al suelo. */
    readonly reachFront: number;
    readonly reachTilt: number;
    readonly reachDrop: number;
    /** Segundo tiempo: las patas traseras estiradas hacia atrás. */
    readonly kickHind: number;
    readonly kickTilt: number;
    readonly kickDrop: number;
  };

  /** Altura del centro de giro del cuerpo entero (alabeo y cabeceo). */
  readonly pivotY: number;
}

/** Lo que cambia cada frame. Todo en radianes salvo la fase y la recogida. */
export interface DeformPose {
  stridePhase: number;
  legAmplitude: number;
  /** 0 de pie, 1 patas recogidas (vuelo). */
  tuck: number;
  /**
   * Ángulo fijo que se suma a las delanteras y a las traseras, por encima de la
   * zancada: sentarse, echarse o desperezarse. Positivo, hacia delante.
   */
  legFront: number;
  legHind: number;
  /** 0 su marcha propia, 1 galope (ver `DeformProfile.run`). */
  gallop: number;
  tailSwing: number;
  tailLift: number;
  tailRoll: number;
  /** Giro de la mitad final de la cola sobre su codo (sólo con `tail.curl`). */
  tailCurl: number;
  neckPitch: number;
  neckYaw: number;
  sit: number;
  wingLift: number;
}

export function createDeformPose(): DeformPose {
  return {
    stridePhase: 0,
    legAmplitude: 0,
    tuck: 0,
    legFront: 0,
    legHind: 0,
    gallop: 0,
    tailSwing: 0,
    tailLift: 0,
    tailRoll: 0,
    tailCurl: 0,
    neckPitch: 0,
    neckYaw: 0,
    sit: 0,
    wingLift: 0,
  };
}

/** Una región que no existe en la especie se "apaga" poniéndola fuera del modelo. */
const NOWHERE = -10;

const GAIT_CODE: Record<DeformProfile['gait'], number> = {
  paso: 1,
  trote: 2,
  galope: 3,
  brinco: 4,
};

const VERTEX_HEADER = /* glsl */ `
  uniform vec4 uLegs;      // cadera y, x que separa, amplitud, x mínima
  uniform vec4 uGait;      // fase, recogida, marcha (1 paso, 2 trote, 3 galope, 4 brinco), cuánto galopa
  uniform vec4 uLegRest;   // ángulo fijo de las delanteras, de las traseras, -, -
  uniform vec4 uTail;      // x base, x punta, y mínima, y del pivote
  uniform vec4 uTailPose;  // vaivén, elevación, giro, doblez de la punta
  uniform vec4 uTailCurl;  // codo x, codo y, distancia a la base donde empieza y acaba el doblez
  uniform vec4 uNeck;      // base x, base y, dirección x, dirección y
  uniform vec4 uNeckPose;  // alcance, cabeceo, giro, -
  uniform vec4 uSit;       // cadera x, cadera y, ángulo, -
  uniform vec4 uWings;     // |z| raíz, |z| punta, y del hombro, elevación
  uniform vec4 uWingBox;   // x mín, x máx, y mín, y máx

  // Rampa suave que, a diferencia de smoothstep, admite a > b: la cola crece
  // hacia x negativas, y smoothstep con los bordes invertidos no está definido.
  float faunaRamp(float a, float b, float x) {
    float t = clamp((x - a) / (b - a), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
  }

  vec3 faunaRotX(vec3 v, float a) {
    float c = cos(a); float s = sin(a);
    return vec3(v.x, c * v.y - s * v.z, s * v.y + c * v.z);
  }
  vec3 faunaRotY(vec3 v, float a) {
    float c = cos(a); float s = sin(a);
    return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
  }
  vec3 faunaRotZ(vec3 v, float a) {
    float c = cos(a); float s = sin(a);
    return vec3(c * v.x - s * v.y, s * v.x + c * v.y, v.z);
  }

  void faunaDeform(inout vec3 p, inout vec3 n) {
    vec3 rest = p;

    // Patas: cada una gira desde su cadera, con el desfase que pide su marcha.
    // En vuelo se recogen hacia atrás.
    float legW = (1.0 - smoothstep(uLegs.x - 0.05, uLegs.x, rest.y)) * step(uLegs.w, rest.x);
    if (legW > 0.0) {
      float front = step(uLegs.y, rest.x);
      float left = step(0.0, rest.z);
      float offset = 0.0;
      if (uGait.z < 1.5) offset = left * 3.14159265;                         // paso
      else if (uGait.z < 2.5) offset = mod(front + left, 2.0) * 3.14159265;  // trote
      else if (uGait.z < 3.5) offset = (1.0 - front) * 3.14159265;           // galope
      // brinco: todas a la vez, desfase cero
      // Quien trota y se lanza a correr desliza el desfase hacia el del galope
      // poco a poco: las patas se reacomodan en unos pasos, sin saltar.
      offset = mix(offset, (1.0 - front) * 3.14159265, uGait.w);
      float swing = sin(uGait.x + offset) * uLegs.z;
      // Ojo con el nombre: rest es la pose de reposo del vértice, y taparla
      // aquí deja el shader sin compilar (y sin fauna).
      float restAngle = front > 0.5 ? uLegRest.x : uLegRest.y;
      float a = (mix(swing, -1.25, uGait.y) + restAngle) * legW;
      vec3 pivot = vec3(rest.x, uLegs.x, rest.z);
      p = pivot + faunaRotZ(p - pivot, a);
      n = faunaRotZ(n, a);
    }

    // Erguirse: la mitad delantera rota sobre la cadera, patas incluidas.
    float sitW = smoothstep(uSit.x - 0.06, uSit.x + 0.14, rest.x);
    if (sitW > 0.0 && uSit.z != 0.0) {
      vec3 pivot = vec3(uSit.x, uSit.y, 0.0);
      p = pivot + faunaRotZ(p - pivot, uSit.z * sitW);
      n = faunaRotZ(n, uSit.z * sitW);
    }

    // Cola: el peso crece de la base a la punta, así que no gira como una
    // tabla sino que se curva.
    float tailW = faunaRamp(uTail.x, uTail.y, rest.x) * step(uTail.z, rest.y);
    if (tailW > 0.0) {
      // Primero la punta sobre su codo, luego la cola entera desde la base: el
      // orden de una cadena de huesos. Así la base se lleva el codo consigo.
      float curlW = faunaRamp(uTailCurl.z, uTailCurl.w, distance(rest.xy, uTail.xw));
      if (curlW > 0.0 && uTailPose.w != 0.0) {
        vec3 knee = vec3(uTailCurl.xy, 0.0);
        p = knee + faunaRotZ(p - knee, uTailPose.w * curlW);
        n = faunaRotZ(n, uTailPose.w * curlW);
      }
      vec3 pivot = vec3(uTail.x, uTail.w, 0.0);
      vec3 q = p - pivot;
      q = faunaRotY(q, uTailPose.x * tailW);
      q = faunaRotZ(q, uTailPose.y * tailW);
      q = faunaRotX(q, uTailPose.z * tailW);
      p = pivot + q;
      n = faunaRotX(faunaRotZ(faunaRotY(n, uTailPose.x * tailW), uTailPose.y * tailW), uTailPose.z * tailW);
    }

    // Cuello y cabeza: el peso crece a lo largo del cuello, de la base a la
    // cabeza. Picotear, olfatear y mirar alrededor salen de aquí.
    float along = dot(rest.xy - uNeck.xy, uNeck.zw);
    float neckW = uNeckPose.x > 0.0 ? faunaRamp(0.0, uNeckPose.x, along) : 0.0;
    if (neckW > 0.0) {
      vec3 pivot = vec3(uNeck.x, uNeck.y, 0.0);
      vec3 q = p - pivot;
      q = faunaRotZ(q, uNeckPose.y * neckW);
      q = faunaRotY(q, uNeckPose.z * neckW);
      p = pivot + q;
      n = faunaRotY(faunaRotZ(n, uNeckPose.y * neckW), uNeckPose.z * neckW);
    }

    // Alas: giran sobre el hombro alrededor del eje del cuerpo. Las dos a la
    // vez y en espejo, así que el signo depende del lado.
    float side = rest.z >= 0.0 ? 1.0 : -1.0;
    float wingW = faunaRamp(uWings.x, uWings.y, abs(rest.z))
      * step(uWingBox.x, rest.x) * step(rest.x, uWingBox.y)
      * step(uWingBox.z, rest.y) * step(rest.y, uWingBox.w);
    if (wingW > 0.0) {
      float a = -uWings.w * wingW * side;
      vec3 pivot = vec3(rest.x, uWings.z, side * uWings.x);
      p = pivot + faunaRotX(p - pivot, a);
      n = faunaRotX(n, a);
    }
  }
`;

type Uniforms = Record<string, IUniform>;

export interface DeformMaterial {
  material: MeshStandardMaterial;
  uniforms: Uniforms;
}

export interface DeformLook {
  /** Fondo washi: la piel se tiñe un poco de él para no recortarse del cartel. */
  washi: string;
  /** Tinta: el contorno de la silueta, como una pincelada. */
  ink: string;
  /**
   * Para modelos que llegan sin color (la libélula): la escena los pinta desde
   * la paleta. El pipeline marca las alas con alfa < 1 en el color de vértice;
   * lo opaco toma `body` y lo translúcido `wing`.
   */
  paint?: { body: string; wing: string };
}

/**
 * El material de un individuo: su color es el que se horneó en los vértices, y
 * encima lleva dos gestos de cartel —un tinte leve hacia el washi y un filo de
 * tinta en la silueta— para que el animal pertenezca al dibujo en vez de
 * parecer recortado de una foto.
 */
export function createDeformMaterial(profile: DeformProfile, look: DeformLook): DeformMaterial {
  const uniforms: Uniforms = {
    uLegs: { value: [profile.hipY, profile.splitX, 0, profile.legMinX] },
    uGait: { value: [0, 0, GAIT_CODE[profile.gait], 0] },
    uLegRest: { value: [0, 0, 0, 0] },
    uTail: {
      value: profile.tail
        ? [profile.tail.baseX, profile.tail.tipX, profile.tail.minY, profile.tail.pivotY]
        : [NOWHERE, NOWHERE - 1, NOWHERE, 0],
    },
    uTailPose: { value: [0, 0, 0, 0] },
    uTailCurl: {
      value: profile.tail?.curl
        ? [profile.tail.curl.x, profile.tail.curl.y, profile.tail.curl.from, profile.tail.curl.to]
        : [0, 0, -NOWHERE, -NOWHERE + 1],
    },
    uNeck: {
      value: profile.neck
        ? [profile.neck.baseX, profile.neck.baseY, profile.neck.dirX, profile.neck.dirY]
        : [0, 0, 1, 0],
    },
    uNeckPose: { value: [profile.neck?.reach ?? 0, 0, 0, 0] },
    uSit: { value: profile.sit ? [profile.sit.hipX, profile.sit.hipY, 0, 0] : [-NOWHERE, 0, 0, 0] },
    uWings: {
      value: profile.wings
        ? [profile.wings.rootZ, profile.wings.tipZ, profile.wings.shoulderY, 0]
        : [-NOWHERE, -NOWHERE + 1, 0, 0],
    },
    uWingBox: {
      value: profile.wings
        ? [profile.wings.minX, profile.wings.maxX, profile.wings.minY, profile.wings.maxY]
        : [0, 0, 0, 0],
    },
    uWashi: { value: new Color(look.washi) },
    uInk: { value: new Color(look.ink) },
    uPaint: { value: look.paint ? 1 : 0 },
    uPaintBody: { value: new Color(look.paint?.body ?? '#ffffff') },
    uPaintWing: { value: new Color(look.paint?.wing ?? '#ffffff') },
  };

  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0,
    // Con alas translúcidas, el material tiene que mezclar. El alfa lo trae el
    // propio color de vértice: el cuerpo sigue opaco.
    transparent: Boolean(look.paint),
  });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_HEADER}`)
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        vec3 faunaPosition = vec3(position);
        faunaDeform(faunaPosition, objectNormal);`,
      )
      .replace('#include <begin_vertex>', 'vec3 transformed = faunaPosition;');

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uWashi;
        uniform vec3 uInk;
        uniform float uPaint;
        uniform vec3 uPaintBody;
        uniform vec3 uPaintWing;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // Modelo sin color propio: lo opaco es cuerpo, lo translúcido es ala.
        if (uPaint > 0.5) {
          diffuseColor.rgb = diffuseColor.a > 0.99 ? uPaintBody : uPaintWing;
        }
        // Un 10 % de washi en la piel: el animal toma la luz del papel.
        diffuseColor.rgb = mix(diffuseColor.rgb, uWashi, 0.1);`,
      )
      .replace(
        '#include <opaque_fragment>',
        `// Filo de tinta: donde la superficie se pone de canto respecto de la
        // cámara, la luz se oscurece hacia el sumi. Es el contorno de una
        // pincelada, sin segunda pasada ni malla de silueta.
        float faunaRim = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        outgoingLight = mix(outgoingLight, uInk, smoothstep(0.6, 0.97, faunaRim) * 0.42);
        #include <opaque_fragment>`,
      );
  };

  // Todos los individuos comparten programa: lo que los distingue son uniforms.
  material.customProgramCacheKey = () => 'fauna-deform-v4';

  return { material, uniforms };
}

/** Vuelca la pose de este frame en los uniforms. */
export function applyDeformPose(uniforms: Uniforms, pose: DeformPose, profile: DeformProfile): void {
  const legs = uniforms.uLegs!.value as number[];
  legs[2] = pose.legAmplitude;

  const gait = uniforms.uGait!.value as number[];
  gait[0] = pose.stridePhase;
  gait[1] = pose.tuck;
  gait[3] = pose.gallop;

  const legRest = uniforms.uLegRest!.value as number[];
  legRest[0] = pose.legFront;
  legRest[1] = pose.legHind;

  const tail = uniforms.uTailPose!.value as number[];
  tail[0] = pose.tailSwing;
  tail[1] = pose.tailLift;
  tail[2] = pose.tailRoll;
  tail[3] = pose.tailCurl;

  const neck = uniforms.uNeckPose!.value as number[];
  neck[0] = profile.neck?.reach ?? 0;
  neck[1] = pose.neckPitch;
  neck[2] = pose.neckYaw;

  const sit = uniforms.uSit!.value as number[];
  sit[2] = pose.sit;

  const wings = uniforms.uWings!.value as number[];
  wings[3] = pose.wingLift;
}

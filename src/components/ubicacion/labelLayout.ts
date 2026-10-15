/**
 * Dónde va cada nombre sobre la maqueta (Fase 5A), sin que se pisen. Módulo
 * puro: lo usa `PrefectureLabels` en cada frame y lo comprueba `check:path`.
 *
 * Fuera del zoom (`layoutLabels`), cada etiqueta prueba una lista fija de
 * sitios alrededor de su punto —abajo, arriba, a los lados, en diagonal y,
 * después, más lejos— y se queda con el primero que no pisa a las ya colocadas
 * ni a los obstáculos (el pin y la flecha del cursor). Si no cabe en ninguno,
 * el que menos pisa. Las de los sitios lejanos llevan una línea de tinta hasta
 * su punto, como en los mapas antiguos. Para que no salten de un sitio a otro,
 * cada etiqueta prueba primero el sitio que tenía (`previous`).
 *
 * En el zoom, las de Kinki se apiñan —Ōsaka y Nara caen casi encima— y con
 * sitios sueltos una línea acababa cruzando la etiqueta de otra: van en corro
 * alrededor del grupo (`ringLayout`).
 */

export interface LabelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LabelBox {
  /** El punto de la prefectura, en px. */
  readonly ax: number;
  readonly ay: number;
  /** El tamaño de la etiqueta, en px. */
  readonly w: number;
  readonly h: number;
}

export interface PlacedLabel {
  /** Esquina superior izquierda, en px. */
  readonly x: number;
  readonly y: number;
  /** Qué sitio de la lista ocupa. */
  readonly slot: number;
  /** Si va lejos de su punto y necesita la línea. */
  readonly leader: boolean;
}

/** Separación entre el punto y la etiqueta, en px. */
const GAP = 6;
/** Lo que se aleja una etiqueta de los sitios lejanos. */
const FAR = 34;
/** Desde este sitio de la lista, la etiqueta lleva línea. */
const LEADER_FROM = 8;

/** El segundo anillo, aún más lejos, para cuando el corro es muy apretado. */
const FARTHER = 72;

/** Los ocho sitios lejanos a una distancia: en cruz y en diagonal. */
function ring(distance: number): ((w: number, h: number) => [number, number])[] {
  const diagonal = distance * 0.7;
  return [
    (w) => [-w / 2, GAP + distance],
    (w, h) => [-w / 2, -h - GAP - distance],
    (_, h) => [GAP + distance, -h / 2],
    (w, h) => [-w - GAP - distance, -h / 2],
    () => [GAP + diagonal, GAP + diagonal],
    (w) => [-w - GAP - diagonal, GAP + diagonal],
    (_, h) => [GAP + diagonal, -h - GAP - diagonal],
    (w, h) => [-w - GAP - diagonal, -h - GAP - diagonal],
  ];
}

/** Los sitios, como esquina superior izquierda relativa al punto. */
const SLOTS: readonly ((w: number, h: number) => [number, number])[] = [
  (w) => [-w / 2, GAP], // abajo
  (w, h) => [-w / 2, -h - GAP], // arriba
  (_, h) => [GAP + 4, -h / 2], // derecha
  (w, h) => [-w - GAP - 4, -h / 2], // izquierda
  () => [GAP, GAP], // abajo a la derecha
  (w) => [-w - GAP, GAP], // abajo a la izquierda
  (_, h) => [GAP, -h - GAP], // arriba a la derecha
  (w, h) => [-w - GAP, -h - GAP], // arriba a la izquierda
  // Lejos, y más lejos aún: éstas llevan línea.
  ...ring(FAR),
  ...ring(FARTHER),
];

/**
 * Lo que ocupa la flecha del cursor del sistema desde su punta (x, y), en px:
 * baja y se abre hacia la derecha. Con margen.
 */
export function cursorRect(x: number, y: number): LabelRect {
  return { x: x - 2, y: y - 2, w: 20, h: 26 };
}

/**
 * El punto del que cuelga la etiqueta de la prefectura bajo el cursor: el
 * cursor mismo, por debajo de su flecha. Colgada del centro de la prefectura,
 * la flecha —que suele estar justo ahí— tapaba el nombre.
 */
export function cursorAnchor(x: number, y: number): { ax: number; ay: number } {
  const arrow = cursorRect(x, y);
  return { ax: x, ay: arrow.y + arrow.h };
}

function overlapArea(a: LabelRect, b: LabelRect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Coloca las etiquetas en el orden dado (la primera, la que manda: la que está
 * bajo el cursor). `obstacles` no se pisan; `previous`, el sitio que tenía cada
 * una en el frame anterior (−1 si ninguno).
 */
export function layoutLabels(
  items: readonly LabelBox[],
  obstacles: readonly LabelRect[],
  previous: readonly number[],
): PlacedLabel[] {
  const taken: LabelRect[] = [...obstacles];
  const placed: PlacedLabel[] = [];
  const rect: LabelRect = { x: 0, y: 0, w: 0, h: 0 };

  items.forEach((item, index) => {
    const before = previous[index] ?? -1;
    const order = before >= 0 ? [before, ...SLOTS.keys()] : [...SLOTS.keys()];
    let best = { slot: 0, cost: Number.POSITIVE_INFINITY };
    for (const slot of order) {
      const [dx, dy] = SLOTS[slot]!(item.w, item.h);
      rect.x = item.ax + dx;
      rect.y = item.ay + dy;
      rect.w = item.w;
      rect.h = item.h;
      const cost = taken.reduce((sum, other) => sum + overlapArea(rect, other), 0);
      if (cost < best.cost) best = { slot, cost };
      if (cost === 0) break;
    }
    const [dx, dy] = SLOTS[best.slot]!(item.w, item.h);
    const x = item.ax + dx;
    const y = item.ay + dy;
    taken.push({ x, y, w: item.w, h: item.h });
    placed.push({ x, y, slot: best.slot, leader: best.slot >= LEADER_FROM });
  });

  return placed;
}

/* ── El zoom: un anillo alrededor de Kinki ─────────────────────────────── */

/** Lo que se separa el anillo del punto más alejado del grupo (o del pin), en px. */
const RING_GAP = 26;
/** Cuánto más lejos va una de cada dos etiquetas, en fracción del radio. */
const RING_STAGGER = 0.16;
/** Lo que se aparta cada una, por su cuenta, en fracción del radio (±). */
const RING_JITTER = 0.05;
/** La separación de las que van junto a su prefectura (`near`), en px. */
const RING_NEAR = 14;
/** Lo mínimo que se separa una etiqueta de su punto, al acercarla, en px. */
const RING_MIN = 10;
/** Separación mínima entre etiquetas, y margen dentro del marco, en px. */
const RING_PAD = 4;
const FRAME_MARGIN = 6;
/**
 * Dos etiquetas a menos de esto de lado no comparten altura: a la misma
 * altura y tan cerca se leen como una fila (Wakayama y Nara), en px.
 */
const RING_LEVEL_GAP = 96;
/** Lo que se abren dos que se estorban, en radianes, en cada vuelta. */
const RING_PUSH = 0.012;
const RING_ROUNDS = 240;

export interface RingItem extends LabelBox {
  /** Fija la variación propia de la etiqueta: la misma en cada frame. */
  readonly seed: number;
  /**
   * Un retoque a ojo: radianes que se gira el rayo de la etiqueta (en la
   * ventana, con la y hacia abajo: positivo, en el sentido del reloj).
   */
  readonly turn?: number;
  /**
   * Un rumbo fijo en vez del rayo desde el centro (radianes, como `turn`; 0 =
   * a la derecha, π/2 = abajo). Para la que tiene su punto casi en el centro
   * del grupo, donde el rayo no apunta a ningún sitio y cambia con un píxel.
   */
  readonly aim?: number;
  /** Junto a su prefectura en vez de en el corro. */
  readonly near?: boolean;
}

/** Un polígono convexo en px de la ventana: la cara de la bandeja. */
export type LabelFrame = readonly (readonly [number, number])[];

function overlapsPadded(a: LabelRect, b: LabelRect, pad: number): boolean {
  return a.x - pad < b.x + b.w && b.x - pad < a.x + a.w && a.y - pad < b.y + b.h && b.y - pad < a.y + a.h;
}

/** Si dos etiquetas cercanas de lado comparten altura (`RING_LEVEL_GAP`). */
export function sameLevel(a: LabelRect, b: LabelRect): boolean {
  const apart = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w));
  return apart < RING_LEVEL_GAP && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** El punto del rectángulo más cercano a (x, y): donde acaba la línea. */
export function nearestOnRect(r: LabelRect, x: number, y: number): [number, number] {
  return [Math.min(Math.max(x, r.x), r.x + r.w), Math.min(Math.max(y, r.y), r.y + r.h)];
}

/** Si el segmento cruza el rectángulo (Liang–Barsky). */
export function segmentHitsRect(x1: number, y1: number, x2: number, y2: number, r: LabelRect): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, x1 - r.x],
    [dx, r.x + r.w - x1],
    [-dy, y1 - r.y],
    [dy, r.y + r.h - y1],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return true;
}

/** Si dos segmentos se cruzan (sin contar que se toquen en un extremo). */
export function segmentsCross(a: readonly number[], b: readonly number[]): boolean {
  const side = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
    (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const d1 = side(a[0]!, a[1]!, a[2]!, a[3]!, b[0]!, b[1]!);
  const d2 = side(a[0]!, a[1]!, a[2]!, a[3]!, b[2]!, b[3]!);
  const d3 = side(b[0]!, b[1]!, b[2]!, b[3]!, a[0]!, a[1]!);
  const d4 = side(b[0]!, b[1]!, b[2]!, b[3]!, a[2]!, a[3]!);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/**
 * Cuánto se sale el rectángulo del marco (0 = dentro, con su margen): la suma
 * de lo que asoma cada esquina por cada lado.
 */
export function frameExcess(r: LabelRect, frame: LabelFrame, margin = FRAME_MARGIN): number {
  let area = 0;
  for (let k = 0; k < frame.length; k += 1) {
    const [x1, y1] = frame[k]!;
    const [x2, y2] = frame[(k + 1) % frame.length]!;
    area += x1 * y2 - x2 * y1;
  }
  const orientation = Math.sign(area) || 1;
  let excess = 0;
  for (let k = 0; k < frame.length; k += 1) {
    const [x1, y1] = frame[k]!;
    const [x2, y2] = frame[(k + 1) % frame.length]!;
    const length = Math.hypot(x2 - x1, y2 - y1) || 1;
    for (const [px, py] of [
      [r.x, r.y],
      [r.x + r.w, r.y],
      [r.x, r.y + r.h],
      [r.x + r.w, r.y + r.h],
    ] as const) {
      // Distancia con signo al lado, positiva hacia dentro.
      const inside = (orientation * ((x2 - x1) * (py - y1) - (y2 - y1) * (px - x1))) / length;
      excess += Math.max(0, margin - inside);
    }
  }
  return excess;
}

/** Un número fijo en −1…1 para cada semilla. */
function signedHash(seed: number): number {
  const s = Math.sin(seed * 12.9898 + 4.1414) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/**
 * Los nombres del zoom, en corro alrededor del grupo (revisión de la 5A). Cada
 * uno va por el rayo que sale del centro del grupo y pasa por su prefectura,
 * fuera del grupo y del pin: como las líneas salen de un mismo centro, ni se
 * cruzan ni pasan por encima de otra etiqueta. Para que el corro no sea un
 * compás, una de cada dos (en el orden del giro) va algo más lejos y cada una
 * se aparta un poco por su cuenta (`seed`); y alguna lleva un retoque a ojo
 * (`turn`, `near`).
 *
 * Con `frame`, ninguna sale de la bandeja: la que asoma se acerca a su
 * prefectura y, si no basta, gira hacia dentro. Si dos aún se estorban —o una
 * línea pisa una etiqueta u otra línea—, se abren en ángulo; si una pisa un
 * obstáculo, se aleja.
 *
 * Sólo depende de los puntos: con el mapa quieto, el corro también lo está.
 */
export function ringLayout(
  items: readonly RingItem[],
  obstacles: readonly LabelRect[],
  frame?: LabelFrame,
): PlacedLabel[] {
  const count = items.length;
  if (count === 0) return [];

  let cx = 0;
  let cy = 0;
  for (const item of items) {
    cx += item.ax / count;
    cy += item.ay / count;
  }
  let reach = 0;
  for (const item of items) reach = Math.max(reach, Math.hypot(item.ax - cx, item.ay - cy));
  for (const o of obstacles) {
    for (const [x, y] of [
      [o.x, o.y],
      [o.x + o.w, o.y],
      [o.x, o.y + o.h],
      [o.x + o.w, o.y + o.h],
    ] as const) {
      reach = Math.max(reach, Math.hypot(x - cx, y - cy));
    }
  }
  const base = reach + RING_GAP;

  // El radio se mide desde el centro del grupo o, en las `near`, desde su punto.
  const ray = items.map((item) => Math.atan2(item.ay - cy, item.ax - cx));
  const angle = items.map((item, i) => (item.aim ?? ray[i]!) + (item.turn ?? 0));
  const radius = new Array<number>(count).fill(base);
  const least = items.map((item) => (item.near ? RING_MIN : Math.hypot(item.ax - cx, item.ay - cy) + RING_MIN));
  [...items.keys()]
    .sort((a, b) => angle[a]! - angle[b]!)
    .forEach((i, k) => {
      radius[i] = items[i]!.near
        ? RING_NEAR
        : base * (1 + (k % 2 === 1 ? RING_STAGGER : 0) + RING_JITTER * signedHash(items[i]!.seed));
    });

  const rects: LabelRect[] = items.map(() => ({ x: 0, y: 0, w: 0, h: 0 }));
  const place = (i: number) => {
    const item = items[i]!;
    const dx = Math.cos(angle[i]!);
    const dy = Math.sin(angle[i]!);
    const ox = item.near ? item.ax : cx;
    const oy = item.near ? item.ay : cy;
    // El borde de dentro de la etiqueta, en su radio.
    const d = radius[i]! + Math.abs(dx) * (item.w / 2) + Math.abs(dy) * (item.h / 2);
    const r = rects[i]!;
    r.x = ox + dx * d - item.w / 2;
    r.y = oy + dy * d - item.h / 2;
    r.w = item.w;
    r.h = item.h;
  };
  // Dentro de la bandeja: primero más cerca de su punto; si no basta, girando
  // hacia donde menos asoma.
  const fit = (i: number) => {
    if (!frame) return;
    for (let step = 0; step < 80; step += 1) {
      const excess = frameExcess(rects[i]!, frame);
      if (excess === 0) return;
      if (radius[i]! - 3 >= least[i]!) {
        radius[i] = radius[i]! - 3;
        place(i);
        continue;
      }
      const from = angle[i]!;
      angle[i] = from + 0.03;
      place(i);
      const clockwise = frameExcess(rects[i]!, frame);
      angle[i] = from - 0.03;
      place(i);
      if (clockwise < frameExcess(rects[i]!, frame)) {
        angle[i] = from + 0.03;
        place(i);
      }
    }
  };
  const line = (i: number) => {
    const item = items[i]!;
    return [item.ax, item.ay, ...nearestOnRect(rects[i]!, item.ax, item.ay)] as const;
  };
  const lineHits = (i: number, r: LabelRect) => {
    const [x1, y1, x2, y2] = line(i);
    return segmentHitsRect(x1, y1, x2, y2, r);
  };

  for (let i = 0; i < count; i += 1) {
    place(i);
    fit(i);
  }
  // El orden de partida alrededor del grupo, medido desde su centro para todas
  // (las `near` giran sobre su punto: sus ángulos no se comparan con los de
  // las demás). Dos que se estorban se abren siempre según este orden, así que
  // nunca se cruzan ni intercambian el sitio.
  const order = rects.map((r) => Math.atan2(r.y + r.h / 2 - cy, r.x + r.w / 2 - cx));
  for (let round = 0; round < RING_ROUNDS; round += 1) {
    let clean = true;
    for (let i = 0; i < count; i += 1) {
      for (let j = i + 1; j < count; j += 1) {
        if (
          !overlapsPadded(rects[i]!, rects[j]!, RING_PAD) &&
          !sameLevel(rects[i]!, rects[j]!) &&
          !lineHits(i, rects[j]!) &&
          !lineHits(j, rects[i]!) &&
          !segmentsCross(line(i), line(j))
        ) {
          continue;
        }
        // Se abren en ángulo, cada una hacia su lado.
        const gap = Math.atan2(Math.sin(order[j]! - order[i]!), Math.cos(order[j]! - order[i]!));
        const side = gap >= 0 ? 1 : -1;
        angle[i] = angle[i]! - side * RING_PUSH;
        angle[j] = angle[j]! + side * RING_PUSH;
        place(i);
        place(j);
        fit(i);
        fit(j);
        clean = false;
      }
      for (const o of obstacles) {
        if (!overlapsPadded(rects[i]!, o, RING_PAD)) continue;
        radius[i] = radius[i]! + 3;
        place(i);
        clean = false;
      }
    }
    if (clean) break;
  }

  return rects.map((r) => ({ x: r.x, y: r.y, slot: -1, leader: true }));
}

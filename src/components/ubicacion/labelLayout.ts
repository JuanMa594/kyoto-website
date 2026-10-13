/**
 * Dónde va cada nombre sobre la maqueta (Fase 5A), sin que se pisen. Módulo
 * puro: lo usa `PrefectureLabels` en cada frame y lo comprueba `check:path`.
 *
 * En el zoom, las siete de Kinki se apiñan: Ōsaka y Nara caen casi encima.
 * Cada etiqueta prueba una lista fija de sitios alrededor de su punto —abajo,
 * arriba, a los lados, en diagonal y, después, más lejos— y se queda con el
 * primero que no pisa a las ya colocadas ni a los obstáculos (el pin). Si no
 * cabe en ninguno, el que menos pisa. Las de los sitios lejanos llevan una
 * línea de tinta hasta su punto, como en los mapas antiguos.
 *
 * Para que no salten de un sitio a otro mientras el mapa crece, cada etiqueta
 * prueba primero el sitio que tenía (`previous`).
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

/**
 * La greca de `6.png` (Fase 6A), calculada: el adorno de esquina de las
 * tarjetas de lectura de los lugares. **No es un SVG dibujado**: es un trazo
 * que sale de esta cuenta —el raimon, la greca de rayos, la misma que pinta el
 * shader de los nobori—.
 *
 * Una línea entra por arriba desde la izquierda, se enrosca en tres espirales
 * cuadradas a lo largo del borde de arriba, dobla la esquina y baja por el
 * borde derecho en otras tres. En un `viewBox` de `GRECA_SIZE` de lado.
 */

/** El lado del `viewBox` y el de cada espiral. */
export const GRECA_SIZE = 120;
const UNIT = 17;
/** Lo que se separa del borde. */
const INSET = 5;

/** La espiral de una celda, en unidades de celda (x a lo largo del borde, y hacia dentro). */
const SPIRAL: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.88, 0],
  [0.88, 0.82],
  [0.28, 0.82],
  [0.28, 0.3],
  [0.62, 0.3],
  [0.62, 0.56],
];

const round = (value: number) => Math.round(value * 10) / 10;

/** El `d` de la greca de esquina. */
export function grecaPath(): string {
  const parts: string[] = [];
  const top = INSET;
  const right = GRECA_SIZE - INSET;
  const runEnd = right - 3 * UNIT;
  // La línea que entra por arriba.
  parts.push(`M0 ${top} L${runEnd} ${top}`);
  // Tres espirales a lo largo del borde de arriba, hacia la esquina.
  for (let k = 0; k < 3; k += 1) {
    const x0 = runEnd + k * UNIT;
    parts.push(
      SPIRAL.map(([u, v], i) => `${i === 0 ? 'M' : 'L'}${round(x0 + u * UNIT)} ${round(top + v * UNIT)}`).join(' '),
    );
  }
  // Y tres bajando por el borde derecho: la celda girada, hacia dentro (−x).
  for (let k = 0; k < 3; k += 1) {
    const y0 = top + UNIT + k * UNIT;
    parts.push(
      SPIRAL.map(([u, v], i) => `${i === 0 ? 'M' : 'L'}${round(right - v * UNIT)} ${round(y0 + u * UNIT)}`).join(' '),
    );
  }
  // La línea que sale por abajo, por el borde derecho.
  parts.push(`M${right} ${top + 4 * UNIT} L${right} ${GRECA_SIZE}`);
  return parts.join(' ');
}

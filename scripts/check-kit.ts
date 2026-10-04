/**
 * Lo que comparten los scripts de comprobación: secciones, comprobaciones y el
 * resumen final. Sin dependencias: corre con bun, fuera del navegador.
 */

const failures: string[] = [];

export function section(title: string): void {
  console.log(`\n— ${title}`);
}

export function check(name: string, ok: boolean, detail = ''): void {
  const suffix = detail ? ` (${detail})` : '';
  console.log(`${ok ? '✓' : '✗'} ${name}${suffix}`);
  if (!ok) failures.push(name);
}

export function range(from: number, to: number, step: number): number[] {
  const values: number[] = [];
  for (let value = from; value <= to + 1e-9; value += step) values.push(value);
  return values;
}

/** Cierra el script: sale con error si algo falló. */
export function finish(success: string): void {
  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} comprobación(es) fallaron.`);
    process.exit(1);
  }
  console.log(`\n✓ ${success}`);
}

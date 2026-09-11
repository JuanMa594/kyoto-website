/**
 * `subset-font` no publica tipos. Declaramos sólo lo que usamos, que es la
 * firma entera de su export por defecto.
 */
declare module 'subset-font' {
  export interface SubsetOptions {
    targetFormat?: 'sfnt' | 'woff' | 'woff2';
    /** IDs de la tabla `name` que se conservan (0 copyright, 13 licencia, 14 URL). */
    preserveNameIds?: number[];
    variationAxes?: Record<string, number | { min: number; max: number; default: number }>;
  }

  export default function subsetFont(
    font: Buffer | Uint8Array,
    text: string,
    options?: SubsetOptions,
  ): Promise<Buffer>;
}

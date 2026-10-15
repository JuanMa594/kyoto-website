/**
 * El abanico móvil y el historial (Fase 3C), en puro.
 *
 * Al abrir el abanico se apila una entrada con la misma URL, para que «atrás»
 * lo cierre. Al elegir una estación hay tres casos:
 *
 *   · la estación en la que ya se está → `dismiss`: se cierra y se consume la
 *     entrada con `history.back()`. Navegar a la misma URL con
 *     `router.replace` dejaría el historial en [… A, A] y el siguiente «atrás»
 *     no haría nada;
 *   · otra, con la entrada del abanico arriba → `replace`: la de destino la
 *     sustituye y el historial queda como tras una navegación normal;
 *   · otra, sin esa entrada (no llegó a apilarse) → `push`.
 */

export type FanPickAction = 'dismiss' | 'replace' | 'push';

export function fanPickAction(index: number, currentIndex: number, fanEntryOnTop: boolean): FanPickAction {
  if (index === currentIndex) return 'dismiss';
  return fanEntryOnTop ? 'replace' : 'push';
}

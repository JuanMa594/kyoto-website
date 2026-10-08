/**
 * Flechas, Inicio y Fin dentro de una lista de enlaces de navegación (el riel o
 * el abanico), sin dar la vuelta al llegar al final. Devuelve `true` si la
 * tecla era suya: quien llama hace entonces `preventDefault`, para que la
 * flecha no camine además el tramo. Fuera de la navegación las flechas siguen
 * siendo del scroll.
 *
 * Las cuatro flechas valen en los dos: en el riel se lee de arriba abajo y en
 * el abanico de izquierda a derecha, y el orden del DOM es el del camino.
 */
export function moveFocus(key: string, links: readonly HTMLElement[]): boolean {
  const index = links.indexOf(document.activeElement as HTMLElement);
  if (index < 0) return false;

  const last = links.length - 1;
  let target = -1;
  if (key === 'ArrowDown' || key === 'ArrowRight') target = Math.min(last, index + 1);
  else if (key === 'ArrowUp' || key === 'ArrowLeft') target = Math.max(0, index - 1);
  else if (key === 'Home') target = 0;
  else if (key === 'End') target = last;
  if (target < 0) return false;

  links[target]?.focus();
  return true;
}

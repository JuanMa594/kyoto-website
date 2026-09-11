import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

/**
 * Envoltorios de `next/link` y `next/navigation` que conservan el idioma
 * activo. Usar siempre estos, nunca los de Next directamente: de lo contrario
 * un enlace saca a la persona del camino y del idioma.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);

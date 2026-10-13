'use client';

import { useKyotoStore } from '@/store/useKyotoStore';

interface KyotoFichaProps {
  label: string;
  items: readonly { readonly label: string; readonly value: string }[];
}

/**
 * La ficha de Kyoto (Fase 5A): datos sueltos que aparecen con el zoom. La
 * región viva está siempre en el DOM para que el lector de pantalla anuncie
 * la ficha al aparecer; el contenido sólo con el zoom, así que sin JS no se
 * ve nunca (el cartel ya se lee entero sin ella).
 */
export function KyotoFicha({ label, items }: KyotoFichaProps) {
  const zoomed = useKyotoStore((state) => state.mapZoom === 'kyoto');

  return (
    <div className="kyoto-ficha-live" aria-live="polite">
      {zoomed && (
        <dl className="kyoto-ficha paper" aria-label={label}>
          {items.map((item) => (
            <div key={item.label} className="kyoto-ficha__row">
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

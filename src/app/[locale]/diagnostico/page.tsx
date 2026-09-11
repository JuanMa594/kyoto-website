import { DiagnosticsPanel } from '@/components/ui/DiagnosticsPanel';
import { staticLocale } from '@/i18n/params';

/**
 * Página de instrumentos de la Fase 1. Sirve para verificar de un vistazo que
 * la detección de calidad, el override manual, el reduced-motion, el modo 静 y
 * el desbloqueo de audio funcionan de verdad.
 */

export const metadata = {
  title: 'Diagnóstico',
  robots: { index: false, follow: false },
};

export default async function DiagnosticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await staticLocale(params);

  return (
    <main id="contenido" className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-4xl">Diagnóstico</h1>
      <p className="mt-3 max-w-prose opacity-70">
        Estado real del store y del perfil de calidad detectado en este equipo. Cambia
        la calidad o activa el modo 静 y comprueba que la escena de atrás responde.
      </p>

      <div className="mt-10">
        <DiagnosticsPanel />
      </div>
    </main>
  );
}

import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { MotionEngine } from '@/animation/MotionEngine';
import { AmbientAudio } from '@/audio/AmbientAudio';
import { EnvironmentProbe } from '@/components/EnvironmentProbe';
import { JourneyNav } from '@/components/nav/JourneyNav';
import { AmbientControls } from '@/components/ui/AmbientControls';
import { staticLocale } from '@/i18n/params';
import { routing } from '@/i18n/routing';
import { SceneRoot } from '@/scene/SceneRoot';
import { fontVariables } from '@/styles/fonts';

import '@/styles/globals.css';

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

/** Export estático: ambos idiomas se generan en build, no bajo demanda. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Omit<LocaleLayoutProps, 'children'>) {
  const locale = await staticLocale(params);
  const t = await getTranslations({ locale, namespace: 'meta' });

  return {
    // Cada estación pone su nombre y la plantilla añade el sitio: «Ubicación ·
    // Kyoto». La Home comparte segmento con este layout, así que la plantilla
    // no le aplica y se queda con el título completo (Fase 3C).
    title: { template: '%s · Kyoto', default: t('title') },
    description: t('description'),
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const locale = await staticLocale(params);
  const messages = await getMessages();
  const t = await getTranslations({ locale, namespace: 'ui' });

  return (
    <html lang={locale} className={fontVariables}>
      <body>
        <a className="skip-link" href="#contenido">
          {t('skipToContent')}
        </a>

        <NextIntlClientProvider locale={locale} messages={messages}>
          {/* Puente navegador ↔ store: calidad, reduced-motion, cursor, audio. */}
          <EnvironmentProbe />

          {/* GSAP + Lenis bajo un solo reloj. Se apaga entero con el modo 静. */}
          <MotionEngine />

          {/* Ambiente sonoro sintetizado. Nunca suena antes de un gesto. */}
          <AmbientAudio />

          {/* La escena vive aquí, en el layout, y no se desmonta al cambiar de
              ruta. Es lo que permite que pasar de una sección a otra sea un
              desplazamiento por el camino y no un corte. */}
          <SceneRoot />

          {/* La navegación: persistente como la escena, y antes del contenido
              en el orden de tabulación (después del «saltar al contenido»). */}
          <JourneyNav />

          {children}

          {/* Los tres mandos —sonido, 静 e idioma— en la esquina del escritorio. */}
          <AmbientControls variant="corner" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

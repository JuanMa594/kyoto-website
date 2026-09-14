import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { MotionEngine } from '@/animation/MotionEngine';
import { EnvironmentProbe } from '@/components/EnvironmentProbe';
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
    title: t('title'),
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

          {/* La escena vive aquí, en el layout, y no se desmonta al cambiar de
              ruta. Es lo que permite que pasar de una sección a otra sea un
              desplazamiento por el camino y no un corte. */}
          <SceneRoot />

          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

'use client';

import type { Station } from '@/config/journey';
import type { ScenePalette } from '@/lib/css-vars';
import type { QualityProfile } from '@/scene/quality/tiers';
import { Atmosphere, Sun } from '@/scene/systems/Atmosphere';
import { FaunaDirector } from '@/scene/systems/fauna/FaunaDirector';
import { PetalZones } from '@/scene/systems/PetalSystem';
import { StonePath } from '@/scene/systems/StonePath';
import { Terrain } from '@/scene/systems/Terrain';

/**
 * El mundo del camino.
 *
 * Desde la Fase 3A es **un solo mundo continuo**: el terreno, las piedras y el
 * aire cubren el recorrido entero y se transforman de una estación a la
 * siguiente por los pesos de zona de `scene/path/journeyPath.ts`. La cámara
 * viaja por él (`camera/CameraRig.tsx`); nada se reconstruye al cambiar de
 * ruta.
 *
 * `station` es la **zona** en la que está la cámara, no la de la ruta: decide
 * qué fauna puede salir.
 *
 * **Composición (regla de tercios)**, en el encuadre local de la cámara:
 *   · el tercio inferior es del camino de piedras,
 *   · el medio, del texto y de la base de los objetos,
 *   · el superior queda despejado para copas, hojas al viento y aves.
 * El relieve sale siempre a los costados del eje del camino (`elevation.ts`).
 */

interface FoundationSceneProps {
  station: Station;
  palette: ScenePalette;
  profile: QualityProfile;
}

export function FoundationScene({ station, palette, profile }: FoundationSceneProps) {
  return (
    <>
      <Atmosphere palette={palette} profile={profile} />

      <hemisphereLight args={[palette.washi, palette.ishiDeep, 1.5]} />
      <Sun palette={palette} profile={profile} />

      <Terrain palette={palette} profile={profile} />
      <StonePath color={palette.ishi} profile={profile} />

      {/* Lo que cae del cielo en cada zona —sakura en eventos, momiji en los
          templos, hojas de bambú en la home—, fundido entre estaciones.
          Cruza por delante y por detrás del sujeto: es la capa que da la
          profundidad. */}
      <PetalZones palette={palette} />

      {/* La vida del cuadro: quién sale lo decide el director a partir de las
          especies de la zona en la que está la cámara. */}
      <FaunaDirector station={station} palette={palette} profile={profile} />
    </>
  );
}

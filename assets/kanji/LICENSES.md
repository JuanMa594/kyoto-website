# Trazos de kanji — procedencia y licencia

Los SVG de `source/` son de **KanjiVG** (https://kanjivg.tagaini.net),
© Ulrich Apel, con licencia **Creative Commons Attribution-Share Alike 3.0**
(http://creativecommons.org/licenses/by-sa/3.0/).

`bun run kanji` los descarga (sólo los kanji de las estaciones de `journey.ts`)
y genera `src/components/kanji/strokes.generated.ts`, que es una obra derivada:
se distribuye con la misma licencia, CC BY-SA 3.0. El resto del sitio no queda
afectado por el «compartir igual».

Uso: los trazos no se ven. Son la máscara a través de la cual aparece, pincelada
a pincelada, el glifo de Zen Old Mincho (`<InkKanji>`, Fase 4).

**Atribución obligatoria**: entra en la sección de créditos visibles de la Fase 9
(`docs/PLAN.md`, §11), junto a los modelos CC BY.

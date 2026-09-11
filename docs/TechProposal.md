## Tech Proposal
Aquí tienes una propuesta técnica y estratégica detallada organizada para guiarte a ti y a tu agente de programación:

---

### 1. Recomendación de Stack Tecnológico

Para lograr un sitio súper interactivo, dinámico y con animaciones fluidas sin sacrificar el rendimiento, esta es la combinación ideal:

* **Lenguaje:** **TypeScript** (Fundamental para estructurar los datos del blog, componentes de animaciones y props de forma segura).
* **Framework:** **Next.js (App Router)** o **Astro**:
* **Astro:** Es la opción más rápida e ideal para un sitio web/blog interactivo centrado en contenido e imágenes, ya que carga 0 KB de JavaScript por defecto y solo hidrata las partes interactivas.
* **Next.js:** Si planeas añadir funciones avanzadas como comentarios, cuentas de usuario o integración con bases de datos en tiempo real.


* **Librerías de Animación e Interacción:**
* **GSAP + ScrollTrigger:** *La herramienta clave.* Te permitirá vincular el desplazamiento (scroll) con la navegación por el camino (*stepping stones* de las imágenes '3' y '4'), mover la cámara a lo largo del trayecto y orquestar elementos con física real o secuencias complejas.
* **Framer Motion:** Excelente para transiciones de UI entre páginas y animaciones suaves de entrada/salida para el menú/sidebar.
* **Three.js / React Three Fiber (R3F) / Spline:** Para los objetos 3D interactivos (como el Torii, la linterna de papel o las garzas volar en un entorno 3D sutil en segundo plano). **Spline** es especialmente útil si quieres diseñar los objetos 3D de forma visual y exportarlos fácilmente con animaciones e interactividad directas para el código.
* **Lottie-React:** Para ilustraciones vectoriales animadas (como bambú moviéndose con el viento, pétalos cayendo en bucle, o las garzas caminando de fondo) con un peso súper ligero.
* **Canvas Confetti / PIXI.js:** Para partículas en 2D en primer plano (pétalos de Sakura flotando por la pantalla, simulación de viento).



---

### 2. Paleta de Colores Inspirada en tus Diseños

A partir del fondo beige suave (*cream*) y los acentos rojo vermellón (*Shu-iro*) de los Torii y el verde bambú de tus imágenes, te sugiero la siguiente paleta de colores CSS / Tailwind:

| Color | Tono / Nombre | Uso Principal |
| --- | --- | --- |
| **Fondo Base** | Warm Cream (`#FBF6E2` o `#FFFDF0`) | El fondo suave presente en tus capturas para no cansar la vista. |
| **Primario (Tradición)** | Vermilion / Torii Red (`#D9381E` / `#C82323`) | Títulos principales, resaltados, Torii, sol naciente. |
| **Secundario (Sakura)** | Soft Cherry Blossom (`#FFC5D3` / `#F3A8B7`) | Secciones de Sakura, detalles florales, efectos al pasar el cursor. |
| **Acento Vegetal** | Bamboo / Matcha Green (`#556B2F` / `#3E5C39`) | Bambú, elementos de comida (Matcha/Ramen), acentos secundarios. |
| **Texto / Contraste** | Deep Charcoal / Ink Black (`#2B2B2B` o `#1A1A1A`) | Párrafos para lectura clara, simulando tinta Sumi-e. |

---

### 3. Ideas de Diseño e Interacción (UX / UI)

#### A. El Navegador / Sidebar Flotante (Basado en la Imagen '13')

* **Menú Radial / Circular Flotante:** Como las opciones de tu imagen '13' son circulares, al mover el cursor al lateral izquierdo o derecho, se desliza un panel de madera/bambú transparente donde cada ícono circular representa una sección:
* 🗾 **Mapa:** Ubicación (`Ichi`)
* ⛩️ **Lugares:** Torii / Santuarios
* 🌸 **Eventos:** Temporada de Sakura
* 🏮 **Festivales:** Noche y faroles
* 🍥 **Gastronomía:** Ramen y cultura culinaria


* **Efecto Hover:** Al pasar el cursor sobre cada círculo, este hace un pequeño pulso suave (efecto *spring animation*) y muestra el kanji en dorado/rojo.

#### B. Navegación por la Página (El Camino 'Stepping Stones')

* **Scroll-driven Path:** En lugar de una barra de scroll tradicional, al hacer scroll hacia abajo, la vista recorre el camino de piedras (*stepping stones* de la imagen '3').
* **Puntos de Interés:** Cada piedra puede tener un marcador interactivo que despliega una tarjeta de información (*Glassmorphism* o estilo papel arroz) con animaciones al llegar a esa zona.

#### C. Animaciones de Ambiente (*Micro-Interactions*)

* **Simulador de Viento y Hojas:** Utilizar una capa ligera de canvas donde pétalos de Sakura u hojas de bambú crucen suavemente la pantalla con dirección y velocidad aleatorias.
* **Fauna Animada:** Cada 20–30 segundos, una sombra o silueta en vector de garzas volando cruza diagonalmente la parte superior de la pantalla.
* **Audio Atmosférico (Opcional):** Un botón discreto en la esquina (con ícono de bambú o campana de viento *Fūrin*) para activar sonidos de fondo sutiles (viento suave, agua corriendo en un jardín Zen).

---

### 4. Guía y Especificaciones para tu Agente de Programación

Cuando trabajes con tu agente de programación (GitHub Copilot, Claude Code, Cursor, etc.), dale instrucciones claras con esta estructura de proyecto:

1. **Diseño Modular y Desempeño:**
* *"Utiliza componentes modulares de React. Aísla las animaciones pesadas en un Canvas separado para no bloquear la renderización del texto principal."*


2. **Tipografía Personalizada:**
* Cargar las fuentes `Goza Nazarashi` y `One Jinja` usando `next/font` o `@font-face` estándar con soporte para caracteres japoneses y formato `.woff2`.


3. **Manejo de Estado para la Navegación:**
* Utilizar un estado global ligero (como `Zustand`) para controlar en qué 'piedra' o sección del camino se encuentra el usuario y sincronizar el sidebar flotante.


4. **Accesibilidad y Dispositivos Móviles:**
* Implementar un flag `prefers-reduced-motion` en CSS/JS para desactivar o suavizar las animaciones en dispositivos con menos recursos o para usuarios sensibles a las animaciones.
* En móviles, el scroll del camino de piedras debe responder de forma natural al *swipe* vertical.
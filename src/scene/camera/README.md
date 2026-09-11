# `scene/camera` — rig de cámara

Vacío hasta la **Fase 2**.

Aquí van el parallax de cursor (amortiguado, máximo 2–4 % del viewport, rotación
≤ 2° con `lookAt` fijo al centro de interés) y, en la **Fase 3**, el rig que ata
el scroll al spline del camino con `ScrollTrigger` + `MotionPath`.

La cámara es siempre **observadora**: nunca entra en la escena.

# Plan de Hablemos

Al terminar cada fase: build, pruebas, commit, resumen en 5 líneas y esperar "continuar".

## Fase 1 — Base, tema, PWA, perfiles y puerta de adultos

- [x] Proyecto Vite + React + TypeScript + Vitest
- [x] PWA: manifiesto, íconos, service worker con precarga completa
- [x] Tema: tokens, letra redondeada empaquetada, foco visible, movimiento reducido
- [x] Guardas táctiles: zoom accidental, "pull to refresh", texto no seleccionable en juego
- [x] IndexedDB con `idb` y esquema versionado
- [x] Perfiles: crear, editar, eliminar, validar, calcular edad
- [x] Selector de perfil e inicio del niño
- [x] Puerta de adultos (mantener 3 s o suma) y zona de adultos
- [x] Pruebas de lógica y revisión en 768x1024 y 1024x768 (Chrome emulado; Safari real queda para la Fase 7)

## Fase 2 — Motor de actividades, voz, refuerzos y almacenamiento

- [x] Modelo de actividad, ítem y sesión; registro de actividades
- [x] Voz con `speechSynthesis`: selección es-419 > es-MX > es-US > es-EC, carga asíncrona, botón "🔊 repetir"
- [x] Refuerzos positivos: estrellas, animaciones, sonidos con Web Audio
- [x] Panel discreto del adulto con 3 estados de calificación
- [x] Sesión guiada de 3-4 actividades y celebración final
- [x] Guardar sesiones y resultados; eliminar un perfil borra también sus datos
- [x] Puntaje (1 / 0.5 / 0) y adaptación de nivel con pruebas

## Fase 3 — Actividades 1 a 4

- [x] 1 Escucha y señala
- [x] 2 Sigue la orden
- [x] 3 Conceptos
- [x] 4 Mini cuento

## Fase 4 — Actividades 5 a 7

- [x] 5 ¿Qué es esto?
- [x] 6 Categorías (arrastrar)
- [x] 7 Arma la frase

## Fase 5 — Actividades 8 a 11

- [x] 8 Praxias orofaciales
- [x] 9 Onomatopeyas y animales
- [x] 10 Palabras con fonema objetivo (listas de al menos 12 palabras por fonema)
- [x] 11 Discriminación auditiva, ritmo y sílabas

## Fase 6 — Evaluación, seguimiento, reportes y respaldo

- [x] Línea base guiada por áreas y nivel recomendado
- [x] Seguimiento por área y fonema, tendencia semanal, rachas
- [x] Reevaluación cada 4 semanas y comparación con la línea base
- [x] Gráficos SVG
- [x] Reporte imprimible por niño
- [x] Exportar e importar respaldo JSON
- [x] Nota de alcance y señales de alerta

## Fase 7 — Accesibilidad, pruebas, offline y despliegue

- [x] Auditoría ARIA, foco y movimiento reducido (axe-core en las 11 actividades y las pantallas de adultos; foco y título por pantalla)
- [x] Wake lock (con re-solicitud al volver a la pestaña y sin fallar si el navegador no lo soporta)
- [ ] Verificar guardas táctiles en dispositivo real (cubiertas con pruebas unitarias y emulación; **falta probar en una tablet/iPad real**)
- [x] Ampliar pruebas de puntaje, adaptación y almacenamiento (migraciones v1→v3 y v2→v3, persistencia, wake lock, guardas táctiles)
- [x] Verificar offline completo (servidor apagado, service worker), viewports 768x1024 / 1024x768 y teléfono 375x812 en Chrome emulado (**Safari/iPad real pendiente**)
- [x] Configuración de despliegue en GitHub Pages (`.github/workflows/deploy.yml`) y Netlify (`netlify.toml`, `public/_headers`)

## Fase 8 — Guía de uso y README

- [x] Pantalla "Guía para adultos" (`adultos/guia`, contenido en `src/content/guide.json`)
- [x] README: instalación, desarrollo, despliegue, "Agregar a pantalla de inicio" en Android/iPad

## Pendiente tras las 8 fases

- [ ] Probar en una **tablet Android y un iPad reales** (Safari): gestos táctiles y arrastre con el dedo, sonido y voces del sistema, instalación en pantalla de inicio, wake lock.
- [ ] Revisar con un fonoaudiólogo el contenido clínico: listas de fonemas por edad, señales de alerta, umbrales de nivel (80 % / 40 %) y de nivel recomendado (60 % / 75 %).
- [x] Publicado en GitHub Pages: <https://andespinozam.github.io/hablemos/> (la acción corrió las 278 pruebas en Linux/UTC y desplegó; service worker activo, sin violaciones de la política de seguridad). **Falta** probar el modo sin conexión y el wake lock en un dispositivo real: el navegador de pruebas rechazó el wake lock por no tener foco.
- [x] Precarga solo de las fuentes latinas (hecho: 21 → 18 archivos, 552 → 490 KiB)
- [x] Licencia MIT (archivo `LICENSE`)
- [ ] Probar la lógica de fechas en zonas con horario de verano y desfase positivo. En Windows, Node solo respeta `TZ=UTC`; el código no usa funciones UTC ni `Date` desde texto (auditado), pero conviene confirmarlo con `TZ=Pacific/Auckland npm test` en Linux/macOS o en la integración continua.

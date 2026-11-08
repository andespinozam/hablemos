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

- [ ] 8 Praxias orofaciales
- [ ] 9 Onomatopeyas y animales
- [ ] 10 Palabras con fonema objetivo (listas de al menos 12 palabras por fonema)
- [ ] 11 Discriminación auditiva, ritmo y sílabas

## Fase 6 — Evaluación, seguimiento, reportes y respaldo

- [ ] Línea base guiada por áreas y nivel recomendado
- [ ] Seguimiento por área y fonema, tendencia semanal, rachas
- [ ] Reevaluación cada 4 semanas y comparación con la línea base
- [ ] Gráficos SVG
- [ ] Reporte imprimible por niño
- [ ] Exportar e importar respaldo JSON
- [ ] Nota de alcance y señales de alerta

## Fase 7 — Accesibilidad, pruebas, offline y despliegue

- [ ] Auditoría ARIA, foco y movimiento reducido
- [ ] Wake lock
- [ ] Verificar guardas táctiles en dispositivo real
- [ ] Ampliar pruebas de puntaje, adaptación y almacenamiento
- [ ] Verificar offline completo, viewports de tablet y Chrome/Safari móvil
- [ ] Configuración de despliegue en GitHub Pages o Netlify

## Fase 8 — Guía de uso y README

- [ ] Pantalla "Guía para adultos"
- [ ] README: instalación, desarrollo, despliegue, "Agregar a pantalla de inicio" en Android/iPad

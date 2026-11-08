# Hablemos — guía del proyecto

PWA para estimular el lenguaje de niños de 3 a 5 años en **español latino**, usada en tablet con supervisión de un adulto. Avance por fases en [PLAN.md](PLAN.md).

## Forma de trabajo

- Trabajar **una fase a la vez**. Al terminar cada una: ejecutar build y pruebas, hacer commit, resumir en 5 líneas y **DETENERSE hasta recibir "continuar"**.
- Marcar las casillas de `PLAN.md` solo cuando lo hecho esté verificado.

## Stack y restricciones

- Vite + React + TypeScript (estricto), `vite-plugin-pwa` (offline completo), CSS propio, IndexedDB con `idb`, Vitest para la lógica.
- Sin backend, cuentas, analítica, anuncios ni llamadas de red en ejecución. Los datos viven solo en el dispositivo. Todo recurso (incluidas las fuentes) va empaquetado.
- `base: './'` y rutas por hash, para desplegar en GitHub Pages o Netlify en cualquier subruta.

## Comandos

```bash
npm run dev       # servidor de desarrollo (puerto 5173)
npm test          # Vitest una vez
npm run build     # tsc + vite build + service worker
npm run preview   # sirve dist/ (puerto 4173), para probar offline
npm run icons     # regenera los PNG de public/icons
```

## Convenciones

- **Código** (identificadores, archivos) en inglés. **Textos de interfaz, comentarios y documentación** en español latino, sin regionalismos poco comunes.
- `src/lib/`: lógica pura, sin React, con pruebas `*.test.ts` al lado. Fecha actual y aleatoriedad se reciben como parámetros para poder probarlas.
- `src/screens/`: pantallas. `src/components/`: piezas reutilizables. `src/content/`: contenido en JSON, **ampliable sin tocar código**.
- `src/styles/theme.css`: tokens de diseño. No escribir colores sueltos fuera de los tokens. Tamaño táctil mínimo: `var(--tap-min)` (72px).
- Fechas de nacimiento: cadena local `YYYY-MM-DD`; nunca `new Date('YYYY-MM-DD')`, que se interpreta en UTC y corre un día en Latinoamérica.
- Cambios de esquema en IndexedDB: subir `DB_VERSION` y agregar un bloque `if (oldVersion < N)` en `src/lib/db.ts`. Nunca editar los bloques anteriores.
- IDs con `newId()` (`src/lib/ids.ts`): `crypto.randomUUID` no existe en HTTP por LAN.

## UX para el niño (obligatorio)

- Horizontal y vertical. Zonas táctiles >= 72px. Letra grande y redondeada. Alto contraste. **Una sola tarea por pantalla.**
- **Retroalimentación solo positiva** (animaciones suaves, estrellas, sonidos agradables con Web Audio). Nunca sonidos de error ni pérdida de puntos. Si se equivoca, la app repite el modelo con calma y ofrece reintentar.
- Instrucciones habladas con `speechSynthesis` (preferir es-419, luego es-MX, es-US, es-EC; velocidad ~0.85; las voces cargan de forma asíncrona) y texto breve. Botón "🔊 repetir" siempre visible.
- Sesión guiada de 10-15 min: 3-4 actividades según el nivel; pantalla final de celebración. Sin pantallas de espera ni cronómetros visibles.
- Sin lectura obligatoria: todo se entiende con imágenes y voz. Imágenes: emojis y SVG originales; nada de personajes con derechos de autor.


## Motor de actividades (Fase 2)

- Cada actividad es un `Activity` (`src/activities/types.ts`) registrado en `src/activities/registry.ts`: `buildItems(level, count, rng)` devuelve ítems y `ItemView` los dibuja. Para agregar una actividad: archivo en `src/activities/`, contenido en `src/content/*.json` y una línea en el registro. El motor no se toca.
- `adultRated: true` → califica el adulto con su panel; `false` → la actividad llama `submit(rating)` por su cuenta.
- `SessionRunner` planifica 3-4 actividades (`lib/sessionPlan.ts`), dice las instrucciones, guarda cada resultado y adapta el nivel al terminar (`lib/progress.ts`, `lib/level.ts`). Solo adaptan las actividades con >= 3 ítems en la sesión.
- Si el adulto marca "Aún no": sin sonido ni mensaje de error; se repite el modelo a velocidad 0.7 y se ofrece "Otra vez" / "Seguir". Ese reintento no se califica. Cada ejercicio completado da una estrella; nunca se pierden.
- **No agregar sonidos de error** a `lib/sounds.ts`. El audio solo inicia tras un toque (`unlockAudio()` en "Jugar").
- Almacenes IndexedDB (v2): `profiles`, `sessions`, `results`, `levels`, con índice `byProfile`. `deleteProfile` borra también su progreso.
- Voz (`lib/speech.ts`): `speak()` nunca lanza ni espera para siempre; sin voz en español usa `lang es-419` del sistema.
- **Ids de actividad:** son permanentes (se guardan en sesiones y resultados). Nunca reutilizar ni renombrar uno; los informes deben tolerar ids que ya no existen (p. ej. `warmup`, una actividad provisional de la Fase 2).

## Actividades 1-4 (Fase 3)

- Ids: `escucha-senala`, `sigue-orden`, `conceptos`, `mini-cuento`. Todas califican solas (`adultRated: false`): acierto a la primera = "Lo logró"; acierto tras equivocarse = "Con ayuda". **Nunca producen "Aún no"**: equivocarse solo atenúa la opción, repite la instrucción con calma y, tras 2 errores, hace "latir" la correcta (`lib/choice.ts`, `components/ChoiceBoard.tsx`).
- Contenido en `src/content/`: `vocab.json` (con categorías, reutilizable por la actividad 6), `orders.json`, `concepts.json`, `stories.json`. `activities.test.ts` valida que cada ítem sea coherente (respuesta correcta entre las opciones, ids únicos, mínimo por categoría/nivel): al ampliar el JSON, correr `npm test`.
- Nivel 2: vocabulario con distractores de la misma categoría y 4 opciones; órdenes de 2 pasos (en cualquier orden); conceptos dentro/fuera y arriba/abajo (SVG en `components/Visuals.tsx`); cuentos de 3 páginas.
- Mini cuento: dos cuentos por sesión (`itemCount: 6`); cada pregunta es un ítem con su propio resultado y la 1.ª de cada cuento trae las páginas. Su `prompt` es la 1.ª página porque el motor dice `item.prompt` al abrir el ítem.
- `ItemView` se remonta por ítem (`key`), así que su estado local empieza limpio en cada ejercicio.
## Actividades 5-7 (Fase 4)

- Ids: `que-es-esto` (califica el adulto), `categorias` y `arma-frase` (califican solas).
- **¿Qué es esto?** (`naming.tsx`): 5 palabras de `vocab.json` repartidas entre categorías (`spreadBy`). "👂 Escucha" dice el modelo; si se usa, el adulto marca "Con ayuda". "Aún no" activa el reintento calmado del motor.
- **Categorías** (`sorting.tsx`, lógica en `lib/sorting.ts`): nivel 1 = 2 grupos y 4 objetos; nivel 2 = 3 grupos y 6; 3 rondas. Arrastre con eventos de puntero (`touch-action: none`) **y** respaldo de tocar objeto → tocar grupo (teclado/lector de pantalla). Soltar fuera de un grupo no cuenta como error. Tras 2 errores se resalta el siguiente objeto y su grupo. Sin errores = "Lo logró"; con errores = "Con ayuda". Las categorías y sus textos están en `categories.json` (deben coincidir con las de `vocab.json`; hay prueba).
- **Arma la frase** (`phrase.tsx`): fichas = palabra clave + emoji (sin artículos); `spoken` es la frase natural completa y la fichas deben aparecer en ella (hay prueba). Se arma ficha por ficha en orden; el orden mostrado nunca es el correcto (`shuffleTiles`). Al completar, la voz dice la frase y luego llega el elogio.
- Tamaño: en `.sorting` los objetos son compactos (`clamp(84px, 13vmin, 140px)`) para que 6 objetos + 3 grupos quepan sin desplazar en 1024x768 y 768x1024. Al agregar contenido más grande, medir `scrollHeight` vs `innerHeight`.
## Actividades 8-11 (Fase 5)

- Ids: `praxias`, `onomatopeyas`, `palabras-fonema` (las tres califica el adulto) y `discriminacion` (califica sola).
- `Item.model` = lo que se dice al reintentar tras "Aún no" (si falta, `target`); `retryText()` en `SessionRunner` quita la puntuación final para no duplicarla. `Activity.buildItems` recibe un 4.º parámetro `BuildContext { age, phonemes }` (edad y resumen por fonema, de `lib/phonemeStats.ts`).
- **Fonemas** (`content/phonemes.json`, lógica en `lib/phonemes.ts`): 36 listas, 552 palabras, mínimo 12 por lista. Cada palabra se escribe `"pa-to 🦆"` (sílabas con guiones + emoji tras el primer espacio). **La posición (inicio/medio/final) NO se escribe**: se calcula con `patterns` (regex sobre la palabra sin acentos). Para agregar palabras o fonemas, editar el JSON y correr `npm test`: valida que la palabra contenga el fonema, que las sílabas coincidan con la cuenta de vocales (`lib/syllables.ts`), que no se corten dígrafos (ch, ll, rr) ni grupos (bl, tr...), que cada lista tenga ≥12 palabras y que no se usen emojis modernos.
- Edades: 3 años = vocales, p m n ñ t k f b d g y; 4 = ch l s j + "3 sílabas"; 5 = r suave, bl pl cl fl gl, s final; avanzados (`advanced: true`): rr, br pr cr fr gr tr dr. Los avanzados solo entran a los 5 años, nivel 2 y cuando ya se practicó todo lo demás de su edad, y a lo sumo uno por sesión. Se eligen primero los nunca practicados y luego los de menor logro.
- **No usar `lookbehind` (`(?<=`, `(?<!`) en los `patterns`**: Safari < 16.4 (iPads viejos) lanza SyntaxError. Solo `lookahead`.
- **Emojis**: nuevo contenido solo con Emoji <= 12 (2019). Evitar los de 2020+ (🪟 🪞 🫐 🛖 🛟 🪆...). Ya hay `🛝` (Emoji 14) en parque; si falla en tablets viejas, reemplazar.
- Praxias (`praxias.json` + `components/PraxiaGuide.tsx`): guía SVG original y animada (`guide--active` durante el conteo; sin movimiento con `prefers-reduced-motion`). Conteo hablado `uno, dos, tres...` cada 1.7 s. El adulto califica; la app no evalúa el movimiento.
- Discriminación (`discrimination.tsx`, `lib/rhythm.ts`): 5 ítems en orden fijo igual/diferente → sílabas → ritmo → igual/diferente → sílabas. Ritmo = golpes cortos/largos con Web Audio (`playRhythm`); nivel 1 con opciones muy distintas, nivel 2 con opciones que difieren en un golpe. Sílabas con palmadas: tras 2 intentos fallidos se muestra la respuesta contando juntos y se califica "Con ayuda" (nunca "Aún no").
- Los resultados de `palabras-fonema` guardan `phoneme` (id del fonema): base del seguimiento por fonema de la Fase 6.
## Evaluación, seguimiento, reporte y respaldo (Fase 6)

- **IndexedDB v3**: nuevo almacén `assessments` y `SessionRecord.kind` (`practice` por defecto, `baseline`, `reassessment`). Las sesiones de evaluación **no cuentan** para adaptar niveles, rachas ni seguimiento de práctica (`practiceResults`, `applyAdaptation`).
- **Evaluación inicial** (`lib/assessmentPlan.ts`, `screens/AssessmentHome.tsx`): 34 ítems en 7 áreas (`ASSESSMENT_AREAS` en `lib/assessment.ts`): receptivo, expresivo, órdenes, conceptos, frases (2 ítems de nivel 1 + 2 de nivel 2), discriminación (3 + 3) y fonemas (8 fonemas distintos de la edad, 1 palabra de cada uno, sin avanzados). Los ítems se guardan **completos** en `AssessmentRecord.items`. Sus ids llevan área y nivel (`receptivo/gato@1`): la misma palabra puede salir en dos áreas.
- Nivel recomendado: con ítems de los dos niveles, nivel 2 si el logro en el 2 es >= 60 %; solo nivel 1 (fonemas): nivel 2 si >= 75 %. **Solo la evaluación inicial aplica los niveles**; la reevaluación únicamente se registra para comparar.
- **Reevaluación** cada 28 días desde la última evaluación *completada*: repite los mismos ítems guardados en otro orden (`shuffleForReassessment`: mezcla dentro de cada área y el orden de las áreas, cada área junta). Una evaluación detenida a medias queda registrada pero no cuenta.
- `SessionRunner` recibe `assessment?: { kind, items? }`; `AssessmentLauncher` carga los ítems de la inicial antes de reevaluar. Rutas de la zona de adultos en `parseAdultRoute` (`lib/router.ts`); todas cuelgan de `adultos/…`, así que la evaluación no vuelve a pedir la puerta.
- **Seguimiento** (`lib/tracking.ts`): % por área y por fonema (1 / 0.5 / 0), tendencia por semana (lunes a domingo, hora local) y rachas por días con práctica. Todas reciben `now` como parámetro.
- **Gráficos SVG** (`components/Charts.tsx`, `lib/chartGeometry.ts`): barras, comparación inicial vs reevaluación y línea semanal. Reglas: valor escrito junto a cada marca, tabla equivalente `sr-only`, texto en color de tinta, leyenda con 2 series. Colores `--chart-current` (#2f6fed) y `--chart-baseline` (#c2570c) validados con la guía de dataviz (CVD ΔE > 30, contraste >= 3:1); si se cambian, volver a validarlos.
- **Reporte** (`screens/Report.tsx`): `window.print()` + CSS `@media print` (oculta `.no-print`, evita cortes dentro de secciones). **Respaldo** (`lib/backup.ts`): JSON `hablemos-backup` v1; la importación valida todo antes de escribir y es atómica (una sola transacción); admite *combinar* (gana el respaldo en ids repetidos) o *reemplazar* (con confirmación). El archivo contiene nombres y fechas de nacimiento.
- **Señales de alerta** (`content/alerts.json`, ampliable): orientativas, nunca diagnósticas; siempre con la recomendación de consultar a un profesional. Se muestran en Seguimiento, Reporte y `adultos/alertas`. `lowAreas` avisa (con tono orientativo) si 2 o más áreas quedan bajo 40 %.
## Accesibilidad, offline y despliegue (Fase 7)

- **Zoom**: bloqueado solo en las pantallas del NIÑO (`setZoomLocked` en `lib/touchGuards.ts`, activado por `App` según la ruta); **permitido en la zona de adultos** (baja visión). La meta de `index.html` queda bloqueada por defecto. axe marca `meta-viewport` en las pantallas del niño: es una decisión del brief, no un olvido.
- **Foco y títulos**: `App` cambia `document.title` (`titleFor`) y enfoca el `<main>` en cada cambio de ruta. Cada pantalla debe tener un `<h1>` (en los ejercicios va `sr-only`).
- **Contraste**: `--good` es #187a41 (5.4:1 con blanco); el anterior daba 4.17. Al cambiar colores, calcular el contraste. Texto pequeño necesita 4.5:1.
- **Tablas ocultas**: un `<table class="sr-only">` ensancha la página (las tablas ignoran `width: 1px`); envolverla en un `<div class="sr-only">` (como hace `SrTable`).
- **Wake lock** (`lib/wakeLock.ts`): `useWakeLock(true)` en `SessionRunner`. **Persistencia** (`lib/storage.ts`): `main.tsx` pide `navigator.storage.persist()`; `Backup` muestra si está concedido. En iPad, Safari borra datos de sitios no usados: recomendar agregar la app a la pantalla de inicio y hacer respaldos.
- **ErrorBoundary** (`components/ErrorBoundary.tsx`) envuelve la app: un fallo muestra un mensaje amable en vez de una pantalla en blanco.
- **CSP** (`vite.config.ts`, plugin `hablemos-csp`): se inyecta como `<meta>` **solo al compilar** (`default-src 'self'`, `connect-src 'self'`, sin scripts en línea). Prohíbe cualquier red externa; si se agrega un recurso externo o un script en línea, la app se rompe en producción (no en `npm run dev`). Probar siempre con `npm run build && npm run preview`.
- **Despliegue**: `.github/workflows/deploy.yml` (GitHub Pages, ejecuta pruebas y build), `netlify.toml` + `public/_headers` (Netlify: caché sin revalidar para `index.html`, `sw.js`, manifiesto). `base: './'` y rutas por hash: funciona en subrutas.
- **Cómo verificar sin conexión de verdad**: `npm run build`, servir con `npm run preview`, abrir la app, esperar a que el service worker active (`navigator.serviceWorker.controller`), **apagar el servidor** y recargar. Tras cambiar el build, borrar el service worker y la caché del navegador antes de probar (el viejo sigue sirviendo).
- **Auditoría de accesibilidad**: `axe-core` es devDependency. En el navegador: inyectar `/node_modules/axe-core/axe.min.js` desde el servidor de desarrollo y correr `axe.run(document)` en cada pantalla. Estado actual: 0 violaciones salvo `meta-viewport` en el niño.
- **Pantallas angostas**: reglas `@media (max-width: 520px)` al final de `global.css` reducen botones sin bajar de 72 px. Al agregar una actividad, medir `scrollHeight` vs `innerHeight` en 375x812, 768x1024 y 1024x768.
## Guía para adultos y README (Fase 8)

- `screens/Guide.tsx` + `content/guide.json` (ruta `adultos/guia`). Las descripciones de las 11 actividades salen de `guide.json` (`activities`, por id): **al agregar una actividad hay que describirla ahí** o `screens/guide.test.ts` falla. Esa prueba también exige que los números de la guía (80 %, 40 %, 3 sesiones, 34 ejercicios, 4 semanas, 3 segundos) coincidan con el código.
- El índice de la guía usa botones con `scrollIntoView`, **no enlaces `#`** (el hash es de las rutas).
- `README.md` documenta instalación, comandos, despliegue y cómo agregar la app a la pantalla de inicio en Android e iPad. Mantenerlo al día si cambian los comandos o el despliegue. Lo pendiente está al final de `PLAN.md`.
## Evaluación de pronunciación (Fase 9)

- **IndexedDB v4**: almacén `pronunciation` (`PronunciationRecord`: ítems completos + respuestas, `completedAt` al responder todo). No crea sesiones ni resultados: **no cuenta para niveles, rachas ni práctica**. `deleteProgress` también la borra.
- Lógica en `lib/pronunciation.ts` (pura, con `rng`/`now` como parámetros) y `lib/pronunciationStore.ts`. Ítems: 2-3 palabras por fonema de la edad (cubriendo inicio/medio/final con `positionOf`), 1-2 fonemas opcionales de la edad siguiente (a los 5, avanzados) y mini revisión de procesos (3 palabras de 3+ sílabas, 3 con grupos). Ajustes en `content/pronunciation.json`; sustituciones frecuentes en `content/substitutions.json` (cada fonema debe tener entrada; hay prueba).
- Bloques de ~12 palabras (~5 min) sin separar las de un mismo fonema (`chunkBlocks`); cada respuesta se guarda al marcarla, así que se pausa y se retoma. Reevaluación a 28 días con los mismos ítems en otro orden (`shuffleForRepeat`).
- Clasificación: consolidado (>= 80 %), esperable para su edad (sonido de edad mayor o avanzado) o a estimular. **Orientativa; la app NO califica la pronunciación.**
- Rutas: `adultos/pronunciacion/:id` (inicio y resultados) y `adultos/pronunciar/:id/:recordId` (evaluador).
## Escalera y pares mínimos (Fase 10)

- **IndexedDB v5**: almacén `ladders` (`perfil:fonema`). `lib/ladder.ts` (puro) y `lib/ladderStore.ts`. Al terminar una evaluación de pronunciación, cada sonido "a estimular" recibe su escalera (en orden de trabajo); solo 3 están activas a la vez, el resto espera. Los esperables/tardíos no activan escalera.
- 6 escalones (`content/ladder.json`: modelo, boca, sonido aislado, sílaba, palabra, frase). Se sube de escalón con "Lo logró" en **3 sesiones distintas** (`SESSIONS_TO_ADVANCE`); "Con ayuda"/"Aún no" no suman ni restan. El escalón viaja en el `itemId` del resultado (`escalera/<fonema>/<escalón>/<n>`); `applyLadderProgress` se llama al terminar la sesión de práctica.
- `content/ladder.json`: `say` (cómo decir el SONIDO, aproximación para la voz del sistema; la Fase 11 la reemplaza por grabaciones), `mouth` (pose para `components/MouthGuide.tsx`), `cue` y `warmups` (r y rr: ejercicios previos de lengua sin presión). Al agregar un fonema, agregar su entrada (hay prueba).
- Actividades nuevas (ids permanentes): `pares-minimos` (califica sola, sin "Aún no"; `content/minimal-pairs.json` viene de `seed/pares_minimos_v2.json`; `lib/minimalPairs.ts` prefiere los pares que coinciden con la sustitución registrada; la r suave usa los pares l/rr) y `escalera-sonido` (califica el adulto; solo entra si hay escaleras activas y **siempre entra** en ese caso: `planSession(..., must)`). `Activity.isAvailable?(ctx)` y `BuildContext.ladders/ladderLast` son los ganchos nuevos.
- La sustitución observada se guarda en la escalera (de la evaluación o escrita por el adulto en `adultos/escalera/:id`, que gana) y alimenta el reporte y los pares.
- El respaldo JSON v1 todavía NO incluye `pronunciation` ni `ladders` (Fase 12). No usar emojis de Emoji 13+ tampoco en botones (p. ej. 🪜).

## Publicación

- **Fuentes**: `src/styles/fonts.css` declara solo Nunito latin y latin-ext (cubren todo el español). No volver a importar `@fontsource-variable/nunito` entero: precargaría cirílico y vietnamita sin uso. Si se agrega un idioma, sumar su subconjunto aquí.
- **Saltos de línea**: `.gitattributes` fija LF en el repositorio.
- **Fechas**: el código usa solo componentes locales (`new Date(y, m, d)`, `getFullYear()`…), nunca funciones UTC ni `new Date('YYYY-MM-DD')`; así es seguro ante horario de verano. Mantenerlo. Las pruebas de fechas se escriben con `new Date(y, m, d, h)` locales.
- Palabras evitadas por regionalismo: calcetín/media, banano/guineo. Se usa "carro", "bus", "uvas".

## Perfiles y adultos

- Varios perfiles: nombre/apodo, fecha de nacimiento, avatar. Ningún otro dato personal.
- "Zona de adultos" tras una puerta: mantener presionado 3 s o resolver una suma.
- Cada actividad muestra al adulto, en un panel discreto, la palabra/objetivo y 3 botones: "Lo logró" / "Con ayuda" / "Aún no". **La app NO califica la pronunciación.**

## Actividades (contenido JSON en `src/content`)

1. Escucha y señala (vocabulario receptivo, 3-4 opciones).
2. Sigue la orden (1 y 2 pasos: "pon la pelota en la caja").
3. Conceptos (grande/pequeño, arriba/abajo, dentro/fuera, uno/muchos).
4. Mini cuento ilustrado con preguntas qué/quién/dónde.
5. ¿Qué es esto? (denominación expresiva; el adulto califica).
6. Categorías (arrastrar a: animales, comida, ropa, cuerpo, casa, transporte).
7. Arma la frase (fichas imagen+palabra, 2-4 palabras: sujeto-verbo-objeto).
8. Praxias orofaciales jugadas (soplar vela/molino, lengua arriba/abajo/lados, labios en "o"/"i", beso; guía animada y conteo).
9. Onomatopeyas y animales (modelado auditivo + imitación).
10. Palabras con fonema objetivo (inicio/medio/final), con listas por fonema.
11. Discriminación auditiva (¿igual o diferente?, ritmo, contar sílabas con palmadas táctiles).

## Fonemas por edad

- 3 años: vocales, p, m, n, ñ, t, k, f, b, d, g, y.
- 4 años: ch, l, s, j y palabras de 3 sílabas.
- 5 años: r suave (pero), grupos con l (bl, pl, cl, fl, gl), s final.
- rr y grupos con r: "avanzado/opcional".
- Cada fonema: al menos 12 palabras frecuentes, concretas y dibujables, adecuadas para Latinoamérica, con posición del fonema y sílabas.

## Evaluación (zona de adultos)

- Línea base guiada de ~15 min por áreas: vocabulario receptivo, vocabulario expresivo, órdenes, conceptos, frases, fonemas según edad, discriminación auditiva. Resultado: % por área y nivel inicial recomendado.
- Seguimiento: % por área y fonema (Lo logró=1, Con ayuda=0.5, Aún no=0), tendencia semanal, rachas.
- Reevaluación sugerida cada 4 semanas, mismos ítems en orden aleatorio, comparada con la línea base.
- Adaptación: sube de nivel con >=80% en 3 sesiones; baja o repite con <40%.
- Gráficos SVG sin librerías pesadas, reporte imprimible (`window.print` + CSS de impresión), exportar/importar respaldo JSON.
- Nota visible: "Esta herramienta apoya la estimulación en casa y no reemplaza la valoración de un fonoaudiólogo."
- Señales de alerta orientativas (a los 3 años casi nadie entiende al niño, no une dos palabras, no sigue órdenes simples, retroceso en lo que ya decía) con recomendación de consultar a un profesional.

## Accesibilidad y calidad

- Etiquetas ARIA, foco visible, `prefers-reduced-motion`, wake lock, bloqueo de zoom accidental y "pull to refresh", sin texto seleccionable en zonas de juego (`.play-zone`).
- Pruebas unitarias de puntaje, adaptación de nivel y almacenamiento. Probar en 768x1024 y 1024x768, y en Chrome/Safari móvil.

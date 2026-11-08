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

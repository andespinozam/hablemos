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

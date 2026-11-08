# Hablemos

App web instalable (PWA) para **estimular el lenguaje de niños de 3 a 5 años**, en español latino. Se usa en tablet (o teléfono) con un adulto al lado. Funciona **sin internet** y **todos los datos se quedan en el dispositivo**: no hay cuentas, anuncios, analítica ni llamadas de red.

**Pruébala:** <https://andespinozam.github.io/hablemos/>

> **Esta herramienta apoya la estimulación en casa y no reemplaza la valoración de un fonoaudiólogo.**

## Qué incluye

- **11 actividades** con voz y retroalimentación solo positiva: escucha y señala, sigue la orden, conceptos, mini cuento, ¿qué es esto?, categorías (arrastrar), arma la frase, praxias orofaciales, onomatopeyas, palabras con fonema objetivo (36 listas, 552 palabras) y discriminación auditiva.
- **Sesiones guiadas** de 10 a 15 minutos con niveles que se ajustan solos.
- **Zona de adultos** protegida por una puerta (mantener presionado 3 s o una suma): perfiles, evaluación inicial y reevaluación cada 4 semanas, evaluación de pronunciación por sonido y posición (en bloques de ~5 minutos, pausables), seguimiento por área y por fonema, reporte imprimible, respaldo en JSON, señales de alerta y una guía de uso.
- Pensada para niños: botones de al menos 72 px, horizontal y vertical, sin lectura obligatoria, sin texto seleccionable en las zonas de juego, la pantalla no se apaga mientras se juega.

El detalle de decisiones y convenciones está en [CLAUDE.md](CLAUDE.md) y el avance por fases en [PLAN.md](PLAN.md).

## Requisitos

- [Node.js](https://nodejs.org) 20 o superior (la integración continua usa 22) y npm.

## Instalación y desarrollo

```bash
npm install
npm run dev
```

Abre <http://localhost:5173>. Comandos disponibles:

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run build` | Revisa los tipos y genera `dist/` (con el service worker) |
| `npm run preview` | Sirve `dist/` en <http://localhost:4173> para probar la versión de producción |
| `npm run icons` | Regenera los íconos PNG de `public/icons` a partir de `public/favicon.svg` |

### Probarla en una tablet de verdad

El **service worker** (uso sin conexión) y el **wake lock** (pantalla encendida) solo funcionan en `localhost` o con **HTTPS**. Si abres el servidor de desarrollo desde otra tablet con `npm run dev -- --host` y entras por `http://192.168.x.x:5173`, la app se verá y funcionará, pero **sin** modo sin conexión ni wake lock. Para probar todo, despliega en un sitio con HTTPS (ver abajo).

## Estructura

```
src/
  activities/   las 11 actividades (una por archivo) y su registro
  components/   piezas reutilizables (gráficos, panel del adulto, guía de praxias...)
  content/      TODO el contenido en JSON: se amplía sin tocar código
  lib/          lógica pura con pruebas (puntaje, niveles, evaluación, respaldo...)
  screens/      pantallas
  styles/       tema y estilos
public/         íconos, favicon y _headers (Netlify)
```

### Ampliar el contenido

Todo lo que ve el niño está en `src/content/`:

| Archivo | Contenido |
| --- | --- |
| `vocab.json` | Vocabulario con categorías (actividades 1, 5 y 6) |
| `orders.json`, `concepts.json`, `stories.json`, `phrases.json` | Órdenes, conceptos, cuentos y frases |
| `categories.json` | Grupos de la actividad de categorías |
| `phonemes.json` | Listas por fonema: `"pa-to 🦆"` (sílabas con guiones + dibujo). La posición del fonema se calcula sola |
| `praxias.json`, `onomatopoeia.json`, `discrimination.json` | Praxias, onomatopeyas y pares de palabras |
| `alerts.json`, `guide.json` | Señales de alerta y guía para adultos |

Después de editar un JSON corre `npm test`: las pruebas revisan que el contenido sea coherente (la respuesta correcta está entre las opciones, las palabras contienen su fonema, las sílabas están bien separadas, cada lista tiene al menos 12 palabras, etc.).

## Despliegue

La app es un sitio estático: cualquier hosting con **HTTPS** sirve. Las rutas son relativas (`base: './'`) y la navegación usa `#`, así que funciona en una subcarpeta (como GitHub Pages) sin configuración extra.

### GitHub Pages

1. Sube el proyecto a un repositorio de GitHub, en la rama `main`.
2. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Cada vez que hagas *push* a `main`, el flujo [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) corre las pruebas, compila y publica. La dirección será `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

### Netlify

- **Desde un repositorio:** *Add new site → Import an existing project*. La configuración ya está en [`netlify.toml`](netlify.toml) (comando `npm run build`, carpeta `dist`).
- **A mano:** corre `npm run build` y arrastra la carpeta `dist/` a <https://app.netlify.com/drop>.

`public/_headers` agrega encabezados de seguridad y evita que se cachee el service worker.

### Lista antes de publicar

1. `npm test` y `npm run build` sin errores.
2. ~~Elegir una licencia~~ Hecho: el proyecto usa la licencia **MIT** (archivo `LICENSE`).
3. Revisar el contenido clínico con un fonoaudiólogo (listas de fonemas por edad, señales de alerta, umbrales de nivel).
4. ~~Publicar~~ Hecho: <https://andespinozam.github.io/hablemos/>. Falta comprobar en un dispositivo real que se instala en la pantalla de inicio y que funciona sin internet (abrir una vez con conexión, luego modo avión).
5. Probar en una tablet Android y en un iPad reales.

### Seguridad

El `index.html` compilado lleva una **política de contenido (CSP) estricta**: la app no puede conectarse a ningún servidor externo. Si algún día agregas un recurso externo (una fuente, un script), tendrás que cambiarla en `vite.config.ts`. La política solo se aplica al compilar, no en `npm run dev`: **prueba siempre con `npm run build && npm run preview`**.

## Agregar a la pantalla de inicio

Abre la app **una vez con internet** para que se guarde en el dispositivo. Después funciona sin conexión.

### Android (Chrome)

1. Abre la dirección de la app en Chrome.
2. Toca el menú **⋮** (arriba a la derecha).
3. Elige **Instalar app** (o **Agregar a la pantalla principal**) y confirma.
4. Se crea un ícono "Hablemos": ábrelo desde ahí, a pantalla completa.

### iPad o iPhone (Safari)

1. Abre la dirección de la app en **Safari** (en otros navegadores el menú no ofrece esta opción).
2. Toca el botón **Compartir** (el cuadrado con una flecha hacia arriba).
3. Elige **Agregar a pantalla de inicio** y toca **Agregar**.
4. Abre la app desde el ícono nuevo.

> **Importante en iPad/iPhone:** Safari puede borrar los datos de los sitios web que no se usan durante varios días. Instalar la app en la pantalla de inicio reduce ese riesgo. Aun así, **haz un respaldo de vez en cuando** (Zona de adultos → Respaldo).

### Actualizar la app

Al publicar una versión nueva, el dispositivo la descarga en segundo plano la próxima vez que abras la app con internet. Ciérrala y ábrela de nuevo para usar la versión nueva.

## Datos y privacidad

- Los perfiles, sesiones, resultados y evaluaciones (incluida la de pronunciación) se guardan en el navegador del dispositivo (IndexedDB). No se envían a ningún servidor.
- Un perfil solo tiene nombre o apodo, fecha de nacimiento y un avatar.
- Eliminar un perfil borra también todo su progreso.
- El **respaldo** es un archivo JSON con esos datos (incluye nombres y fechas de nacimiento): guárdalo con cuidado. **Todavía no incluye las evaluaciones de pronunciación** (se agregarán en el respaldo v2, Fase 12): si las necesitas, imprime el reporte.

## Calidad y pruebas

- **Pruebas unitarias** de la lógica: puntaje, adaptación de nivel, almacenamiento y migraciones de la base, evaluación, seguimiento, respaldo, voz, wake lock, guardas táctiles y validación del contenido.
- **Accesibilidad:** etiquetas ARIA, foco visible, `prefers-reduced-motion`, un `<h1>` por pantalla y auditoría con axe-core sin violaciones (salvo el bloqueo de zoom en las pantallas del niño, que es intencional; en la zona de adultos el zoom está permitido).
- **Uso sin conexión:** verificado con el servidor apagado.

### Lo que todavía no se ha probado

Todo se verificó en Chrome de escritorio con tamaños de tablet (768×1024 y 1024×768) y de teléfono emulados. **No se probó en un dispositivo real**: conviene revisar en una tablet Android y en un iPad (Safari) los gestos táctiles, el arrastre con el dedo, el sonido, las voces del sistema y la instalación en la pantalla de inicio.

## Límites

Hablemos no diagnostica ni evalúa la pronunciación: los resultados dependen de la calificación del adulto (Lo logró / Con ayuda / Aún no). Las **señales de alerta** de la app son orientativas. Ante cualquier duda sobre el desarrollo del lenguaje de un niño, consulta a un fonoaudiólogo o al pediatra.

## Licencia

[MIT](LICENSE). El código puede usarse, copiarse y modificarse; consulta el archivo para las condiciones. Esto aplica al software: la app **no es un dispositivo médico** ni sustituye la valoración de un profesional.

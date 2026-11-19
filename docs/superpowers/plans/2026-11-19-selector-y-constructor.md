# Selector escalable y constructor de pautas propias — Implementation Plan

**Goal:** que la pestaña Calendario escale a cientos de esquemas (buscador por área/fármaco) y permita al farmacéutico definir una pauta propia (inmunomediadas y onco-hematología) sin editar código.

**Architecture:** el motor (`RxEngine.buildSchedule`) y el registro (`RxData`) no cambian de contrato. El selector pasa a buscador filtrable; el constructor genera un objeto de esquema válido (tipo "ciclos" o "intervalo") que se registra en memoria con `estado:"pendiente"`.

**Tech Stack:** HTML/CSS/JS clásico, UMD, `node --test` + jsdom, sin build, funciona desde `file://`.

**Spec:** conversación con el usuario (2026-11-19); base: `docs/superpowers/specs/2026-11-19-calendarizador-pestana-design.md`.

## Global Constraints
- No editar `css/rxplain.css` ni `js/infografia.js`. Ningún archivo ni carpeta que empiece por `_` o `.` referenciado desde `index.html` (Jekyll). Solo `<script src>` clásicos.
- Nada del paciente ni de las pautas propias se guarda (ni storage, ni cookies, ni red). Todo texto del usuario se escapa en HTML.
- No se calculan dosis: `dosis` es texto libre.
- Las pautas propias llevan siempre `estado:"pendiente"`, `fuente:"Pauta definida por el usuario (sin validar)"`, y la hoja muestra el banner de pendiente existente (fail-safe).
- No inventar esquemas clínicos. CIMA no rellena nada automáticamente.

## Review Focus
- Selector con 0 coincidencias, con acentos/mayúsculas ("hematologia" encuentra "Hematología"), con esquema seleccionado que deja de coincidir.
- Constructor: ciclo de 0/negativo/no numérico, días fuera del ciclo, días duplicados/desordenados, texto con `<`/`"`, lugar inválido.
- Pauta propia sobrevive a cambiar de esquema y vuelve a seleccionarse; no aparece en la hoja como "validado".

---
### Task 1: Selector con buscador y filtro por área
**Files:** Modify `js/calendario-view.js`, `css/calendario.css`; Test `tests/calendario-view.test.mjs`.
**Interfaces:** Consumes `RxData.list()/byArea()/get(id)`. Produces: se mantiene `#cal_esquema` como `<select>` real (otros tests y la vista dependen de él), alimentado por un `<input id="cal_buscar" type="search">` y un `<select id="cal_area">` (opción "Todas las áreas"). Filtrar = reconstruir las `<option>` de `#cal_esquema` por área y texto (nombre, linea, fármacos de los items; insensible a mayúsculas y acentos). Si hay 0 coincidencias, el select queda vacío y aparece `<p id="cal_sin_resultados" role="status">Sin esquemas que coincidan.</p>`, sin calendario. Cada opción muestra "✔ validado" o "⚠ pendiente" como texto.
- [ ] Tests: filtrar por área; buscar "lenalid" y "hematologia"; 0 coincidencias; el esquema seleccionado se mantiene si sigue coincidiendo y, si no, se selecciona el primero coincidente; el estado aparece como texto en la opción.
- [ ] Implementar y `npm test` en verde; commit.

### Task 2: Constructor de pautas propias
**Files:** Create `js/constructor-pauta.js` (UMD, `window.RxBuilder.buildRegimen(form) -> regimen`, lanza `Error` con mensaje claro si es inválido), tests `tests/constructor-pauta.test.mjs`; Modify `js/calendario-view.js` (botón "Crear pauta propia" que abre el formulario bajo `#cal_constructor`), `index.html` (script tag antes de `calendario-view.js`), `css/calendario.css`, `README.md`.
**Interfaces:** `form = { nombre, area, tipo: "ciclos"|"intervalo", ciclos_defecto, ciclo_dias (solo ciclos), items:[{farmaco, abrev, dosis, lugar, dias:[n,...] (ciclos) | desplazamientos_dias:[...], primer_mantenimiento_dia, cada_dias (intervalo)}] }`. Para tipo "ciclos" produce una única fase `{desde:1,hasta:null/ciclos_defecto según el formato de las fases existentes (leer data/regimens/mieloma-drd.js y js/schedule-engine.js), duracion: ciclo_dias, items}`. Valida con `RxData.register` (id generado `propia-<n>`, `linea:"Pauta propia"`, `estado:"pendiente"`, `fuente`, `fecha_revision:null`), validación extra: `ciclo_dias` entero 1–366; `dias` enteros 1–ciclo_dias, sin duplicados, ordenados; intervalo: enteros ≥0 y `cada_dias` ≥1. Tras crear, la vista la selecciona y repinta. Formulario con ejemplos precargables: "Biológico cada N semanas" (desplazamientos 0,14,28 y mantenimiento cada 56) y "Oral días 1–21 de 28".
- [ ] Tests de validación (Review Focus), de escape HTML en la hoja y de que la hoja lleva el banner de pendiente.
- [ ] Implementar, `npm test` en verde, README (sección "Pautas propias"), commit.

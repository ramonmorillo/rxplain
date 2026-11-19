# Pestaña "Calendario" en RxPlain — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir a RxPlain una segunda pestaña, "Calendario", que genera un calendario de tratamiento (vista mensual + hoja A4 para el paciente) a partir de un esquema, una fecha de inicio y un nº de ciclos.

**Architecture:** `index.html` se parte en HTML + `css/` + `js/` con scripts clásicos (sin módulos ES, sin compilación). Un motor puro (`js/schedule-engine.js`, envoltorio UMD para poder probarlo con Node) calcula ciclos y eventos; los esquemas son datos en `data/regimens/*.js` registrados en un registro validado; la vista y la hoja imprimible consumen el resultado del motor.

**Tech Stack:** HTML/CSS/JS vanilla en navegador (Chrome/Edge). Solo desarrollo: Node ≥ 18 con `node --test` y `jsdom` (devDependency) para pruebas.

**Spec:** `docs/superpowers/specs/2026-11-19-calendarizador-pestana-design.md`

## Global Constraints

- Web estática, gratuita, sin compilación, sin APIs de pago; funciona en Chrome y Edge de los ordenadores del hospital.
- Scripts clásicos (`<script src>`), nunca `type="module"` ni `fetch` de datos locales: la página debe funcionar también abierta desde `file://`. (Decisión del constructor: por eso los esquemas son `.js` y no `.json`.)
- Repo público: sin datos de pacientes ni datos internos del hospital.
- No guardar datos del paciente en ningún sitio (ni `localStorage`, ni `sessionStorage`, ni red, ni repo). El identificador del paciente vive solo en memoria.
- El calendario coloca fechas y tomas; no calcula ni recomienda dosis. La dosis es texto mostrado tal cual (`dosis: "25 mg"`).
- No imprimir una hoja con un esquema `pendiente` sin aviso visible en pantalla y en el impreso.
- La hoja del paciente debe leerse en impresora monocromo: texto y borde grueso además de color; nunca solo color.
- Tipografías del sistema en lo nuevo (sin Google Fonts ni otros recursos externos), por si la red del hospital los bloquea; CIMA sigue siendo la única llamada externa y es opcional.
- Esquemas nuevos de oncología, hematología e inmunomediadas: los aporta Ramón con fuente; no se inventan. Los de mieloma entran como `estado: "pendiente"`.
- La pestaña Infografía no cambia de comportamiento (ids, textos y reglas `@media print` actuales intactos).
- Commits en español, terminados con las líneas de atribución que fije la sesión.

## Review Focus

1. Esquema `pendiente` → el aviso aparece en la hoja impresa (anti-objetivo del spec). Test en Task 8.
2. Inicio en fin de semana/festivo o cita de hospital en festivo (Viernes Santo 2027) → se avisa. Test en Task 7.
3. Nº de ciclos vacío, 0, negativo, decimal o >60 → se ajusta a un entero entre 1 y 60; retraso negativo o no numérico → 0. Test en Task 4 y Task 7.
4. Texto con HTML en identificador de paciente o datos del farmacéutico (`<img src=x onerror=alert(1)>`) → se escapa en la hoja. Test en Task 8.
5. Aritmética de fechas en cambio de hora (25-oct-2026) y año bisiesto (29-feb-2028) → fechas correctas. Test en Task 3.

---

## File Structure

- `index.html` — solo estructura: hero, pestañas, panel Infografía (el `<main class="mainLayout">` actual), panel Calendario, footer, `<script src>`.
- `css/rxplain.css` — el CSS actual movido tal cual; `css/calendario.css` — estilos nuevos (pestañas, calendario, hoja, impresión del calendario).
- `js/infografia.js` — el script actual movido tal cual.
- `js/tabs.js` — navegación por pestañas.
- `js/schedule-engine.js` — fechas, festivos, `buildSchedule`.
- `js/regimen-data.js` — registro y validación de esquemas.
- `data/regimens/mieloma-drd.js`, `mieloma-vrd-swog.js`, `mieloma-isa-kd.js` — esquemas pendientes de validación.
- `js/calendario-view.js` — formulario + vista mensual + avisos.
- `js/hoja-paciente.js` — hoja A4 e impresión.
- `tests/` — `*.test.mjs` y `tests/helpers/loadPage.mjs`.
- `package.json`, `README.md`.

---

### Task 1: Separar CSS y JS sin cambiar el comportamiento

**Files:**
- Create: `css/rxplain.css`, `js/infografia.js`, `package.json`, `tests/helpers/loadPage.mjs`, `tests/smoke.test.mjs`
- Modify: `index.html`

**Interfaces:**
- Produces: `loadPage(): Promise<JSDOM>` en `tests/helpers/loadPage.mjs` (carga `index.html` desde disco con `runScripts: "dangerously"`, `resources: "usable"`, `pretendToBeVisual: true`, y espera a `load`). Los scripts nuevos de tareas posteriores se añaden a `index.html` y quedan cubiertos por este helper.

- [ ] **Step 1: Comprobar cómo se publica hoy.** Ejecutar `gh api repos/ramonmorillo/rxplain/pages`; anotar el resultado (rama/carpeta de publicación o "no hay Pages") para el README de Task 9. Si falla por permisos, anotarlo y seguir.
- [ ] **Step 2: Write the failing test** `tests/smoke.test.mjs`: `test("la infografía conserva sus ids y arranca", ...)` — con `loadPage()`, assert que existen `#addMed`, `#generate`, `#print`, `#output`, `#pharm_name`, `#cima_query`, y que `document.querySelectorAll("style").length === 0` y `document.querySelectorAll("script:not([src])").length === 0`.
- [ ] **Step 3: Run** `npm test` (`node --test tests/`) → FAIL (aún hay `<style>` y `<script>` inline).
- [ ] **Step 4: Mover** el contenido de `<style>` a `css/rxplain.css` y el de `<script>` a `js/infografia.js` sin editar una sola línea; enlazar con `<link rel="stylesheet" href="css/rxplain.css">` y `<script src="js/infografia.js"></script>` en el mismo sitio. Crear `package.json` con `"scripts": {"test": "node --test tests/"}`, `"devDependencies": {"jsdom": "^24"}`, `"private": true`; `npm install`; añadir `node_modules/` a `.gitignore`.
- [ ] **Step 5: Run** `npm test` → PASS. Comprobar además `diff <(git show HEAD:index.html | sed -n '/<style>/,/<\/style>/p' | sed '1d;$d') css/rxplain.css` sin diferencias de contenido relevantes.
- [ ] **Step 6: Commit** `git add -A && git commit -m "Separa CSS y JS de index.html sin cambiar comportamiento"`

### Task 2: Pestañas Infografía / Calendario

**Files:**
- Create: `js/tabs.js`, `css/calendario.css`, `tests/tabs.test.mjs`
- Modify: `index.html`, `css/calendario.css` (enlazado tras `rxplain.css`)

**Interfaces:**
- Produces: `RxTabs.show(name: "infografia" | "calendario"): void`. Marcado: `<nav role="tablist" id="tabs">` con `<button role="tab" id="tab-btn-infografia" aria-controls="tab-infografia">` y `tab-btn-calendario`; el `<main class="mainLayout">` actual pasa a tener `id="tab-infografia" role="tabpanel"`; nuevo `<section id="tab-calendario" class="mainLayout" role="tabpanel" hidden>` con un `<div id="calendarioRoot">` vacío.

- [ ] **Step 1: Write the failing test:** `test("por defecto Infografía visible y Calendario oculto")`; `test("clic en la pestaña Calendario la muestra y oculta Infografía")` (assert `hidden`, `aria-selected`); `test("las teclas ← → mueven el foco entre pestañas")`.
- [ ] **Step 2: Run** `npm test` → FAIL.
- [ ] **Step 3: Implement** `RxTabs` en `js/tabs.js` (alterna `hidden` y `aria-selected`; ← → entre pestañas). Insertar la `<nav>` entre `<header class="hero">` y el `<main>`. Estilos de pestañas en `css/calendario.css`, coherentes con las variables CSS existentes (`--surface`, etc.).
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: pestañas Infografía y Calendario`

### Task 3: Fechas y festivos del motor

**Files:**
- Create: `js/schedule-engine.js`, `tests/engine-dates.test.mjs`

**Interfaces:**
- Produces (`module.exports` en Node, `window.RxEngine` en navegador, envoltorio UMD): `isoAdd(iso: string, n: number): string`, `isoDow(iso: string): number` (0 = lunes), `isoDiff(a: string, b: string): number`, `holidayName(iso: string): string | undefined` (festivos nacionales y de Andalucía: 1-ene, 6-ene, 28-feb, 1-may, 15-ago, 12-oct, 1-nov, 6-dic, 8-dic, 25-dic, Jueves y Viernes Santo; sin festivos locales). Aritmética en UTC, formato `YYYY-MM-DD`.

- [ ] **Step 1: Write the failing tests:**
  - `isoAdd("2026-10-24", 2) === "2026-10-26"` (cambio de hora)
  - `isoAdd("2028-02-28", 1) === "2028-02-29"` (bisiesto)
  - `isoAdd("2026-12-30", 3) === "2027-01-02"`
  - `isoDow("2026-11-23") === 0`; `isoDow("2026-11-28") === 5`
  - `isoDiff("2026-11-23", "2027-01-04") === 42`
  - `holidayName("2027-03-26") === "Viernes Santo"`; `holidayName("2027-03-25") === "Jueves Santo"`; `holidayName("2026-12-08") === "Inmaculada"`; `holidayName("2026-11-24") === undefined`
- [ ] **Step 2: Run** `node --test tests/engine-dates.test.mjs` → FAIL.
- [ ] **Step 3: Implement** las cuatro funciones; Pascua con el algoritmo gregoriano anónimo (el artefacto HematoFH ya lo usaba).
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat: fechas y festivos del motor`

### Task 4: `buildSchedule` por ciclos con retrasos

**Files:**
- Modify: `js/schedule-engine.js`
- Test: `tests/engine-cycles.test.mjs`

**Interfaces:**
- Consumes: `isoAdd`, `isoDiff`.
- Produces: `buildSchedule(regimen: Regimen, opts: {start: string, n: number, delays?: Record<number, number>}): {cycles: {n: number, start: string, len: number, fase: string}[], events: Evento[], end: string}`.
  - `Regimen` (esquema por ciclos): `{tipo?: "ciclos", fases: [{desde: number, hasta: number | null, duracion: number, etiqueta: string, items: [{farmaco: string, abrev: string, dosis: string, veces_al_dia?: number, lugar: "hospital" | "casa" | "casa_inyeccion", dias: number[], etiqueta?: string}]}], ...metadatos}`.
  - `Evento`: `{date: string, cycle: number, day: number, farmaco: string, abrev: string, dosis: string, veces: number, lugar: string, etiqueta: string}` (`veces` = `veces_al_dia ?? 1`).
  - Reglas: la fase de un ciclo es la primera con `desde <= c <= hasta` (`hasta: null` = abierta); si no hay ninguna, la última fase. `delays[c]` días de retraso respecto al fin del ciclo anterior (c ≥ 2); negativo o no numérico → 0. Días `> duracion` se ignoran. `n` se ajusta a un entero entre 1 y 60 (vacío, NaN, 0, negativo, decimal, >60).

- [ ] **Step 1: Write the failing tests** con un esquema de prueba en `tests/fixtures/regimen-ciclos.mjs` (2 fases: C1–2 de 28 días con `Len` días 1–21 y `Dara` días [1,8,15,22] en hospital; C3 en adelante de 28 días con `Dara` [1,15]):
  - `inicio 2026-11-23, n=3` → `cycles.map(c=>c.start)` = `["2026-11-23","2026-12-21","2027-01-18"]`.
  - eventos de `Dara` en C1 = `["2026-11-23","2026-11-30","2026-12-07","2026-12-14"]`.
  - `delays: {2: 3}` → C2 empieza `2026-12-24` y C3 `2027-01-21`.
  - C3 tiene 2 eventos `Dara` (fase abierta); con `n=5` los ciclos 4 y 5 usan esa misma fase.
  - `n` en `["", 0, -2, 2.7, 999, "abc"]` → nº de ciclos devueltos `[1,1,1,2,60,1]` respectivamente (`2.7` → `2`).
  - `delays: {2: -5}` y `{2: "x"}` → igual que sin retraso.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `buildSchedule`; `end` = último día del último ciclo. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: motor de ciclos con retrasos`

### Task 5: Extensiones del motor (tomas por día, intervalos largos, casa/inyección)

**Files:**
- Modify: `js/schedule-engine.js`
- Test: `tests/engine-intervalos.test.mjs`, fixture `tests/fixtures/regimen-intervalo.mjs`

**Interfaces:**
- Produces: `buildSchedule` también acepta `Regimen` con `tipo: "intervalo"`: `{tipo: "intervalo", items: [{farmaco, abrev, dosis, lugar, desplazamientos_dias: number[], primer_mantenimiento_dia: number, cada_dias: number, dosis_totales: number}]}`. Para este tipo `opts.n` sustituye a `dosis_totales` (mismo ajuste 1–60), `cycles` devuelve `[]` y `end` es la fecha de la última dosis. Las dosis son: `desplazamientos_dias`, luego `primer_mantenimiento_dia`, luego `+cada_dias`, hasta `dosis_totales`.
- `veces` ya viaja en `Evento` (Task 4); `lugar: "casa_inyeccion"` se conserva tal cual.

- [ ] **Step 1: Write the failing tests** (fixture sintético, **no es una pauta clínica real**, solo prueba el motor): `desplazamientos_dias: [0,14,42]`, `primer_mantenimiento_dia: 98`, `cada_dias: 56`, `dosis_totales: 5`, `lugar: "casa_inyeccion"`:
  - inicio `2026-11-23` → fechas `["2026-11-23","2026-12-07","2027-01-04","2027-03-01","2027-04-26"]`.
  - `opts.n = 3` → 3 eventos; `cycles` es `[]`; `end === "2027-01-04"`.
  - un ítem con `veces_al_dia: 2` en un esquema por ciclos produce eventos con `veces === 2`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS (y los tests de Task 3–4 siguen pasando).
- [ ] **Step 5: Commit** `feat: motor admite tomas por día, intervalos largos y autoinyección`

### Task 6: Registro y validación de esquemas + tres esquemas de mieloma pendientes

**Files:**
- Create: `js/regimen-data.js`, `data/regimens/mieloma-drd.js`, `mieloma-vrd-swog.js`, `mieloma-isa-kd.js`, `tests/regimen-data.test.mjs`

**Interfaces:**
- Produces (UMD, `window.RxData`): `register(r: Regimen): void` (lanza `Error` cuyo mensaje nombra el campo inválido), `list(): Regimen[]`, `get(id: string): Regimen | undefined`, `byArea(): Record<string, Regimen[]>`, `_reset(): void` (solo tests).
- Metadatos obligatorios: `id`, `nombre`, `area` (`"Hematología" | "Oncología" | "Inmunomediadas"`), `linea`, `estado` (`"validado" | "pendiente"`), `fuente` (texto no vacío), `fecha_revision` (`"YYYY-MM-DD"`; `null` solo si `estado === "pendiente"`), `ciclos_defecto`, y `fases` (o `items` si `tipo === "intervalo"`). Opcionales: `ensayo`, `continuo`, `notas: string[]`, `supuestos: string[]`.
- Cada archivo de `data/regimens/` termina con `RxData.register({...})`.

- [ ] **Step 1: Write the failing tests:** `register` rechaza (mensaje contiene el nombre del campo): sin `fuente`; `estado: "otro"`; `estado: "validado"` con `fecha_revision: null`; ítem con `lugar: "x"`; ítem con `dias` vacío; id duplicado. Acepta un esquema pendiente con `fecha_revision: null`. Tras cargar los tres archivos de `data/` (vía `require`), `list()` tiene 3 y todos tienen `estado === "pendiente"`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `RxData`. **Step 4: Portar** DRd, VRd (SWOG) e Isa-Kd del artefacto HematoFH (días y dosis como texto: `"25 mg"`, `"1,3 mg/m²"`, `"10 mg/kg"`), `area: "Hematología"`, `estado: "pendiente"`, `fecha_revision: null`, `fuente: "Pestaña Esquemas del Excel de costes de mieloma múltiple del Servicio (vía artefacto HematoFH)"`, y copiar sus `supuestos`/`notas` tal cual. No añadir dosis ni días que no estén en el artefacto.
- [ ] **Step 5: Run** → PASS. **Step 6: Commit** `feat: registro de esquemas y tres esquemas de mieloma pendientes`

### Task 7: Vista del calendario (formulario, mensual, avisos)

**Files:**
- Create: `js/calendario-view.js`, `tests/calendario-view.test.mjs`
- Modify: `index.html` (scripts en orden: `schedule-engine`, `regimen-data`, `data/regimens/*`, `calendario-view`, `hoja-paciente`, `tabs`, `infografia`), `css/calendario.css`

**Interfaces:**
- Consumes: `RxEngine.buildSchedule`, `RxEngine.holidayName`, `RxEngine.isoDow`, `RxData.byArea()`.
- Produces (`window.RxCalendar`): `mount(root: HTMLElement): void` (pinta en `#calendarioRoot`: `<select id="cal_esquema">` agrupado por área, `<input type="date" id="cal_inicio">`, `<input id="cal_ciclos">`, un `<input data-delay="N">` por ciclo ≥ 2, `<div id="cal_meses">`, `<div id="cal_avisos">`), `renderMonths(schedule: Schedule): string`, `conflicts(schedule: Schedule): string[]` (fechas ISO con evento de lugar `hospital` en sábado, domingo o festivo, ordenadas y sin repetir).
- Día de hospital: clase `.dia-hospital` y texto visible `HOSPITAL`; cada fármaco como `<span class="pildora">{abrev}</span>`.
- `#cal_avisos` muestra: el aviso de `pendiente` (clase `.aviso-pendiente`, texto "Esquema pendiente de validación"), los `supuestos` y `notas` del esquema, y el aviso de conflictos con las fechas en formato `sáb. 21 nov`.

- [ ] **Step 1: Write the failing tests (jsdom):**
  - selecciona `mieloma-drd`, inicio `2026-11-23`, ciclos 6 → `#cal_meses .dia-hospital` existe en `2026-11-23`; `#cal_avisos` contiene "pendiente de validación".
  - inicio `2026-11-21` (sábado) → `#cal_avisos` menciona `sáb. 21 nov`.
  - `conflicts()` con un esquema cuyo día de hospital cae el `2027-03-26` incluye esa fecha.
  - escribir `0`, `""` y `"abc"` en `#cal_ciclos` no rompe la vista (≥ 1 ciclo pintado).
  - poner `5` en `data-delay="2"` desplaza la fecha de inicio mostrada del C2 en 5 días.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (adaptar de `monthsHTML` y `renderCal` del artefacto, sin costes, sin SC/IV, sin peso/talla). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: vista de calendario con avisos`

### Task 8: Hoja del paciente, impresión y privacidad

**Files:**
- Create: `js/hoja-paciente.js`, `tests/hoja.test.mjs`
- Modify: `js/calendario-view.js` (campo `#cal_paciente`, botón `#cal_imprimir`, contenedor `#hojaPaciente`), `css/calendario.css`

**Interfaces:**
- Consumes: `Schedule` de `buildSchedule`; campos de RxPlain `#pharm_name`, `#center`, `#contact`, `#date` (se leen al imprimir).
- Produces (`window.RxSheet`): `buildSheetHTML(schedule: Schedule, regimen: Regimen, ctx: {paciente: string, profesional: {nombre: string, centro: string, contacto: string, fecha: string}}): string`. Todo texto de usuario pasa por escape HTML. Contenido: título, esquema, inicio y nº de ciclos; tabla "Días que tiene que venir al hospital"; "Medicación en casa" con `dosis` y `veces`; calendarios mensuales A4 con borde grueso + texto `HOSPITAL` en días de hospital y nombre del fármaco como texto; bloque de contacto solo con los campos rellenados; si `regimen.estado === "pendiente"`, banner `.aviso-pendiente` "ESQUEMA PENDIENTE DE VALIDACIÓN — NO ENTREGAR AL PACIENTE".
- Impresión: `#cal_imprimir` pone `document.body.dataset.printing = "calendario"`, llama `window.print()` y lo quita en `afterprint`. CSS `@media print`: con `data-printing="calendario"` solo se muestra `#hojaPaciente`; sin ese atributo se oculta todo el panel `#tab-calendario` (la impresión de la infografía no cambia). `@page{size:A4;margin:12mm}`.

- [ ] **Step 1: Write the failing tests:**
  - esquema `pendiente` → HTML contiene `aviso-pendiente` y "NO ENTREGAR AL PACIENTE".
  - `paciente: "<img src=x onerror=alert(1)>"` y `profesional.nombre` con `<script>` → el HTML contiene `&lt;img` y `&lt;script` y no contiene `<img src=x`.
  - con `profesional` vacío no aparece el bloque de contacto.
  - jsdom: tras rellenar todos los campos del calendario y de RxPlain, `localStorage.length === 0`, `sessionStorage.length === 0` y no se llamó a `fetch`.
  - jsdom: clic en `#cal_imprimir` llama a `window.print` (stub) con `body.dataset.printing === "calendario"` en ese momento y sin él después de disparar `afterprint`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (adaptar `patientSheetHTML` del artefacto; sustituir `saveFile` por la impresión del navegador; sin descarga `.html`). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: hoja del paciente imprimible y privacidad`

### Task 9: README, verificación manual y PR

**Files:**
- Create: `README.md`

- [ ] **Step 1: Escribir `README.md`:** qué es RxPlain y la pestaña Calendario; declaración de privacidad (no se guarda nada del paciente); cómo añadir un esquema (campos de Task 6, con `estado` y `fuente` obligatorios); cómo ejecutar `npm test`; cómo se publica (resultado de Task 1, paso 1).
- [ ] **Step 2: Run** `npm test` → todo PASS.
- [ ] **Step 3: Verificación manual en Chrome y en Edge** (anotar en la descripción del PR): (a) abrir `index.html` desde disco y desde la URL publicada; (b) generar una infografía de ejemplo ("Cargar ejemplo") e imprimir en vista previa: debe verse igual que antes; (c) en Calendario, cargar DRd con inicio en sábado, comprobar aviso de conflicto; (d) imprimir la hoja: banner de "pendiente" visible y legible en blanco y negro.
- [ ] **Step 4: Commit** `docs: README` y `git push`; abrir PR contra `main` con `gh api repos/ramonmorillo/rxplain/pulls -f title=... -f head=feature/pestana-calendario -f base=main`.

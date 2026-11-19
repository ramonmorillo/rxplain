# Sub-pestañas del Calendario: Fármacos (CIMA), Esquemas, Calendario, Informe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** reorganizar la pestaña **Calendario** en cuatro sub-pestañas (Fármacos, Esquemas, Calendario, Informe del paciente), normalizar fármacos con CIMA, proponer un borrador de pauta desde el apartado 4.2 de la ficha técnica (editable por el farmacéutico) y entregar un informe con las próximas administraciones.

**Architecture:** la pestaña superior "Infografía" NO se toca. Dentro de `#tab-calendario` se añade una barra de sub-pestañas (`role=tablist`) con cuatro paneles que existen siempre en el DOM (`hidden` los oculta), de modo que los ids actuales (`#cal_esquema`, `#cal_buscar`, `#cal_area`, `#cal_inicio`, `#cal_ciclos`, `#cal_meses`, `#cal_avisos`, `#cal_paciente`, `#cal_imprimir`, `#cal_constructor`) siguen existiendo y los tests actuales siguen valiendo. Estado compartido solo en memoria. Módulos nuevos UMD: `js/cima.js` (`window.RxCima`), `js/posologia-ft.js` (`window.RxPosologia`).

**Tech Stack:** HTML/CSS/JS clásico, UMD, `node --test` + jsdom, sin build, `file://`.

**Spec:** conversación con el usuario 2026-11-19 (decisiones: infografía no se toca; sub-pestañas dentro de Calendario; CIMA normaliza fármacos; borrador de pauta desde la ficha técnica editable por el farmacéutico, siempre `pendiente`; el resultado final es informe + calendario para el paciente). Base: `docs/superpowers/specs/2026-11-19-calendarizador-pestana-design.md`.

## Global Constraints
- No editar `css/rxplain.css` ni `js/infografia.js`; la pestaña Infografía y su impresión no cambian.
- Sin build; solo `<script src>` clásicos; ninguna ruta referenciada desde `index.html` empieza por `_` o `.`; funciona desde `file://`.
- Única llamada de red permitida: CIMA/AEMPS (`https://cima.aemps.es/cima/rest`), solo al pulsar buscar/seleccionar, nunca con datos del paciente. Nada del paciente ni de las pautas se guarda (ni storage, ni cookies).
- Todo texto externo (CIMA) y de usuario se escapa en HTML.
- No se calculan dosis. Ninguna pauta derivada de la ficha técnica o creada por el usuario es `validado`: siempre `pendiente` + banner "NO ENTREGAR AL PACIENTE" (fail-safe: banner salvo `estado === "validado"`).
- El extractor de la ficha técnica nunca adivina: lo que no entiende queda vacío y se avisa; cada dato propuesto muestra la frase de la ficha de la que sale. Los tests usan textos sintéticos inventados, no citas reales de fichas.
- No hay acceso a CIMA desde el entorno de desarrollo: `fetch` se inyecta en los módulos y los tests usan respuestas simuladas; si CIMA falla o devuelve otro formato, la UI muestra un aviso y el enlace a la ficha, sin romper nada.

## Review Focus
- Sub-pestañas: teclado (flechas), `aria-selected`, solo un panel visible, impresión de la hoja sigue funcionando desde cualquier sub-pestaña y la limpieza de `data-printing` también.
- CIMA: respuesta vacía, error de red, HTML en los textos, nregistro con caracteres raros, apartado 4.2 ausente.
- Extractor: texto sin pauta reconocible, varias frecuencias en el mismo texto, "una vez al día" vs "cada 12 horas", rangos de días, unidades (días/semanas), cifras con coma decimal; nunca inventa.
- Informe: fecha de inicio vacía, 0 administraciones, pautas por intervalo, banner pendiente en todas las páginas, legible en blanco y negro.

---
### Task 1: Sub-pestañas y reorganización (Fase A)
**Files:** Modify `index.html` (solo dentro de `#tab-calendario`), `js/calendario-view.js`, `css/calendario.css`; Create `js/subtabs.js` (`window.RxSubtabs.show(name)`, nombres `farmacos|esquemas|calendario|informe`, por defecto `calendario`); Test `tests/subtabs.test.mjs` + ajustes mínimos a tests existentes.
**Interfaces:** botones `#sub-btn-<n>`, paneles `#sub-<n>`. Reparto: **Esquemas** = `#cal_buscar`, `#cal_area`, `#cal_esquema`, lista/estado y `#cal_constructor` (botón "Crear pauta propia"); **Calendario** = resumen del esquema elegido (nombre, estado) con botón "Cambiar esquema" que lleva a Esquemas, `#cal_inicio`, `#cal_ciclos`, `#cal_retrasos`, `#cal_avisos`, `#cal_meses`; **Informe** = `#cal_paciente`, `#cal_imprimir` y (Task 4) vista previa; **Fármacos** = contenedor `#farmacos_root` con texto "Próximamente" hasta la Task 2. Elegir un esquema en Esquemas actualiza el calendario y mantiene la sub-pestaña. Al crear una pauta propia se pasa a Calendario.
- [ ] Tests: solo un panel visible; clic y flechas cambian; todos los ids anteriores siguen existiendo; imprimir desde Informe construye la hoja; `RxTabs.show("infografia")` limpia como antes; la suite existente pasa.
- [ ] Implementar y `npm test` en verde; commit.

### Task 2: Pestaña Fármacos con CIMA (Fase B)
**Files:** Create `js/cima.js`, `tests/cima.test.mjs`; Modify `js/calendario-view.js` o nuevo `js/farmacos-view.js` (montaje en `#farmacos_root`), `index.html`, `css/calendario.css`, `README.md`.
**Interfaces:** `RxCima.create({fetch, base})` → `{buscar(nombre) -> Promise<[{nregistro, nombre, pactivos, formaFarmaceutica, labtitular, url}]>, apartado(nregistro, seccion="4.2") -> Promise<{texto, url}>}`; `base` por defecto `https://cima.aemps.es/cima/rest`; `buscar` usa `GET {base}/medicamentos?nombre=<q>&pagina=1`; `apartado` usa `GET {base}/docSegmentado/contenido/1?nregistro=<n>&seccion=4.2` (formato no verificado: aceptar texto/HTML, convertir a texto plano con `textContent` de un nodo desacoplado/DOMParser, y fallar con `Error` claro si vacío). UI: buscador, lista de resultados (nombre, principio activo, forma, enlace a CIMA), al elegir uno se muestra el 4.2 en un `<pre>`/bloque de texto y el botón "Proponer pauta" (se activa en la Task 3). "Fármaco normalizado" = principio activo + nº registro, que se guarda en memoria para el constructor.
- [ ] Tests con `fetch` simulado: éxito, vacío, HTTP 500, red caída, nombre con `<script>`, 4.2 ausente; la UI escapa y no lanza.
- [ ] Implementar, `npm test`, README (sección CIMA y su limitación), commit.

### Task 3: Borrador de pauta desde la ficha técnica (Fase C)
**Files:** Create `js/posologia-ft.js`, `tests/posologia-ft.test.mjs`; Modify `js/constructor-pauta.js` (solo si hace falta para precargar) y la vista de Fármacos/constructor.
**Interfaces:** `RxPosologia.extraer(texto) -> { propuestas: [{tipo: "diaria"|"ciclo"|"intervalo", frase, veces_al_dia?, dias_ciclo?, ciclo_dias?, cada_dias?, notas}], avisos: [string] }`. Reglas mínimas: "una vez al día / cada 24 horas" (1), "dos veces al día / cada 12 horas" (2), "X de cada Y días"/"días 1 a 21 de ciclos de 28 días" (ciclo), "cada N semanas/días" (intervalo, `cada_dias = N*7` para semanas), "semanas 0, 2 y 4 y después cada 8 semanas" (intervalo con desplazamientos), coma decimal tolerada. Lo no reconocido → `avisos` y ninguna propuesta; varias frecuencias → varias propuestas, nunca fusionadas. UI: lista de propuestas con la frase origen; botón "Usar en el constructor" rellena el formulario del constructor (nombre = fármaco normalizado; farmaco/abrev desde CIMA; `dosis` queda vacía para que la escriba el farmacéutico) y cambia a Esquemas; el farmacéutico edita y crea (siempre `pendiente`).
- [ ] Tests con textos sintéticos para cada regla y para los casos de Review Focus; test de que `dosis` queda vacía y de que no se propone nada ante texto sin pauta.
- [ ] Implementar, `npm test`, commit.

### Task 4: Informe del paciente (Fase D)
**Files:** Modify `js/hoja-paciente.js`, `js/calendario-view.js`, `css/calendario.css`, `index.html`; Test `tests/hoja.test.mjs`.
**Interfaces:** `RxSheet.buildSheetHTML` añade al principio (tras el banner) un bloque **"Sus próximas administraciones"** con las próximas 8 administraciones desde la fecha de inicio (o desde hoy si la pauta ya empezó): fecha con día de la semana, fármaco, dosis, lugar (hospital en texto + borde grueso, "casa"), ordenadas por fecha; luego el resto de la hoja actual. Pestaña Informe: vista previa en pantalla con el mismo HTML (`#informe_preview`), sin datos fuera de memoria. Texto de pie: "Este informe no sustituye las indicaciones de su farmacéutico o médico".
- [ ] Tests: orden por fecha, límite 8, hospital en texto, escape de HTML, pauta por intervalo, 0 eventos (mensaje), banner pendiente intacto, vista previa == hoja impresa.
- [ ] Implementar, `npm test`, README actualizado (flujo de las cuatro sub-pestañas), commit.

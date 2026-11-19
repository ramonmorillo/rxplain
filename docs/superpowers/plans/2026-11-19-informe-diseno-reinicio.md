# Informe del paciente (diseño), pauta indefinida hasta 2027, contacto y reinicio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** (1) botón para empezar de nuevo; (2) hoja del paciente con el mejor diseño posible, con calendario de todo 2027 cuando la pauta es indefinida, mensaje de consulta al farmacéutico y recuadro de hospital / farmacéutico / teléfono; (3) verificación visual real con Chrome.

**Architecture:** el motor no cambia de contrato. Un esquema puede declarar `duracion:"indefinida"`; la vista calcula entonces tantos ciclos/dosis como hagan falta para cubrir hasta `#cal_hasta` (por defecto 2027-12-31, tope de 60 del motor). Datos de contacto en el sub-panel Informe (`#inf_hospital`, `#inf_farmaceutico`, `#inf_telefono`) con respaldo en los campos de Infografía (`#center`, `#pharm_name`, `#contact`), solo en memoria.

**Tech Stack:** HTML/CSS/JS clásico, UMD, `node --test` + jsdom, sin build, `file://`. **Verificación visual:** Chrome real está en `/usr/bin/google-chrome` y Playwright (Python) disponible; el script de partida es `/home/claude/visual/shot.py` (abre `index.html` por `file://`, recorre las sub-pestañas, guarda capturas en `/tmp/shots/` y genera `hoja.pdf`; `pdftoppm -r 60 -png` lo convierte en imágenes que se pueden mirar con la herramienta Read). Quien implemente la hoja DEBE mirar las imágenes, iterar y mencionar en su informe qué vio.

## Global Constraints
- No editar `css/rxplain.css` ni `js/infografia.js`. Infografía y su impresión no cambian (verificarlo también por PDF: imprimir la infografía antes y después y comparar).
- Sin build; `<script src>` clásicos; ninguna ruta empieza por `_` o `.`; funciona desde `file://`.
- Nada del paciente ni de las pautas se guarda (ni storage ni cookies). Los datos del profesional tampoco se guardan en esta entrega.
- Todo texto de usuario o externo se escapa. No se calculan dosis.
- Aviso pendiente fail-safe (todo salvo `estado === "validado"`), visible en cada página impresa, legible en blanco y negro (texto + borde grueso, no solo color). La hoja debe ser comprensible en B/N: hospital = borde grueso + texto "HOSPITAL"; casa = texto "casa"/símbolo distinto.
- Mensaje fijo y destacado en la hoja: «Consulte con su farmacéutico ante cualquier cambio de día de administración.»
- Los esquemas incluidos de mieloma NO se marcan indefinidos (decisión clínica de la persona responsable).

## Review Focus
- Fecha de inicio posterior a `hasta`; pauta indefinida con intervalo largo (pocas dosis) o diaria; n máximo 60 alcanzado antes de cubrir 2027 → aviso visible de "calendario recortado hasta DD/MM/AAAA".
- Hoja: 0 eventos, 1 mes, 12+ meses, nombre de paciente/hospital con `<`/`"`, teléfono con espacios/+34, campos de contacto vacíos (no imprimir recuadros vacíos que parezcan datos).
- Impresión real (PDF de Chrome): ninguna página sin aviso si pendiente; ningún mes partido entre páginas; ninguna página casi vacía innecesaria; leyenda presente.
- Reinicio: no deja datos del paciente en el DOM (hoja, vista previa, campo de paciente); no borra los datos del profesional salvo que se pida.

---
### Task 1: Pauta indefinida, "calendario hasta" y datos de contacto
**Files:** Modify `js/regimen-data.js` (campo opcional `duracion` ∈ `"limitada"|"indefinida"`, por defecto limitada; validar), `js/constructor-pauta.js` (+ casilla "Pauta indefinida (se continúa hasta que su médico indique otra cosa)"), `js/calendario-view.js` (control `#cal_indefinida` casilla + `#cal_hasta` fecha, visible en la sub-pestaña Calendario, por defecto marcado si el esquema es indefinido, hasta=2027-12-31; al estar activo el nº de ciclos/dosis se calcula para cubrir hasta esa fecha; aviso si el tope de 60 recorta), `js/hoja-paciente.js` (recibe `schedule` ya extendido; añade en el contexto `indefinida` y `hasta`), `index.html`/`css/calendario.css` (campos de contacto en `#sub-informe`: `#inf_hospital`, `#inf_farmaceutico`, `#inf_telefono`, con respaldo en `#center`, `#pharm_name`, `#contact`; la hoja usa los de Informe si no están vacíos), tests, README.
**Interfaces:** `ctx.profesional = {centro, nombre, contacto, fecha}` ya existe: rellenarlo desde los campos nuevos con respaldo; añadir `ctx.indefinida:boolean`, `ctx.hasta:iso`.
- [ ] Tests (jsdom): validación de `duracion`; indefinida extiende ciclos hasta cubrir 2027-12-31 (DRd ejemplo con inicio 2026-11-19 → último evento ≥ 2027-12-xx o aviso de recorte); intervalo largo; inicio posterior a hasta; contacto de Informe prevalece sobre Infografía; escape; vista previa se refresca.
- [ ] Implementar, `npm test`, commit.

### Task 2: Rediseño de la hoja del paciente (verificado con Chrome)
**Files:** Modify `js/hoja-paciente.js`, `css/calendario.css` (reglas de impresión bajo `body[data-printing="calendario"]` y de la vista previa), tests `tests/hoja.test.mjs`.
**Diseño exigido:** A4 vertical. **Página 1 (portada):** franja superior con nombre del hospital (grande), título "Su calendario de tratamiento", paciente, nombre del esquema y fecha de inicio; recuadro destacado con el mensaje fijo de consulta al farmacéutico; tarjetas "Sus próximas administraciones" (las próximas 8; fecha grande con día de la semana, fármaco, dosis, dónde) ; leyenda de símbolos (HOSPITAL / en casa / inyección en casa / festivo-fin de semana con aviso); recuadro de contacto (hospital, farmacéutico responsable, teléfono) con tamaño de letra generoso. **Calendario:** meses desde el inicio hasta el final (hasta 2027 si indefinida), **dos meses por página** (3 si caben sin perder legibilidad), cada celda con número de día y marcadores en texto; días de hospital con borde grueso y la palabra HOSPITAL; sin meses partidos; cabecera de cada página con el nombre del hospital + aviso pendiente (si procede) + "Consulte con su farmacéutico…" en el pie de cada página. **Última página:** lista compacta de visitas al hospital y tabla de medicación en casa con "Qué días". Tipografía de sistema, tamaño mínimo 10 pt en celdas, 12 pt en tablas, contraste alto, imprimible en B/N sin perder información.
- [ ] Generar el PDF con `/home/claude/visual/shot.py` (ajustarlo para fijar contacto y paciente de prueba), convertirlo con `pdftoppm -r 60 -png`, **mirar cada página con Read** y iterar hasta que: ningún mes se parte, ninguna página queda casi vacía sin razón, el aviso pendiente está en todas, la jerarquía visual es clara. Repetir con esquema validado simulado (sin banner), con pauta por intervalo y con 12+ meses. Guardar el informe de lo observado.
- [ ] Tests de contenido (mensaje fijo presente, contacto, orden, escapes, banner por página en pendiente) y `npm test`; commit.

### Task 3: Botón "Empezar de nuevo"
**Files:** Modify `js/calendario-view.js`, `js/farmacos-view.js`, `css/calendario.css`, tests.
**Interfaces:** botón visible en la barra de sub-pestañas de Calendario: «↺ Empezar de nuevo» con confirmación en línea (dos pasos, sin `window.confirm`): "Se borrarán los datos del paciente, la fecha, los ciclos, los retrasos y las búsquedas. [Borrar] [Cancelar]". Restaura: identificador de paciente vacío, fecha de inicio = hoy, ciclos = valor por defecto del esquema, retrasos vacíos, buscador/área de Esquemas, búsqueda y resultados de Fármacos (y el apartado 4.2 mostrado), vista previa del Informe, hoja de impresión (`limpiarHoja`), sub-pestaña = Calendario. NO borra los datos del profesional (hospital, farmacéutico, teléfono) ni las pautas propias creadas; segunda opción en el mismo diálogo: casilla "Borrar también mis pautas propias y datos del profesional".
- [ ] Tests: tras reiniciar no queda ningún dato del paciente en el DOM (`#cal_paciente`, vista previa, `#hojaPaciente`); profesional conservado; casilla borra pautas propias (se des-registran del `RxData` o se ocultan; elegir lo más simple que sea correcto y documentarlo); cancelar no cambia nada; `data-printing` limpio.
- [ ] Implementar, `npm test`, commit.

# RxPlain 2.0: rediseño visual — diseño

Fecha: 2026-11-23 · Estado: aprobado por Ramón (portada con dos tarjetas, cabecera compacta fija, Calendario en dos columnas, pie con autoría/versión/aviso legal, tipografía del sistema)

## Intención
Que la web resulte moderna, eficiente y atractiva, con **las dos funcionalidades generales claramente diferenciadas** (Infografía para el paciente · Calendario de tratamiento), con autoría, fechas y propiedad visibles y con los cánones de un producto sanitario profesional (claridad, jerarquía, accesibilidad, sobriedad).

## Decisiones del propietario
- **Propiedad**: «Todos los derechos reservados» + uso gratuito para fines profesionales y docentes. Reproducir, distribuir, modificar, obras derivadas y uso comercial requieren autorización.
- **Contador de visitas**: **no se incluye** (una web estática necesita un servicio externo; se mantiene la declaración «ninguna comunicación de red salvo CIMA»).
- **Fecha de creación**: se conserva febrero de 2026 (primera publicación) y se añaden «Versión 2.0 · Actualizada en noviembre de 2026».

## Objetivos / no objetivos
- Objetivos: portada que presente ambas herramientas; cabecera compacta; espacio de trabajo a ancho completo; Calendario en dos columnas; pie y aviso legal; accesibilidad AA; móvil de 320 px.
- No objetivos: cambiar el contenido ni el aspecto **impreso** (infografía y hoja del paciente); añadir analítica; cambiar la lógica de las herramientas.
- Anti-objetivo (fallo aunque «se vea bien»): que el rediseño altere lo que se entrega al paciente. Se verifica comparando PDF de impresión antes/después (texto, páginas y píxeles).

## Restricciones
Web estática sin compilación ni dependencias de ejecución; funciona desde `file://`; sin recursos externos (la red del hospital puede bloquear fuentes); Chrome/Edge.

## Aproximaciones
1. **Capa de diseño (`css/tema.css`) sobre la estructura existente + reestructurar solo la cromática (elegida).** Bajo riesgo para lo impreso, cambio incremental, tests existentes intactos salvo pestañas por defecto.
2. Reescribir `rxplain.css` entero: más limpio, pero arriesga la infografía impresa y la hoja.
3. Framework de UI / fuentes externas: descartado (sin compilación, sin red).

## Diseño
- **Navegación**: barra superior fija con marca y pestañas Inicio · Infografía · Calendario · Guía de uso; «Aviso legal» (`#tab-legal`) se abre desde el pie. `tabs.js` gestiona paneles, enlaces directos por hash, `data-goto-tab` y el título del documento.
- **Portada**: título, dos tarjetas de herramienta con color propio (teal / índigo), icono, tres ventajas y acción principal; franja de garantías; usos; tres pasos.
- **Áreas de trabajo**: cada herramienta con su cabecera de color; botones y pestañas activas adoptan el acento de la herramienta.
- **Calendario**: `.cal-layout` en dos columnas ≥ 1080 px (pauta + controles | resumen + avisos + meses).
- **Pie**: autoría, fechas, versión, uso responsable, legal, copyright. **Aviso legal**: titularidad, propiedad y condiciones, responsabilidad, privacidad, fuentes (CIMA/AEMPS), versión y novedades.
- **Superficies impresas aisladas**: `.infografia`, `#outputWrap`, `#hojaPaciente`, `.informe-preview` redefinen los tokens y la tipografía de la v1; el bloque `@media print` de la capa reafirma las reglas de impresión de la v1 que la capa nueva pisaría (ancho de página, color negro, enlaces).

## Verificación
Tests (`tests/diseno.test.mjs`, `tabs`, `guia`): estructura/ARIA, ids únicos, portada, pie, aviso legal, coherencia de versión y fechas, ausencia de recursos externos y analítica, contraste WCAG AA, reglas de impresión (con comprobación de que fallan al romper cada una). Manual: capturas 320–1280 px y comparación de PDF de impresión (infografía y hoja) contra la versión anterior.

## Pendiente
Texto legal orientativo: revisar con el servicio jurídico / DPD. Comprobación en Chrome y Edge reales.

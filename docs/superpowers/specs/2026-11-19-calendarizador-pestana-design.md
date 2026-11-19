# RxPlain: pestaña "Calendario" (calendarizador de pautas) — diseño

Fecha: 2026-11-19 · Estado: aprobado por Ramón en conversación (diseño corto)

## Intención
RxPlain traduce el tratamiento a lenguaje del paciente (infografía). Se añade el *cuándo*:
un calendario de tratamiento que el farmacéutico revisa, imprime y entrega al paciente.
Punto de partida: el artefacto "HematoFH Mieloma" (calendario + hoja del paciente + costes)
creado para una compañera de hematología. Se reutiliza su motor de ciclos y fases.

## Objetivos
- Dos pestañas en RxPlain: **Infografía** (la actual, sin cambios de comportamiento) y **Calendario** (nueva).
- Calendario: esquema + fecha de inicio + nº de ciclos → vista mensual y hoja A4 para el paciente.
- Retrasar un ciclo recoloca el resto; aviso de citas de hospital en festivo o fin de semana.
- Pensado para varias áreas (oncología, hematología, inmunomediadas), no solo mieloma.

## No objetivos
- Costes, bases de datos/Supabase, árboles de decisión de protocolos, comparafar.
- Calcular o recomendar dosis: el calendario coloca fechas y tomas; el texto de dosis lo escribe el farmacéutico.

## Anti-objetivos (fallo aunque "funcione")
- Guardar datos del paciente en ningún sitio (localStorage, servidor, repo). Debe constar en el README.
- Imprimir una hoja con un esquema "pendiente de validación" sin avisarlo.
- Hoja ilegible en impresora monocromo (no depender solo del color).

## Restricciones
- Web estática, gratuita, sin compilación, sin APIs de pago; funciona en Chrome y Edge de los ordenadores del hospital.
- Repo público (`ramonmorillo/rxplain`): sin datos de pacientes ni datos internos del hospital.
- Estado actual: un único `index.html` (~53 KB, JS sin framework). Despliegue desconocido; comprobar antes de partir el archivo.

## Aproximaciones consideradas
1. **Pestaña en RxPlain, motor aislado en su propio archivo, esquemas como datos en archivos .js (elegida).** Simple, sin sincronizar repos.
2. Repo aparte del calendarizador usado por RxPlain: sin compilación obliga a copiar archivos entre repos. Descartada.
3. Todo en Comparafar: descartada por Ramón.

## Diseño
- **Estructura:** `index.html`, `css/`, `js/` (app de infografía, navegación por pestañas, `schedule-engine.js`, vista de calendario, hoja imprimible), `data/regimens/*.js`.
- **Motor** (derivado del artefacto): esquemas por fases (ciclos desde–hasta, duración, ítems con fármaco, dosis, base mg/kg/m²/fija, días, lugar). Ampliaciones respecto al artefacto:
  - tomas por día (p. ej. cada 12 h);
  - pautas por intervalos largos sin ciclos (semanas 0, 2, 6 y luego cada 8/12 semanas), sin el tope de 56 días del editor;
  - administración en casa (autoinyección) distinta de hospital y de toma oral.
  Se elimina todo lo de costes y la vía SC/IV específica de anti-CD38 (se generaliza a "alternativa de vía" solo si hace falta).
- **Datos de esquema:** cada archivo de esquema lleva `fuente`, `fecha_revision` y `estado` (`validado` | `pendiente`). Los esquemas de mieloma del artefacto entran como `pendiente` solo para probar el motor. Los de oncología, hematología e inmunomediadas los aporta Ramón con su fuente; no se inventan.
- **Hoja del paciente:** A4, letra grande, símbolo + texto además de color; reutiliza el bloque de personalización profesional de RxPlain; si el esquema está `pendiente`, aviso visible en pantalla y en el impreso. Impresión por el flujo de RxPlain (imprimir/PDF); se sustituye la descarga exclusiva de artefactos por métodos estándar de navegador.
- **Privacidad:** identificador de paciente solo en memoria durante la sesión.

## Pendiente del constructor
- Estructura exacta de ficheros y nombres.
- Cómo se publica RxPlain hoy (verificar) y que la división no lo rompa.
- Fuentes web (el artefacto usa Google Fonts): decidir si se mantienen o se usan tipografías del sistema por si la red del hospital las bloquea.
- Decisión del constructor: los esquemas son archivos `.js` (no `.json`) para que la herramienta funcione también abierta desde disco (`file://`), donde el navegador bloquea `fetch` de JSON locales.

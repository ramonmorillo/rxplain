# RxPlain

Herramienta web estática para generar una **infografía de la farmacoterapia del paciente** (imprimible), con una segunda pestaña, **Calendario**, para calendarizar pautas de tratamiento y entregar al paciente una hoja imprimible.

No requiere servidor ni instalación: es HTML, CSS y JavaScript sin dependencias de ejecución, y funciona abriendo `index.html` directamente desde disco (`file://`) en Chrome o Edge.

## Pestañas

### Infografía
Genera una infografía imprimible de la medicación del paciente. Incluye una consulta opcional a CIMA/AEMPS (ver Privacidad).

### Calendario
- Se elige una pauta de un catálogo agrupado por área (Hematología, Oncología, Inmunomediadas), una fecha de inicio y el número de ciclos (o de dosis).
- Dos tipos de pauta:
  - `ciclos`: fases con duración fija en días y fármacos con los días del ciclo en que se administran (p. ej. un ciclo de 28 días).
  - `intervalo`: dosis separadas por intervalos (desplazamientos desde el inicio, primer mantenimiento y periodicidad).
- **Avisos de conflicto**: se señalan las visitas al hospital que caen en fin de semana o festivo. Los festivos que conoce el motor son una lista fija (nacionales más el Día de Andalucía) y Jueves y Viernes Santo calculados; **no incluye otros festivos autonómicos ni locales** (conviene que el farmacéutico los revise).
- **Hoja del paciente imprimible**: si el esquema está en estado `pendiente`, la hoja lleva el banner "ESQUEMA PENDIENTE DE VALIDACIÓN — NO ENTREGAR AL PACIENTE".

> Los tres esquemas de mieloma múltiple incluidos (`mieloma-drd`, `mieloma-vrd-swog`, `mieloma-isa-kd`) están todos en `estado: "pendiente"`: proceden de una hoja de costes del Servicio y **no han sido validados clínicamente**. No deben entregarse a pacientes hasta su revisión.

## Privacidad

Declaración, comprobada con una búsqueda en el código (`js/`, `data/`, `index.html`, `css/`):

- **No se guarda nada del paciente.** No hay uso de `localStorage`, `sessionStorage`, cookies ni IndexedDB. Al recargar la página los datos introducidos desaparecen.
- **No hay comunicaciones de red**, salvo la consulta opcional ya existente a la API pública de CIMA/AEMPS (`https://cima.aemps.es/cima/rest`) desde la pestaña Infografía (`js/infografia.js`). La pestaña Calendario no realiza ninguna petición de red.
- No hay analítica, CDN, fuentes externas ni scripts de terceros. Los enlaces a EMA, AEMPS, CIMA y SEFH de la infografía son enlaces que abre el usuario.

Esta declaración describe el código del repositorio. Si se modifica el código, debe volver a verificarse.

## Cómo añadir un esquema

Cada esquema es un archivo en `data/regimens/` que llama a `RxData.register({...})`. Se valida al registrarse (`js/regimen-data.js`) y, si hay un error, lanza una excepción con el campo afectado. Usar de modelo `data/regimens/mieloma-drd.js` (por ciclos) y `data/regimens/mieloma-isa-kd.js`; los atajos para construir fármacos están en `data/regimens/_helpers.js`. El tipo `intervalo` no lo usa ninguno de los tres esquemas incluidos; hay un ejemplo sintético en `tests/fixtures/regimen-intervalo.mjs`.

**Un esquema debe proceder siempre de una fuente citable (ficha técnica, guía, protocolo del servicio). Nunca se inventa.** La herramienta no calcula dosis: `dosis` es texto que se muestra tal cual.

Campos comunes (obligatorios salvo indicación):

| Campo | Descripción |
|---|---|
| `id` | Texto único, p. ej. `mieloma-drd` |
| `nombre` | Nombre visible |
| `area` | `Hematología`, `Oncología` o `Inmunomediadas` |
| `linea` | Texto, p. ej. `1ª línea · no candidatos` |
| `estado` | `validado` o `pendiente` |
| `fuente` | Texto no vacío con el origen del esquema |
| `fecha_revision` | `YYYY-MM-DD`; solo puede ser `null` si `estado` es `pendiente` |
| `ciclos_defecto` | Número >= 1 |
| `ensayo`, `continuo`, `notas`, `supuestos` | Opcionales (`notas` y `supuestos` son arrays de texto) |

Esquema por ciclos (por defecto): `fases: [{ desde, hasta (null = sin límite), duracion (días, entero), etiqueta, items: [...] }]`. Cada item: `farmaco`, `abrev`, `dosis` (texto), `lugar` (`hospital`, `casa` o `casa_inyeccion`), `dias` (enteros >= 1 y <= `duracion`), y opcionalmente `etiqueta` y `veces_al_dia`.

Esquema por intervalo: `tipo: "intervalo"` e `items: [{ farmaco, abrev, dosis, lugar, desplazamientos_dias: [0, ...], primer_mantenimiento_dia, cada_dias, dosis_totales }]`.

Pasos:
1. Crear `data/regimens/<id>.js` siguiendo uno de los modelos.
2. Añadir su etiqueta `<script src="data/regimens/<id>.js"></script>` en `index.html`, junto a las de los demás esquemas y antes de `js/calendario-view.js`.
3. Añadir pruebas si el esquema introduce un caso nuevo y ejecutar `npm test`.
4. Dejarlo en `estado: "pendiente"` hasta que un farmacéutico lo valide; solo entonces pasar a `validado` con `fecha_revision`.

## Pruebas

Requiere Node 22. `jsdom` es dependencia solo de desarrollo (no se carga en la aplicación).

```
npm install
npm test
```

## Estructura del proyecto

```
index.html                 Página única; carga los scripts
css/rxplain.css            Estilos de la infografía
css/calendario.css         Estilos de la pestaña Calendario y de la hoja impresa
js/infografia.js           Infografía y consulta opcional a CIMA
js/tabs.js                 Pestañas
js/schedule-engine.js      Motor de calendarización (fechas, festivos, avisos)
js/regimen-data.js         Registro y validador de esquemas
js/calendario-view.js      Interfaz de la pestaña Calendario
js/hoja-paciente.js        Hoja imprimible del paciente
data/regimens/             Esquemas (+ _helpers.js)
tests/                     Pruebas (node --test)
docs/superpowers/          Especificación y plan del desarrollo
```

## Publicación

La aplicación es estática (sin compilación) y funciona desde `file://`. **El método de publicación (p. ej. GitHub Pages) NO se ha verificado y debe confirmarlo el propietario del repositorio**; este README no afirma ninguna URL publicada.

## Verificación manual pendiente

Pendiente de realizar por el farmacéutico en Chrome y en Edge (no se ha podido ejecutar un navegador en el desarrollo; las pruebas automáticas no sustituyen esta revisión):

- [ ] (a) Abrir `index.html` desde disco y desde la URL publicada (una vez confirmada).
- [ ] (b) Generar una infografía de ejemplo ("Cargar ejemplo") e imprimir en vista previa: debe verse igual que antes de añadir la pestaña Calendario.
- [ ] (c) En Calendario, cargar DRd con inicio en sábado y comprobar que aparece el aviso de conflicto.
- [ ] (d) Imprimir la hoja del paciente: el banner de "pendiente" debe ser visible y legible en blanco y negro.

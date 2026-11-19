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
- **Avisos de conflicto** (`js/calendario-view.js`, a partir de los festivos de `js/schedule-engine.js`): se señalan las visitas al hospital que caen en fin de semana o festivo. Los festivos que conoce el motor son una lista fija (nacionales más el Día de Andalucía) y Jueves y Viernes Santo calculados; **no incluye otros festivos autonómicos ni locales** (conviene que el farmacéutico los revise).
- **Hoja del paciente imprimible**: si el esquema está en estado `pendiente`, la hoja lleva el banner "ESQUEMA PENDIENTE DE VALIDACIÓN — NO ENTREGAR AL PACIENTE" (en cabecera y repetido en cada mes). El banner se muestra salvo que `estado` sea exactamente `validado`. La tabla de medicación en casa indica en qué días del ciclo se toma cada fármaco.

> Los tres esquemas de mieloma múltiple incluidos (`mieloma-drd`, `mieloma-vrd-swog`, `mieloma-isa-kd`) están todos en `estado: "pendiente"`: proceden de una hoja de costes del Servicio y **no han sido validados clínicamente**. No deben entregarse a pacientes hasta su revisión.

## Privacidad

Declaración, comprobada con una búsqueda en el código (`js/`, `data/`, `index.html`, `css/`):

- **No se guarda nada del paciente.** No hay uso de `localStorage`, `sessionStorage`, cookies ni IndexedDB. Al recargar la página los datos introducidos desaparecen.
- **No hay comunicaciones de red**, salvo la consulta opcional ya existente a la API pública de CIMA/AEMPS (`https://cima.aemps.es/cima/rest`) desde la pestaña Infografía (`js/infografia.js`). La sub-pestaña Fármacos del Calendario (`js/cima.js`, `js/farmacos-view.js`) consulta la misma API solo al pulsar Buscar o elegir un resultado, enviando únicamente el nombre del fármaco o su nº de registro; el resto del Calendario no realiza peticiones de red.
- No hay analítica, CDN, fuentes externas ni scripts de terceros. Los enlaces a EMA, AEMPS, CIMA y SEFH de la infografía son enlaces que abre el usuario.

Esta declaración describe el código del repositorio. Si se modifica el código, debe volver a verificarse.

## Cómo añadir un esquema

Cada esquema es un archivo en `data/regimens/` que llama a `RxData.register({...})`. Se valida al registrarse (`js/regimen-data.js`) y, si hay un error, lanza una excepción con el campo afectado. Usar de modelo `data/regimens/mieloma-drd.js` (por ciclos) y `data/regimens/mieloma-isa-kd.js`; los atajos para construir fármacos están en `data/regimens/helpers.js`. El tipo `intervalo` no lo usa ninguno de los tres esquemas incluidos; hay un ejemplo sintético en `tests/fixtures/regimen-intervalo.mjs`.

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

## Pautas propias

En la pestaña Calendario, el botón **Crear pauta propia** abre un formulario para definir una pauta sin editar código:

- Elija nombre, área y tipo: *por ciclos* (p. ej. "días 1–21 de 28") o *por intervalo* (dosis sueltas, p. ej. "0, 14, 28 y luego cada 56 días").
- **Añadir fármaco** crea una fila por fármaco. Los días se escriben como lista o rango: `1-21`, `1,8,15`, `1-3, 8`.
- Hay dos ejemplos precargables: "Biológico cada N semanas" y "Oral días 1–21 de 28".
- La pauta se registra solo en memoria con `estado: "pendiente"` (fuente "Pauta definida por el usuario (sin validar)"); se selecciona y se pinta al crearla, y la hoja impresa lleva el aviso de pendiente. No se guarda al cerrar la página.
- La dosis es texto libre: la herramienta no calcula dosis.

La lógica está en `js/constructor-pauta.js` (`RxBuilder.buildRegimen`) y sus pruebas en `tests/constructor-pauta.test.mjs`.

## Pruebas

Requiere Node >= 22 (campo `engines` de `package.json`). `jsdom` es dependencia solo de desarrollo (no se carga en la aplicación).

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
js/cima.js                 Cliente CIMA/AEMPS (búsqueda y apartado 4.2; `fetch` inyectable)
js/farmacos-view.js        Sub-pestaña Fármacos
js/schedule-engine.js      Motor de calendarización (fechas, festivos)
js/regimen-data.js         Registro y validador de esquemas
js/calendario-view.js      Interfaz de la pestaña Calendario (incluye los avisos y la detección de conflictos)
js/hoja-paciente.js        Hoja imprimible del paciente
data/regimens/             Esquemas (+ helpers.js)
tests/                     Pruebas (node --test)
docs/superpowers/          Especificación y plan del desarrollo
```

## Fármacos y CIMA

La sub-pestaña **Fármacos** busca un medicamento en CIMA/AEMPS (`/medicamentos?nombre=…`), muestra nombre, principio activo, forma y enlace a CIMA, y al elegir uno carga el apartado 4.2 de la ficha técnica (`/docSegmentado/contenido/1?nregistro=…&seccion=4.2`). El «fármaco normalizado» (principio activo + nº de registro) se guarda solo en memoria.

**Limitaciones:** no ha podido probarse contra CIMA real (el entorno de desarrollo no tiene acceso); los tests usan respuestas simuladas. El formato del endpoint `docSegmentado` no está verificado, por lo que el código acepta JSON o HTML/texto y, si falla o viene vacío, muestra un aviso y el enlace a la ficha técnica en CIMA. El texto del 4.2 es solo orientativo: la ficha oficial manda. La llamada solo ocurre al pulsar Buscar/Enter o al elegir un resultado, y nunca incluye datos del paciente.

### Borrador de pauta desde la ficha técnica

Con el 4.2 cargado, **Proponer pauta** (`js/posologia-ft.js`) lee solo la *frecuencia* y muestra cada propuesta junto a la frase de la que sale; **Usar en el constructor** la precarga en el formulario de Esquemas. Es un borrador automático: no sustituye la validación farmacéutica, y la pauta que se cree queda siempre como *pendiente*.

**Límites:**
- Reconoce solo patrones simples en español: «una vez / dos veces… al día», «cada N horas» (si 24/N es entero de 1 a 6), «días 1 a 21 de ciclos de 28 días», «21 de cada 28 días», «cada N semanas/días» y «semanas 0, 2 y 4 y después cada 8 semanas». Admite coma decimal, pero solo si el resultado son días enteros («cada 1,5 semanas» no se propone).
- No extrae ni calcula **dosis** (queda vacía), ni área ni lugar de administración (quedan sin elegir); el farmacéutico debe completarlos para poder crear la pauta.
- Cada frase se analiza por separado: una pauta partida en dos frases («semanas 0, 2 y 4. Después, cada 8 semanas.») se propone como dos propuestas independientes, no fusionadas. Ante varias frecuencias se muestran varias propuestas.
- En «semanas 0, 2 y 4 y después cada 8 semanas» el primer mantenimiento se sitúa en el día 56 (intervalo contado desde el día 0); la ficha puede querer contarlo desde la última dosis inicial. Si el mantenimiento no cae después de la última dosis inicial se deja vacío y se avisa.
- Lo que no se entiende (rangos incoherentes, horas que no dividen 24, ajustes por peso, insuficiencia renal, etc.) no se propone: se muestra un aviso. El texto de la ficha es complejo; revise siempre el original.
- Los tests usan frases sintéticas inventadas, no citas de fichas reales, y no se ha contrastado con fichas técnicas reales.

## Publicación

La aplicación es estática (sin compilación) y funciona desde `file://`. **El método de publicación (p. ej. GitHub Pages) NO se ha verificado y debe confirmarlo el propietario del repositorio**; este README no afirma ninguna URL publicada.

## Verificación manual pendiente

Pendiente de realizar por el farmacéutico en Chrome y en Edge (no se ha podido ejecutar un navegador en el desarrollo; las pruebas automáticas no sustituyen esta revisión):

- [ ] (a) Abrir `index.html` desde disco y desde la URL publicada (una vez confirmada).
- [ ] (b) Generar una infografía de ejemplo ("Cargar ejemplo") e imprimir en vista previa: debe verse igual que antes de añadir la pestaña Calendario.
- [ ] (c) En Calendario, cargar DRd con inicio en sábado y comprobar que aparece el aviso de conflicto.
- [ ] (d) Imprimir la hoja del paciente: el banner de "pendiente" debe ser visible y legible en blanco y negro **y aparecer en CADA página impresa** de una hoja de varias páginas.

## Publicación (GitHub Pages)

El archivo `.nojekyll` (vacío, en la raíz) existe para evitar que Jekyll omita en silencio archivos y carpetas cuyo nombre empieza por `_` o `.`. Aun así, no se deben nombrar así los archivos que carga `index.html`; un test lo comprueba.

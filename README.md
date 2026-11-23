# RxPlain

Herramienta web estática para generar una **infografía de la farmacoterapia del paciente** (imprimible), con una segunda pestaña, **Calendario**, para calendarizar pautas de tratamiento y entregar al paciente una hoja imprimible.

No requiere servidor ni instalación: es HTML, CSS y JavaScript sin dependencias de ejecución, y funciona abriendo `index.html` directamente desde disco (`file://`) en Chrome o Edge.

## Pestañas

### Infografía
Genera una infografía imprimible de la medicación del paciente. Incluye una consulta opcional a CIMA/AEMPS (ver Privacidad).

### Calendario
- La **pauta se define en la propia pestaña Calendario** (no hay catálogo de esquemas) y el calendario se recalcula al escribir: fármacos, dosis, lugar, días, fecha de inicio y número de ciclos (o de dosis).
- Dos tipos de pauta:
  - `ciclos`: un ciclo de N días y, para cada fármaco, los días del ciclo en que se administra (p. ej. días 1–21 de 28).
  - `intervalo`: dosis separadas por intervalos (desplazamientos desde el inicio, primer mantenimiento y periodicidad).
- **Avisos de conflicto** (`js/calendario-view.js`, a partir de los festivos de `js/schedule-engine.js`): se señalan las visitas al hospital que caen en fin de semana o festivo. Los festivos que conoce el motor son una lista fija (nacionales más el Día de Andalucía) y Jueves y Viernes Santo calculados; **no incluye otros festivos autonómicos ni locales** (conviene que el farmacéutico los revise).
- **Hoja del paciente imprimible**: salvo que se marque la casilla «Pauta revisada y validada por el farmacéutico» (`#cb_validada`, desmarcada por defecto), la pauta queda `pendiente` y la hoja lleva el banner «ESQUEMA PENDIENTE DE VALIDACIÓN — NO ENTREGAR AL PACIENTE» (en cabecera y repetido en cada mes). La tabla de medicación en casa indica en qué días del ciclo se toma cada fármaco.

#### Flujo de las tres sub-pestañas
1. **Desde el propio campo «Fármaco»** de la pauta (Calendario): al escribir 3 o más letras aparece un desplegable con los medicamentos de CIMA; al elegir uno se lee su ficha (apartado 4.2) y se rellena la pauta tentativa (la propuesta cuya frase menciona la concentración elegida; un selector permite cambiar a otra propuesta de la ficha). Queda el cursor en la dosis. **O en la sub-pestaña Fármacos**: buscar el medicamento en CIMA, leer el apartado 4.2 y, si se quiere, proponer un borrador de pauta. **Usar en el calendario** lo precarga en la pestaña Calendario y deja el cursor en el primer campo que falta (normalmente la dosis).
2. **Calendario**: la pauta (formulario `#cal_pauta`), fecha de inicio, ciclos/dosis y retrasos; avisos de conflicto y calendario mensual.
   - **Pauta indefinida** (casilla `#cal_indefinida`, control del usuario; una propuesta *diaria* de la ficha la marca): el nº de ciclos/dosis se calcula para cubrir hasta `#cal_hasta` («Calendario hasta», por defecto 31/12/2027); el campo de ciclos queda automático. El motor calcula como máximo 60 ciclos/dosis: si no llega a esa fecha se muestra el aviso «Calendario recortado hasta DD/MM/AAAA». Si la fecha de inicio es posterior a «Calendario hasta» se avisa y no se calcula nada.
   - Un nº de ciclos fuera de 1–60 o no entero se ajusta y se avisa de lo que se ha calendarizado.
3. **Informe**: identificador del paciente (opcional, no se guarda), y datos de contacto de la hoja (`#inf_hospital`, `#inf_farmaceutico`, `#inf_telefono`; si se dejan vacíos se usan los de Infografía `#center`, `#pharm_name`, `#contact`; solo en memoria) y vista previa en pantalla (`#informe_preview`), generada con la misma función que la hoja impresa y refrescada con cada cambio. Empieza por **«Sus próximas administraciones»**: las próximas 8 desde la fecha de inicio (o desde hoy si la pauta ya empezó), con día de la semana, fármaco, dosis y lugar (hospital: texto HOSPITAL y borde grueso; casa: «En casa»); si no queda ninguna, indica «0 administraciones». Termina con el aviso «Este informe no sustituye las indicaciones de su farmacéutico o médico». La vista previa no se imprime; el botón imprime la hoja construida aparte (`#hojaPaciente`). Nada se guarda fuera de la memoria de la página.

## Privacidad

Declaración, comprobada con una búsqueda en el código (`js/`, `data/`, `index.html`, `css/`):

- **No se guarda nada del paciente.** No hay uso de `localStorage`, `sessionStorage`, cookies ni IndexedDB. Al recargar la página los datos introducidos desaparecen.
- **No hay comunicaciones de red**, salvo las consultas a la API pública de CIMA/AEMPS (`https://cima.aemps.es/cima/rest`), que solo reciben el **texto del campo Fármaco** (o el nº de registro de un medicamento ya elegido), nunca datos del paciente: (a) el desplegable del campo «Fármaco» de la pauta consulta CIMA **mientras se escribe** (a partir de 3 letras y con una pausa de ~0,35 s) y, al elegir una opción, lee su apartado 4.2 (`js/farmaco-combo.js`, `js/calendario-view.js`); (b) la sub-pestaña Fármacos consulta solo al pulsar Buscar o elegir un resultado (`js/cima.js`, `js/farmacos-view.js`); (c) la pestaña Infografía mantiene su consulta opcional (`js/infografia.js`). El resto del Calendario no realiza peticiones de red.
- No hay analítica, CDN, fuentes externas ni scripts de terceros. Los enlaces a EMA, AEMPS, CIMA y SEFH de la infografía son enlaces que abre el usuario.

Esta declaración describe el código del repositorio. Si se modifica el código, debe volver a verificarse.

## La pauta

El formulario **Pauta** de la pestaña Calendario define qué se toma y cuándo, sin editar código:

- Tipo: *por ciclos* (p. ej. «días 1–21 de 28») o *por intervalo* (dosis sueltas, p. ej. «0, 14, 28 y luego cada 56 días»). El nombre es opcional (por defecto, el del primer fármaco).
- **Añadir fármaco** crea una fila por fármaco (fármaco, abreviatura, dosis, lugar —casa por defecto—, veces al día y días). Los días se escriben como lista o rango: `1-21`, `1,8,15`, `1-3, 8`. Mientras la pauta esté incompleta se indica qué falta y no se pinta calendario.
- Hay dos ejemplos precargables: «Biológico cada N semanas» y «Oral días 1–21 de 28».
- La pauta vive solo en memoria y nunca se guarda. Queda `pendiente` (fuente «Pauta definida por el usuario (sin validar)») hasta que el farmacéutico marca la casilla de validación.
- La dosis es texto libre: la herramienta no calcula dosis.

Una pauta debe proceder de una fuente citable (ficha técnica, guía, protocolo del servicio): la herramienta no la inventa. La lógica está en `js/constructor-pauta.js` (`RxBuilder.buildRegimen`) y su validación en `js/regimen-data.js` (`RxData.check`); las pruebas, en `tests/constructor-pauta.test.mjs` y `tests/regimen-data.test.mjs`.

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
js/farmaco-combo.js        Desplegable de fármacos (CIMA) del campo «Fármaco» de la pauta
js/schedule-engine.js      Motor de calendarización (fechas, festivos)
js/regimen-data.js         Validador de la forma de una pauta
js/calendario-view.js      Interfaz de la pestaña Calendario (incluye los avisos y la detección de conflictos)
js/hoja-paciente.js        Hoja imprimible del paciente
tests/                     Pruebas (node --test)
docs/superpowers/          Especificación y plan del desarrollo
```

## Fármacos y CIMA

La sub-pestaña **Fármacos** busca un medicamento en CIMA/AEMPS (`/medicamentos?nombre=…`), muestra nombre, principio activo, forma y enlace a CIMA, y al elegir uno carga el apartado 4.2 de la ficha técnica (`/docSegmentado/contenido/1?nregistro=…&seccion=4.2`). El «fármaco normalizado» (principio activo + nº de registro) se guarda solo en memoria.

**Limitaciones:** no ha podido probarse contra CIMA real (el entorno de desarrollo no tiene acceso); los tests usan respuestas simuladas. El formato del endpoint `docSegmentado` no está verificado, por lo que el código acepta JSON o HTML/texto y, si falla o viene vacío, muestra un aviso y el enlace a la ficha técnica en CIMA. El texto del 4.2 es solo orientativo: la ficha oficial manda. La llamada solo ocurre al pulsar Buscar/Enter o al elegir un resultado, y nunca incluye datos del paciente.

### Borrador de pauta desde la ficha técnica

Con el 4.2 cargado, **Proponer pauta** (`js/posologia-ft.js`) lee solo la *frecuencia* y muestra cada propuesta junto a la frase de la que sale; **Usar en el calendario** la precarga en el formulario de la pestaña Calendario (una pauta *diaria* se representa como ciclos de 28 días con calendario indefinido). Es un borrador automático: no sustituye la validación farmacéutica, y la pauta que se cree queda siempre como *pendiente*.

**Límites:**
- Reconoce solo patrones simples en español: «una vez / dos veces… al día», «cada N horas» (si 24/N es entero de 1 a 6), «días 1 a 21 de ciclos de 28 días», «21 de cada 28 días», «cada N semanas/días» y «semanas 0, 2 y 4 y después cada 8 semanas». Admite coma decimal, pero solo si el resultado son días enteros («cada 1,5 semanas» no se propone).
- No extrae ni calcula **dosis** (queda vacía), ni área ni lugar de administración (quedan sin elegir); el farmacéutico debe completarlos para poder crear la pauta.
- Criterio conservador: si una frase contiene un calificador que no se interpreta (máximo, «hasta», «no más de», «si es necesario», «dosis de carga», descansos, rangos de días o ciclos no reconocidos, intervalos en rango «cada 2-4 semanas», alternativas con «o»), **no se propone nada** y se muestra un aviso con el calificador. Si falta incluir una duración («durante 12 semanas»), la propuesta se muestra con un aviso propio.
- Cada frase se analiza por separado, salvo una lista de dosis iniciales («Semanas 0, 2 y 4.») seguida de una frase que empiece por «Después/Posteriormente/Luego… cada N»: se unen en una sola propuesta. Si no se pueden unir, no se propone nada y se avisa (la inducción nunca se pierde en silencio). Los días de la ficha («Días 1, 8 y 15») se convierten a desplazamientos desde el día de inicio (día 1 = 0).
- «Veces al día» sin dato en la ficha queda en blanco con una marca «sin dato» (en blanco, el constructor usa 1). No se admite «0,2 y 4» sin espacios (es ambiguo con la coma decimal).
- En «semanas 0, 2 y 4 y después cada 8 semanas» el primer mantenimiento se sitúa en el día 56 (intervalo contado desde el día 0); la ficha puede querer contarlo desde la última dosis inicial. Si el mantenimiento no cae después de la última dosis inicial se deja vacío y se avisa.
- Lo que no se entiende (rangos incoherentes, horas que no dividen 24, ajustes por peso, insuficiencia renal, etc.) no se propone: se muestra un aviso. El texto de la ficha es complejo; revise siempre el original.
- Los tests usan frases sintéticas inventadas, no citas de fichas reales, y no se ha contrastado con fichas técnicas reales.

## Publicación

La aplicación es estática (sin compilación) y funciona desde `file://`. **El método de publicación (p. ej. GitHub Pages) NO se ha verificado y debe confirmarlo el propietario del repositorio**; este README no afirma ninguna URL publicada.

## Verificación manual pendiente

Pendiente de realizar por el farmacéutico en Chrome y en Edge (no se ha podido ejecutar un navegador en el desarrollo; las pruebas automáticas no sustituyen esta revisión):

- [ ] (a) Abrir `index.html` desde disco y desde la URL publicada (una vez confirmada).
- [ ] (b) Generar una infografía de ejemplo ("Cargar ejemplo") e imprimir en vista previa: debe verse igual que antes de añadir la pestaña Calendario.
- [ ] (c) En Calendario, definir una pauta con un fármaco en lugar «Hospital», fecha de inicio en sábado y comprobar que aparece el aviso de conflicto.
- [ ] (c2) En Fármacos, buscar un medicamento, elegir un resultado, «Proponer pauta» → «Usar en el calendario»; escribir la dosis y comprobar que aparece el calendario.
- [ ] (d) Imprimir la hoja del paciente: el banner de "pendiente" debe ser visible y legible en blanco y negro **y aparecer en CADA página impresa** de una hoja de varias páginas.

## Publicación (GitHub Pages)

El archivo `.nojekyll` (vacío, en la raíz) existe para evitar que Jekyll omita en silencio archivos y carpetas cuyo nombre empieza por `_` o `.`. Aun así, no se deben nombrar así los archivos que carga `index.html`; un test lo comprueba.

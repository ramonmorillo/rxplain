import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./helpers/loadPage.mjs";
import { regimenIntervalo } from "./fixtures/regimen-intervalo.mjs";

function setValue(dom, el, value, type = "input") {
  el.value = value;
  el.dispatchEvent(new dom.window.Event(type, { bubbles: true }));
}

function setup(dom, id, inicio, ciclos) {
  const d = dom.window.document;
  setValue(dom, d.getElementById("cal_esquema"), id, "change");
  setValue(dom, d.getElementById("cal_inicio"), inicio, "change");
  if (ciclos !== undefined) setValue(dom, d.getElementById("cal_ciclos"), String(ciclos));
  return d;
}

test("se monta solo en #calendarioRoot con los controles del formulario", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  assert.ok(d.querySelector("#calendarioRoot #cal_esquema"));
  assert.ok(d.querySelector("#calendarioRoot #cal_inicio"));
  assert.ok(d.querySelector("#calendarioRoot #cal_ciclos"));
  assert.ok(d.querySelector("#calendarioRoot #cal_meses"));
  assert.ok(d.querySelector("#calendarioRoot #cal_avisos"));
  assert.ok(d.querySelectorAll("#cal_esquema optgroup").length >= 1);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("DRd con inicio 2026-11-23: día de hospital y aviso de pendiente", async () => {
  const dom = await loadPage();
  const d = setup(dom, "mieloma-drd", "2026-11-23", 6);
  const cell = d.querySelector('#cal_meses .dia-hospital[data-date="2026-11-23"]');
  assert.ok(cell);
  assert.match(cell.textContent, /HOSPITAL/);
  assert.ok(cell.querySelector(".pildora"));
  assert.match(d.getElementById("cal_avisos").textContent, /pendiente de validación/);
  assert.ok(d.querySelector("#cal_avisos .aviso-pendiente"));
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("inicio en sábado: el aviso de conflictos menciona sáb. 21 nov", async () => {
  const dom = await loadPage();
  const d = setup(dom, "mieloma-drd", "2026-11-21", 3);
  assert.match(d.getElementById("cal_avisos").textContent, /sáb\. 21 nov/);
  dom.window.close();
});

test("conflicts() incluye Viernes Santo con evento de hospital", async () => {
  const dom = await loadPage();
  const { RxCalendar } = dom.window;
  const sched = {
    cycles: [{ n: 1, start: "2027-03-26", len: 28, fase: "C1" }],
    events: [
      { date: "2027-03-26", cycle: 1, day: 1, farmaco: "X", abrev: "X", dosis: "d", veces: 1, lugar: "hospital", etiqueta: "" },
      { date: "2027-03-26", cycle: 1, day: 1, farmaco: "Y", abrev: "Y", dosis: "d", veces: 1, lugar: "hospital", etiqueta: "" },
      { date: "2027-03-24", cycle: 1, day: 1, farmaco: "Z", abrev: "Z", dosis: "d", veces: 1, lugar: "casa", etiqueta: "" },
      { date: "2027-03-27", cycle: 1, day: 1, farmaco: "Z", abrev: "Z", dosis: "d", veces: 1, lugar: "casa", etiqueta: "" }
    ],
    end: "2027-04-22"
  };
  assert.deepEqual(Array.from(RxCalendar.conflicts(sched)), ["2027-03-26"]);
  dom.window.close();
});

test("ciclos inválidos (0, vacío, abc) mantienen al menos un ciclo pintado", async () => {
  const dom = await loadPage();
  const d = setup(dom, "mieloma-drd", "2026-11-23");
  for (const v of ["0", "", "abc"]) {
    setValue(dom, d.getElementById("cal_ciclos"), v);
    assert.ok(d.querySelector("#cal_meses .dia-hospital"), `con "${v}"`);
    assert.ok(d.querySelectorAll("#cal_meses [data-ciclo-inicio]").length >= 1, `con "${v}"`);
  }
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("el retraso del ciclo 2 desplaza su inicio en 5 días", async () => {
  const dom = await loadPage();
  const d = setup(dom, "mieloma-drd", "2026-11-23", 3);
  const antes = d.querySelector('[data-ciclo-inicio="2"]').getAttribute("data-date");
  assert.equal(antes, "2026-12-21");
  assert.equal(d.querySelectorAll("[data-delay]").length, 2);
  assert.equal(d.querySelector('[data-delay="1"]'), null);
  setValue(dom, d.querySelector('[data-delay="2"]'), "5");
  assert.equal(d.querySelector('[data-ciclo-inicio="2"]').getAttribute("data-date"), "2026-12-26");
  dom.window.close();
});

test("cambiar de esquema restablece los ciclos por defecto", async () => {
  const dom = await loadPage();
  const d = setup(dom, "mieloma-drd", "2026-11-23", 3);
  setValue(dom, d.getElementById("cal_esquema"), "mieloma-vrd-swog", "change");
  const r = dom.window.RxData.get("mieloma-vrd-swog");
  assert.equal(Number(d.getElementById("cal_ciclos").value), r.ciclos_defecto);
  dom.window.close();
});

test("esquema por intervalos: se pinta sin errores y sin campos de retraso", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  dom.window.RxData.register({
    id: "test-intervalo", nombre: "Prueba por intervalos", area: "Oncología", linea: "sintética",
    estado: "validado", fuente: "prueba", fecha_revision: "2026-01-01", ciclos_defecto: 5,
    ...regimenIntervalo
  });
  dom.window.RxCalendar.mount(d.getElementById("calendarioRoot"));
  setValue(dom, d.getElementById("cal_esquema"), "test-intervalo", "change");
  setValue(dom, d.getElementById("cal_inicio"), "2026-11-23", "change");
  assert.equal(d.querySelectorAll("[data-delay]").length, 0);
  assert.ok(d.querySelectorAll("#cal_meses .pildora").length >= 1);
  assert.equal(d.querySelector("#cal_avisos .aviso-pendiente"), null);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("mount funciona con otra raíz", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  const otra = d.createElement("div");
  d.body.appendChild(otra);
  dom.window.RxCalendar.mount(otra);
  assert.ok(otra.querySelector("#cal_meses"));
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("un retraso sobrevive a vaciar y restaurar la fecha de inicio", async () => {
  const dom = await loadPage();
  const d = setup(dom, "mieloma-drd", "2026-11-23", 3);
  setValue(dom, d.querySelector('[data-delay="2"]'), "5");
  setValue(dom, d.getElementById("cal_inicio"), "");
  assert.equal(d.querySelector("#cal_meses .dia"), null);
  assert.match(d.getElementById("cal_avisos").textContent, /fecha de inicio/);
  setValue(dom, d.getElementById("cal_inicio"), "2026-11-23", "change");
  const inp = d.querySelector('[data-delay="2"]');
  assert.ok(inp);
  assert.equal(inp.value, "5");
  assert.equal(d.querySelector('[data-ciclo-inicio="2"]').getAttribute("data-date"), "2026-12-26");
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("aviso en pantalla fail-safe: solo 'validado' exacto lo omite", async () => {
  for (const [estado, esperado] of [["pendiente", true], ["Pendiente", true], ["otro", true], [undefined, true], ["validado", false]]) {
    const dom = await loadPage();
    const d = dom.window.document;
    const reg = { id: "t-" + String(estado), nombre: "T", area: "Oncología", linea: "s", estado: "validado",
      fuente: "p", fecha_revision: "2026-01-01", ciclos_defecto: 5, ...regimenIntervalo };
    dom.window.RxData.register(reg);
    reg.estado = estado; // simula un dato corrupto tras el registro
    dom.window.RxCalendar.mount(d.getElementById("calendarioRoot"));
    setValue(dom, d.getElementById("cal_esquema"), reg.id, "change");
    setValue(dom, d.getElementById("cal_inicio"), "2026-11-23", "change");
    assert.equal(!!d.querySelector("#cal_avisos .aviso-pendiente"), esperado, String(estado));
    dom.window.close();
  }
});

const MSG = "No se han podido cargar los esquemas. Compruebe que la carpeta data/ está publicada junto a index.html.";

test("sin esquemas registrados (scripts de datos bloqueados) se muestra un mensaje visible y los controles quedan deshabilitados", async () => {
  const dom = await loadPage({
    beforeParse(window) {
      const orig = window.HTMLScriptElement.prototype;
      // Simula 404 de data/: el script de ayudas no se carga.
      const desc = Object.getOwnPropertyDescriptor(orig, "src");
      Object.defineProperty(orig, "src", {
        configurable: true,
        get: desc.get,
        set(v) { desc.set.call(this, /data\/regimens\//.test(v) ? "data:text/javascript,void 0" : v); },
      });
    },
  });
  const d = dom.window.document;
  // Si el bloqueo por src no aplica a scripts del HTML inicial, forzamos el estado vacío y remontamos.
  if (dom.window.RxData.list().length) {
    dom.window.RxData._reset();
    dom.window.RxCalendar.mount(d.getElementById("calendarioRoot"));
  }
  const root = d.getElementById("calendarioRoot");
  assert.match(root.textContent, /No se han podido cargar los esquemas/);
  assert.ok(root.textContent.includes(MSG));
  assert.ok(root.querySelector('[role="alert"]'));
  assert.equal(d.getElementById("cal_esquema").disabled, true);
  assert.equal(d.getElementById("cal_ciclos").disabled, true);
  assert.equal(d.getElementById("cal_inicio").disabled, true);
  dom.window.close();
});

test("con esquemas cargados no hay mensaje de error", async () => {
  const dom = await loadPage();
  const root = dom.window.document.getElementById("calendarioRoot");
  assert.equal(root.querySelector('[role="alert"]'), null);
  assert.equal(dom.window.document.getElementById("cal_esquema").disabled, false);
  dom.window.close();
});

// --- Selector con buscador y filtro por área ---
function opcionesIds(d) {
  return Array.from(d.querySelectorAll("#cal_esquema option")).map((o) => o.value);
}

function registrarOtraArea(dom) {
  dom.window.RxData.register({
    id: "test-reuma", nombre: "Biológico X", area: "Inmunomediadas", linea: "mantenimiento",
    estado: "validado", fuente: "prueba", fecha_revision: "2026-01-01", ciclos_defecto: 5,
    ...regimenIntervalo
  });
  dom.window.RxCalendar.mount(dom.window.document.getElementById("calendarioRoot"));
}

test("selector: existen buscador y filtro de área con 'Todas las áreas'", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  assert.equal(d.getElementById("cal_buscar").type, "search");
  const area = d.getElementById("cal_area");
  assert.equal(area.tagName, "SELECT");
  assert.equal(area.options[0].textContent, "Todas las áreas");
  assert.equal(area.options[0].value, "");
  assert.ok(area.options.length >= 2);
  assert.equal(d.getElementById("cal_sin_resultados"), null);
  dom.window.close();
});

test("selector: filtrar por área deja solo esquemas de esa área", async () => {
  const dom = await loadPage();
  registrarOtraArea(dom);
  const d = dom.window.document;
  setValue(dom, d.getElementById("cal_area"), "Inmunomediadas", "change");
  assert.deepEqual(opcionesIds(d), ["test-reuma"]);
  assert.equal(d.getElementById("cal_esquema").value, "test-reuma");
  setValue(dom, d.getElementById("cal_area"), "", "change");
  assert.ok(opcionesIds(d).length > 1);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("selector: buscar 'lenalid' (fármaco) y 'hematologia' (sin acento/mayúsculas)", async () => {
  const dom = await loadPage();
  registrarOtraArea(dom);
  const d = dom.window.document;
  setValue(dom, d.getElementById("cal_buscar"), "LENALID");
  const len = opcionesIds(d);
  assert.ok(len.includes("mieloma-drd"));
  assert.ok(!len.includes("test-reuma"));
  setValue(dom, d.getElementById("cal_buscar"), "hematologia");
  const hem = opcionesIds(d);
  assert.ok(hem.includes("mieloma-drd"));
  assert.ok(!hem.includes("test-reuma"));
  dom.window.close();
});

test("selector: 0 coincidencias vacía el select, muestra aviso y no hay calendario", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  setValue(dom, d.getElementById("cal_buscar"), "zzzz-no-existe");
  assert.equal(d.querySelectorAll("#cal_esquema option").length, 0);
  const p = d.getElementById("cal_sin_resultados");
  assert.ok(p);
  assert.equal(p.getAttribute("role"), "status");
  assert.equal(p.textContent, "Sin esquemas que coincidan.");
  assert.equal(d.querySelector("#cal_meses .dia"), null);
  assert.equal(d.getElementById("cal_avisos").textContent.trim(), "");
  // al volver a coincidir desaparece el aviso y reaparece el calendario
  setValue(dom, d.getElementById("cal_buscar"), "");
  assert.equal(d.getElementById("cal_sin_resultados"), null);
  assert.ok(d.querySelector("#cal_meses .dia"));
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("selector: se mantiene el esquema seleccionado si sigue coincidiendo; si no, el primero", async () => {
  const dom = await loadPage();
  const d = setup(dom, "mieloma-vrd-swog", "2026-11-23", 4);
  setValue(dom, d.getElementById("cal_buscar"), "swog");
  assert.equal(d.getElementById("cal_esquema").value, "mieloma-vrd-swog");
  assert.equal(d.getElementById("cal_ciclos").value, "4"); // no se restablece
  setValue(dom, d.getElementById("cal_buscar"), "Isa-Kd");
  assert.equal(d.getElementById("cal_esquema").value, "mieloma-isa-kd");
  assert.equal(Number(d.getElementById("cal_ciclos").value), dom.window.RxData.get("mieloma-isa-kd").ciclos_defecto);
  assert.ok(d.querySelector("#cal_meses .dia"));
  dom.window.close();
});

test("selector: cada opción muestra el estado como texto", async () => {
  const dom = await loadPage();
  registrarOtraArea(dom);
  const d = dom.window.document;
  const txt = (id) => d.querySelector(`#cal_esquema option[value="${id}"]`).textContent;
  assert.match(txt("mieloma-drd"), /⚠ pendiente/);
  assert.match(txt("test-reuma"), /✔ validado/);
  dom.window.close();
});

test("I-2: un nº de ciclos fuera de 1..60 o no entero avisa del ajuste", async () => {
  const dom = await loadPage();
  const d = setup(dom, "mieloma-drd", "2026-11-23");
  const av = () => d.getElementById("cal_avisos");
  for (const [v, efectivo] of [["", 1], ["0", 1], ["-3", 1], ["2.5", 2], ["999", 60]]) {
    setValue(dom, d.getElementById("cal_ciclos"), v);
    const a = av().querySelector(".aviso-ajuste");
    assert.ok(a, `aviso con "${v}"`);
    assert.match(a.textContent, new RegExp("se han calendarizado " + efectivo + "\\b"), `efectivo con "${v}"`);
    assert.equal(d.querySelectorAll("#cal_meses [data-ciclo-inicio]").length, efectivo, `ciclos pintados con "${v}"`);
  }
  for (const v of ["1", "6", "60"]) {
    setValue(dom, d.getElementById("cal_ciclos"), v);
    assert.equal(av().querySelector(".aviso-ajuste"), null, `sin aviso con "${v}"`);
  }
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("I-2: en pautas por intervalo el aviso habla de dosis", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  dom.window.RxData.register({
    id: "test-intervalo", nombre: "Prueba por intervalos", area: "Oncología", linea: "sintética",
    estado: "validado", fuente: "prueba", fecha_revision: "2026-01-01", ciclos_defecto: 5,
    ...regimenIntervalo
  });
  dom.window.RxCalendar.mount(d.getElementById("calendarioRoot"));
  setValue(dom, d.getElementById("cal_esquema"), "test-intervalo", "change");
  setValue(dom, d.getElementById("cal_inicio"), "2026-11-23", "change");
  setValue(dom, d.getElementById("cal_ciclos"), "999");
  assert.match(d.querySelector("#cal_avisos .aviso-ajuste").textContent, /«Dosis» ajustado/);
  dom.window.close();
});

test("I-1: «change» de Ciclos no recrea los campos de retraso (no pierde el foco)", async () => {
  const dom = await loadPage();
  const d = setup(dom, "mieloma-drd", "2026-11-23", 3);
  const antes = d.querySelector('[data-delay="2"]');
  antes.focus();
  setValue(dom, d.getElementById("cal_ciclos"), "3", "change");
  const despues = d.querySelector('[data-delay="2"]');
  assert.equal(despues, antes, "mismo nodo");
  assert.equal(d.activeElement, antes, "conserva el foco");
  setValue(dom, antes, "5");
  setValue(dom, d.getElementById("cal_ciclos"), "3", "change");
  assert.equal(d.querySelector('[data-delay="2"]').value, "5");
  assert.equal(d.querySelector('[data-ciclo-inicio="2"]').getAttribute("data-date"), "2026-12-26");
  dom.window.close();
});

test("I-1: al cambiar el nº de ciclos los campos de retraso se ajustan y conservan lo escrito", async () => {
  const dom = await loadPage();
  const d = setup(dom, "mieloma-drd", "2026-11-23", 3);
  setValue(dom, d.querySelector('[data-delay="2"]'), "5");
  setValue(dom, d.getElementById("cal_ciclos"), "4");
  assert.equal(d.querySelectorAll("[data-delay]").length, 3);
  assert.equal(d.querySelector('[data-delay="2"]').value, "5");
  setValue(dom, d.getElementById("cal_ciclos"), "1");
  assert.equal(d.querySelectorAll("[data-delay]").length, 0);
  assert.equal(d.getElementById("cal_retrasos").hidden, true);
  dom.window.close();
});

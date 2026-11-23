import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./helpers/loadPage.mjs";
import { definirPauta, setValue, PAUTA_REF } from "./helpers/pauta.mjs";

// Pauta por intervalo (biológico): dosis iniciales 0, 14, 42; mantenimiento desde el día 98 cada 56.
const PAUTA_INTERVALO = {
  nombre: "Prueba por intervalos",
  tipo: "intervalo",
  items: [{ farmaco: "Inyectable", abrev: "I", dosis: "dosis-texto-I", lugar: "casa_inyeccion",
    desplazamientos_dias: "0,14,42", primer_mantenimiento_dia: "98", cada_dias: "56" }]
};

function setup(dom, pauta, inicio, ciclos, extra = {}) {
  return definirPauta(dom, { ...pauta, inicio, n: ciclos, ...extra });
}

test("se monta solo en #calendarioRoot con el formulario de pauta y los controles", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  for (const id of ["cal_pauta", "cb_tipo", "cb_items", "cb_add", "cb_validada", "cb_estado", "cal_inicio",
    "cal_ciclos", "cal_indefinida", "cal_hasta", "cal_meses", "cal_avisos"]) {
    assert.ok(d.querySelector("#calendarioRoot #" + id), id);
  }
  assert.equal(d.getElementById("cal_ciclos").value, "6");
  assert.equal(d.getElementById("cal_indefinida").checked, false);
  for (const id of ["cal_esquema", "cal_buscar", "cal_area", "cal_nueva", "cb_crear", "cal_cambiar"]) {
    assert.equal(d.getElementById(id), null, id);
  }
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("pauta de referencia con inicio 2026-11-23: día de hospital y aviso de pendiente", async () => {
  const dom = await loadPage();
  const d = setup(dom, PAUTA_REF, "2026-11-23", 6);
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
  const d = setup(dom, PAUTA_REF, "2026-11-21", 3);
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
  const d = setup(dom, PAUTA_REF, "2026-11-23");
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
  const d = setup(dom, PAUTA_REF, "2026-11-23", 3);
  const antes = d.querySelector('[data-ciclo-inicio="2"]').getAttribute("data-date");
  assert.equal(antes, "2026-12-21");
  assert.equal(d.querySelectorAll("[data-delay]").length, 2);
  assert.equal(d.querySelector('[data-delay="1"]'), null);
  setValue(dom, d.querySelector('[data-delay="2"]'), "5");
  assert.equal(d.querySelector('[data-ciclo-inicio="2"]').getAttribute("data-date"), "2026-12-26");
  dom.window.close();
});

test("pauta por intervalos: se pinta sin errores y sin campos de retraso", async () => {
  const dom = await loadPage();
  const d = setup(dom, { ...PAUTA_INTERVALO, validada: true }, "2026-11-23", 5);
  assert.equal(d.querySelectorAll("[data-delay]").length, 0);
  assert.ok(d.querySelectorAll("#cal_meses .pildora").length >= 1);
  assert.equal(d.querySelector("#cal_avisos .aviso-pendiente"), null);
  assert.equal(d.getElementById("cal_ciclos_lbl").textContent, "Dosis");
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
  const d = setup(dom, PAUTA_REF, "2026-11-23", 3);
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

test("la casilla «validada» quita el aviso de pendiente; sin ella aparece", async () => {
  const dom = await loadPage();
  const d = setup(dom, PAUTA_REF, "2026-11-23", 3);
  assert.equal(d.getElementById("cb_validada").checked, false);
  assert.ok(d.querySelector("#cal_avisos .aviso-pendiente"));
  assert.match(d.getElementById("cal_resumen_txt").textContent, /pendiente de validación/);
  setValue(dom, d.getElementById("cb_validada"), true, "change");
  assert.equal(d.querySelector("#cal_avisos .aviso-pendiente"), null);
  assert.match(d.getElementById("cal_resumen_txt").textContent, /validada/);
  assert.doesNotMatch(d.getElementById("cal_resumen_txt").textContent, /pendiente/);
  assert.ok(d.querySelector("#cal_meses .dia-hospital"), "el calendario sigue pintado");
  setValue(dom, d.getElementById("cb_validada"), false, "change");
  assert.ok(d.querySelector("#cal_avisos .aviso-pendiente"));
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("recálculo en vivo: editar días y dosis repinta sin pulsar nada", async () => {
  const dom = await loadPage();
  const d = setup(dom, PAUTA_REF, "2026-11-23", 1);
  const hosp = () => [...d.querySelectorAll("#cal_meses .dia-hospital")].map((e) => e.dataset.date);
  assert.deepEqual(hosp(), ["2026-11-23", "2026-11-30", "2026-12-07", "2026-12-14"]);
  const dara = d.querySelectorAll("#cb_items .cb-item")[1];
  setValue(dom, dara.querySelector('[data-f="dias"]'), "1,15");
  assert.deepEqual(hosp(), ["2026-11-23", "2026-12-07"]);
  setValue(dom, dara.querySelector('[data-f="dosis"]'), "1200 mg");
  const pil = d.querySelector('#cal_meses .dia-hospital[data-date="2026-11-23"] .pildora.lugar-hospital');
  assert.match(pil.getAttribute("title"), /1200 mg/);
  // Cambiar la duración del ciclo desplaza el ciclo siguiente
  setValue(dom, d.getElementById("cal_ciclos"), "2");
  assert.equal(d.querySelector('[data-ciclo-inicio="2"]').getAttribute("data-date"), "2026-12-21");
  setValue(dom, d.getElementById("cb_ciclo"), "30");
  assert.equal(d.querySelector('[data-ciclo-inicio="2"]').getAttribute("data-date"), "2026-12-23");
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("pauta incompleta: sin meses, mensaje en #cb_estado y aviso de completar; al completarla se pinta", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  // Estado inicial: una fila vacía
  assert.equal(d.querySelector("#cal_meses .dia"), null);
  assert.match(d.getElementById("cal_avisos").textContent, /Complete la pauta/);
  assert.notEqual(d.getElementById("cb_estado").textContent.trim(), "");
  assert.equal(d.getElementById("cb_estado").getAttribute("role"), "status");
  // Fármaco sin dosis: sigue incompleta
  const row = d.querySelector("#cb_items .cb-item");
  setValue(dom, row.querySelector('[data-f="farmaco"]'), "Lenalidomida");
  assert.match(d.getElementById("cb_estado").textContent, /dosis/i);
  assert.equal(d.querySelector("#cal_meses .dia"), null);
  // Completa
  setValue(dom, row.querySelector('[data-f="dosis"]'), "25 mg");
  setValue(dom, row.querySelector('[data-f="dias"]'), "1-21");
  assert.equal(d.getElementById("cb_estado").textContent, "");
  assert.ok(d.querySelector("#cal_meses .dia"));
  assert.doesNotMatch(d.getElementById("cal_avisos").textContent, /Complete la pauta/);
  // Nombre por defecto = primer fármaco
  assert.match(d.getElementById("cal_resumen_txt").textContent, /^Lenalidomida/);
  // Vuelve a romperla: se vacían los meses
  setValue(dom, row.querySelector('[data-f="dias"]'), "1-40");
  assert.match(d.getElementById("cb_estado").textContent, /fuera del ciclo/);
  assert.equal(d.querySelector("#cal_meses .dia"), null);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("precargar({...}) rellena el formulario, va a Calendario y enfoca la dosis vacía", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  d.getElementById("sub-btn-farmacos").click();
  assert.equal(d.getElementById("sub-calendario").hidden, true);
  const ok = dom.window.RxCalendar.precargar({
    nombre: "Adalimumab 40 mg", tipo: "intervalo", ciclo_dias: "", n: 8, indefinida: false,
    origen: "Borrador creado desde la ficha técnica de Humira",
    items: [{ farmaco: "Adalimumab", abrev: "", dosis: "", lugar: "casa_inyeccion", veces_al_dia: "1",
      desplazamientos_dias: "0", primer_mantenimiento_dia: "14", cada_dias: "14" }]
  });
  assert.equal(ok, true);
  assert.equal(d.getElementById("sub-calendario").hidden, false);
  assert.equal(d.getElementById("sub-farmacos").hidden, true);
  assert.equal(d.getElementById("cb_nombre").value, "Adalimumab 40 mg");
  assert.equal(d.getElementById("cb_tipo").value, "intervalo");
  const row = d.querySelector("#cb_items .cb-item");
  assert.equal(row.querySelector('[data-f="farmaco"]').value, "Adalimumab");
  assert.equal(row.querySelector('[data-f="lugar"]').value, "casa_inyeccion");
  assert.equal(row.querySelector('[data-f="cada_dias"]').value, "14");
  assert.equal(d.getElementById("cal_ciclos").value, "8");
  assert.equal(d.getElementById("cal_indefinida").checked, false);
  const origen = d.getElementById("cb_origen");
  assert.equal(origen.hidden, false);
  assert.match(origen.textContent, /Humira/);
  // Sin dosis la pauta está incompleta y el foco va a la dosis
  assert.equal(d.activeElement, row.querySelector('[data-f="dosis"]'));
  assert.match(d.getElementById("cb_estado").textContent, /dosis/i);
  // Al escribir la dosis se calcula en vivo
  setValue(dom, row.querySelector('[data-f="dosis"]'), "40 mg");
  assert.equal(d.getElementById("cb_estado").textContent, "");
  assert.ok(d.querySelector("#cal_meses .pildora"));
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("precargar con indefinida marca la casilla y bloquea el nº de ciclos; sin borrador devuelve false", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  assert.equal(dom.window.RxCalendar.precargar(null), false);
  dom.window.RxCalendar.precargar({
    nombre: "Oral", tipo: "ciclos", ciclo_dias: "28", n: 4, indefinida: true,
    items: [{ farmaco: "Oral", abrev: "Or", dosis: "10 mg", lugar: "casa", dias: "1-14" }]
  });
  assert.equal(d.getElementById("cal_indefinida").checked, true);
  assert.equal(d.getElementById("cal_ciclos").disabled, true);
  assert.equal(d.getElementById("cb_ciclo").value, "28");
  assert.equal(d.getElementById("cb_origen").hidden, true);
  // Con todo relleno el foco cae en el primer campo vacío visible (días del ciclo no: está relleno)
  assert.notEqual(d.activeElement, d.querySelector('#cb_items [data-f="farmaco"]'));
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("los ejemplos rellenan el formulario y el calendario se recalcula", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  d.getElementById("cal_ej_oral").click();
  assert.equal(d.getElementById("cb_tipo").value, "ciclos");
  assert.equal(d.getElementById("cal_ciclos").value, "6");
  d.getElementById("cal_ej_bio").click();
  assert.equal(d.getElementById("cb_tipo").value, "intervalo");
  assert.equal(d.getElementById("cal_ciclos").value, "8");
  assert.equal(d.getElementById("cal_indefinida").checked, false);
  dom.window.close();
});

test("I-2: un nº de ciclos fuera de 1..60 o no entero avisa del ajuste", async () => {
  const dom = await loadPage();
  const d = setup(dom, PAUTA_REF, "2026-11-23");
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
  const d = setup(dom, { ...PAUTA_INTERVALO, validada: true }, "2026-11-23", 5);
  setValue(dom, d.getElementById("cal_ciclos"), "999");
  assert.match(d.querySelector("#cal_avisos .aviso-ajuste").textContent, /«Dosis» ajustado/);
  dom.window.close();
});

test("I-1: «change» de Ciclos no recrea los campos de retraso (no pierde el foco)", async () => {
  const dom = await loadPage();
  const d = setup(dom, PAUTA_REF, "2026-11-23", 3);
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
  const d = setup(dom, PAUTA_REF, "2026-11-23", 3);
  setValue(dom, d.querySelector('[data-delay="2"]'), "5");
  setValue(dom, d.getElementById("cal_ciclos"), "4");
  assert.equal(d.querySelectorAll("[data-delay]").length, 3);
  assert.equal(d.querySelector('[data-delay="2"]').value, "5");
  setValue(dom, d.getElementById("cal_ciclos"), "1");
  assert.equal(d.querySelectorAll("[data-delay]").length, 0);
  assert.equal(d.getElementById("cal_retrasos").hidden, true);
  dom.window.close();
});

test("I-4: la etiqueta de hospital tiene versión corta para pantallas estrechas", async () => {
  const dom = await loadPage();
  const d = setup(dom, PAUTA_REF, "2026-11-23", 3);
  const etq = d.querySelector('#cal_meses .dia-hospital[data-date="2026-11-23"] .etq-hospital');
  assert.ok(etq);
  assert.equal(etq.querySelector(".etq-largo").textContent, "HOSPITAL");
  const corto = etq.querySelector(".etq-corto");
  assert.equal(corto.textContent, "HOSP.");
  assert.equal(corto.getAttribute("aria-hidden"), "true");
  dom.window.close();
});

import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadPage } from "./helpers/loadPage.mjs";

const require = createRequire(import.meta.url);
const RxData = require("../js/regimen-data.js");
const RxEngine = require("../js/schedule-engine.js");
const RxBuilder = require("../js/constructor-pauta.js");

function item(extra) {
  return Object.assign({ farmaco: "Lenalidomida", abrev: "Len", dosis: "25 mg", lugar: "casa", dias: [1, 2, 3] }, extra);
}
function formCiclos(extra) {
  return Object.assign({ nombre: "Mi oral", area: "Hematología", tipo: "ciclos", ciclos_defecto: 3, ciclo_dias: 28, items: [item()] }, extra);
}
function formIntervalo(extra) {
  return Object.assign({
    nombre: "Mi biológico", area: "Inmunomediadas", tipo: "intervalo", ciclos_defecto: 5,
    items: [{ farmaco: "Biológico", abrev: "Bio", dosis: "40 mg", lugar: "casa_inyeccion", desplazamientos_dias: [0, 14, 28], primer_mantenimiento_dia: 56, cada_dias: 56 }]
  }, extra);
}
function reset() { RxData._reset(); }
function throwsMsg(fn, re) { assert.throws(fn, (e) => e instanceof Error && re.test(e.message)); }

test("ciclos: genera regimen válido, pendiente y registrado", () => {
  reset();
  const r = RxBuilder.buildRegimen(formCiclos());
  assert.match(r.id, /^propia-\d+$/);
  assert.equal(r.linea, "Pauta propia");
  assert.equal(r.estado, "pendiente");
  assert.equal(r.fecha_revision, null);
  assert.match(r.fuente, /sin validar/);
  assert.equal(r.fases.length, 1);
  assert.equal(r.fases[0].desde, 1);
  assert.equal(r.fases[0].hasta, null);
  assert.equal(r.fases[0].duracion, 28);
  assert.equal(RxData.get(r.id), r);
});

test("ids propia-<n> no se repiten", () => {
  reset();
  const a = RxBuilder.buildRegimen(formCiclos());
  const b = RxBuilder.buildRegimen(formCiclos());
  assert.notEqual(a.id, b.id);
});

test("ejemplo oral días 1-21 de 28 produce las fechas esperadas", () => {
  reset();
  const form = RxBuilder.EJEMPLOS.oral21de28();
  const r = RxBuilder.buildRegimen(RxBuilder.formFromText(form));
  const s = RxEngine.buildSchedule(r, { start: "2026-11-02", n: 2 });
  assert.equal(s.events.length, 42);
  assert.equal(s.cycles[1].start, "2026-11-30");
  const dates = s.events.map((e) => e.date).sort();
  assert.equal(dates[0], "2026-11-02");
  assert.equal(dates[20], "2026-11-22");
  assert.equal(dates[21], "2026-11-30");
  assert.equal(dates[41], "2026-12-20");
});

test("ejemplo biológico cada N semanas produce las fechas esperadas", () => {
  reset();
  const form = RxBuilder.EJEMPLOS.biologico();
  const r = RxBuilder.buildRegimen(RxBuilder.formFromText(form));
  const s = RxEngine.buildSchedule(r, { start: "2026-11-02", n: 5 });
  assert.deepEqual(s.events.map((e) => e.date), ["2026-11-02", "2026-11-16", "2026-11-30", "2026-12-28", "2027-02-22"]);
});

test("parseDias: listas y rangos", () => {
  assert.deepEqual(RxBuilder.parseDias("1-21"), Array.from({ length: 21 }, (_, i) => i + 1));
  assert.deepEqual(RxBuilder.parseDias("1,8,15"), [1, 8, 15]);
  assert.deepEqual(RxBuilder.parseDias(" 1 – 3 , 8 "), [1, 2, 3, 8]);
  assert.deepEqual(RxBuilder.parseDias("0,14", { min: 0 }), [0, 14]);
  throwsMsg(() => RxBuilder.parseDias("1,a"), /no es un número/);
  throwsMsg(() => RxBuilder.parseDias("5-2"), /rango/i);
  throwsMsg(() => RxBuilder.parseDias("1,,3"), /vacío|no es un número/);
});

test("ciclo_dias: 0, negativo, no numérico, decimal, >366", () => {
  [0, -5, "abc", 2.5, 367, NaN, ""].forEach((v) => {
    reset();
    throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ ciclo_dias: v })), /ciclo/i);
  });
  reset();
  assert.ok(RxBuilder.buildRegimen(formCiclos({ ciclo_dias: 366, items: [item({ dias: [1, 366] })] })));
});

test("dias fuera del ciclo, duplicados, desordenados, vacíos", () => {
  reset();
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ items: [item({ dias: [1, 29] })] })), /29/);
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ items: [item({ dias: [0, 1] })] })), /0/);
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ items: [item({ dias: [1, 1, 2] })] })), /repetid|duplicad/i);
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ items: [item({ dias: [8, 1] })] })), /orden/i);
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ items: [item({ dias: [] })] })), /día/i);
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ items: [item({ dias: [1.5] })] })), /entero/i);
  assert.equal(RxData.list().length, 0);
});

test("nombre, área, lugar, fármaco, ciclos por defecto, sin fármacos", () => {
  reset();
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ nombre: "  " })), /nombre/i);
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ area: "Cardiología" })), /área/i);
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ items: [item({ lugar: "bar" })] })), /lugar/i);
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ items: [item({ farmaco: "" })] })), /fármaco/i);
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ items: [item({ dosis: "" })] })), /dosis/i);
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ ciclos_defecto: 0 })), /ciclos/i);
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ items: [] })), /fármaco/i);
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ tipo: "otro" })), /tipo/i);
  assert.equal(RxData.list().length, 0);
});

test("intervalo: desplazamientos, mantenimiento y cada_dias", () => {
  reset();
  const base = formIntervalo().items[0];
  const f = (o) => formIntervalo({ items: [Object.assign({}, base, o)] });
  throwsMsg(() => RxBuilder.buildRegimen(f({ desplazamientos_dias: [0, -1] })), /desplazamiento/i);
  throwsMsg(() => RxBuilder.buildRegimen(f({ desplazamientos_dias: [0, 1.5] })), /desplazamiento/i);
  throwsMsg(() => RxBuilder.buildRegimen(f({ cada_dias: 0 })), /cada/i);
  throwsMsg(() => RxBuilder.buildRegimen(f({ cada_dias: "x" })), /cada/i);
  throwsMsg(() => RxBuilder.buildRegimen(f({ primer_mantenimiento_dia: -1 })), /mantenimiento/i);
  const r = RxBuilder.buildRegimen(formIntervalo());
  assert.equal(r.tipo, "intervalo");
  assert.equal(r.items[0].dosis_totales, 5);
});

test("valores numéricos en texto (desde el formulario) se aceptan", () => {
  reset();
  const r = RxBuilder.buildRegimen(formCiclos({ ciclo_dias: "28", ciclos_defecto: "4" }));
  assert.equal(r.fases[0].duracion, 28);
  assert.equal(r.ciclos_defecto, 4);
});

// ---------- vista ----------
function setValue(dom, el, value, type = "input") {
  el.value = value;
  el.dispatchEvent(new dom.window.Event(type, { bubbles: true }));
}
function click(dom, el) { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); }

test("vista: abrir constructor, ejemplo, crear y seleccionar", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  assert.ok(dom.window.RxBuilder);
  click(dom, d.getElementById("cal_nueva"));
  const box = d.getElementById("cal_constructor");
  assert.equal(box.hidden, false);
  click(dom, d.getElementById("cal_ej_oral"));
  assert.equal(d.getElementById("cb_dias_0") ? d.getElementById("cb_dias_0").value : d.querySelector("[data-f=dias]").value, "1-21");
  setValue(dom, d.getElementById("cb_nombre"), "Mi pauta <b>");
  click(dom, d.getElementById("cb_crear"));
  assert.equal(d.querySelector("#cal_constructor [role=alert]").textContent, "");
  const sel = d.getElementById("cal_esquema");
  assert.match(sel.value, /^propia-/);
  assert.equal(RxData_get(dom, sel.value).nombre, "Mi pauta <b>");
  assert.ok(d.querySelector("#cal_meses .pildora"));
  assert.ok(d.querySelector("#cal_avisos .aviso-pendiente"));
  assert.equal(box.hidden, true);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});
function RxData_get(dom, id) { return dom.window.RxData.get(id); }

test("vista: error claro en role=alert y no crea nada", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  const antes = dom.window.RxData.list().length;
  click(dom, d.getElementById("cal_nueva"));
  click(dom, d.getElementById("cb_crear"));
  const al = d.querySelector("#cal_constructor p[role=alert]");
  assert.ok(al);
  assert.match(al.textContent, /nombre/i);
  assert.equal(dom.window.RxData.list().length, antes);
  dom.window.close();
});

test("vista: Añadir fármaco añade filas; ejemplo biológico; día fuera de ciclo da error", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  click(dom, d.getElementById("cal_nueva"));
  const n0 = d.querySelectorAll("#cb_items .cb-item").length;
  click(dom, d.getElementById("cb_add"));
  assert.equal(d.querySelectorAll("#cb_items .cb-item").length, n0 + 1);
  click(dom, d.getElementById("cal_ej_bio"));
  assert.equal(d.getElementById("cb_tipo").value, "intervalo");
  setValue(dom, d.getElementById("cb_nombre"), "Bio");
  click(dom, d.getElementById("cb_crear"));
  assert.match(d.getElementById("cal_esquema").value, /^propia-/);
  click(dom, d.getElementById("cal_nueva"));
  click(dom, d.getElementById("cal_ej_oral"));
  setValue(dom, d.getElementById("cb_nombre"), "Malo");
  setValue(dom, d.querySelector("#cb_items [data-f=dias]"), "1-40");
  click(dom, d.getElementById("cb_crear"));
  assert.match(d.querySelector("#cal_constructor p[role=alert]").textContent, /día 29.*entre 1 y 28/);
  dom.window.close();
});

test("la pauta propia sobrevive a cambiar de esquema y la hoja lleva el banner de pendiente y escapa HTML", async () => {
  const dom = await loadPage({ beforeParse(w) { w.print = () => {}; } });
  const d = dom.window.document;
  click(dom, d.getElementById("cal_nueva"));
  click(dom, d.getElementById("cal_ej_oral"));
  setValue(dom, d.getElementById("cb_nombre"), 'X"<img src=x onerror=alert(1)>');
  setValue(dom, d.querySelector("#cb_items [data-f=farmaco]"), "<script>alert(1)</script>");
  click(dom, d.getElementById("cb_crear"));
  const id = d.getElementById("cal_esquema").value;
  setValue(dom, d.getElementById("cal_esquema"), "mieloma-drd", "change");
  assert.ok(Array.from(d.getElementById("cal_esquema").options).some((o) => o.value === id));
  setValue(dom, d.getElementById("cal_esquema"), id, "change");
  click(dom, d.getElementById("cal_imprimir"));
  const hoja = d.getElementById("hojaPaciente");
  assert.ok(hoja.querySelector(".aviso-pendiente"));
  assert.equal(hoja.querySelector("img"), null);
  assert.equal(hoja.querySelector("script"), null);
  assert.equal(d.querySelector("#cal_meses img"), null);
  dom.window.close();
});

test("imprimir sin esquema seleccionado pide seleccionar un esquema", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  setValue(dom, d.getElementById("cal_buscar"), "zzzzzz");
  setValue(dom, d.getElementById("cal_inicio"), "", "change");
  click(dom, d.getElementById("cal_imprimir"));
  assert.match(d.getElementById("cal_avisos").textContent, /Seleccione un esquema\./);
  dom.window.close();
});

// ---------- ronda de correcciones 1 ----------
test("intervalo: dosis iniciales duplicadas, decrecientes y mantenimiento no posterior", () => {
  reset();
  const f = (o) => formIntervalo({ items: [Object.assign({}, formIntervalo().items[0], o)] });
  throwsMsg(() => RxBuilder.buildRegimen(f({ desplazamientos_dias: [0, 0, 14] })), /Biológico.*repetid/i);
  throwsMsg(() => RxBuilder.buildRegimen(f({ desplazamientos_dias: [0, 28, 14] })), /Biológico.*orden creciente/i);
  throwsMsg(() => RxBuilder.buildRegimen(f({ primer_mantenimiento_dia: 28 })), /primer mantenimiento \(día 28\) debe ser posterior a la última dosis inicial \(día 28\)/i);
  throwsMsg(() => RxBuilder.buildRegimen(f({ primer_mantenimiento_dia: 10 })), /posterior/i);
  assert.equal(RxData.list().length, 0);
  assert.ok(RxBuilder.buildRegimen(f({ desplazamientos_dias: [], primer_mantenimiento_dia: 0 })));
});

test("veces_al_dia: opcional, entero 1-6, llega al evento", () => {
  reset();
  const f = (v) => formCiclos({ items: [item({ veces_al_dia: v })] });
  [0, 7, 1.5, "x", -1].forEach((v) => throwsMsg(() => RxBuilder.buildRegimen(f(v)), /veces al día de Lenalidomida/i));
  const r = RxBuilder.buildRegimen(f("2"));
  assert.equal(r.fases[0].items[0].veces_al_dia, 2);
  const s = RxEngine.buildSchedule(r, { start: "2026-11-02", n: 1 });
  assert.equal(s.events[0].veces, 2);
  assert.equal(RxBuilder.buildRegimen(f("")).fases[0].items[0].veces_al_dia, 1);
  assert.equal(RxBuilder.buildRegimen(formCiclos({ items: [item()] })).fases[0].items[0].veces_al_dia, 1);
  const ri = RxBuilder.buildRegimen(formIntervalo({ items: [Object.assign({}, formIntervalo().items[0], { veces_al_dia: 3 })] }));
  assert.equal(ri.items[0].veces_al_dia, 3);
});

test("vista: la hoja imprime '2 veces al día' y las etiquetas aclaran el día 0/1", async () => {
  const dom = await loadPage({ beforeParse(w) { w.print = () => {}; } });
  const d = dom.window.document;
  click(dom, d.getElementById("cal_nueva"));
  const txt = d.getElementById("cal_constructor").textContent;
  assert.match(txt, /Días del ciclo \(1 = primer día del ciclo\)/);
  assert.match(txt, /Dosis iniciales: días desde el inicio \(0 = día de inicio\)/);
  assert.match(txt, /Primer mantenimiento: días desde el inicio \(0 = día de inicio\)/);
  click(dom, d.getElementById("cal_ej_oral"));
  setValue(dom, d.getElementById("cb_nombre"), "Dos al día");
  setValue(dom, d.querySelector("#cb_items [data-f=veces_al_dia]"), "2");
  click(dom, d.getElementById("cb_crear"));
  click(dom, d.getElementById("cal_imprimir"));
  assert.match(d.getElementById("hojaPaciente").textContent, /2 veces al día/);
  click(dom, d.getElementById("cal_nueva"));
  click(dom, d.getElementById("cal_ej_oral"));
  setValue(dom, d.getElementById("cb_nombre"), "Mal");
  setValue(dom, d.querySelector("#cb_items [data-f=veces_al_dia]"), "9");
  click(dom, d.getElementById("cb_crear"));
  assert.match(d.querySelector("#cal_constructor p[role=alert]").textContent, /veces al día/);
  dom.window.close();
});

test("indefinida: la casilla del formulario marca duracion indefinida; por defecto no", () => {
  reset();
  assert.equal(RxBuilder.buildRegimen(formCiclos()).duracion, undefined);
  assert.equal(RxBuilder.buildRegimen(formCiclos({ indefinida: true })).duracion, "indefinida");
  assert.equal(RxBuilder.buildRegimen(formIntervalo({ indefinida: true })).duracion, "indefinida");
});

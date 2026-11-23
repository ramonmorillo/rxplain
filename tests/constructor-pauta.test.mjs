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
  return Object.assign({ nombre: "Mi oral", tipo: "ciclos", ciclo_dias: 28, items: [item()] }, extra);
}
function formIntervalo(extra) {
  return Object.assign({
    nombre: "Mi biológico", tipo: "intervalo",
    items: [{ farmaco: "Biológico", abrev: "Bio", dosis: "40 mg", lugar: "casa_inyeccion", desplazamientos_dias: [0, 14, 28], primer_mantenimiento_dia: 56, cada_dias: 56 }]
  }, extra);
}
function throwsMsg(fn, re) { assert.throws(fn, (e) => e instanceof Error && re.test(e.message)); }

test("ciclos: genera regimen válido, pendiente y sin registrar nada", () => {
  const r = RxBuilder.buildRegimen(formCiclos());
  assert.equal(r.id, "pauta");
  assert.equal(r.nombre, "Mi oral");
  assert.equal(r.linea, "Pauta propia");
  assert.equal(r.estado, "pendiente");
  assert.equal(r.fecha_revision, null);
  assert.match(r.fuente, /sin validar/);
  assert.equal(r.ciclos_defecto, 1);
  assert.equal(r.supuestos.length, 1);
  assert.equal(r.fases.length, 1);
  assert.equal(r.fases[0].desde, 1);
  assert.equal(r.fases[0].hasta, null);
  assert.equal(r.fases[0].duracion, 28);
  assert.equal(RxData.register, undefined);
  assert.equal(RxData.list, undefined);
});

test("es pura: pautas iguales o distintas siempre llevan id 'pauta' y son objetos nuevos", () => {
  const a = RxBuilder.buildRegimen(formCiclos());
  const b = RxBuilder.buildRegimen(formCiclos());
  const c = RxBuilder.buildRegimen(formCiclos({ nombre: "Mi oral 2" }));
  assert.equal(a.id, "pauta");
  assert.equal(b.id, "pauta");
  assert.equal(c.id, "pauta");
  assert.notEqual(a, b);
  assert.deepEqual(a, b);
  assert.equal(c.nombre, "Mi oral 2");
});

test("nombre opcional: por defecto el primer fármaco", () => {
  assert.equal(RxBuilder.buildRegimen(formCiclos({ nombre: "" })).nombre, "Lenalidomida");
  assert.equal(RxBuilder.buildRegimen(formCiclos({ nombre: "   " })).nombre, "Lenalidomida");
  assert.equal(RxBuilder.buildRegimen(formCiclos({ nombre: undefined })).nombre, "Lenalidomida");
});

test("validada: solo true exacto con fecha_revision; sin fecha da error; sin supuestos", () => {
  const r = RxBuilder.buildRegimen(formCiclos({ validada: true, fecha_revision: "2026-11-20" }));
  assert.equal(r.estado, "validado");
  assert.equal(r.fecha_revision, "2026-11-20");
  assert.match(r.fuente, /validada por el usuario/);
  assert.equal(r.supuestos, undefined);
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ validada: true })), /Falta la fecha de revisión/);
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ validada: true, fecha_revision: "20/11/2026" })), /Falta la fecha de revisión/);
  ["true", 1, "si", false, undefined].forEach((v) => {
    assert.equal(RxBuilder.buildRegimen(formCiclos({ validada: v, fecha_revision: "2026-11-20" })).estado, "pendiente");
  });
  const i = RxBuilder.buildRegimen(formIntervalo({ validada: true, fecha_revision: "2026-11-20" }));
  assert.equal(i.estado, "validado");
});

test("el formulario ya no admite área, ciclos por defecto ni indefinida: se ignoran", () => {
  const r = RxBuilder.buildRegimen(formCiclos({ area: "Cardiología", ciclos_defecto: 9, indefinida: true }));
  assert.equal(r.area, undefined);
  assert.equal(r.ciclos_defecto, 1);
  assert.equal(r.duracion, undefined);
  assert.equal(RxBuilder.AREAS, undefined);
});

test("ejemplos: devuelven nombre, tipo, n e items en texto", () => {
  const o = RxBuilder.EJEMPLOS.oral21de28();
  assert.deepEqual([o.tipo, o.n, o.ciclo_dias, o.items[0].dias], ["ciclos", 6, "28", "1-21"]);
  assert.equal(o.area, undefined);
  const b = RxBuilder.EJEMPLOS.biologico();
  assert.deepEqual([b.tipo, b.n, b.items[0].desplazamientos_dias, b.items[0].cada_dias], ["intervalo", 8, "0,14,28", "56"]);
  assert.equal(b.ciclo_dias, undefined);
});

test("ejemplo oral días 1-21 de 28 produce las fechas esperadas", () => {
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
    throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ ciclo_dias: v })), /ciclo/i);
  });
  assert.ok(RxBuilder.buildRegimen(formCiclos({ ciclo_dias: 366, items: [item({ dias: [1, 366] })] })));
});

test("dias fuera del ciclo, duplicados, desordenados, vacíos", () => {
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ items: [item({ dias: [1, 29] })] })), /29/);
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ items: [item({ dias: [0, 1] })] })), /0/);
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ items: [item({ dias: [1, 1, 2] })] })), /repetid|duplicad/i);
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ items: [item({ dias: [8, 1] })] })), /orden/i);
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ items: [item({ dias: [] })] })), /día/i);
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ items: [item({ dias: [1.5] })] })), /entero/i);
});

test("lugar, fármaco, dosis, sin fármacos y tipo", () => {
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ items: [item({ lugar: "bar" })] })), /lugar/i);
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ items: [item({ farmaco: "" })] })), /fármaco/i);
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ items: [item({ dosis: "" })] })), /dosis/i);
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ items: [] })), /fármaco/i);
  throwsMsg(() => RxBuilder.buildRegimen(formCiclos({ tipo: "otro" })), /tipo/i);
});

test("intervalo: desplazamientos, mantenimiento y cada_dias", () => {
  const base = formIntervalo().items[0];
  const f = (o) => formIntervalo({ items: [Object.assign({}, base, o)] });
  throwsMsg(() => RxBuilder.buildRegimen(f({ desplazamientos_dias: [0, -1] })), /desplazamiento/i);
  throwsMsg(() => RxBuilder.buildRegimen(f({ desplazamientos_dias: [0, 1.5] })), /desplazamiento/i);
  throwsMsg(() => RxBuilder.buildRegimen(f({ cada_dias: 0 })), /cada/i);
  throwsMsg(() => RxBuilder.buildRegimen(f({ cada_dias: "x" })), /cada/i);
  throwsMsg(() => RxBuilder.buildRegimen(f({ primer_mantenimiento_dia: -1 })), /mantenimiento/i);
  const r = RxBuilder.buildRegimen(formIntervalo());
  assert.equal(r.tipo, "intervalo");
  assert.equal(r.items[0].dosis_totales, 1); // el nº de dosis lo fija el calendario (n)
});

test("valores numéricos en texto (desde el formulario) se aceptan", () => {
  const r = RxBuilder.buildRegimen(formCiclos({ ciclo_dias: "28" }));
  assert.equal(r.fases[0].duracion, 28);
});

// ---------- vista ----------
function setValue(dom, el, value, type = "input") {
  el.value = value;
  el.dispatchEvent(new dom.window.Event(type, { bubbles: true }));
}
function click(dom, el) { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); }
const diasPildora = (d) => Array.from(d.querySelectorAll("#cal_meses .dia")).filter((x) => x.querySelector(".pildora")).map((x) => x.dataset.date);

test("vista: ejemplo oral rellena el formulario y el calendario se pinta en vivo, sin botón Crear", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  assert.ok(dom.window.RxBuilder);
  assert.equal(d.getElementById("cb_crear"), null);
  assert.equal(d.getElementById("cal_nueva"), null);
  assert.equal(d.getElementById("cal_esquema"), null);
  assert.equal(d.getElementById("cb_area"), null);
  click(dom, d.getElementById("cal_ej_oral"));
  assert.equal(d.querySelector("#cb_items [data-f=dias]").value, "1-21");
  assert.equal(d.getElementById("cb_ciclo").value, "28");
  assert.equal(d.getElementById("cal_ciclos").value, "6");
  setValue(dom, d.getElementById("cb_nombre"), "Mi pauta <b>");
  assert.equal(d.getElementById("cb_estado").textContent, "");
  assert.match(d.getElementById("cal_resumen_txt").textContent, /^Mi pauta <b> · pendiente de validación$/);
  assert.equal(d.querySelector("#cal_resumen b"), null);
  setValue(dom, d.getElementById("cal_inicio"), "2026-11-02", "change");
  setValue(dom, d.getElementById("cal_ciclos"), "2");
  const dias = diasPildora(d);
  assert.equal(dias.length, 42);
  assert.equal(dias[0], "2026-11-02");
  assert.equal(dias[20], "2026-11-22");
  assert.equal(dias[21], "2026-11-30");
  assert.equal(dias[41], "2026-12-20");
  assert.ok(d.querySelector("#cal_avisos .aviso-pendiente"));
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("vista: pauta incompleta o con error: mensaje claro en #cb_estado y sin calendario", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  // Formulario vacío al abrir: pide completar la pauta, sin errores de consola.
  assert.match(d.getElementById("cb_estado").textContent, /fármaco/i);
  assert.equal(d.querySelectorAll("#cal_meses .pildora").length, 0);
  assert.match(d.getElementById("cal_avisos").textContent, /Complete la pauta/);
  click(dom, d.getElementById("cal_ej_oral"));
  assert.ok(d.querySelector("#cal_meses .pildora"));
  setValue(dom, d.querySelector("#cb_items [data-f=dias]"), "1-40");
  assert.match(d.getElementById("cb_estado").textContent, /día 29.*entre 1 y 28/);
  assert.equal(d.querySelectorAll("#cal_meses .pildora").length, 0);
  setValue(dom, d.querySelector("#cb_items [data-f=dias]"), "1-21");
  assert.equal(d.getElementById("cb_estado").textContent, "");
  assert.ok(d.querySelector("#cal_meses .pildora"));
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("vista: Añadir fármaco añade filas, Quitar las elimina (queda al menos una); ejemplo biológico", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  const n0 = d.querySelectorAll("#cb_items .cb-item").length;
  click(dom, d.getElementById("cb_add"));
  assert.equal(d.querySelectorAll("#cb_items .cb-item").length, n0 + 1);
  click(dom, d.querySelector("#cb_items [data-quitar]"));
  assert.equal(d.querySelectorAll("#cb_items .cb-item").length, n0);
  click(dom, d.querySelector("#cb_items [data-quitar]"));
  assert.equal(d.querySelectorAll("#cb_items .cb-item").length, 1);
  assert.match(d.getElementById("cb_estado").textContent, /al menos un fármaco/);
  click(dom, d.getElementById("cal_ej_bio"));
  assert.equal(d.getElementById("cb_tipo").value, "intervalo");
  assert.equal(d.getElementById("cal_ciclos_lbl").textContent, "Dosis");
  setValue(dom, d.getElementById("cal_inicio"), "2026-11-02", "change");
  setValue(dom, d.getElementById("cal_ciclos"), "5");
  assert.deepEqual(diasPildora(d), ["2026-11-02", "2026-11-16", "2026-11-30", "2026-12-28", "2027-02-22"]);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("el nombre y el fármaco con HTML se escapan en la vista y en la hoja; la hoja lleva el banner de pendiente", async () => {
  const dom = await loadPage({ beforeParse(w) { w.print = () => {}; } });
  const d = dom.window.document;
  click(dom, d.getElementById("cal_ej_oral"));
  setValue(dom, d.getElementById("cb_nombre"), 'X"<img src=x onerror=alert(1)>');
  setValue(dom, d.querySelector("#cb_items [data-f=farmaco]"), "<script>alert(1)</script>");
  setValue(dom, d.querySelector("#cb_items [data-f=abrev]"), "<i>");
  assert.equal(d.getElementById("cb_estado").textContent, "");
  click(dom, d.getElementById("cal_imprimir"));
  const hoja = d.getElementById("hojaPaciente");
  assert.ok(hoja.querySelector(".aviso-pendiente"));
  assert.match(hoja.textContent, /<script>alert\(1\)<\/script>/);
  assert.equal(hoja.querySelector("img"), null);
  assert.equal(hoja.querySelector("script"), null);
  assert.equal(d.querySelector("#cal_meses img, #cal_meses script, #cal_meses i"), null);
  assert.equal(d.querySelector("#cal_resumen img"), null);
  assert.equal(d.querySelector("#informe_preview img, #informe_preview script"), null);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("imprimir con la pauta incompleta avisa de completarla y no construye hoja", async () => {
  const dom = await loadPage({ beforeParse(w) { w.print = () => {}; } });
  const d = dom.window.document;
  click(dom, d.getElementById("cal_imprimir"));
  assert.match(d.getElementById("cal_avisos").textContent, /Complete la pauta/);
  assert.equal(d.getElementById("hojaPaciente").innerHTML, "");
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

// ---------- ronda de correcciones 1 ----------
test("intervalo: dosis iniciales duplicadas, decrecientes y mantenimiento no posterior", () => {
  const f = (o) => formIntervalo({ items: [Object.assign({}, formIntervalo().items[0], o)] });
  throwsMsg(() => RxBuilder.buildRegimen(f({ desplazamientos_dias: [0, 0, 14] })), /Biológico.*repetid/i);
  throwsMsg(() => RxBuilder.buildRegimen(f({ desplazamientos_dias: [0, 28, 14] })), /Biológico.*orden creciente/i);
  throwsMsg(() => RxBuilder.buildRegimen(f({ primer_mantenimiento_dia: 28 })), /primer mantenimiento \(día 28\) debe ser posterior a la última dosis inicial \(día 28\)/i);
  throwsMsg(() => RxBuilder.buildRegimen(f({ primer_mantenimiento_dia: 10 })), /posterior/i);
  assert.ok(RxBuilder.buildRegimen(f({ desplazamientos_dias: [], primer_mantenimiento_dia: 0 })));
});

test("veces_al_dia: opcional, entero 1-6, llega al evento", () => {
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
  const txt = d.getElementById("cal_pauta").textContent;
  assert.match(txt, /Días del ciclo \(1 = primer día del ciclo\)/);
  assert.match(txt, /Dosis iniciales: días desde el inicio \(0 = día de inicio\)/);
  assert.match(txt, /Primer mantenimiento: días desde el inicio \(0 = día de inicio\)/);
  click(dom, d.getElementById("cal_ej_oral"));
  setValue(dom, d.getElementById("cb_nombre"), "Dos al día");
  setValue(dom, d.querySelector("#cb_items [data-f=veces_al_dia]"), "2");
  assert.equal(d.getElementById("cb_estado").textContent, "");
  assert.match(d.querySelector("#cal_meses .pildora").title, /2 veces al día/);
  click(dom, d.getElementById("cal_imprimir"));
  assert.match(d.getElementById("hojaPaciente").textContent, /2 veces al día/);
  setValue(dom, d.querySelector("#cb_items [data-f=veces_al_dia]"), "9");
  assert.match(d.getElementById("cb_estado").textContent, /veces al día/);
  assert.equal(d.querySelectorAll("#cal_meses .pildora").length, 0);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("vista: la casilla validada marca la pauta como validada y quita el aviso de pendiente", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  click(dom, d.getElementById("cal_ej_oral"));
  assert.ok(d.querySelector("#cal_avisos .aviso-pendiente"));
  const v = d.getElementById("cb_validada");
  v.checked = true;
  v.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  assert.equal(d.getElementById("cb_estado").textContent, "");
  assert.match(d.getElementById("cal_resumen_txt").textContent, /· validada$/);
  assert.equal(d.querySelector("#cal_avisos .aviso-pendiente"), null);
  assert.ok(d.querySelector("#cal_meses .pildora"));
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

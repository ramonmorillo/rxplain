import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./helpers/loadPage.mjs";

function setValue(dom, el, value, type = "input") {
  el.value = value;
  el.dispatchEvent(new dom.window.Event(type, { bubbles: true }));
}
function check(dom, el, on) {
  el.checked = on;
  el.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}
const cic = (extra) => Object.assign({
  nombre: "Oral indef", area: "Hematología", tipo: "ciclos", ciclos_defecto: 3, ciclo_dias: 28,
  items: [{ farmaco: "Oral", abrev: "Or", dosis: "10 mg", lugar: "casa", dias: [1, 8] }]
}, extra);
const inter = (cada, extra) => Object.assign({
  nombre: "Bio indef", area: "Inmunomediadas", tipo: "intervalo", ciclos_defecto: 3,
  items: [{ farmaco: "Bio", abrev: "Bi", dosis: "40 mg", lugar: "casa_inyeccion", desplazamientos_dias: [0], primer_mantenimiento_dia: cada, cada_dias: cada }]
}, extra);

// Crea la pauta por la interfaz del constructor (así se refresca el selector, como en uso real).
async function setup(form, inicio = "2026-11-19") {
  const dom = await loadPage();
  const d = dom.window.document;
  d.getElementById("cal_nueva").click();
  d.getElementById("cb_nombre").value = form.nombre;
  d.getElementById("cb_area").value = form.area;
  const tipo = d.getElementById("cb_tipo");
  tipo.value = form.tipo;
  tipo.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  d.getElementById("cb_n").value = String(form.ciclos_defecto);
  if (form.ciclo_dias) d.getElementById("cb_ciclo").value = String(form.ciclo_dias);
  const row = d.querySelector("#cb_items .cb-item");
  for (const [k, v] of Object.entries(form.items[0])) {
    const el = row.querySelector(`[data-f="${k}"]`);
    if (el) el.value = Array.isArray(v) ? v.join(",") : String(v);
  }
  d.getElementById("cb_indefinida").checked = !!form.indefinida;
  d.getElementById("cb_crear").click();
  assert.equal(d.getElementById("cb_error").textContent, "");
  const r = dom.window.RxData.list().filter((x) => x.linea === "Pauta propia").pop();
  setValue(dom, d.getElementById("cal_inicio"), inicio, "change");
  return { dom, d, r };
}
const dates = (d) => [...d.querySelectorAll("#cal_meses [data-date]")].map((e) => e.dataset.date);

test("esquema indefinido: casilla marcada, hasta 2027-12-31 y calendario cubre hasta diciembre 2027", async () => {
  const { dom, d } = await setup({ ...cic(), indefinida: true });
  assert.equal(d.getElementById("cal_indefinida").checked, true);
  assert.equal(d.getElementById("cal_hasta").value, "2027-12-31");
  const ds = dates(d);
  assert.equal(ds[ds.length - 1], "2027-12-31");
  const ev = [...d.querySelectorAll("#cal_meses .pildora")].length;
  assert.ok(ev >= 30, "eventos=" + ev); // ~16 ciclos x 2 días
  assert.equal(d.querySelector("#cal_avisos .aviso-recorte"), null);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("esquema limitado: casilla desmarcada y el nº de ciclos manda", async () => {
  const { d, dom } = await setup(cic());
  assert.equal(d.getElementById("cal_indefinida").checked, false);
  assert.equal(d.querySelectorAll("#cal_meses .mes").length, 4);
  // activarla manualmente extiende
  check(dom, d.getElementById("cal_indefinida"), true);
  const ds = dates(d);
  assert.equal(ds[ds.length - 1], "2027-12-31");
  // y desactivarla restaura el nº de ciclos anterior
  check(dom, d.getElementById("cal_indefinida"), false);
  assert.equal(d.getElementById("cal_ciclos").value, "3");
  assert.equal(d.getElementById("cal_ciclos").disabled, false);
  dom.window.close();
});

test("pauta por intervalo largo indefinida: pocas dosis, cubre hasta la fecha", async () => {
  const { d, dom } = await setup({ ...inter(180), indefinida: true });
  const ds = dates(d);
  assert.equal(ds[ds.length - 1], "2027-12-31");
  const dosis = d.querySelectorAll("#cal_meses .pildora").length;
  assert.ok(dosis === 3, "dosis=" + dosis);
  assert.equal(d.querySelector("#cal_avisos .aviso-recorte"), null);
  dom.window.close();
});

test("tope de 60 recorta antes de la fecha: aviso visible con la fecha hasta la que llega", async () => {
  const { d, dom } = await setup({ ...inter(7), indefinida: true }, "2026-11-19");
  // 60 dosis cada 7 días llegan a ~2028-01; con hasta=2030 el tope de 60 recorta
  check(dom, d.getElementById("cal_indefinida"), true);
  setValue(dom, d.getElementById("cal_hasta"), "2030-12-31", "change");
  const av = d.querySelector("#cal_avisos .aviso-recorte");
  assert.ok(av, "debe haber aviso de recorte");
  assert.match(av.textContent, /Calendario recortado hasta \d{2}\/\d{2}\/\d{4}/);
  const m = av.textContent.match(/hasta (\d{2})\/(\d{2})\/(\d{4})/);
  const last = dates(d).filter((x) => d.querySelector(`#cal_meses [data-date="${x}"] .pildora`)).pop();
  assert.equal(`${m[3]}-${m[2]}-${m[1]}`, last);
  dom.window.close();
});

test("inicio posterior a hasta: mensaje claro, sin calendario ni errores", async () => {
  const { d, dom } = await setup({ ...cic(), indefinida: true }, "2028-03-01");
  assert.match(d.getElementById("cal_avisos").textContent, /posterior/);
  assert.equal(d.querySelectorAll("#cal_meses .mes").length, 0);
  assert.match(d.getElementById("informe_preview").textContent, /posterior|Indique/);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("hasta vacío o inválido: mensaje, sin errores", async () => {
  const { d, dom } = await setup({ ...cic(), indefinida: true });
  setValue(dom, d.getElementById("cal_hasta"), "", "change");
  assert.match(d.getElementById("cal_avisos").textContent, /Calendario hasta/);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("los esquemas de mieloma incluidos no son indefinidos", async () => {
  const dom = await loadPage();
  for (const r of dom.window.RxData.list()) assert.notEqual(r.duracion, "indefinida", r.id);
  assert.equal(dom.window.document.getElementById("cal_indefinida").checked, false);
  dom.window.close();
});

test("el constructor tiene la casilla de pauta indefinida y la propaga al esquema", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  d.getElementById("cal_nueva").click();
  const cb = d.getElementById("cb_indefinida");
  assert.ok(cb);
  assert.match(cb.closest("label").textContent, /Pauta indefinida \(se continúa hasta que su médico indique otra cosa\)/);
  d.getElementById("cal_ej_oral").click();
  d.getElementById("cb_indefinida").checked = true;
  d.getElementById("cb_crear").click();
  const r = dom.window.RxData.list().filter((x) => x.linea === "Pauta propia").pop();
  assert.equal(r.duracion, "indefinida");
  assert.equal(d.getElementById("cal_indefinida").checked, true);
  dom.window.close();
});

test("hoja: contexto con indefinida y hasta, y texto visible", async () => {
  const { d, dom } = await setup({ ...cic(), indefinida: true });
  const pre = d.getElementById("informe_preview");
  assert.match(pre.textContent, /hasta que su médico indique otra cosa/i);
  assert.match(pre.textContent, /31\/12\/2027/);
  check(dom, d.getElementById("cal_indefinida"), false);
  assert.doesNotMatch(d.getElementById("informe_preview").textContent, /hasta que su médico indique otra cosa/i);
  dom.window.close();
});

test("hoja: aviso de recorte también en la vista previa", async () => {
  const { d, dom } = await setup({ ...inter(7), indefinida: true });
  setValue(dom, d.getElementById("cal_hasta"), "2030-12-31", "change");
  assert.match(d.getElementById("informe_preview").textContent, /Calendario recortado hasta \d{2}\/\d{2}\/\d{4}/);
  dom.window.close();
});

// ---- Datos de contacto en Informe ----
test("contacto: campos de Informe con respaldo en los de Infografía", async () => {
  const { d, dom } = await setup(cic());
  for (const id of ["inf_hospital", "inf_farmaceutico", "inf_telefono"]) {
    assert.ok(d.querySelector("#sub-informe #" + id), id);
  }
  const pre = () => d.getElementById("informe_preview").textContent;
  setValue(dom, d.getElementById("center"), "Centro Infografía");
  setValue(dom, d.getElementById("pharm_name"), "Farm Infografía");
  setValue(dom, d.getElementById("contact"), "955000000");
  assert.match(pre(), /Centro Infografía/);
  assert.match(pre(), /Farm Infografía/);
  assert.match(pre(), /955000000/);
  setValue(dom, d.getElementById("inf_hospital"), "Hospital Informe");
  setValue(dom, d.getElementById("inf_farmaceutico"), "Farm Informe");
  setValue(dom, d.getElementById("inf_telefono"), "+34 600 11 22 33");
  assert.match(pre(), /Hospital Informe/);
  assert.match(pre(), /Farm Informe/);
  assert.match(pre(), /\+34 600 11 22 33/);
  assert.doesNotMatch(pre(), /Centro Infografía|Farm Infografía|955000000/);
  // vacío de nuevo: vuelve al respaldo
  setValue(dom, d.getElementById("inf_hospital"), "   ");
  assert.match(pre(), /Centro Infografía/);
  dom.window.close();
});

test("contacto: se escapa y no se guarda", async () => {
  const { d, dom } = await setup(cic());
  setValue(dom, d.getElementById("inf_hospital"), 'H<img src=x onerror=alert(1)>"');
  const pre = d.getElementById("informe_preview");
  assert.equal(pre.querySelector("img"), null);
  assert.match(pre.textContent, /H<img src=x/);
  try { assert.equal(dom.window.localStorage.length, 0); } catch (e) { if (e instanceof assert.AssertionError) throw e; /* jsdom sin storage en file:// */ }
  assert.equal(dom.window.document.cookie, "");
  dom.window.close();
});

import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./helpers/loadPage.mjs";
import { definirPauta, setValue } from "./helpers/pauta.mjs";

function check(dom, el, on) {
  el.checked = on;
  el.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}
const cic = (extra) => Object.assign({
  nombre: "Oral indef", tipo: "ciclos", n: 3, ciclo_dias: 28,
  items: [{ farmaco: "Oral", abrev: "Or", dosis: "10 mg", lugar: "casa", dias: "1,8" }]
}, extra);
const inter = (cada, extra) => Object.assign({
  nombre: "Bio indef", tipo: "intervalo", n: 3,
  items: [{ farmaco: "Bio", abrev: "Bi", dosis: "40 mg", lugar: "casa_inyeccion", desplazamientos_dias: "0",
    primer_mantenimiento_dia: String(cada), cada_dias: String(cada) }]
}, extra);

// Define la pauta por el formulario, como el usuario (la casilla «indefinida» es un control del usuario).
async function setup(form, inicio = "2026-11-19") {
  const dom = await loadPage();
  const d = definirPauta(dom, { ...form, inicio });
  assert.equal(d.getElementById("cb_estado").textContent, "");
  return { dom, d };
}
const dates = (d) => [...d.querySelectorAll("#cal_meses [data-date]")].map((e) => e.dataset.date);

test("pauta indefinida: casilla marcada, hasta 2027-12-31 y calendario cubre hasta diciembre 2027", async () => {
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

test("pauta limitada: casilla desmarcada y el nº de ciclos manda", async () => {
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

test("la casilla indefinida no se marca sola: es un control del usuario", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  const cb = d.getElementById("cal_indefinida");
  assert.equal(cb.checked, false);
  assert.match(cb.closest("label").textContent, /Pauta indefinida \(se continúa hasta que su médico indique otra cosa\)/);
  assert.equal(d.getElementById("cb_indefinida"), null);
  d.getElementById("cal_ej_oral").click();
  assert.equal(d.getElementById("cal_indefinida").checked, false);
  check(dom, cb, true);
  assert.equal(d.getElementById("cal_ciclos").disabled, true);
  assert.equal(d.getElementById("cal_hasta").disabled, false);
  check(dom, cb, false);
  assert.equal(d.getElementById("cal_hasta").disabled, true);
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

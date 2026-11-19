import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadPage } from "./helpers/loadPage.mjs";

const require = createRequire(import.meta.url);
const { buildSheetHTML } = require("../js/hoja-paciente.js");
globalThis.RxEngine = require("../js/schedule-engine.js");

const regimen = (estado) => ({ nombre: "X<b>", linea: "L", estado });
const sched = {
  cycles: [{ n: 1, start: "2026-11-23", len: 28, fase: "C1" }],
  events: [
    { date: "2026-11-24", cycle: 1, day: 2, farmaco: "Dexa", abrev: "Dx", dosis: "20 mg", veces: 1, lugar: "casa", etiqueta: "" },
    { date: "2026-11-23", cycle: 1, day: 1, farmaco: "Dara", abrev: "Da", dosis: "16 mg/kg", veces: 1, lugar: "hospital", etiqueta: "" },
  ],
  end: "2026-12-20",
};
const vacio = { paciente: "", profesional: { nombre: "", centro: "", contacto: "", fecha: "" } };

test("pendiente: banner exacto", () => {
  const h = buildSheetHTML(sched, regimen("pendiente"), vacio);
  assert.ok(h.includes("aviso-pendiente"));
  assert.ok(h.includes("ESQUEMA PENDIENTE DE VALIDACIÓN — NO ENTREGAR AL PACIENTE"));
  assert.ok(!buildSheetHTML(sched, regimen("validado"), vacio).includes("aviso-pendiente"));
});

test("escapa HTML de usuario y de la pauta", () => {
  const h = buildSheetHTML(sched, regimen("validado"), {
    paciente: "<img src=x onerror=alert(1)>",
    profesional: { nombre: "<script>alert(1)</script>", centro: "", contacto: "", fecha: "" },
  });
  assert.ok(h.includes("&lt;img") && h.includes("&lt;script"));
  assert.ok(!h.includes("<img src=x") && !h.includes("<script>"));
  assert.ok(h.includes("X&lt;b&gt;"));
});

test("sin profesional no hay bloque de contacto; con él, solo campos rellenados", () => {
  assert.ok(!buildSheetHTML(sched, regimen("validado"), vacio).includes("hoja-contacto"));
  const h = buildSheetHTML(sched, regimen("validado"), { paciente: "", profesional: { nombre: "", centro: "", contacto: "976", fecha: "" } });
  assert.ok(h.includes("hoja-contacto") && h.includes("976") && !h.includes("Farmacéutico/a"));
});

test("hospital: HOSPITAL en texto, fármaco y lugar como texto", () => {
  const h = buildSheetHTML(sched, regimen("validado"), vacio);
  assert.ok(h.includes("HOSPITAL") && h.includes("hoja-dia-hospital"));
  assert.ok(h.includes("Dara") && h.includes("Dexa") && h.includes("20 mg") && h.includes("casa"));
});

async function fill(dom) {
  const d = dom.window.document;
  const set = (id, v, t = "input") => { const e = d.getElementById(id); e.value = v; e.dispatchEvent(new dom.window.Event(t, { bubbles: true })); };
  set("cal_esquema", "mieloma-drd", "change");
  set("cal_inicio", "2026-11-23", "change");
  set("cal_paciente", "Paciente Secreto");
  set("pharm_name", "Farm"); set("center", "Centro"); set("contact", "123"); set("date", "1 ene");
  return d;
}

test("clic en imprimir: print con data-printing y se limpia en afterprint", async () => {
  const dom = await loadPage();
  const d = await fill(dom);
  let during = null, calls = 0;
  dom.window.print = () => { calls++; during = d.body.dataset.printing; };
  d.getElementById("cal_imprimir").click();
  assert.equal(calls, 1);
  assert.equal(during, "calendario");
  assert.ok(d.getElementById("hojaPaciente").innerHTML.includes("Paciente Secreto"));
  dom.window.dispatchEvent(new dom.window.Event("afterprint"));
  assert.equal(d.body.dataset.printing, undefined);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("fecha vacía: no imprime y avisa", async () => {
  const dom = await loadPage();
  const d = await fill(dom);
  const ini = d.getElementById("cal_inicio"); ini.value = ""; ini.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  let calls = 0;
  dom.window.print = () => { calls++; };
  d.getElementById("cal_imprimir").click();
  assert.equal(calls, 0);
  assert.equal(d.body.dataset.printing, undefined);
  assert.match(d.getElementById("cal_avisos").textContent, /fecha de inicio válida/);
  dom.window.close();
});

test("privacidad: nada en storage ni fetch", async () => {
  const dom = await loadPage();
  let fetches = 0, writes = 0;
  const orig = dom.window.Storage && dom.window.Storage.prototype.setItem;
  if (orig) dom.window.Storage.prototype.setItem = function () { writes++; };
  dom.window.fetch = () => { fetches++; return Promise.resolve(); };
  const d = await fill(dom);
  dom.window.print = () => {};
  d.getElementById("cal_imprimir").click();
  dom.window.dispatchEvent(new dom.window.Event("afterprint"));
  // jsdom con file:// no expone localStorage: se vigila además Storage.prototype.
  for (const k of ["localStorage", "sessionStorage"]) {
    let st; try { st = dom.window[k]; } catch (e) { st = undefined; }
    if (st) assert.equal(st.length, 0);
  }
  assert.equal(writes, 0);
  assert.equal(fetches, 0);
  dom.window.close();
});

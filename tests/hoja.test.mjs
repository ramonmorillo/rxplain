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

const BANNER = "ESQUEMA PENDIENTE DE VALIDACIÓN — NO ENTREGAR AL PACIENTE";
const count = (h, t) => h.split(t).length - 1;

test("fail-safe: solo 'validado' exacto omite el banner", () => {
  for (const estado of [undefined, "Pendiente", "otro", "", null]) {
    assert.ok(buildSheetHTML(sched, regimen(estado), vacio).includes(BANNER), String(estado));
  }
  assert.ok(!buildSheetHTML(sched, regimen("validado"), vacio).includes(BANNER));
});

test("banner repetido en cada bloque mensual si no está validado", () => {
  const multi = { ...sched, end: "2027-01-20" };
  const h = buildSheetHTML(multi, regimen("pendiente"), vacio);
  const meses = count(h, 'class="hoja-mes"');
  assert.ok(meses >= 3);
  assert.ok(count(h, BANNER) >= meses + 1);
  const v = buildSheetHTML(multi, regimen("validado"), vacio);
  assert.equal(count(v, BANNER), 0);
  assert.ok(!v.includes("aviso-pendiente"));
});

const drdSched = () => {
  const RxData = require("../js/regimen-data.js");
  require("../data/regimens/mieloma-drd.js");
  const r = RxData.get("mieloma-drd");
  return { r, s: globalThis.RxEngine.buildSchedule(r, { start: "2026-11-23", n: 6 }) };
};

test("medicación en casa: columna 'Qué días' con rangos y filas por patrón de días", () => {
  const { r, s } = drdSched();
  const h = buildSheetHTML(s, r, vacio);
  const casa = h.slice(h.indexOf("Medicación en casa"), h.indexOf("Calendario mensual"));
  assert.ok(casa.includes("Qué días"));
  assert.ok(casa.includes("Tome la medicación solo los días marcados en el calendario."));
  assert.ok(/<td>1–21<\/td>/.test(casa), "lenalidomida 1–21");
  assert.ok(casa.includes("2, 9, 16, 23") && casa.includes("2, 16"));
  const dexa = casa.split("<tr>").filter((t) => /dexametasona/i.test(t));
  assert.ok(dexa.length >= 2, "patrones distintos -> filas distintas");
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
  const casa = h.slice(h.indexOf("Medicación en casa"), h.indexOf("Calendario mensual"));
  const hosp = h.slice(h.indexOf("Días que tiene que venir"), h.indexOf("Medicación en casa"));
  assert.ok(casa.includes("Dexa") && casa.includes("20 mg") && !casa.includes("Dara"));
  assert.ok(hosp.includes("Dara") && !hosp.includes("Dexa"));
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

test("privacidad: nada en storage, cookies ni red", async () => {
  const writes = [];
  const dom = await loadPage({
    beforeParse(w) {
      // file:// no expone Storage real en jsdom: se definen almacenes falsos que registran cualquier escritura.
      for (const k of ["localStorage", "sessionStorage"]) {
        const data = {};
        const fake = new Proxy(data, {
          set(t, p, v) { writes.push(k + ":" + String(p)); t[p] = v; return true; },
          get(t, p) {
            if (p === "length") return Object.keys(t).length;
            if (["setItem", "removeItem", "clear"].includes(p)) return () => { writes.push(k + "." + p); };
            if (p === "getItem") return (x) => (x in t ? t[x] : null);
            return t[p];
          },
        });
        Object.defineProperty(w, k, { configurable: true, get: () => fake });
      }
      const desc = Object.getOwnPropertyDescriptor(w.Document.prototype, "cookie");
      Object.defineProperty(w.document, "cookie", { configurable: true, get() { return desc.get.call(this); }, set(v) { writes.push("cookie"); desc.set.call(this, v); } });
      w.__net = 0;
      w.fetch = () => { w.__net++; return Promise.resolve(); };
      w.XMLHttpRequest = function () { w.__net++; };
      w.navigator.sendBeacon = () => { w.__net++; return true; };
      w.WebSocket = function () { w.__net++; };
    },
  });
  const d = await fill(dom);
  dom.window.print = () => {};
  d.getElementById("cal_imprimir").click();
  dom.window.dispatchEvent(new dom.window.Event("afterprint"));
  assert.equal(dom.window.localStorage.length, 0);
  assert.equal(dom.window.sessionStorage.length, 0);
  assert.deepEqual(writes, []);
  assert.equal(d.cookie, "");
  assert.equal(dom.window.__net, 0);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("print que lanza: limpia atributo y hoja sin error", async () => {
  const dom = await loadPage();
  const d = await fill(dom);
  dom.window.print = () => { throw new Error("bloqueado"); };
  d.getElementById("cal_imprimir").click();
  assert.equal(d.body.dataset.printing, undefined);
  assert.equal(d.getElementById("hojaPaciente").innerHTML, "");
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("dos clics sin afterprint: un afterprint lo limpia todo", async () => {
  const dom = await loadPage();
  const d = await fill(dom);
  let calls = 0;
  dom.window.print = () => { calls++; };
  const add = dom.window.addEventListener.bind(dom.window);
  let n = 0;
  dom.window.addEventListener = (t, ...r) => { if (t === "afterprint") n++; return add(t, ...r); };
  d.getElementById("cal_imprimir").click();
  d.getElementById("cal_imprimir").click();
  assert.equal(calls, 2);
  dom.window.dispatchEvent(new dom.window.Event("afterprint"));
  assert.equal(d.body.dataset.printing, undefined);
  assert.equal(d.getElementById("hojaPaciente").innerHTML, "");
  assert.equal(n, 2); // un registro por clic; el navegador deduplica el mismo listener
  dom.window.close();
});

test("cambiar a Infografía tras imprimir sin afterprint limpia todo", async () => {
  const dom = await loadPage();
  const d = await fill(dom);
  dom.window.print = () => {};
  d.getElementById("cal_imprimir").click();
  assert.equal(d.body.dataset.printing, "calendario");
  d.getElementById("tab-btn-infografia").click();
  assert.equal(d.body.dataset.printing, undefined);
  assert.equal(d.getElementById("hojaPaciente").innerHTML, "");
  dom.window.close();
});

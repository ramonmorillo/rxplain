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

test("banner en cada página impresa si no está validado", () => {
  const multi = { ...sched, end: "2027-01-20" };
  const h = buildSheetHTML(multi, regimen("pendiente"), vacio);
  const paginas = count(h, 'class="hoja-pagina ');
  assert.ok(count(h, 'class="hoja-mes"') >= 3 && paginas >= 3);
  assert.equal(count(h, BANNER), paginas);
  for (const pg of h.split('<section class="hoja-pagina ').slice(1)) assert.ok(pg.includes(BANNER));
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
  const casa = h.slice(h.indexOf("Medicación en casa"));
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
  const casa = h.slice(h.indexOf("Medicación en casa"));
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

// ---- Task 4: "Sus próximas administraciones" ----
const PROX = "Sus próximas administraciones";
const proxBlock = (h) => {
  const i = h.indexOf(PROX);
  assert.ok(i >= 0, "falta el bloque");
  return h.slice(i, h.indexOf("</section>", i));
};
const evs = (list) => ({
  cycles: [{ n: 1, start: list[0].date, len: 28, fase: "C1" }],
  events: list.map((e, i) => ({ cycle: 1, day: i + 1, abrev: "", veces: 1, etiqueta: "", dosis: "1 mg", lugar: "casa", ...e })),
  end: "2027-03-01",
});

test("próximas: orden por fecha, empate por fármaco, fecha con día de la semana", () => {
  const s = evs([
    { date: "2026-11-25", farmaco: "Zeta" },
    { date: "2026-11-23", farmaco: "Beta" },
    { date: "2026-11-23", farmaco: "Alfa" },
  ]);
  const b = proxBlock(buildSheetHTML(s, regimen("validado"), { ...vacio, hoy: "2026-11-01" }));
  assert.ok(b.indexOf("Alfa") < b.indexOf("Beta") && b.indexOf("Beta") < b.indexOf("Zeta"));
  assert.ok(/lunes<\/span><span class="hoja-prox-dia">23<\/span><span class="hoja-prox-mes">nov 2026/.test(b));
});

test("próximas: límite de 8", () => {
  const list = [];
  for (let i = 0; i < 12; i++) list.push({ date: "2026-11-" + String(10 + i).padStart(2, "0"), farmaco: "F" + String(i).padStart(2, "0") });
  const b = proxBlock(buildSheetHTML(evs(list), regimen("validado"), { ...vacio, hoy: "2026-11-01" }));
  assert.equal(count(b, 'class="hoja-prox-med"'), 8);
  assert.ok(b.includes("F07") && !b.includes("F08"));
});

test("próximas: pauta ya empezada cuenta desde hoy (hoy incluido); no empezada, desde el inicio", () => {
  const s = evs([
    { date: "2026-11-23", farmaco: "Pasado" },
    { date: "2026-11-30", farmaco: "Hoy" },
    { date: "2026-12-07", farmaco: "Futuro" },
  ]);
  const a = proxBlock(buildSheetHTML(s, regimen("validado"), { ...vacio, hoy: "2026-11-30" }));
  assert.ok(!a.includes("Pasado") && a.includes("Hoy") && a.includes("Futuro"));
  const b = proxBlock(buildSheetHTML(s, regimen("validado"), { ...vacio, hoy: "2026-10-01" }));
  assert.ok(b.includes("Pasado") && b.includes("Hoy") && b.includes("Futuro"));
});

test("próximas: hospital con texto HOSPITAL y borde grueso; casa como 'En casa'", () => {
  const b = proxBlock(buildSheetHTML(sched, regimen("validado"), { ...vacio, hoy: "2026-11-01" }));
  const filas = b.split(/<li class="hoja-prox[" ]/).slice(1);
  const h = filas.find((t) => t.includes("Dara")), c = filas.find((t) => t.includes("Dexa"));
  assert.ok(h.includes("hoja-prox-hospital") && h.includes("HOSPITAL") && h.includes("16 mg/kg"));
  assert.ok(c.includes("En casa") && !c.includes("HOSPITAL") && c.includes("20 mg"));
});

test("próximas: escapa HTML de fármaco y dosis", () => {
  const s = evs([{ date: "2026-11-23", farmaco: "<img src=x>", dosis: "<b>1</b>" }]);
  const h = buildSheetHTML(s, regimen("validado"), { ...vacio, hoy: "2026-11-01" });
  assert.ok(!h.includes("<img src=x>") && !h.includes("<b>1</b>"));
  assert.ok(proxBlock(h).includes("&lt;img src=x&gt;"));
});

test("próximas: pauta por intervalo", () => {
  const s = { cycles: [], events: [
    { date: "2026-11-23", cycle: 1, day: 1, farmaco: "Inyec", abrev: "", dosis: "100 mg", veces: 1, lugar: "casa_inyeccion", etiqueta: "" },
    { date: "2026-12-21", cycle: 2, day: 29, farmaco: "Inyec", abrev: "", dosis: "100 mg", veces: 1, lugar: "casa_inyeccion", etiqueta: "" },
  ], end: "2026-12-21" };
  const b = proxBlock(buildSheetHTML(s, { nombre: "I", tipo: "intervalo", items: [{ farmaco: "Inyec", cada_dias: 28 }], estado: "validado" }, { ...vacio, hoy: "2026-11-01" }));
  assert.equal(count(b, 'class="hoja-prox-med"'), 2);
  assert.ok(b.includes("Inyección en casa"));
});

test("próximas: 0 administraciones -> mensaje, sin tabla", () => {
  const h = buildSheetHTML(sched, regimen("validado"), { ...vacio, hoy: "2027-06-01" });
  const b = proxBlock(h);
  assert.ok(b.includes("0 administraciones") && !b.includes("hoja-prox-hospital"));
  assert.ok(h.includes('class="hoja-mes"'));
});

test("próximas: banner pendiente intacto y pie de informe", () => {
  const h = buildSheetHTML(sched, regimen("pendiente"), { ...vacio, hoy: "2026-11-01" });
  assert.ok(h.indexOf(BANNER) < h.indexOf(PROX));
  assert.ok(count(h, BANNER) >= 1 + count(h, 'class="hoja-mes"'));
  assert.ok(h.includes("Este informe no sustituye las indicaciones de su farmacéutico o médico"));
  assert.ok(!buildSheetHTML(sched, regimen("validado"), vacio).includes(BANNER));
});

test("próximas: sin ctx.hoy usa la fecha actual (no lanza)", () => {
  assert.ok(buildSheetHTML(sched, regimen("validado"), vacio).includes(PROX));
});

test("vista previa == hoja impresa y se refresca con los cambios", async () => {
  const dom = await loadPage();
  const d = await fill(dom);
  dom.window.RxCalendar.hoy = () => "2026-11-01";
  d.getElementById("cal_paciente").value = "Pac Uno";
  d.getElementById("cal_paciente").dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  const prev = d.getElementById("informe_preview");
  assert.ok(prev.innerHTML.includes("Pac Uno") && prev.innerHTML.includes("Sus próximas administraciones"));
  dom.window.print = () => {};
  d.getElementById("cal_imprimir").click();
  assert.equal(d.getElementById("hojaPaciente").innerHTML, prev.innerHTML);
  dom.window.dispatchEvent(new dom.window.Event("afterprint"));
  const ini = d.getElementById("cal_inicio"); ini.value = "2026-12-07"; ini.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  assert.ok(prev.innerHTML.includes("7 de dic 2026"));
  const cic = d.getElementById("cal_ciclos"); cic.value = "1"; cic.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  assert.ok(!prev.innerHTML.includes("hoja-mes") || prev.innerHTML.split("hoja-mes").length < 8);
  assert.equal(prev.querySelectorAll("[id]").length, 0, "sin ids duplicados");
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("vista previa: fecha vacía la vacía; CSS de impresión la oculta", async () => {
  const dom = await loadPage();
  const d = await fill(dom);
  const ini = d.getElementById("cal_inicio"); ini.value = ""; ini.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  assert.equal(d.getElementById("informe_preview").innerHTML.includes("Sus próximas"), false);
  const fs = await import("node:fs");
  const css = fs.readFileSync(new URL("../css/calendario.css", import.meta.url), "utf8");
  assert.match(css, /@media print\{[^]*#informe_preview/);
  dom.window.close();
});

// ---- Final fix wave ----
test("I1: cada página empieza con el aviso; las tablas no llevan aviso propio", () => {
  const multi = { ...sched, end: "2027-01-20" };
  for (const estado of ["pendiente", undefined, "otro"]) {
    const h = buildSheetHTML(multi, regimen(estado), vacio);
    for (const pg of h.split('<section class="hoja-pagina ').slice(1)) {
      const i = pg.indexOf('<p class="aviso-pendiente hoja-banner">');
      assert.ok(i >= 0 && i < pg.indexOf('<div class="hoja-cuerpo">'), String(estado));
    }
    for (const t of h.match(/<table[\s\S]*?<\/table>/g) || []) assert.ok(!t.includes(BANNER));
  }
});

test("I1: mieloma-isa-kd 12 ciclos pendiente -> aviso y número de hoja en todas las páginas", () => {
  const RxData = require("../js/regimen-data.js");
  require("../data/regimens/mieloma-isa-kd.js");
  const r = { ...RxData.get("mieloma-isa-kd"), estado: "pendiente" };
  const s = globalThis.RxEngine.buildSchedule(r, { start: "2026-11-23", n: 12 });
  const h = buildSheetHTML(s, r, vacio);
  const paginas = h.split('<section class="hoja-pagina ').slice(1);
  assert.ok(paginas.length >= 6);
  paginas.forEach((pg, i) => {
    assert.ok(pg.includes(BANNER));
    assert.ok(pg.includes("Hoja " + (i + 1) + " de " + paginas.length));
  });
  // ningún mes repartido: cada hoja-mes está entero dentro de una página
  for (const pg of paginas) assert.equal(count(pg, '<section class="hoja-mes"'), count(pg, "hoja-mes-titulo"));
});

test("M2: próximas muestra la etiqueta tras la dosis", () => {
  const s = { cycles: [{ n: 1, start: "2026-11-23", len: 28 }], end: "2026-12-20", events: [
    { date: "2026-11-23", cycle: 1, day: 1, farmaco: "Dexa", abrev: "", dosis: "20 mg", veces: 1, lugar: "casa", etiqueta: "premed." },
    { date: "2026-11-24", cycle: 1, day: 2, farmaco: "Dara", abrev: "", dosis: "10 mg", veces: 1, lugar: "casa", etiqueta: "" },
  ] };
  const h = buildSheetHTML(s, regimen("validado"), { ...vacio, hoy: "2026-11-01" });
  const prox = h.slice(h.indexOf("Sus próximas"), h.indexOf("Días que tiene"));
  assert.ok(prox.includes("20 mg premed."), prox);
  assert.ok(!prox.includes("10 mg ") || prox.includes("10 mg</td>"));
});

test("M1: vista previa se repinta al mostrar Informe y al volver a la pestaña Calendario", async () => {
  const dom = await loadPage();
  const d = await fill(dom);
  const prev = d.getElementById("informe_preview");
  d.getElementById("pharm_name").value = "Dra. Repintada";
  dom.window.RxSubtabs.show("informe");
  assert.ok(prev.innerHTML.includes("Dra. Repintada"));
  d.getElementById("pharm_name").value = "Dr. Segundo";
  d.getElementById("sub-btn-calendario").click(); d.getElementById("sub-btn-informe").click();
  assert.ok(prev.innerHTML.includes("Dr. Segundo"));
  d.getElementById("pharm_name").value = "Dra. Tercera";
  dom.window.RxTabs.show("infografia"); dom.window.RxTabs.show("calendario");
  assert.ok(prev.innerHTML.includes("Dra. Tercera"));
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

// ---- Rediseño (Task 2) ----
const MSG = "Consulte con su farmacéutico ante cualquier cambio de día de administración.";
const pags = (h) => h.split('<section class="hoja-pagina ').slice(1);

test("mensaje fijo destacado en portada y en el pie de cada página", () => {
  const h = buildSheetHTML({ ...sched, end: "2027-03-20" }, regimen("validado"), vacio);
  const ps = pags(h);
  assert.ok(ps[0].includes('<div class="hoja-mensaje" role="note">'));
  assert.ok(ps[0].indexOf(MSG) < ps[0].indexOf("Sus próximas"));
  for (const pg of ps) assert.ok(pg.includes('<p class="hoja-pie-msg">' + MSG + "</p>"));
});

test("contacto: hospital, farmacéutico y teléfono solo si no están vacíos", () => {
  const ctx = (p) => ({ paciente: "", profesional: { nombre: "", centro: "", contacto: "", fecha: "", ...p } });
  assert.ok(!buildSheetHTML(sched, regimen("validado"), ctx({})).includes("hoja-contacto"));
  const h = buildSheetHTML(sched, regimen("validado"), ctx({ contacto: "+34 955 01 50 00" }));
  const c = h.slice(h.indexOf('class="hoja-contacto"'), h.indexOf("</section>", h.indexOf('class="hoja-contacto"')));
  assert.ok(c.includes("Teléfono") && c.includes("+34 955 01 50 00"));
  assert.ok(!c.includes("Hospital</dt>") && !c.includes("Farmacéutico/a responsable"));
  const t = buildSheetHTML(sched, regimen("validado"), ctx({ centro: "H. Valme", nombre: "Dra. X", contacto: "955" }));
  assert.ok(t.includes("<dt>Hospital</dt><dd>H. Valme</dd>") && t.includes("<dt>Farmacéutico/a responsable</dt><dd>Dra. X</dd>"));
  assert.ok(t.includes('<p class="hoja-hospital">H. Valme</p>') && t.includes('<p class="hoja-cab-hosp">H. Valme</p>'));
});

test("orden: portada, meses, visitas al hospital y medicación en casa", () => {
  const { r, s } = drdSched();
  const h = buildSheetHTML(s, r, { ...vacio, hoy: "2026-11-01" });
  const a = h.indexOf("Su calendario de tratamiento"), b = h.indexOf("Sus próximas"), c = h.indexOf("Cómo leer el calendario"),
    d = h.indexOf('class="hoja-mes"'), e = h.indexOf("Días que tiene que venir al hospital"), f = h.indexOf("Medicación en casa");
  assert.ok(a < b && b < c && c < d && d < e && e < f, [a, b, c, d, e, f].join());
  assert.ok(pags(h)[0].includes("Cómo leer el calendario") && !pags(h)[0].includes('class="hoja-mes"'));
});

test("escapa paciente y hospital también en la cabecera de cada página", () => {
  const h = buildSheetHTML({ ...sched, end: "2027-01-20" }, regimen("pendiente"), {
    paciente: '<b>"P"</b>', profesional: { centro: "<i>H</i>", nombre: "", contacto: "", fecha: "" },
  });
  assert.ok(!h.includes("<b>\"P\"</b>") && !h.includes("<i>H</i>"));
  assert.ok(h.includes("&lt;b&gt;&quot;P&quot;&lt;/b&gt;") && h.includes("&lt;i&gt;H&lt;/i&gt;"));
});

test("meses: 2 o 3 por página, nunca partidos; hospital con HOSPITAL en la celda", () => {
  const { r, s } = drdSched();
  const h = buildSheetHTML(s, r, vacio);
  for (const pg of pags(h)) assert.ok(count(pg, 'class="hoja-mes"') <= 3);
  const conMeses = pags(h).filter((pg) => pg.includes('class="hoja-mes"'));
  assert.ok(conMeses.slice(0, -1).every((pg) => count(pg, 'class="hoja-mes"') >= 2));
  assert.ok(/class="hoja-dia hoja-dia-hospital[^"]*" data-date="2026-11-23"[\s\S]*?HOSPITAL/.test(h));
});

test("pauta indefinida recortada: el último ciclo cortado se une al grupo anterior en 'Qué días'", () => {
  const { r } = drdSched();
  const full = globalThis.RxEngine.buildSchedule(r, { start: "2026-11-19", n: 15 });
  const hasta = "2027-12-31";
  const s = { cycles: full.cycles, events: full.events.filter((e) => e.date <= hasta), end: hasta };
  const h = buildSheetHTML(s, r, { ...vacio, indefinida: true, hasta });
  const casa = h.slice(h.indexOf("Medicación en casa"));
  const len = casa.split("<tr>").filter((t) => t.includes("Lenalidomida"));
  assert.equal(len.length, 1, len.join("|"));
  assert.ok(len[0].includes("<td>1–21</td>"));
  assert.ok(!/ciclo 15\)/.test(casa));
});

test("0 eventos: portada y resumen sin calendario ni errores", () => {
  const h = buildSheetHTML({ cycles: [], events: [], end: "2026-11-23" }, regimen("pendiente"), vacio);
  assert.ok(h.includes("0 administraciones") && h.includes("No hay visitas al hospital") && h.includes("No hay medicación para tomar en casa"));
  assert.equal(count(h, BANNER), pags(h).length);
});

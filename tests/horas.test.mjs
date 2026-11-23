import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadPage } from "./helpers/loadPage.mjs";
import { definirPauta, setValue } from "./helpers/pauta.mjs";

const require = createRequire(import.meta.url);
const RxBuilder = require("../js/constructor-pauta.js");
const RxEngine = require("../js/schedule-engine.js");

const item = (extra) => Object.assign({ farmaco: "Fármaco A", abrev: "FA", dosis: "10 mg", lugar: "casa", dias: [1, 2] }, extra);
const form = (items) => ({ tipo: "ciclos", ciclo_dias: 2, items });

// ---------------------------------------------------------------- parseHoras
test("parseHoras: normaliza, ordena y acepta separadores habituales", () => {
  assert.deepEqual(RxBuilder.parseHoras("20:00, 8:00", "x"), ["08:00", "20:00"]);
  assert.deepEqual(RxBuilder.parseHoras("8.30 y 21:15", "x"), ["08:30", "21:15"]);
  assert.deepEqual(RxBuilder.parseHoras("08:00 14:00;22:00", "x"), ["08:00", "14:00", "22:00"]);
  assert.deepEqual(RxBuilder.parseHoras(["20:00", "08:00"], "x"), ["08:00", "20:00"]);
  assert.deepEqual(RxBuilder.parseHoras("", "x"), []);
  assert.deepEqual(RxBuilder.parseHoras(undefined, "x"), []);
  assert.deepEqual(RxBuilder.parseHoras("00:00, 23:59", "x"), ["00:00", "23:59"]);
});

test("parseHoras: rechaza horas inválidas, repetidas y más de 6 al día con mensaje claro", () => {
  for (const [v, re] of [
    ["24:00", /«24:00» no es una hora válida en F/],
    ["8", /«8» no es una hora válida/],
    ["08:60", /no es una hora válida/],
    ["mañana", /«mañana» no es una hora válida/],
    ["08:00, 8:00", /La hora 08:00 de F está repetida/],
    ["01:00,02:00,03:00,04:00,05:00,06:00,07:00", /Como máximo 6 horas/],
  ]) assert.throws(() => RxBuilder.parseHoras(v, "F"), re, v);
});

// ---------------------------------------------------------------- buildRegimen + motor
test("las horas fijan las veces al día si no se dieron y llegan a cada toma del motor", () => {
  const r = RxBuilder.buildRegimen(form([item({ horas: "20:00, 08:00" })]));
  const it = r.fases[0].items[0];
  assert.deepEqual(it.horas, ["08:00", "20:00"]);
  assert.equal(it.veces_al_dia, 2);
  const ev = RxEngine.buildSchedule(r, { start: "2026-11-30", n: 1 }).events;
  assert.deepEqual(ev.map((e) => [e.date, e.horas.join("+"), e.veces]), [["2026-11-30", "08:00+20:00", 2], ["2026-12-01", "08:00+20:00", 2]]);
});

test("las horas deben cuadrar con las veces al día si estas se indican", () => {
  assert.throws(() => RxBuilder.buildRegimen(form([item({ horas: "08:00, 20:00", veces_al_dia: "3" })])),
    /Las horas de Fármaco A \(2\) no coinciden con las veces al día \(3\): indique 2 veces al día o ajuste las horas\./);
  const ok = RxBuilder.buildRegimen(form([item({ horas: "08:00, 20:00", veces_al_dia: "2" })]));
  assert.equal(ok.fases[0].items[0].veces_al_dia, 2);
});

test("sin horas todo queda como antes (horas = [] y veces sin cambios)", () => {
  const r = RxBuilder.buildRegimen(form([item({ veces_al_dia: 3 })]));
  assert.deepEqual(r.fases[0].items[0].horas, []);
  assert.equal(r.fases[0].items[0].veces_al_dia, 3);
});

test("pauta por intervalo: las horas llegan a las dosis", () => {
  const r = RxBuilder.buildRegimen({ tipo: "intervalo", items: [{ farmaco: "B", dosis: "1", lugar: "hospital", desplazamientos_dias: [0], primer_mantenimiento_dia: 14, cada_dias: 14, horas: "09:30" }] });
  const ev = RxEngine.buildSchedule(r, { start: "2026-11-30", n: 3 }).events;
  assert.deepEqual(ev.map((e) => [e.date, e.horas[0]]), [["2026-11-30", "09:30"], ["2026-12-14", "09:30"], ["2026-12-28", "09:30"]]);
});

// ---------------------------------------------------------------- calendario (UI)
const celda = (d, iso) => d.querySelector(`#cal_meses .dia[data-date="${iso}"]`);

test("calendario: las horas se ven en la celda, ordenadas por hora, y en el tooltip", async () => {
  const dom = await loadPage();
  const d = definirPauta(dom, {
    tipo: "ciclos", ciclo_dias: 2, inicio: "2026-11-30", n: 1,
    items: [
      { farmaco: "Tarde", abrev: "TAR", dosis: "1", dias: "1,2", horas: "20:00" },
      { farmaco: "Mañana y noche", abrev: "MYN", dosis: "2", dias: "1", horas: "08:00, 22:00" },
      { farmaco: "Sin hora", abrev: "SIN", dosis: "3", dias: "1", veces_al_dia: "2" },
    ],
  });
  const c = celda(d, "2026-11-30");
  const pil = Array.from(c.querySelectorAll(".pildora")).map((p) => p.textContent);
  assert.deepEqual(pil, ["MYN", "TAR", "SIN"], "orden por primera hora; sin hora al final");
  assert.deepEqual(Array.from(c.querySelectorAll(".horas")).map((h) => h.textContent), ["08:00 22:00", "20:00", "×2"]);
  assert.match(c.querySelector(".pildora").title, /Mañana y noche · 2 · 2 veces al día · a las 08:00 y 22:00/);
  // el día 2 solo tiene la toma de la tarde
  assert.deepEqual(Array.from(celda(d, "2026-12-01").querySelectorAll(".horas")).map((h) => h.textContent), ["20:00"]);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("calendario: al escribir las horas, «veces al día» se ajusta; si se descuadra, se avisa", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  const f = d.querySelector('[data-f="farmaco"]');
  setValue(dom, f, "X");
  setValue(dom, d.querySelector('[data-f="dosis"]'), "5 mg");
  setValue(dom, d.querySelector('[data-f="dias"]'), "1");
  const veces = d.querySelector('[data-f="veces_al_dia"]');
  setValue(dom, d.querySelector('[data-f="horas"]'), "08:00, 14:00, 22:00");
  assert.equal(veces.value, "3");
  assert.equal(d.getElementById("cb_estado").textContent, "");
  setValue(dom, veces, "2");
  assert.match(d.getElementById("cb_estado").textContent, /no coinciden con las veces al día/);
  assert.equal(d.querySelector("#cal_meses .mes"), null, "sin calendario mientras no cuadre");
  // hora a medio escribir: no rompe ni toca veces
  setValue(dom, d.querySelector('[data-f="horas"]'), "08:0");
  assert.match(d.getElementById("cb_estado").textContent, /no es una hora válida/);
  assert.equal(veces.value, "2");
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("calendario: el borrador de la ficha con «cada N horas» no inventa horas", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  dom.window.RxCalendar.precargar({ tipo: "ciclos", ciclo_dias: 28, indefinida: true, items: [{ farmaco: "Y", abrev: "Y", dosis: "", lugar: "casa", dias: "1-28", veces_al_dia: 3 }] });
  assert.equal(d.querySelector('[data-f="horas"]').value, "");
  assert.equal(d.querySelector('[data-f="veces_al_dia"]').value, "3");
  dom.window.close();
});

// ---------------------------------------------------------------- hoja del paciente
test("hoja: horas en próximas administraciones, medicación en casa y visitas al hospital", async () => {
  const dom = await loadPage();
  const d = definirPauta(dom, {
    tipo: "ciclos", ciclo_dias: 14, inicio: "2026-11-30", n: 1,
    items: [
      { farmaco: "Oral", abrev: "Ora", dosis: "10 mg", lugar: "casa", dias: "1-3", horas: "08:00, 20:00" },
      { farmaco: "Infusión", abrev: "Inf", dosis: "1 g", lugar: "hospital", dias: "1", horas: "09:30" },
      { farmaco: "Pastilla", abrev: "Pas", dosis: "5 mg", lugar: "casa", dias: "1-3", horas: "21:00" },
    ],
  });
  void d;
  dom.window.document.getElementById("sub-btn-informe").click();
  const prev = dom.window.document.getElementById("informe_preview");
  const prox = Array.from(prev.querySelectorAll(".hoja-prox-med")).map((x) => x.textContent.replace(/\s+/g, " ").trim());
  // 30/11: orden por hora (Infusión 09:30 no es de casa; la hoja de «próximas» ordena por primera hora)
  assert.ok(prox.some((t) => /Oral 10 mg \(2 veces al día: 08:00 y 20:00\)/.test(t)), prox.join(" | "));
  assert.ok(prox.some((t) => /Infusión 1 g \(a las 09:30\)/.test(t)), prox.join(" | "));
  assert.ok(prox.some((t) => /Pastilla 5 mg \(a las 21:00\)/.test(t)), prox.join(" | "));
  const idx = (re) => prox.findIndex((t) => re.test(t));
  assert.ok(idx(/Oral/) < idx(/Infusión/) && idx(/Infusión/) < idx(/Pastilla/), "ordenadas por hora dentro del día: " + prox.join(" | "));
  const txt = prev.textContent.replace(/\s+/g, " ");
  assert.match(txt, /2 veces al día \(08:00 y 20:00\)/, "tabla de medicación en casa");
  assert.match(txt, /1 vez al día \(21:00\)/);
  assert.match(txt, /Infusión \(09:30\)/, "visitas al hospital");
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

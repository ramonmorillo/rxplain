import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { regimenIntervalo } from "./fixtures/regimen-intervalo.mjs";
import { regimenCiclos } from "./fixtures/regimen-ciclos.mjs";

const { buildSchedule } = createRequire(import.meta.url)("../js/schedule-engine.js");

test("intervalo: fechas de las 5 dosis", () => {
  const r = buildSchedule(regimenIntervalo, { start: "2026-11-23", n: 5 });
  assert.deepEqual(r.events.map((e) => e.date),
    ["2026-11-23", "2026-12-07", "2027-01-04", "2027-03-01", "2027-04-26"]);
  assert.ok(r.events.every((e) => e.lugar === "casa_inyeccion" && e.veces === 1));
  assert.equal(r.events[0].dosis, "dosis-texto-I");
});

test("intervalo: n sustituye a dosis_totales, cycles vacío y end", () => {
  const r = buildSchedule(regimenIntervalo, { start: "2026-11-23", n: 3 });
  assert.equal(r.events.length, 3);
  assert.deepEqual(r.cycles, []);
  assert.equal(r.end, "2027-01-04");
});

test("intervalo: n se ajusta a 1-60", () => {
  const n = (v) => buildSchedule(regimenIntervalo, { start: "2026-11-23", n: v }).events.length;
  assert.equal(n(999), 60);
  assert.equal(n(0), 1);
});

test("por ciclos: veces_al_dia llega como veces", () => {
  const reg = {
    tipo: "ciclos",
    fases: [{ desde: 1, hasta: null, duracion: 7, etiqueta: "F", items: [
      { farmaco: "X", abrev: "X", dosis: "d", lugar: "casa", dias: [1, 2], veces_al_dia: 2 }
    ] }]
  };
  const r = buildSchedule(reg, { start: "2026-11-23", n: 1 });
  assert.deepEqual(r.events.map((e) => e.veces), [2, 2]);
});

test("ajuste de n: Infinity cuenta como >60; basura da 1", () => {
  for (const reg of [regimenCiclos, regimenIntervalo]) {
    const len = (v) => {
      const r = buildSchedule(reg, { start: "2026-11-23", n: v });
      return reg.tipo === "ciclos" ? r.cycles.length : r.events.length;
    };
    assert.equal(len(Infinity), 60);
    assert.equal(len("Infinity"), 60);
    assert.equal(len(999), 60);
    assert.equal(len(2.7), 2);
    for (const v of ["", 0, -2, NaN, "abc"]) assert.equal(len(v), 1);
  }
});

test("pautas sin fases/items lanzan Error claro", () => {
  const o = { start: "2026-11-23", n: 1 };
  assert.throws(() => buildSchedule({ tipo: "ciclos" }, o), (e) => e instanceof Error && !(e instanceof TypeError) && /fases/.test(e.message));
  assert.throws(() => buildSchedule({ tipo: "ciclos", fases: [] }, o), /fases/);
  assert.throws(() => buildSchedule({ fases: [] }, o), /fases/);
  assert.throws(() => buildSchedule({ tipo: "intervalo" }, o), (e) => e instanceof Error && !(e instanceof TypeError) && /items/.test(e.message));
  assert.throws(() => buildSchedule({ tipo: "intervalo", items: [] }, o), /items/);
});

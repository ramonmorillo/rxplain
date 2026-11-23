import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { regimenCiclos } from "./fixtures/regimen-ciclos.mjs";

const { buildSchedule } = createRequire(import.meta.url)("../js/schedule-engine.js");

const dara = (r, c) => r.events.filter((e) => e.farmaco === "Dara" && e.cycle === c);

test("inicios de ciclo sin retraso", () => {
  const r = buildSchedule(regimenCiclos, { start: "2026-11-23", n: 3 });
  assert.deepEqual(r.cycles.map((c) => c.start), ["2026-11-23", "2026-12-21", "2027-01-18"]);
  assert.deepEqual(r.cycles.map((c) => c.n), [1, 2, 3]);
  assert.deepEqual(r.cycles.map((c) => c.len), [28, 28, 28]);
  assert.deepEqual(r.cycles.map((c) => c.fase), ["Fase A", "Fase A", "Fase B"]);
  assert.equal(r.end, "2027-02-14");
});

test("eventos de Dara en C1 y forma del evento", () => {
  const r = buildSchedule(regimenCiclos, { start: "2026-11-23", n: 3 });
  assert.deepEqual(dara(r, 1).map((e) => e.date), ["2026-11-23", "2026-11-30", "2026-12-07", "2026-12-14"]);
  assert.deepEqual(dara(r, 1)[1], {
    date: "2026-11-30", cycle: 1, day: 8, farmaco: "Dara", abrev: "D",
    dosis: "dosis-texto-D", veces: 1, horas: [], lugar: "hospital", etiqueta: ""
  });
  const len = r.events.find((e) => e.farmaco === "Len");
  assert.equal(len.etiqueta, "diario");
  assert.equal(len.lugar, "casa");
});

test("días mayores que la duración se ignoran", () => {
  const r = buildSchedule(regimenCiclos, { start: "2026-11-23", n: 1 });
  assert.ok(r.events.every((e) => e.day <= 28));
  assert.equal(dara(r, 1).length, 4);
});

test("retraso en C2 desplaza C2 y siguientes", () => {
  const r = buildSchedule(regimenCiclos, { start: "2026-11-23", n: 3, delays: { 2: 3 } });
  assert.equal(r.cycles[1].start, "2026-12-24");
  assert.equal(r.cycles[2].start, "2027-01-21");
});

test("retrasos negativos o no numéricos equivalen a 0", () => {
  const base = buildSchedule(regimenCiclos, { start: "2026-11-23", n: 3 });
  for (const d of [-5, "x"]) {
    const r = buildSchedule(regimenCiclos, { start: "2026-11-23", n: 3, delays: { 2: d } });
    assert.deepEqual(r, base);
  }
});

test("fase abierta: C3 y posteriores", () => {
  const r = buildSchedule(regimenCiclos, { start: "2026-11-23", n: 5 });
  assert.equal(dara(r, 3).length, 2);
  assert.equal(dara(r, 3)[0].veces, 2);
  assert.equal(r.cycles[3].fase, "Fase B");
  assert.equal(dara(r, 4).length, 2);
  assert.equal(dara(r, 5).length, 2);
});

test("sin fase coincidente se usa la última", () => {
  const reg = { fases: [{ desde: 1, hasta: 1, duracion: 7, etiqueta: "Única", items: [
    { farmaco: "X", abrev: "X", dosis: "d", lugar: "casa", dias: [1] }] }] };
  const r = buildSchedule(reg, { start: "2026-11-23", n: 2 });
  assert.deepEqual(r.cycles.map((c) => c.fase), ["Única", "Única"]);
  assert.equal(r.events.length, 2);
});

test("n se ajusta a entero entre 1 y 60", () => {
  const out = ["", 0, -2, 2.7, 999, "abc"].map(
    (n) => buildSchedule(regimenCiclos, { start: "2026-11-23", n }).cycles.length
  );
  assert.deepEqual(out, [1, 1, 1, 2, 60, 1]);
});

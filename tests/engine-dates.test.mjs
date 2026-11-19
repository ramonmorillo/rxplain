import test from "node:test";
import assert from "node:assert/strict";
import engine from "../js/schedule-engine.js";

const { isoAdd, isoDow, isoDiff, holidayName } = engine;

test("isoAdd cruza el cambio de hora de octubre de 2026", () => {
  assert.equal(isoAdd("2026-10-24", 2), "2026-10-26");
});
test("isoAdd respeta el día bisiesto", () => {
  assert.equal(isoAdd("2028-02-28", 1), "2028-02-29");
});
test("isoAdd cruza fin de año", () => {
  assert.equal(isoAdd("2026-12-30", 3), "2027-01-02");
});
test("isoDow: 0 = lunes", () => {
  assert.equal(isoDow("2026-11-23"), 0);
  assert.equal(isoDow("2026-11-28"), 5);
});
test("isoDiff en días", () => {
  assert.equal(isoDiff("2026-11-23", "2027-01-04"), 42);
});
test("holidayName: Semana Santa y festivos fijos", () => {
  assert.equal(holidayName("2027-03-26"), "Viernes Santo");
  assert.equal(holidayName("2027-03-25"), "Jueves Santo");
  assert.equal(holidayName("2026-12-08"), "Inmaculada");
  assert.equal(holidayName("2026-11-24"), undefined);
});

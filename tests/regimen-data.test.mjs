import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const RxData = require("../js/regimen-data.js");

const base = () => ({
  id: "t1",
  nombre: "Prueba",
  linea: "1ª línea",
  estado: "pendiente",
  fecha_revision: null,
  fuente: "fuente de prueba",
  ciclos_defecto: 6,
  fases: [{
    desde: 1, hasta: null, duracion: 28, etiqueta: "C1",
    items: [{ farmaco: "A", abrev: "A", dosis: "1 mg", lugar: "casa", dias: [1, 8] }]
  }]
});

const rejects = (r, campo) => {
  assert.throws(() => RxData.check(r), (e) => e instanceof Error && e.message.includes(campo));
};

test("check acepta una pauta pendiente con fecha_revision null y la devuelve", () => {
  const r = base();
  assert.equal(RxData.check(r), r);
  assert.deepEqual(Object.keys(RxData).sort(), ["check"]);
});

test("check no guarda nada: la misma pauta (mismo id) se puede comprobar varias veces", () => {
  assert.ok(RxData.check(base()));
  assert.ok(RxData.check(base()));
});

test("check rechaza sin id u objeto no válido", () => {
  const r = base(); delete r.id; rejects(r, "id");
  rejects({ ...base(), id: "  " }, "id");
  rejects(null, "id");
});

test("check rechaza sin fuente", () => {
  const r = base(); delete r.fuente; rejects(r, "fuente");
});
test("check rechaza estado desconocido", () => {
  rejects({ ...base(), estado: "otro" }, "estado");
});
test("check rechaza validado sin fecha_revision", () => {
  rejects({ ...base(), estado: "validado", fecha_revision: null }, "fecha_revision");
});
test("check rechaza fecha_revision mal formada", () => {
  rejects({ ...base(), fecha_revision: "19/11/2026" }, "fecha_revision");
});
test("check rechaza lugar inválido", () => {
  const r = base(); r.fases[0].items[0].lugar = "x"; rejects(r, "lugar");
});
test("check rechaza dias vacío", () => {
  const r = base(); r.fases[0].items[0].dias = []; rejects(r, "dias");
});
test("check rechaza dia mayor que la duración de la fase", () => {
  const r = base(); r.fases[0].items[0].dias = [29]; rejects(r, "dias");
});
test("check rechaza ciclos_defecto ausente", () => {
  const r = base(); delete r.ciclos_defecto; rejects(r, "ciclos_defecto");
});

test("tipo intervalo: valida campos numéricos", () => {
  const ok = () => ({
    ...base(), tipo: "intervalo", fases: undefined,
    items: [{ farmaco: "A", abrev: "A", dosis: "1 mg", lugar: "casa_inyeccion",
      desplazamientos_dias: [0, 14], primer_mantenimiento_dia: 28, cada_dias: 28, dosis_totales: 5 }]
  });
  assert.ok(RxData.check(ok()));
  const bad = ok(); delete bad.items[0].cada_dias; rejects(bad, "cada_dias");
  const bad2 = ok(); bad2.items[0].desplazamientos_dias = [-1]; rejects(bad2, "desplazamientos_dias");
  const bad3 = ok(); bad3.items[0].dosis_totales = "5"; rejects(bad3, "dosis_totales");
});

test("farmaco, abrev y dosis: texto no vacío en ambos tipos", () => {
  for (const k of ["farmaco", "abrev", "dosis"]) {
    for (const bad of [undefined, "", "  ", 5]) {
      const c = base(); c.fases[0].items[0][k] = bad; rejects(c, k);
      const i = { ...base(), tipo: "intervalo", fases: undefined,
        items: [{ farmaco: "A", abrev: "A", dosis: "1 mg", lugar: "casa_inyeccion",
          desplazamientos_dias: [0], primer_mantenimiento_dia: 28, cada_dias: 28, dosis_totales: 2 }] };
      i.items[0][k] = bad; rejects(i, k);
    }
  }
});

test("duracion: opcional, acepta limitada/indefinida y rechaza otros valores", () => {
  assert.ok(RxData.check(base()));
  assert.ok(RxData.check({ ...base(), duracion: "indefinida" }));
  assert.ok(RxData.check({ ...base(), duracion: "limitada" }));
  rejects({ ...base(), duracion: "para siempre" }, "duracion");
  rejects({ ...base(), duracion: true }, "duracion");
});

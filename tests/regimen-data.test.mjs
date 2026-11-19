import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const RxData = require("../js/regimen-data.js");
const { buildSchedule } = require("../js/schedule-engine.js");

const base = () => ({
  id: "t1",
  nombre: "Prueba",
  area: "Hematología",
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
  RxData._reset();
  assert.throws(() => RxData.register(r), (e) => e instanceof Error && e.message.includes(campo));
};

test("register acepta un esquema pendiente con fecha_revision null", () => {
  RxData._reset();
  RxData.register(base());
  assert.equal(RxData.list().length, 1);
  assert.equal(RxData.get("t1").nombre, "Prueba");
  assert.deepEqual(Object.keys(RxData.byArea()), ["Hematología"]);
});

test("register rechaza sin fuente", () => {
  const r = base(); delete r.fuente; rejects(r, "fuente");
});
test("register rechaza estado desconocido", () => {
  rejects({ ...base(), estado: "otro" }, "estado");
});
test("register rechaza validado sin fecha_revision", () => {
  rejects({ ...base(), estado: "validado", fecha_revision: null }, "fecha_revision");
});
test("register rechaza fecha_revision mal formada", () => {
  rejects({ ...base(), fecha_revision: "19/11/2026" }, "fecha_revision");
});
test("register rechaza lugar inválido", () => {
  const r = base(); r.fases[0].items[0].lugar = "x"; rejects(r, "lugar");
});
test("register rechaza dias vacío", () => {
  const r = base(); r.fases[0].items[0].dias = []; rejects(r, "dias");
});
test("register rechaza dia mayor que la duración de la fase", () => {
  const r = base(); r.fases[0].items[0].dias = [29]; rejects(r, "dias");
});
test("register rechaza id duplicado", () => {
  RxData._reset();
  RxData.register(base());
  assert.throws(() => RxData.register(base()), (e) => e.message.includes("id"));
});
test("register rechaza ciclos_defecto ausente", () => {
  const r = base(); delete r.ciclos_defecto; rejects(r, "ciclos_defecto");
});

test("tipo intervalo: valida campos numéricos", () => {
  const ok = () => ({
    ...base(), tipo: "intervalo", fases: undefined,
    items: [{ farmaco: "A", abrev: "A", dosis: "1 mg", lugar: "casa_inyeccion",
      desplazamientos_dias: [0, 14], primer_mantenimiento_dia: 28, cada_dias: 28, dosis_totales: 5 }]
  });
  RxData._reset();
  RxData.register(ok());
  const bad = ok(); delete bad.items[0].cada_dias; rejects(bad, "cada_dias");
  const bad2 = ok(); bad2.items[0].desplazamientos_dias = [-1]; rejects(bad2, "desplazamientos_dias");
  const bad3 = ok(); bad3.items[0].dosis_totales = "5"; rejects(bad3, "dosis_totales");
});

test("tres esquemas de mieloma: pendientes, y el motor los calcula", () => {
  RxData._reset();
  const files = ["mieloma-drd", "mieloma-vrd-swog", "mieloma-isa-kd"];
  globalThis.RxData = RxData;
  try {
    files.forEach((f) => {
      const p = require.resolve(`../data/regimens/${f}.js`);
      delete require.cache[p];
      require(p);
    });
  } finally {
    delete globalThis.RxData;
  }
  const list = RxData.list();
  assert.equal(list.length, 3);
  assert.ok(list.every((r) => r.estado === "pendiente" && r.fecha_revision === null && r.area === "Hematología"));
  const esperado = { "mieloma-drd": 33, "mieloma-vrd-swog": 26, "mieloma-isa-kd": 17 };
  list.forEach((r) => {
    const s = buildSchedule(r, { start: "2026-11-23", n: r.ciclos_defecto });
    assert.equal(s.events.filter((e) => e.cycle === 1).length, esperado[r.id], r.id);
  });
  const count = (id, n, c) => buildSchedule(RxData.get(id), { start: "2026-11-23", n })
    .events.filter((e) => e.cycle === c).length;
  assert.equal(count("mieloma-drd", 7, 3), 27);
  assert.equal(count("mieloma-drd", 7, 7), 24);
  assert.equal(count("mieloma-isa-kd", 2, 2), 14);
  const drd = RxData.get("mieloma-drd");
  assert.equal(drd.fases[0].items[3].dosis, "1800 mg");
  assert.equal(RxData.get("mieloma-isa-kd").fases[0].items[0].dosis, "10 mg/kg");
  assert.ok(drd.supuestos.some((s) => s.includes("SC e IV")));
});

test("farmaco, abrev y dosis: texto no vacío en ambos tipos", () => {
  for (const k of ["farmaco", "abrev", "dosis"]) {
    for (const bad of [undefined, "", "  ", 5]) {
      RxData._reset();
      const c = base(); c.fases[0].items[0][k] = bad; rejects(c, k);
      RxData._reset();
      const i = { ...base(), tipo: "intervalo", fases: undefined,
        items: [{ farmaco: "A", abrev: "A", dosis: "1 mg", lugar: "casa_inyeccion",
          desplazamientos_dias: [0], primer_mantenimiento_dia: 28, cada_dias: 28, dosis_totales: 2 }] };
      i.items[0][k] = bad; rejects(i, k);
    }
  }
});

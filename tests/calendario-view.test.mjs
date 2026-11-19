import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./helpers/loadPage.mjs";
import { regimenIntervalo } from "./fixtures/regimen-intervalo.mjs";

function setValue(dom, el, value, type = "input") {
  el.value = value;
  el.dispatchEvent(new dom.window.Event(type, { bubbles: true }));
}

function setup(dom, id, inicio, ciclos) {
  const d = dom.window.document;
  setValue(dom, d.getElementById("cal_esquema"), id, "change");
  setValue(dom, d.getElementById("cal_inicio"), inicio, "change");
  if (ciclos !== undefined) setValue(dom, d.getElementById("cal_ciclos"), String(ciclos));
  return d;
}

test("se monta solo en #calendarioRoot con los controles del formulario", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  assert.ok(d.querySelector("#calendarioRoot #cal_esquema"));
  assert.ok(d.querySelector("#calendarioRoot #cal_inicio"));
  assert.ok(d.querySelector("#calendarioRoot #cal_ciclos"));
  assert.ok(d.querySelector("#calendarioRoot #cal_meses"));
  assert.ok(d.querySelector("#calendarioRoot #cal_avisos"));
  assert.ok(d.querySelectorAll("#cal_esquema optgroup").length >= 1);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("DRd con inicio 2026-11-23: día de hospital y aviso de pendiente", async () => {
  const dom = await loadPage();
  const d = setup(dom, "mieloma-drd", "2026-11-23", 6);
  const cell = d.querySelector('#cal_meses .dia-hospital[data-date="2026-11-23"]');
  assert.ok(cell);
  assert.match(cell.textContent, /HOSPITAL/);
  assert.ok(cell.querySelector(".pildora"));
  assert.match(d.getElementById("cal_avisos").textContent, /pendiente de validación/);
  assert.ok(d.querySelector("#cal_avisos .aviso-pendiente"));
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("inicio en sábado: el aviso de conflictos menciona sáb. 21 nov", async () => {
  const dom = await loadPage();
  const d = setup(dom, "mieloma-drd", "2026-11-21", 3);
  assert.match(d.getElementById("cal_avisos").textContent, /sáb\. 21 nov/);
  dom.window.close();
});

test("conflicts() incluye Viernes Santo con evento de hospital", async () => {
  const dom = await loadPage();
  const { RxCalendar } = dom.window;
  const sched = {
    cycles: [{ n: 1, start: "2027-03-26", len: 28, fase: "C1" }],
    events: [
      { date: "2027-03-26", cycle: 1, day: 1, farmaco: "X", abrev: "X", dosis: "d", veces: 1, lugar: "hospital", etiqueta: "" },
      { date: "2027-03-26", cycle: 1, day: 1, farmaco: "Y", abrev: "Y", dosis: "d", veces: 1, lugar: "hospital", etiqueta: "" },
      { date: "2027-03-24", cycle: 1, day: 1, farmaco: "Z", abrev: "Z", dosis: "d", veces: 1, lugar: "casa", etiqueta: "" },
      { date: "2027-03-27", cycle: 1, day: 1, farmaco: "Z", abrev: "Z", dosis: "d", veces: 1, lugar: "casa", etiqueta: "" }
    ],
    end: "2027-04-22"
  };
  assert.deepEqual(Array.from(RxCalendar.conflicts(sched)), ["2027-03-26"]);
  dom.window.close();
});

test("ciclos inválidos (0, vacío, abc) mantienen al menos un ciclo pintado", async () => {
  const dom = await loadPage();
  const d = setup(dom, "mieloma-drd", "2026-11-23");
  for (const v of ["0", "", "abc"]) {
    setValue(dom, d.getElementById("cal_ciclos"), v);
    assert.ok(d.querySelector("#cal_meses .dia-hospital"), `con "${v}"`);
    assert.ok(d.querySelectorAll("#cal_meses [data-ciclo-inicio]").length >= 1, `con "${v}"`);
  }
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("el retraso del ciclo 2 desplaza su inicio en 5 días", async () => {
  const dom = await loadPage();
  const d = setup(dom, "mieloma-drd", "2026-11-23", 3);
  const antes = d.querySelector('[data-ciclo-inicio="2"]').getAttribute("data-date");
  assert.equal(antes, "2026-12-21");
  assert.equal(d.querySelectorAll("[data-delay]").length, 2);
  assert.equal(d.querySelector('[data-delay="1"]'), null);
  setValue(dom, d.querySelector('[data-delay="2"]'), "5");
  assert.equal(d.querySelector('[data-ciclo-inicio="2"]').getAttribute("data-date"), "2026-12-26");
  dom.window.close();
});

test("cambiar de esquema restablece los ciclos por defecto", async () => {
  const dom = await loadPage();
  const d = setup(dom, "mieloma-drd", "2026-11-23", 3);
  setValue(dom, d.getElementById("cal_esquema"), "mieloma-vrd-swog", "change");
  const r = dom.window.RxData.get("mieloma-vrd-swog");
  assert.equal(Number(d.getElementById("cal_ciclos").value), r.ciclos_defecto);
  dom.window.close();
});

test("esquema por intervalos: se pinta sin errores y sin campos de retraso", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  dom.window.RxData.register({
    id: "test-intervalo", nombre: "Prueba por intervalos", area: "Oncología", linea: "sintética",
    estado: "validado", fuente: "prueba", fecha_revision: "2026-01-01", ciclos_defecto: 5,
    ...regimenIntervalo
  });
  dom.window.RxCalendar.mount(d.getElementById("calendarioRoot"));
  setValue(dom, d.getElementById("cal_esquema"), "test-intervalo", "change");
  setValue(dom, d.getElementById("cal_inicio"), "2026-11-23", "change");
  assert.equal(d.querySelectorAll("[data-delay]").length, 0);
  assert.ok(d.querySelectorAll("#cal_meses .pildora").length >= 1);
  assert.equal(d.querySelector("#cal_avisos .aviso-pendiente"), null);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("mount funciona con otra raíz", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  const otra = d.createElement("div");
  d.body.appendChild(otra);
  dom.window.RxCalendar.mount(otra);
  assert.ok(otra.querySelector("#cal_meses"));
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

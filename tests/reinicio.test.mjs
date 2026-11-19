import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./helpers/loadPage.mjs";

const ev = (dom, el, t = "input") => el.dispatchEvent(new dom.window.Event(t, { bubbles: true }));
const set = (dom, d, id, v, t = "input") => { const e = d.getElementById(id); e.value = v; ev(dom, e, t); };

async function prep() {
  const dom = await loadPage();
  const d = dom.window.document;
  dom.window.RxCalendar.hoy = () => "2026-11-19";
  set(dom, d, "cal_esquema", "mieloma-drd", "change");
  set(dom, d, "cal_inicio", "2026-12-01", "change");
  set(dom, d, "cal_ciclos", "3");
  set(dom, d, "cal_paciente", "Paciente Secreto");
  set(dom, d, "inf_hospital", "Hosp Prof");
  set(dom, d, "inf_farmaceutico", "Farm Prof");
  set(dom, d, "inf_telefono", "955");
  set(dom, d, "cal_buscar", "dara");
  const delay = d.querySelector("[data-delay='2']");
  if (delay) { delay.value = "7"; ev(dom, delay); }
  d.getElementById("far_buscar").value = "atorvastatina";
  d.getElementById("far_resultados").innerHTML = "<li>resultado</li>";
  return { dom, d };
}
const abrir = (d) => d.getElementById("cal_reiniciar").click();

test("botón visible fuera del tablist y confirmación en línea en dos pasos", async () => {
  const { dom, d } = await prep();
  const btn = d.getElementById("cal_reiniciar");
  assert.ok(btn && !btn.closest("#subtabs"));
  assert.match(btn.textContent, /Empezar de nuevo/);
  assert.equal(d.getElementById("cal_reinicio").hidden, true);
  let confirms = 0; dom.window.confirm = () => { confirms++; return true; };
  abrir(d);
  assert.equal(d.getElementById("cal_reinicio").hidden, false);
  assert.match(d.getElementById("cal_reinicio").textContent, /Se borrarán los datos del paciente, la fecha, los ciclos, los retrasos y las búsquedas\./);
  assert.equal(d.getElementById("cal_paciente").value, "Paciente Secreto", "abrir no borra nada");
  assert.equal(confirms, 0);
  dom.window.close();
});

test("cancelar no cambia nada", async () => {
  const { dom, d } = await prep();
  const antes = d.getElementById("informe_preview").innerHTML;
  abrir(d);
  d.getElementById("cal_reinicio_no").click();
  assert.equal(d.getElementById("cal_reinicio").hidden, true);
  assert.equal(d.getElementById("cal_paciente").value, "Paciente Secreto");
  assert.equal(d.getElementById("cal_inicio").value, "2026-12-01");
  assert.equal(d.getElementById("cal_buscar").value, "dara");
  assert.equal(d.getElementById("informe_preview").innerHTML, antes);
  dom.window.close();
});

test("borrar: sin datos del paciente en el DOM; profesional conservado", async () => {
  const { dom, d } = await prep();
  dom.window.print = () => {};
  d.getElementById("cal_imprimir").click();
  assert.equal(d.body.dataset.printing, "calendario");
  abrir(d);
  d.getElementById("cal_reinicio_si").click();
  assert.equal(d.getElementById("cal_paciente").value, "");
  assert.ok(!d.body.innerHTML.includes("Paciente Secreto"));
  assert.equal(d.getElementById("hojaPaciente").innerHTML, "");
  assert.equal(d.body.dataset.printing, undefined);
  assert.equal(d.getElementById("cal_inicio").value, "2026-11-19");
  assert.equal(d.getElementById("cal_ciclos").value, "12");
  assert.equal(d.querySelector("[data-delay='2']")?.value || "", "");
  assert.equal(d.getElementById("cal_buscar").value, "");
  assert.equal(d.getElementById("cal_area").value, "");
  assert.equal(d.getElementById("far_buscar").value, "");
  assert.equal(d.getElementById("far_resultados").innerHTML, "");
  assert.equal(d.getElementById("far_ficha").hidden, true);
  assert.equal(d.getElementById("sub-calendario").hidden, false);
  assert.equal(d.getElementById("inf_hospital").value, "Hosp Prof");
  assert.equal(d.getElementById("inf_telefono").value, "955");
  assert.ok(d.getElementById("informe_preview").innerHTML.includes("Hosp Prof"));
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("casilla: borra también pautas propias y datos del profesional", async () => {
  const { dom, d } = await prep();
  const r = dom.window.RxBuilder.buildRegimen(dom.window.RxBuilder.formFromText({
    nombre: "Mi pauta", area: "Oncología", tipo: "ciclos", ciclo_dias: "21", ciclos_defecto: "4",
    items: [{ farmaco: "Fármaco X", abrev: "FX", dosis: "1 mg", lugar: "casa", dias: "1-14" }],
  }));
  assert.ok(dom.window.RxData.get(r.id));
  abrir(d);
  d.getElementById("cal_reinicio_todo").checked = true;
  d.getElementById("cal_reinicio_si").click();
  assert.equal(dom.window.RxData.get(r.id), undefined);
  assert.ok(![...d.getElementById("cal_esquema").options].some((o) => o.value === r.id));
  for (const id of ["inf_hospital", "inf_farmaceutico", "inf_telefono"]) assert.equal(d.getElementById(id).value, "");
  assert.ok(dom.window.RxData.get("mieloma-drd"), "los esquemas incluidos siguen");
  assert.equal(d.getElementById("cal_reinicio_todo").checked, false);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

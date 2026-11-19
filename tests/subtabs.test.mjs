import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./helpers/loadPage.mjs";

const NAMES = ["farmacos", "esquemas", "calendario", "informe"];

function visible(d) {
  return NAMES.filter((n) => !d.getElementById("sub-" + n).hidden);
}
const key = (dom, el, k) =>
  el.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: k, bubbles: true }));

test("por defecto solo el panel Calendario es visible y aria-selected coincide", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  assert.deepEqual(dom.errors, []);
  assert.deepEqual(visible(d), ["calendario"]);
  assert.equal(d.getElementById("subtabs").getAttribute("role"), "tablist");
  for (const n of NAMES) {
    assert.equal(d.getElementById("sub-btn-" + n).getAttribute("aria-selected"), String(n === "calendario"));
  }
  dom.window.close();
});

test("clic en cada sub-pestaña deja visible solo ese panel", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  for (const n of NAMES) {
    d.getElementById("sub-btn-" + n).click();
    assert.deepEqual(visible(d), [n]);
    assert.equal(d.getElementById("sub-btn-" + n).getAttribute("aria-selected"), "true");
  }
  dom.window.RxSubtabs.show("inexistente");
  assert.deepEqual(visible(d), ["informe"]);
  dom.window.close();
});

test("flechas mueven foco y selección con vuelta circular", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  const b = (n) => d.getElementById("sub-btn-" + n);
  b("calendario").focus();
  key(dom, b("calendario"), "ArrowRight");
  assert.equal(d.activeElement, b("informe"));
  assert.deepEqual(visible(d), ["informe"]);
  key(dom, b("informe"), "ArrowRight");
  assert.equal(d.activeElement, b("farmacos"));
  key(dom, b("farmacos"), "ArrowLeft");
  assert.equal(d.activeElement, b("informe"));
  dom.window.close();
});

test("todos los ids anteriores siguen en el DOM y Fármacos muestra Próximamente", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  for (const id of ["cal_esquema", "cal_buscar", "cal_area", "cal_inicio", "cal_ciclos", "cal_retrasos",
    "cal_avisos", "cal_meses", "cal_paciente", "cal_imprimir", "cal_constructor", "cal_nueva"]) {
    assert.ok(d.getElementById(id), id);
  }
  assert.ok(d.querySelector("#sub-esquemas #cal_esquema"));
  assert.ok(d.querySelector("#sub-esquemas #cal_constructor"));
  assert.ok(d.querySelector("#sub-calendario #cal_meses"));
  assert.ok(d.querySelector("#sub-informe #cal_imprimir"));
  assert.match(d.querySelector("#sub-farmacos #farmacos_root").textContent, /Próximamente/);
  dom.window.close();
});

test("Cambiar esquema lleva a Esquemas; elegir esquema mantiene la sub-pestaña", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  d.getElementById("cal_cambiar").click();
  assert.deepEqual(visible(d), ["esquemas"]);
  const sel = d.getElementById("cal_esquema");
  sel.value = sel.options[sel.options.length - 1].value;
  sel.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  assert.deepEqual(visible(d), ["esquemas"]);
  assert.match(d.getElementById("cal_resumen_txt").textContent, /pendiente|validado/);
  dom.window.close();
});

test("crear pauta propia pasa a Calendario", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  d.getElementById("sub-btn-esquemas").click();
  d.getElementById("cal_nueva").click();
  d.getElementById("cal_ej_bio").click();
  d.getElementById("cb_crear").click();
  assert.equal(d.getElementById("cb_error").textContent, "");
  assert.deepEqual(visible(d), ["calendario"]);
  dom.window.close();
});

test("imprimir desde Informe construye la hoja; Infografía limpia como antes", async () => {
  const dom = await loadPage({ beforeParse(w) { w.print = () => {}; } });
  const d = dom.window.document;
  d.getElementById("sub-btn-informe").click();
  d.getElementById("cal_imprimir").click();
  assert.equal(d.body.dataset.printing, "calendario");
  assert.ok(d.getElementById("hojaPaciente").innerHTML.length > 100);
  dom.window.RxTabs.show("infografia");
  d.getElementById("tab-btn-infografia").click();
  assert.equal(d.body.dataset.printing, undefined);
  assert.equal(d.getElementById("hojaPaciente").innerHTML, "");
  dom.window.close();
});

test("imprimir sin fecha desde Informe vuelve a Calendario con el aviso", async () => {
  const dom = await loadPage({ beforeParse(w) { w.print = () => {}; } });
  const d = dom.window.document;
  d.getElementById("cal_inicio").value = "";
  d.getElementById("sub-btn-informe").click();
  d.getElementById("cal_imprimir").click();
  assert.deepEqual(visible(d), ["calendario"]);
  assert.match(d.getElementById("cal_avisos").textContent, /fecha de inicio/);
  dom.window.close();
});

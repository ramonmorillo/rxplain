import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./helpers/loadPage.mjs";
import { definirPauta, PAUTA_REF } from "./helpers/pauta.mjs";

const NAMES = ["farmacos", "calendario", "informe"];

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
  dom.window.RxSubtabs.show("esquemas"); // ya no existe: no cambia nada
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
  key(dom, b("informe"), "ArrowLeft");
  assert.equal(d.activeElement, b("calendario"));
  key(dom, b("calendario"), "ArrowLeft");
  assert.equal(d.activeElement, b("farmacos"));
  key(dom, b("farmacos"), "ArrowRight");
  assert.equal(d.activeElement, b("calendario"));
  assert.deepEqual(visible(d), ["calendario"]);
  dom.window.close();
});

test("solo existen las sub-pestañas Fármacos, Calendario e Informe", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  assert.deepEqual(
    [...d.querySelectorAll("#subtabs [role=tab]")].map((b) => b.id.replace("sub-btn-", "")), NAMES);
  assert.deepEqual(Array.from(dom.window.RxSubtabs.NAMES), NAMES);
  assert.equal(d.getElementById("sub-btn-esquemas"), null);
  assert.equal(d.getElementById("sub-esquemas"), null);
  dom.window.close();
});

test("ids principales en su sub-pestaña y Fármacos muestra su raíz", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  for (const id of ["cal_pauta", "cb_nombre", "cb_tipo", "cb_items", "cb_validada", "cb_estado", "cal_inicio",
    "cal_ciclos", "cal_retrasos", "cal_avisos", "cal_meses", "cal_paciente", "cal_imprimir"]) {
    assert.ok(d.getElementById(id), id);
  }
  for (const id of ["cal_esquema", "cal_buscar", "cal_area", "cal_constructor", "cal_nueva", "cal_cambiar"]) {
    assert.equal(d.getElementById(id), null, id);
  }
  assert.ok(d.querySelector("#sub-calendario #cal_pauta"));
  assert.ok(d.querySelector("#sub-calendario #cal_inicio"));
  assert.ok(d.querySelector("#sub-calendario #cal_meses"));
  assert.ok(d.querySelector("#sub-informe #cal_imprimir"));
  assert.ok(d.querySelector("#sub-farmacos #farmacos_root"));
  dom.window.close();
});

test("precargar desde otra sub-pestaña lleva a Calendario", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  d.getElementById("sub-btn-informe").click();
  assert.deepEqual(visible(d), ["informe"]);
  d.getElementById("cal_ej_bio").click();
  assert.deepEqual(visible(d), ["informe"], "los ejemplos no cambian de sub-pestaña");
  dom.window.RxCalendar.precargar(dom.window.RxBuilder.EJEMPLOS.biologico());
  assert.deepEqual(visible(d), ["calendario"]);
  dom.window.close();
});

test("imprimir desde Informe construye la hoja; Infografía limpia como antes", async () => {
  const dom = await loadPage({ beforeParse(w) { w.print = () => {}; } });
  const d = definirPauta(dom, { ...PAUTA_REF, inicio: "2026-11-23", n: 2 });
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
  const d = definirPauta(dom, { ...PAUTA_REF, inicio: "2026-11-23", n: 2 });
  d.getElementById("cal_inicio").value = "";
  d.getElementById("sub-btn-informe").click();
  d.getElementById("cal_imprimir").click();
  assert.deepEqual(visible(d), ["calendario"]);
  assert.match(d.getElementById("cal_avisos").textContent, /fecha de inicio/);
  assert.equal(d.body.dataset.printing, undefined);
  dom.window.close();
});

test("imprimir sin pauta desde Informe vuelve a Calendario con el aviso de completarla", async () => {
  const dom = await loadPage({ beforeParse(w) { w.print = () => {}; } });
  const d = dom.window.document;
  d.getElementById("sub-btn-informe").click();
  d.getElementById("cal_imprimir").click();
  assert.deepEqual(visible(d), ["calendario"]);
  assert.match(d.getElementById("cal_avisos").textContent, /Complete la pauta/);
  assert.equal(d.body.dataset.printing, undefined);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

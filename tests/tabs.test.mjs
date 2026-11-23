import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadPage } from "./helpers/loadPage.mjs";

const css = (f) => fs.readFileSync(fileURLToPath(new URL(`../css/${f}`, import.meta.url)), "utf8");

function els(dom) {
  const d = dom.window.document;
  return {
    d,
    btnH: d.getElementById("tab-btn-inicio"),
    btnI: d.getElementById("tab-btn-infografia"),
    btnC: d.getElementById("tab-btn-calendario"),
    btnG: d.getElementById("tab-btn-guia"),
    panH: d.getElementById("tab-inicio"),
    panI: d.getElementById("tab-infografia"),
    panC: d.getElementById("tab-calendario"),
  };
}
const visibles = (d) => ["inicio", "infografia", "calendario", "guia", "legal"].filter((n) => !d.getElementById("tab-" + n).hidden);

test("por defecto solo la portada (Inicio) es visible", async () => {
  const dom = await loadPage();
  const { btnH, btnI, btnC, btnG, d } = els(dom);
  assert.deepEqual(dom.errors, []);
  assert.deepEqual(visibles(d), ["inicio"]);
  assert.equal(btnH.getAttribute("aria-selected"), "true");
  for (const b of [btnI, btnC, btnG]) assert.equal(b.getAttribute("aria-selected"), "false");
  assert.ok(d.getElementById("calendarioRoot"));
  assert.equal(d.getElementById("tabs").getAttribute("role"), "tablist");
  assert.equal(d.title, "RxPlain · Traducción farmacoterapéutica");
  dom.window.close();
});

test("cada pestaña muestra solo su panel y actualiza el título", async () => {
  const dom = await loadPage();
  const { btnH, btnI, btnC, btnG, d } = els(dom);
  const casos = [[btnI, "infografia", "Infografía · RxPlain"], [btnC, "calendario", "Calendario · RxPlain"], [btnG, "guia", "Guía de uso · RxPlain"], [btnH, "inicio", "RxPlain · Traducción farmacoterapéutica"]];
  for (const [btn, panel, titulo] of casos) {
    btn.click();
    assert.deepEqual(visibles(d), [panel]);
    assert.equal(btn.getAttribute("aria-selected"), "true");
    assert.equal(d.title, titulo);
  }
  dom.window.RxTabs.show("calendario");
  assert.deepEqual(visibles(d), ["calendario"]);
  dom.window.RxTabs.show("no-existe");
  assert.deepEqual(visibles(d), ["calendario"], "un nombre desconocido no cambia nada");
  dom.window.close();
});

test("las teclas ← → recorren las cuatro pestañas de la barra, con vuelta circular", async () => {
  const dom = await loadPage();
  const { btnH, btnI, btnC, btnG, d } = els(dom);
  const key = (el, k) => el.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: k, bubbles: true }));
  btnH.focus();
  key(btnH, "ArrowRight"); assert.equal(d.activeElement, btnI);
  key(btnI, "ArrowRight"); assert.equal(d.activeElement, btnC);
  key(btnC, "ArrowRight"); assert.equal(d.activeElement, btnG);
  key(btnG, "ArrowRight"); assert.equal(d.activeElement, btnH);
  key(btnH, "ArrowLeft"); assert.equal(d.activeElement, btnG);
  assert.deepEqual(visibles(d), ["guia"], "la selección sigue al foco");
  dom.window.close();
});

test("enlace directo: index.html#calendario abre esa pestaña; un hash desconocido abre Inicio", async () => {
  const base = pathToFileURL(fileURLToPath(new URL("../index.html", import.meta.url))).href;
  for (const [hash, esperado] of [["#calendario", "calendario"], ["#infografia", "infografia"], ["#guia", "guia"], ["#legal", "legal"], ["#loquesea", "inicio"], ["", "inicio"]]) {
    const dom = await loadPage({ url: base + hash });
    assert.deepEqual(visibles(dom.window.document), [esperado], hash);
    dom.window.close();
  }
});

test("data-goto-tab: las tarjetas de la portada y el pie llevan a su panel (también a «legal», que no está en la barra)", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  d.querySelector('.toolCard--info [data-goto-tab="infografia"]').click();
  assert.deepEqual(visibles(d), ["infografia"]);
  d.getElementById("tab-btn-inicio").click();
  d.querySelector('.toolCard--cal [data-goto-tab="calendario"]').click();
  assert.deepEqual(visibles(d), ["calendario"]);
  d.querySelector('.siteFooter [data-goto-tab="legal"]').click();
  assert.deepEqual(visibles(d), ["legal"]);
  assert.equal(d.getElementById("tab-btn-legal"), null, "legal no tiene botón en la barra");
  assert.equal(d.title, "Aviso legal y privacidad · RxPlain");
  d.querySelector(".brand").click();
  assert.deepEqual(visibles(d), ["inicio"]);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("calendario.css fuerza [hidden] (el panel usa mainLayout)", () => {
  assert.match(css("calendario.css"), /\[hidden\]\s*\{\s*display\s*:\s*none\s*!important/);
});

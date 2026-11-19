import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { loadPage } from "./helpers/loadPage.mjs";

const css = (f) => fs.readFileSync(fileURLToPath(new URL(`../css/${f}`, import.meta.url)), "utf8");

function els(dom) {
  const d = dom.window.document;
  return {
    d,
    btnI: d.getElementById("tab-btn-infografia"),
    btnC: d.getElementById("tab-btn-calendario"),
    panI: d.getElementById("tab-infografia"),
    panC: d.getElementById("tab-calendario"),
  };
}

test("por defecto Infografía visible y Calendario oculto", async () => {
  const dom = await loadPage();
  const { btnI, btnC, panI, panC, d } = els(dom);
  assert.deepEqual(dom.errors, []);
  assert.equal(panI.hidden, false);
  assert.equal(panC.hidden, true);
  assert.equal(btnI.getAttribute("aria-selected"), "true");
  assert.equal(btnC.getAttribute("aria-selected"), "false");
  assert.ok(d.getElementById("calendarioRoot"));
  assert.equal(d.getElementById("tabs").getAttribute("role"), "tablist");
  dom.window.close();
});

test("clic en la pestaña Calendario la muestra y oculta Infografía", async () => {
  const dom = await loadPage();
  const { btnI, btnC, panI, panC } = els(dom);
  btnC.click();
  assert.equal(panC.hidden, false);
  assert.equal(panI.hidden, true);
  assert.equal(btnC.getAttribute("aria-selected"), "true");
  assert.equal(btnI.getAttribute("aria-selected"), "false");
  btnI.click();
  assert.equal(panI.hidden, false);
  assert.equal(panC.hidden, true);
  dom.window.RxTabs.show("calendario");
  assert.equal(panC.hidden, false);
  dom.window.close();
});

test("las teclas ← → mueven el foco entre pestañas", async () => {
  const dom = await loadPage();
  const { btnI, btnC, d } = els(dom);
  const key = (el, k) =>
    el.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: k, bubbles: true }));
  btnI.focus();
  key(btnI, "ArrowRight");
  assert.equal(d.activeElement, btnC);
  key(btnC, "ArrowRight");
  assert.equal(d.activeElement, btnI);
  key(btnI, "ArrowLeft");
  assert.equal(d.activeElement, btnC);
  dom.window.close();
});

test("calendario.css fuerza [hidden] (el panel usa mainLayout)", () => {
  assert.match(css("calendario.css"), /\[hidden\]\s*\{\s*display\s*:\s*none\s*!important/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./helpers/loadPage.mjs";

test("la infografía conserva sus ids y arranca", async () => {
  const dom = await loadPage();
  const { document } = dom.window;
  for (const id of ["addMed", "generate", "print", "output", "pharm_name", "cima_query"]) {
    assert.ok(document.getElementById(id), `falta #${id}`);
  }
  assert.equal(document.querySelectorAll("style").length, 0);
  assert.equal(document.querySelectorAll("script:not([src])").length, 0);
  dom.window.close();
});

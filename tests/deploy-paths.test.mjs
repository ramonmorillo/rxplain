import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function refs() {
  const out = [];
  for (const m of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) out.push(m[1]);
  for (const m of html.matchAll(/<link[^>]*\shref="([^"]+)"/g)) out.push(m[1]);
  return out.filter((r) => !/^(https?:)?\/\//.test(r) && !r.startsWith("data:"));
}

test("index.html referencia al menos los scripts y estilos esperados", () => {
  assert.ok(refs().length >= 10);
});

test("cada <script src> y <link href> existe y ningún segmento empieza por '_' o '.' (Jekyll los omite)", () => {
  for (const ref of refs()) {
    const clean = ref.split(/[?#]/)[0];
    assert.ok(fs.existsSync(path.join(root, clean)), `no existe: ${ref}`);
    for (const seg of clean.split("/")) {
      assert.ok(!/^[_.]/.test(seg) || seg === "." , `segmento ignorado por Jekyll en ${ref}: ${seg}`);
    }
  }
});

test(".nojekyll existe en la raíz", () => {
  assert.ok(fs.existsSync(path.join(root, ".nojekyll")));
});

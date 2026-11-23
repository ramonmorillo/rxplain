import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage } from "./helpers/loadPage.mjs";
import { definirPauta } from "./helpers/pauta.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const norm = (t) => String(t).replace(/\s+/g, " ").trim();

test("la guía es una tercera pestaña: oculta por defecto, se abre con la pestaña y con el botón de la cabecera", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  const pan = d.getElementById("tab-guia"), btn = d.getElementById("tab-btn-guia");
  assert.equal(btn.textContent.trim(), "Guía de uso");
  assert.equal(btn.getAttribute("role"), "tab");
  assert.equal(btn.getAttribute("aria-controls"), "tab-guia");
  assert.equal(pan.hidden, true);
  btn.click();
  assert.equal(pan.hidden, false);
  assert.equal(d.getElementById("tab-infografia").hidden, true);
  assert.equal(d.getElementById("tab-calendario").hidden, true);
  assert.equal(btn.getAttribute("aria-selected"), "true");
  d.getElementById("tab-btn-infografia").click();
  assert.equal(pan.hidden, true);
  d.getElementById("openGuia").click();
  assert.equal(pan.hidden, false);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("el índice enlaza con secciones que existen y los ids de la guía no se repiten", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  const links = Array.from(d.querySelectorAll("#tab-guia a[href^='#']"));
  assert.ok(links.length >= 15, "índice y enlaces internos");
  for (const a of links) {
    const id = a.getAttribute("href").slice(1);
    assert.ok(d.querySelector("#tab-guia #" + CSS_ESC(id)), "destino inexistente: " + id);
  }
  const ids = Array.from(d.querySelectorAll("#tab-guia [id]")).map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, "ids duplicados");
  // todas las secciones numeradas están en el índice
  for (const h of d.querySelectorAll("#tab-guia section[id^='g-']")) {
    assert.ok(d.querySelector(`.guiaToc a[href="#${h.id}"]`), "falta en el índice: " + h.id);
  }
  dom.window.close();
});
const CSS_ESC = (s) => s.replace(/[^\w-]/g, "\\$&");

test("la guía no se queda obsoleta: cada etiqueta de la interfaz citada (.ui) existe en la herramienta", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  // Pauta con 3 ciclos para que existan los campos «Retraso C2/C3».
  definirPauta(dom, { tipo: "ciclos", ciclo_dias: 28, inicio: "2026-11-30", n: 3, items: [{ farmaco: "A", dosis: "1", lugar: "casa", dias: "1" }] });
  const guia = d.getElementById("tab-guia");
  const clon = d.body.cloneNode(true);
  clon.querySelector("#tab-guia").remove();
  // Código fuente de la herramienta SIN la propia guía (si no, cada etiqueta se encontraría a sí misma).
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const sinGuia = html.replace(/<section id="tab-guia"[\s\S]*?<div id="hojaPaciente"/, '<div id="hojaPaciente"');
  assert.ok(sinGuia.length < html.length - 5000, "se ha quitado la guía del fuente");
  const fuentes = sinGuia + "\n" + fs.readdirSync(path.join(root, "js")).filter((f) => f.endsWith(".js"))
    .map((f) => fs.readFileSync(path.join(root, "js", f), "utf8")).join("\n");
  const universo = norm(clon.textContent) + " " + norm(fuentes);
  const etiquetas = Array.from(guia.querySelectorAll(".ui")).map((e) => norm(e.textContent));
  assert.ok(etiquetas.length >= 40, "la guía cita las etiquetas de la interfaz con .ui (" + etiquetas.length + ")");
  const faltan = etiquetas.filter((t) => !universo.includes(t));
  assert.deepEqual(faltan, [], "etiquetas citadas en la guía que ya no existen en la interfaz");
  dom.window.close();
});

test("la guía no menciona funcionalidades eliminadas", async () => {
  const dom = await loadPage();
  const txt = norm(dom.window.document.getElementById("tab-guia").textContent);
  for (const viejo of ["Crear pauta propia", "Cambiar esquema", "Usar en el constructor", "catálogo de esquemas", "Buscar esquema", "pestaña Esquemas"]) {
    assert.ok(!txt.includes(viejo), "obsoleto: " + viejo);
  }
  // sí explica los puntos clave
  for (const clave of ["no calcula ni recomienda dosis", "No se guarda nada", "nunca inventa horas", "NO ENTREGAR AL PACIENTE", "Empezar de nuevo", "al menos 3 letras"]) {
    assert.ok(txt.includes(clave), "falta: " + clave);
  }
  dom.window.close();
});

test("imprimir la guía activa el modo de impresión de la guía y lo limpia en afterprint", async () => {
  const dom = await loadPage();
  const w = dom.window, d = w.document;
  let llamadas = 0, modo = null;
  w.print = () => { llamadas++; modo = d.body.dataset.printing; };
  d.getElementById("tab-btn-guia").click();
  d.getElementById("guiaImprimir").click();
  assert.equal(llamadas, 1);
  assert.equal(modo, "guia");
  w.dispatchEvent(new w.Event("afterprint"));
  assert.equal(d.body.dataset.printing, undefined);
  // si afterprint no llega, cambiar de pestaña también lo limpia
  d.getElementById("guiaImprimir").click();
  assert.equal(d.body.dataset.printing, "guia");
  d.getElementById("tab-btn-infografia").click();
  assert.equal(d.body.dataset.printing, undefined);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("css de la guía: respeta [hidden] y define la impresión de solo la guía", () => {
  const css = fs.readFileSync(path.join(root, "css/guia.css"), "utf8");
  assert.match(css, /\.guia\[hidden\]\s*\{\s*display\s*:\s*none\s*!important/);
  assert.match(css, /body\[data-printing="guia"\] \.pageShell > :not\(#tab-guia\)\{display:none!important\}/);
});

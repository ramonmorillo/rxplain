import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadPage } from "./helpers/loadPage.mjs";

const require = createRequire(import.meta.url);
const RxCima = require("../js/cima.js");

function resp(body, { status = 200, json = false } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (json ? JSON.stringify(body) : String(body)),
    json: async () => (json ? body : JSON.parse(body)),
  };
}
function mk(handler) {
  const calls = [];
  const fetch = async (url) => { calls.push(url); return handler(url); };
  return { cima: RxCima.create({ fetch }), calls };
}
const LISTA = {
  totalFilas: 2,
  resultados: [
    { nregistro: "12345", nombre: "FARMAX 10 mg comprimidos", pactivos: "FARMAXINA", labtitular: "Lab Sintético SA", formaFarmaceutica: { id: 1, nombre: "COMPRIMIDO" } },
    { nregistro: "67890", nombre: "OTRO 5 mg", pactivos: "OTRAXINA", labtitular: "Otro Lab", formaFarmaceutica: "CAPSULA" },
  ],
};

test("buscar: éxito mapea campos, usa el endpoint y codifica el nombre", async () => {
  const { cima, calls } = mk(() => resp(LISTA, { json: true }));
  const r = await cima.buscar("farma x&y");
  assert.equal(calls.length, 2);
  assert.ok(calls.includes("https://cima.aemps.es/cima/rest/medicamentos?nombre=farma%20x%26y"));
  assert.ok(calls.includes("https://cima.aemps.es/cima/rest/medicamentos?practiv1=farma%20x%26y"));
  assert.ok(calls.every((u) => !/pagina/.test(u)));
  assert.equal(r.length, 2);
  assert.equal(r[0].nregistro, "12345");
  assert.equal(r[0].pactivos, "FARMAXINA");
  assert.equal(r[0].formaFarmaceutica, "COMPRIMIDO");
  assert.equal(r[0].labtitular, "Lab Sintético SA");
  assert.match(r[0].url, /^https:\/\/cima\.aemps\.es\/.*12345/);
  assert.equal(r[1].formaFarmaceutica, "CAPSULA");
});

test("buscar: respuesta vacía -> lista vacía; formas alternativas aceptadas", async () => {
  assert.deepEqual(await mk(() => resp({ totalFilas: 0, resultados: [] }, { json: true })).cima.buscar("x"), []);
  assert.deepEqual(await mk(() => resp({}, { json: true })).cima.buscar("x"), []);
  assert.deepEqual(await mk(() => resp("", {})).cima.buscar("x").catch(() => "err"), "err");
  const arr = await mk(() => resp(LISTA.resultados, { json: true })).cima.buscar("x");
  assert.equal(arr.length, 2);
});

test("buscar: nombre vacío no llama a la red; HTTP 500 y red caída dan Error claro", async () => {
  const m = mk(() => resp("", {}));
  await assert.rejects(() => m.cima.buscar("   "), /nombre/i);
  assert.equal(m.calls.length, 0);
  await assert.rejects(() => mk(() => resp("boom", { status: 500 })).cima.buscar("x"), /500/);
  const caida = RxCima.create({ fetch: async () => { throw new TypeError("Failed to fetch"); } });
  await assert.rejects(() => caida.buscar("x"), /conectar|red/i);
});

test("buscar: descarta nregistro con caracteres raros y conserva el texto con <script> tal cual (se escapa en la UI)", async () => {
  const { cima } = mk(() => resp({ resultados: [
    { nregistro: "1/../x?y", nombre: "malo" },
    { nregistro: "111", nombre: "<script>alert(1)</script>", pactivos: "<img src=x onerror=1>" },
  ] }, { json: true }));
  const r = await cima.buscar("x");
  assert.equal(r.length, 1);
  assert.equal(r[0].nombre, "<script>alert(1)</script>");
});

test("apartado: JSON con contenido HTML -> texto plano; endpoint correcto", async () => {
  const { cima, calls } = mk(() => resp([{ seccion: "4.2", titulo: "Posología", contenido: "<p>Texto <b>uno</b>.</p><p>Texto dos.</p><script>alert(1)</script>" }], { json: true }));
  const a = await cima.apartado("12345");
  assert.equal(calls[0], "https://cima.aemps.es/cima/rest/docSegmentado/contenido/1?nregistro=12345&seccion=4.2");
  assert.match(a.texto, /Texto uno\./);
  assert.match(a.texto, /Texto dos\./);
  assert.ok(!/<|alert/.test(a.texto));
  assert.match(a.url, /12345/);
});

test("apartado: HTML o texto plano directo, y objeto con campo contenido", async () => {
  assert.match((await mk(() => resp("<div><p>A</p><p>B</p></div>")).cima.apartado("1")).texto, /A\s+B/);
  assert.equal((await mk(() => resp("Solo texto plano")).cima.apartado("1")).texto, "Solo texto plano");
  assert.equal((await mk(() => resp({ contenido: "<p>X</p>" }, { json: true })).cima.apartado("1")).texto, "X");
});

test("apartado: 4.2 ausente (vacío, [], HTML sin texto, 404) -> Error claro", async () => {
  await assert.rejects(() => mk(() => resp("")).cima.apartado("1"), /4\.2|apartado/i);
  await assert.rejects(() => mk(() => resp([], { json: true })).cima.apartado("1"), /4\.2|apartado/i);
  await assert.rejects(() => mk(() => resp("<p> </p>")).cima.apartado("1"), /4\.2|apartado/i);
  await assert.rejects(() => mk(() => resp("nf", { status: 404 })).cima.apartado("1"), /404/);
  await assert.rejects(() => mk(() => resp("x")).cima.apartado("a/b"), /registro/i);
  await assert.rejects(() => mk(() => resp("x")).cima.apartado("1", "4.2;x"), /secci/i);
});

// ---- UI ----
async function ui(handler) {
  const calls = [];
  const dom = await loadPage({
    beforeParse(w) { w.fetch = async (url) => { calls.push(url); return handler(url); }; },
  });
  return { dom, d: dom.window.document, calls };
}
const tick = () => new Promise((r) => setTimeout(r, 20));

test("UI: no hay llamadas a CIMA al cargar; buscar solo con botón/Enter", async () => {
  const { dom, d, calls } = await ui(() => resp(LISTA, { json: true }));
  assert.equal(calls.length, 0);
  assert.ok(d.querySelector("#farmacos_root #far_buscar"));
  d.getElementById("far_buscar").value = "farm";
  d.getElementById("far_buscar").dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await tick();
  assert.equal(calls.length, 0, "escribir no dispara red");
  d.getElementById("far_buscar_btn").click();
  await tick();
  assert.equal(calls.length, 2);
  const items = d.querySelectorAll("#far_resultados li");
  assert.equal(items.length, 2);
  assert.match(items[0].textContent, /FARMAX/);
  assert.match(items[0].textContent, /FARMAXINA/);
  assert.match(items[0].textContent, /COMPRIMIDO/);
  assert.match(items[0].querySelector("a").href, /cima\.aemps\.es/);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("UI: Enter en el campo envía la búsqueda; nombre vacío no llama", async () => {
  const { dom, d, calls } = await ui(() => resp(LISTA, { json: true }));
  const inp = d.getElementById("far_buscar");
  d.getElementById("far_form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await tick();
  assert.equal(calls.length, 0);
  inp.value = "farm";
  d.getElementById("far_form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await tick();
  assert.equal(calls.length, 2);
  dom.window.close();
});

test("UI: nombre con <script> se muestra como texto, sin crear elementos", async () => {
  const { dom, d } = await ui(() => resp({ resultados: [{ nregistro: "111", nombre: "<script>window.__x=1</script><b>n</b>", pactivos: "<img src=x onerror=window.__y=1>" }] }, { json: true }));
  d.getElementById("far_buscar").value = "x";
  d.getElementById("far_buscar_btn").click();
  await tick();
  const root = d.getElementById("farmacos_root");
  assert.equal(root.querySelectorAll("script, img, b").length, 0);
  assert.match(root.textContent, /<script>window\.__x=1<\/script>/);
  assert.equal(dom.window.__x, undefined);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("UI: vacío, HTTP 500 y red caída muestran aviso sin lanzar", async () => {
  for (const [handler, re] of [
    [() => resp({ resultados: [] }, { json: true }), /no devolvió medicamentos/i],
    [() => resp("x", { status: 500 }), /500/],
    [() => { throw new TypeError("Failed to fetch"); }, /conectar|red/i],
  ]) {
    const { dom, d } = await ui(handler);
    d.getElementById("far_buscar").value = "x";
    d.getElementById("far_buscar_btn").click();
    await tick();
    assert.match(d.getElementById("far_estado").textContent, re);
    assert.equal(d.querySelectorAll("#far_resultados li").length, 0);
    assert.deepEqual(dom.errors, []);
    dom.window.close();
  }
});

test("UI: elegir un resultado muestra el 4.2 en <pre> escapado, guarda el fármaco normalizado y activa/desactiva Proponer pauta", async () => {
  const { dom, d, calls } = await ui((url) =>
    url.includes("docSegmentado") ? resp("<p>Texto <script>window.__z=1</script>sintético</p>") : resp(LISTA, { json: true }));
  d.getElementById("far_buscar").value = "farm";
  d.getElementById("far_buscar_btn").click();
  await tick();
  d.querySelector("#far_resultados li button").click();
  await tick();
  assert.ok(calls.some((u) => u.includes("nregistro=12345") && u.includes("seccion=4.2")));
  const pre = d.querySelector("#far_ficha pre");
  assert.match(pre.textContent, /Texto sintético/);
  assert.equal(dom.window.__z, undefined);
  assert.equal(dom.window.RxFarmacos.seleccionado().nregistro, "12345");
  assert.equal(dom.window.RxFarmacos.seleccionado().pactivos, "FARMAXINA");
  assert.ok(d.getElementById("far_proponer"));
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("UI: 4.2 ausente o error -> aviso, enlace a la ficha en CIMA y sin excepciones", async () => {
  for (const h of [() => resp(""), () => resp("x", { status: 500 }), () => { throw new TypeError("net"); }]) {
    const { dom, d } = await ui((url) => (url.includes("docSegmentado") ? h() : resp(LISTA, { json: true })));
    d.getElementById("far_buscar").value = "farm";
    d.getElementById("far_buscar_btn").click();
    await tick();
    d.querySelector("#far_resultados li button").click();
    await tick();
    assert.match(d.getElementById("far_estado").textContent, /4\.2|ficha|CIMA/i);
    const a = d.querySelector("#far_ficha a");
    assert.match(a.href, /cima\.aemps\.es/);
    assert.equal(d.querySelector("#far_ficha pre").textContent, "");
    assert.deepEqual(dom.errors, []);
    dom.window.close();
  }
});

test("UI: ningún dato del paciente en la petición (solo nombre del fármaco)", async () => {
  const { dom, d, calls } = await ui(() => resp(LISTA, { json: true }));
  d.getElementById("cal_paciente").value = "PACIENTE-SECRETO";
  d.getElementById("far_buscar").value = "farm";
  d.getElementById("far_buscar_btn").click();
  await tick();
  assert.ok(calls.every((u) => !/SECRETO/.test(u)));
  dom.window.close();
});

test("htmlToText: saltos de línea crudos no parten frases; poblaciones avisadas", async () => {
  assert.equal(RxCima.htmlToText("Adultos\ncada 12 horas.\nNiños: una vez\nal día."), "Adultos cada 12 horas. Niños: una vez al día.");
  assert.equal(RxCima.htmlToText("<p>Uno</p><p>Dos\ntres</p>a<br>b"), "Uno\nDos tres\na\nb");
  const RxPosologia = require("../js/posologia-ft.js");
  const r = RxPosologia.extraer(RxCima.htmlToText("Adultos\ncada 12 horas.\nNiños: una vez\nal día."));
  assert.equal(r.propuestas.length, 2);
  assert.deepEqual(r.propuestas.map((p) => p.veces_al_dia), [2, 1]);
  for (const p of r.propuestas) assert.ok(p.avisos.some((a) => a.startsWith("La ficha distingue poblaciones")));
});

// ---- Hotfix: búsqueda robusta (nombre + practiv1) ----
const byVia = (nombreResp, practivResp) => (url) => (url.includes("practiv1=") ? practivResp() : nombreResp());
const OK = (b) => () => resp(b, { json: true });
const VACIO = OK({ resultados: [] });
const FAIL500 = () => resp("boom", { status: 500 });

test("buscarDetalle: solo nombre devuelve datos", async () => {
  const { cima } = mk(byVia(OK(LISTA), VACIO));
  const r = await cima.buscarDetalle("farm");
  assert.equal(r.items.length, 2);
  assert.match(r.diagnostico, /nombre comercial: HTTP 200, 2 elemento/);
  assert.match(r.diagnostico, /principio activo: HTTP 200, 0 elemento/);
});

test("buscarDetalle: solo practiv1 devuelve datos (formas array e items)", async () => {
  let r = await mk(byVia(VACIO, OK(LISTA.resultados))).cima.buscarDetalle("adali");
  assert.equal(r.items.length, 2);
  r = await mk(byVia(OK({}), OK({ items: LISTA.resultados }))).cima.buscarDetalle("adali");
  assert.equal(r.items.length, 2);
});

test("buscarDetalle: ambos devuelven datos y se deduplica por nregistro", async () => {
  const extra = { nregistro: "99999", nombre: "TERCERO" };
  const { cima } = mk(byVia(OK(LISTA), OK({ resultados: [LISTA.resultados[0], extra] })));
  const r = await cima.buscarDetalle("farm");
  assert.deepEqual(r.items.map((m) => m.nregistro), ["12345", "67890", "99999"]);
});

test("buscarDetalle: una petición HTTP 500 y la otra OK -> resultados y diagnóstico con el fallo", async () => {
  for (const [n, p] of [[FAIL500, OK(LISTA)], [OK(LISTA), FAIL500]]) {
    const r = await mk(byVia(n, p)).cima.buscarDetalle("farm");
    assert.equal(r.items.length, 2);
    assert.match(r.diagnostico, /HTTP 500, fallo/);
  }
});

test("buscarDetalle: ambas fallan -> Error claro con diagnóstico", async () => {
  await assert.rejects(() => mk(() => resp("x", { status: 500 })).cima.buscarDetalle("x"),
    (e) => /500/.test(e.message) && /nombre comercial: HTTP 500, fallo/.test(e.diagnostico));
  await assert.rejects(() => mk(byVia(FAIL500, () => { throw new TypeError("net"); })).cima.buscarDetalle("x"), /500|conectar/);
});

test("buscarDetalle: cero resultados -> mensaje preciso y diagnóstico", async () => {
  const r = await mk(() => resp({ resultados: [] }, { json: true })).cima.buscarDetalle("ADALI");
  assert.equal(r.items.length, 0);
  assert.equal(r.mensajeVacio, "CIMA no devolvió medicamentos para «ADALI» (se buscó por nombre comercial y por principio activo). Pruebe el nombre completo (p. ej. «adalimumab» o «Humira») o el principio activo.");
  assert.match(r.diagnostico, /HTTP 200, 0 elemento/);
});

test("buscarDetalle: cuenta resultados descartados por formato", async () => {
  const { cima } = mk(byVia(OK({ resultados: [{ nregistro: "1/x", nombre: "m" }, null, { nregistro: "5", nombre: "ok" }] }), VACIO));
  const r = await cima.buscarDetalle("x");
  assert.equal(r.items.length, 1);
  assert.equal(r.descartados, 2);
  assert.match(r.diagnostico, /2 resultados descartados por formato/);
  const sin = await mk(byVia(OK(LISTA), VACIO)).cima.buscarDetalle("x");
  assert.ok(!/descartados/.test(sin.diagnostico));
});

test("UI: cero resultados muestra mensaje preciso y línea de diagnóstico; todo escapado", async () => {
  const { dom, d, calls } = await ui(() => resp({ resultados: [] }, { json: true }));
  d.getElementById("far_buscar").value = "<b>ADALI</b>";
  d.getElementById("far_buscar_btn").click();
  await tick();
  assert.equal(calls.length, 2);
  assert.match(d.getElementById("far_estado").textContent, /CIMA no devolvió medicamentos para «<b>ADALI<\/b>»/);
  assert.equal(d.querySelectorAll("#farmacos_root b").length, 0);
  assert.match(d.getElementById("far_diag").textContent, /nombre comercial: HTTP 200, 0 elemento/);
  assert.match(d.getElementById("far_diag").textContent, /principio activo: HTTP 200, 0 elemento/);
  dom.window.close();
});

test("UI: un 500 y un OK -> lista y diagnóstico; ambos 500 -> error y diagnóstico", async () => {
  let t = await ui(byVia(FAIL500, OK(LISTA)));
  t.d.getElementById("far_buscar").value = "farm";
  t.d.getElementById("far_buscar_btn").click();
  await tick();
  assert.equal(t.d.querySelectorAll("#far_resultados li").length, 2);
  assert.match(t.d.getElementById("far_diag").textContent, /HTTP 500/);
  t.dom.window.close();
  t = await ui(FAIL500);
  t.d.getElementById("far_buscar").value = "farm";
  t.d.getElementById("far_buscar_btn").click();
  await tick();
  assert.match(t.d.getElementById("far_estado").textContent, /500/);
  assert.match(t.d.getElementById("far_diag").textContent, /HTTP 500, fallo/);
  t.dom.window.close();
});

test("UI: descartados por formato se muestran en el diagnóstico", async () => {
  const { dom, d } = await ui(() => resp({ resultados: [{ nregistro: "a/b" }, { nregistro: "7", nombre: "N" }] }, { json: true }));
  d.getElementById("far_buscar").value = "x";
  d.getElementById("far_buscar_btn").click();
  await tick();
  assert.match(d.getElementById("far_diag").textContent, /2 resultados descartados por formato/);
  dom.window.close();
});

test("principio activo: si la lista no trae pactivos se usa el VTM (caso real de CIMA)", async () => {
  const { cima } = mk(() => resp({ resultados: [
    { nregistro: "1161164001", nombre: "AMGEVITA 20 MG", pactivos: null, vtm: { id: 398728003, nombre: "adalimumab" } },
    { nregistro: "2", nombre: "SIN DATOS", vtm: null },
    { nregistro: "3", nombre: "CON PACTIVOS", pactivos: "X", vtm: { nombre: "otro" } }
  ] }, { json: true }));
  const r = await cima.buscar("adalimu");
  assert.equal(r[0].pactivos, "adalimumab");
  assert.equal(r[1].pactivos, "");
  assert.equal(r[2].pactivos, "X");
});

test("UI: «Ver 4.2» lleva el apartado a la vista, enfoca su título y marca el resultado elegido", async () => {
  const { dom, d } = await ui((url) => /docSegmentado/.test(url)
    ? resp("<p>Posología: 40 mg cada 14 días.</p>")
    : resp(LISTA, { json: true }));
  const vistos = [];
  dom.window.Element.prototype.scrollIntoView = function () { vistos.push(this.id || this.tagName); };
  d.getElementById("far_buscar").value = "farm";
  d.getElementById("far_buscar_btn").click();
  await tick();
  const filas = d.querySelectorAll("#far_resultados li");
  filas[1].querySelector("button.far-elegir").click();
  await tick();
  assert.ok(vistos.includes("far_ficha"), "se desplaza a la ficha");
  assert.equal(d.activeElement.tagName, "H3");
  assert.equal(filas[1].getAttribute("aria-current"), "true");
  assert.ok(filas[1].classList.contains("far-elegido"));
  assert.equal(filas[0].getAttribute("aria-current"), null);
  // elegir otro mueve la marca
  filas[0].querySelector("button.far-elegir").click();
  await tick();
  assert.equal(filas[1].getAttribute("aria-current"), null);
  assert.equal(filas[0].getAttribute("aria-current"), "true");
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

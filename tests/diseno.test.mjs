import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage } from "./helpers/loadPage.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const norm = (t) => String(t).replace(/\s+/g, " ").trim();
const html = read("index.html");
const tema = read("css/tema.css");

// ---------------------------------------------------------------- estructura y accesibilidad
test("estructura accesible: idioma, hitos, enlace «saltar al contenido» y un único <main>", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  assert.equal(d.documentElement.lang, "es");
  assert.equal(d.querySelectorAll("main").length, 1);
  assert.equal(d.querySelectorAll("header.topbar").length, 1);
  assert.equal(d.querySelectorAll("nav#tabs[role=tablist]").length, 1);
  assert.equal(d.querySelectorAll("footer.siteFooter").length, 1);
  const skip = d.querySelector("a.skip");
  assert.equal(skip.getAttribute("href"), "#contenido");
  assert.equal(d.getElementById("contenido").tagName, "MAIN");
  assert.ok(d.querySelector("noscript"), "aviso si no hay JavaScript");
  dom.window.close();
});

test("los ids son únicos en toda la página y cada tabpanel/tab apunta a elementos que existen", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  const ids = Array.from(d.querySelectorAll("[id]")).map((e) => e.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(dup, [], "ids duplicados");
  for (const panel of d.querySelectorAll("[role=tabpanel]")) {
    const lab = panel.getAttribute("aria-labelledby");
    assert.ok(lab && d.getElementById(lab), `tabpanel ${panel.id}: aria-labelledby inexistente (${lab})`);
  }
  for (const tab of d.querySelectorAll("[role=tab]")) {
    assert.ok(d.getElementById(tab.getAttribute("aria-controls")), `tab ${tab.id}: aria-controls inexistente`);
  }
  dom.window.close();
});

test("todo botón y enlace tiene nombre accesible, y los iconos decorativos están ocultos a lectores de pantalla", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  for (const el of d.querySelectorAll("button, a[href]")) {
    const nombre = norm(el.textContent) || el.getAttribute("aria-label") || el.getAttribute("title");
    assert.ok(nombre, "sin nombre accesible: " + el.outerHTML.slice(0, 90));
  }
  for (const svg of d.querySelectorAll("svg")) {
    assert.equal(svg.getAttribute("aria-hidden"), "true", "svg sin aria-hidden");
  }
  for (const a of d.querySelectorAll('a[target="_blank"]')) assert.match(a.getAttribute("rel"), /noopener/);
  dom.window.close();
});

test("metadatos: descripción, autoría, color de tema, icono y Open Graph", () => {
  assert.match(html, /<meta name="description" content="[^"]{60,}"/);
  assert.match(html, /<meta name="author" content="Ramón Morillo">/);
  assert.match(html, /<meta name="theme-color" content="#[0-9a-f]{6}">/i);
  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,/);
  assert.match(html, /<meta property="og:title"/);
  assert.match(html, /<meta property="og:description"/);
});

// ---------------------------------------------------------------- portada: dos herramientas diferenciadas
test("la portada presenta las dos herramientas, diferenciadas, con su acción principal", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  const tarjetas = Array.from(d.querySelectorAll("#tab-inicio .toolCard"));
  assert.equal(tarjetas.length, 2);
  const [info, cal] = tarjetas;
  assert.ok(info.classList.contains("toolCard--info") && cal.classList.contains("toolCard--cal"));
  assert.equal(norm(info.querySelector("h2").textContent), "Infografía para el paciente");
  assert.equal(norm(cal.querySelector("h2").textContent), "Calendario de tratamiento");
  for (const t of tarjetas) {
    assert.equal(t.querySelectorAll(".toolList li").length, 3, "tres ventajas por herramienta");
    assert.ok(t.querySelector(".btn.large[data-goto-tab]"), "acción principal");
  }
  assert.equal(info.querySelector(".btn.large").getAttribute("data-goto-tab"), "infografia");
  assert.equal(cal.querySelector(".btn.large").getAttribute("data-goto-tab"), "calendario");
  assert.equal(d.querySelectorAll("#tab-inicio h1").length, 1, "un único h1 en la portada");
  // cada herramienta lleva su cabecera propia y su color en el área de trabajo
  assert.ok(d.querySelector("#tab-infografia .toolHead--info h1"));
  assert.ok(d.querySelector("#tab-calendario .toolHead--cal h1"));
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("«Cargar ejemplo» de la portada lleva a la Infografía y carga el caso", async () => {
  // jsdom no implementa scrollIntoView (el código de la infografía lo usa al cargar el ejemplo)
  const dom = await loadPage({ beforeParse(w) { w.Element.prototype.scrollIntoView = function () {}; } });
  const d = dom.window.document;
  assert.equal(d.getElementById("tab-infografia").hidden, true);
  d.getElementById("loadExampleHero").click();
  assert.equal(d.getElementById("tab-infografia").hidden, false);
  assert.equal(d.getElementById("tab-inicio").hidden, true);
  assert.equal(d.getElementById("count").textContent, "3", "tres medicamentos del ejemplo");
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

// ---------------------------------------------------------------- autoría, versión, propiedad
test("el pie muestra autoría, fechas, versión, copyright y enlaces legales", async () => {
  const dom = await loadPage();
  const f = norm(dom.window.document.querySelector(".siteFooter").textContent);
  for (const t of [
    "Ramón Morillo", "Farmacia Hospitalaria", "Creada en febrero de 2026", "Versión 2.0", "Actualizada en noviembre de 2026",
    "© 2026 Ramón Morillo. Todos los derechos reservados.", "Uso gratuito para fines profesionales y docentes",
    "Aviso legal y propiedad", "Privacidad", "Guía de uso", "No sustituye el juicio clínico", "CIMA/AEMPS", "No guarda datos del paciente",
  ]) assert.ok(f.includes(t), "falta en el pie: " + t);
  const gh = dom.window.document.querySelector('.siteFooter a[href^="https://github.com/ramonmorillo/rxplain"]');
  assert.ok(gh);
  dom.window.close();
});

test("el aviso legal cubre titularidad, propiedad, responsabilidad, privacidad, fuentes y versión; y sus enlaces resuelven", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  const legal = d.getElementById("tab-legal");
  for (const id of ["legal-autoria", "legal-propiedad", "legal-responsabilidad", "legal-privacidad", "legal-fuentes", "legal-version"]) {
    assert.ok(legal.querySelector("#" + id), "falta la sección " + id);
  }
  const t = norm(legal.textContent);
  for (const frase of [
    "Todos los derechos reservados", "uso gratuito de la herramienta con fines profesionales y docentes",
    "Requiere autorización del autor", "No sustituye el juicio clínico", "RxPlain no guarda datos", "nunca datos del paciente",
    "GitHub Pages", "no está afiliado ni respaldado por la AEMPS", "Versión 2.0", "Versión 1.0", "febrero de 2026", "noviembre de 2026",
  ]) assert.ok(t.includes(frase), "falta en el aviso legal: " + frase);
  // todo enlace del pie a una sección legal existe
  for (const a of d.querySelectorAll('.siteFooter a[data-goto-tab="legal"]')) {
    const id = a.getAttribute("href").slice(1);
    assert.ok(legal.querySelector("#" + id), "enlace roto del pie: " + id);
  }
  dom.window.close();
});

test("coherencia: versión y fechas son las mismas en el pie, el aviso legal y la guía", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  const pie = norm(d.querySelector(".siteFooter").textContent);
  const legal = norm(d.getElementById("tab-legal").textContent);
  const guia = norm(d.getElementById("tab-guia").textContent);
  const versionPie = /Versión (\d+\.\d+)/.exec(pie)[1];
  assert.match(legal, new RegExp("La versión actual es la " + versionPie.replace(".", "\\.")));
  assert.ok(legal.includes("Versión " + versionPie + " (noviembre de 2026)"));
  assert.ok(pie.includes("Creada en febrero de 2026") && legal.includes("febrero de 2026"));
  assert.ok(/noviembre de 2026/.test(guia), "la guía indica su fecha de actualización");
  // el copyright coincide con el año de creación
  assert.ok(pie.includes("© 2026"));
  dom.window.close();
});

test("la privacidad declarada coincide con el comportamiento: sin cookies ni almacenamiento y sin recursos externos", async () => {
  const dom = await loadPage();
  assert.equal(dom.window.document.cookie, "");
  dom.window.close();
  // el código no usa almacenamiento del navegador (ni cookies) en ningún módulo
  const codigo = fs.readdirSync(path.join(root, "js")).map((f) => read("js/" + f)).join("\n");
  assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie\s*=/.test(codigo), "uso de almacenamiento del navegador");
  // ni scripts, hojas de estilo, imágenes ni fuentes de terceros (la web funciona sin red y no la usa para analítica)
  assert.deepEqual(html.match(/<(script|link|img|iframe)\b[^>]*\s(src|href)="https?:\/\/[^"]+"/gi) || [], [], "recursos externos en index.html");
  for (const f of ["tema.css", "rxplain.css", "calendario.css", "guia.css"]) {
    assert.ok(!/@import|url\(\s*["']?https?:/i.test(read("css/" + f)), "recurso externo en " + f);
  }
  const fuentes = fs.readdirSync(path.join(root, "js")).map((f) => read("js/" + f)).join("\n");
  assert.ok(!/google-analytics|googletagmanager|goatcounter|plausible|hotjar|matomo|fbq\(/i.test(fuentes + html), "no hay analítica ni contador");
});

// ---------------------------------------------------------------- calendario en dos columnas
test("Calendario: la pauta y los controles a la izquierda; avisos y meses a la derecha", async () => {
  const dom = await loadPage();
  const d = dom.window.document;
  const lay = d.querySelector("#sub-calendario .cal-layout");
  assert.ok(lay);
  const izq = lay.querySelector(".cal-izq"), der = lay.querySelector(".cal-der");
  for (const id of ["cal_pauta", "cal_inicio", "cal_ciclos", "cal_indefinida", "cal_hasta", "cal_retrasos"]) assert.ok(izq.querySelector("#" + id), id + " a la izquierda");
  for (const id of ["cal_resumen", "cal_avisos", "cal_meses"]) assert.ok(der.querySelector("#" + id), id + " a la derecha");
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

// ---------------------------------------------------------------- CSS: contraste, casillas, impresión
function tokens() {
  const tok = {};
  const raiz = tema.slice(0, tema.indexOf("superficies que se imprimen"));
  for (const m of raiz.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)) {
    tok[m[1]] = m[2].length === 4 ? "#" + m[2].slice(1).split("").map((c) => c + c).join("") : m[2];
  }
  return tok;
}
const lum = (h) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

test("contraste WCAG AA (≥ 4,5:1) de los pares de color del rediseño", () => {
  const t = tokens();
  const T = (n) => t[n] || n;
  const pares = [
    ["text", "bg"], ["text", "surface"], ["muted", "bg"], ["muted", "surface"], ["brand-deep", "bg"], ["primary", "surface"],
    ["info", "info-soft"], ["cal", "cal-soft"], ["info", "surface"], ["cal", "surface"], ["muted-2", "surface"],
    ["#ffffff", "info"], ["#ffffff", "cal"], ["#ffffff", "primary"],
    ["#c3d5e0", "#0c2638"], ["#9fb9c9", "#0c2638"], ["#8fb3c7", "#0c2638"], ["#e8f3f9", "#0c2638"], ["#66778a", "#ffffff"],
  ];
  for (const [a, b] of pares) {
    const r = ratio(T(a), T(b));
    assert.ok(r >= 4.5, `contraste insuficiente ${a} sobre ${b}: ${r.toFixed(2)}:1`);
  }
});

test("css: las casillas no heredan el ancho del input y las superficies impresas conservan la tipografía y los tokens de la v1", () => {
  assert.match(tema, /input\[type="checkbox"\],input\[type="radio"\]\{width:18px/);
  const bloque = tema.slice(tema.indexOf("superficies que se imprimen"), tema.indexOf("/* ---------------------------------------------------------------- base */"));
  for (const sel of [".infografia", "#outputWrap", "#hojaPaciente", ".informe-preview"]) assert.ok(bloque.includes(sel), "falta " + sel);
  assert.match(bloque, /font-family:Inter,ui-sans-serif,system-ui/);
  assert.match(bloque, /--text:#102033/);
});

test("css de impresión: se oculta la cromática y se reafirman las reglas de la v1 que la capa nueva pisaría", () => {
  const imp = tema.slice(tema.lastIndexOf("@media print"));
  for (const sel of [".topbar", ".toolHead", ".inicio", ".siteFooter", "#tab-legal"]) assert.ok(imp.includes(sel), "no se oculta " + sel);
  assert.match(imp, /\.pageShell\{max-width:none;margin:0;padding:0\}/);
  assert.match(imp, /body\{[^}]*color:#000/);
  assert.match(imp, /a\{color:#000;text-decoration:none\}/);
  // y la regla de la hoja del paciente sigue ocultando todo lo demás
  assert.match(read("css/calendario.css"), /body\[data-printing="calendario"\] \.pageShell > :not\(#hojaPaciente\)\{display:none!important\}/);
});

test("css: respeta prefers-reduced-motion y define estilos de foco visibles", () => {
  assert.match(tema, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(tema, /:focus-visible/);
});

test("css responsive: la barra de pestañas no se desborda en móvil (versión corta de «Guía de uso»)", async () => {
  assert.match(tema, /\.soloAncho\{display:none\}/);
  assert.match(tema, /@media\(max-width:350px\)/, "ajuste para móviles de 320 px");
  assert.match(tema, /\.tabNav\{width:100%;order:2;margin:0;display:grid;grid-template-columns:repeat\(4,auto\)/);
  const dom = await loadPage();
  const g = dom.window.document.getElementById("tab-btn-guia");
  assert.equal(norm(g.textContent), "Guía de uso", "el nombre accesible completo se conserva");
  dom.window.close();
});

test("css: la capa nueva no redefine --accent (token de la v1 que usa el calendario) y el acento por herramienta es --tool", () => {
  const sinComentarios = tema.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/--accent\s*:/.test(sinComentarios), "tema.css redefine --accent");
  assert.ok(!/var\(--accent/.test(sinComentarios), "tema.css usa --accent");
  for (const sel of ["#tab-infografia{--tool:var(--info)}", "#tab-calendario{--tool:var(--cal)}"]) assert.ok(tema.includes(sel), "falta " + sel);
  assert.match(read("css/calendario.css"), /\.ciclo-ini\{background:var\(--accent\)/, "el calendario sigue usando el token de la v1");
});

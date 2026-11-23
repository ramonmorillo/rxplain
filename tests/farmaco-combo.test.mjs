import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./helpers/loadPage.mjs";
import { setValue } from "./helpers/pauta.mjs";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const DEBOUNCE = 450; // > 350 ms del desplegable

function resp(body, { json = false, status = 200 } = {}) {
  return { ok: status < 300, status, text: async () => (json ? JSON.stringify(body) : String(body)), json: async () => body };
}

const PRALUENT = [
  { nregistro: "111", nombre: "PRALUENT 75 MG PLUMA", pactivos: "alirocumab", formaFarmaceutica: { nombre: "SOLUCIÓN INYECTABLE" }, labtitular: "Lab A" },
  { nregistro: "222", nombre: "PRALUENT 300 MG PLUMA", pactivos: "alirocumab", formaFarmaceutica: { nombre: "SOLUCIÓN INYECTABLE" }, labtitular: "Lab A" },
];
const FICHA = "75 mg 1 vez cada 2 semanas.\n300 mg 1 vez cada 4 semanas.";

// handler(url) -> respuesta. Por defecto: búsqueda de PRALUENT y ficha con dos propuestas.
async function page(handler) {
  const calls = [];
  const dom = await loadPage({
    beforeParse(w) {
      w.fetch = async (url) => {
        calls.push(url);
        if (handler) { const r = handler(url); if (r) return r; }
        if (/docSegmentado/.test(url)) return resp(FICHA);
        return resp({ resultados: PRALUENT }, { json: true });
      };
    },
  });
  const d = dom.window.document;
  return { dom, d, calls };
}
const campo = (d) => d.querySelector('#cb_items .cb-item [data-f="farmaco"]');
async function escribir(dom, d, texto) {
  campo(d).focus();
  setValue(dom, campo(d), texto);
  await wait(DEBOUNCE);
}
const opciones = (d) => Array.from(d.querySelectorAll(".far-combo li[role=option]:not([aria-disabled])"));

test("desplegable: menos de 3 letras no consulta; con 3 o más lista las opciones de CIMA", async () => {
  const { dom, d, calls } = await page();
  await escribir(dom, d, "pr");
  assert.equal(calls.length, 0);
  assert.equal(d.querySelector(".far-combo").hidden, true);
  await escribir(dom, d, "pralu");
  assert.ok(calls.length >= 1);
  assert.equal(campo(d).getAttribute("role"), "combobox");
  assert.equal(campo(d).getAttribute("aria-expanded"), "true");
  assert.equal(opciones(d).length, 2);
  assert.match(opciones(d)[0].textContent, /PRALUENT 75 MG PLUMA · alirocumab · SOLUCIÓN INYECTABLE · Lab A/);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("desplegable: teclear varias letras seguidas hace una sola búsqueda (pausa)", async () => {
  const { dom, d, calls } = await page();
  campo(d).focus();
  for (const t of ["pra", "pral", "pralu", "praluen"]) setValue(dom, campo(d), t);
  await wait(DEBOUNCE);
  assert.equal(calls.filter((u) => /nombre=/.test(u)).length, 1);
  dom.window.close();
});

test("desplegable: teclado (↓ ↓ Enter) elige la opción, Escape cierra y el texto externo no crea HTML", async () => {
  const { dom, d } = await page((u) => /docSegmentado/.test(u) ? null : resp({ resultados: [
    { nregistro: "9", nombre: "<img src=x onerror=window.__x=1>", pactivos: "<b>x</b>" },
    { nregistro: "8", nombre: "OTRO", pactivos: "otro" }] }, { json: true }));
  await escribir(dom, d, "otro");
  assert.equal(d.querySelectorAll(".far-combo img, .far-combo b").length, 0);
  assert.equal(dom.window.__x, undefined);
  campo(d).dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(d.querySelector(".far-combo").hidden, true);
  assert.equal(campo(d).getAttribute("aria-expanded"), "false");
  // reabrir con ↓ y elegir la segunda
  const k = (key) => campo(d).dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  k("ArrowDown"); await wait(DEBOUNCE);
  k("ArrowDown"); k("ArrowDown");
  assert.equal(opciones(d)[1].getAttribute("aria-selected"), "true");
  assert.equal(campo(d).getAttribute("aria-activedescendant"), opciones(d)[1].id);
  k("Enter"); await wait(60);
  assert.equal(campo(d).value, "otro");
  assert.equal(d.querySelector(".far-combo").hidden, true);
  dom.window.close();
});

test("desplegable: sin resultados y error de red muestran una nota y dejan escribir a mano", async () => {
  let modo = "vacio";
  const { dom, d } = await page((u) => {
    if (/docSegmentado/.test(u)) return null;
    if (modo === "vacio") return resp({ resultados: [] }, { json: true });
    throw new TypeError("Failed to fetch");
  });
  await escribir(dom, d, "zzzz");
  assert.match(d.querySelector(".far-combo").textContent, /Sin resultados en CIMA/);
  assert.equal(opciones(d).length, 0);
  modo = "error";
  await escribir(dom, d, "zzzzz");
  assert.match(d.querySelector(".far-combo").textContent, /No se pudo consultar CIMA/);
  assert.equal(campo(d).value, "zzzzz");
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("elegir una opción carga la ficha 4.2, rellena la pauta tentativa y enfoca la dosis", async () => {
  const { dom, d, calls } = await page();
  await escribir(dom, d, "praluent");
  opciones(d)[0].dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  await wait(80);
  assert.ok(calls.some((u) => /docSegmentado.*nregistro=111.*seccion=4\.2/.test(u)));
  assert.equal(campo(d).value, "alirocumab");
  assert.equal(d.querySelector('#cb_items [data-f="abrev"]').value, "alir");
  assert.equal(d.getElementById("cb_tipo").value, "intervalo");
  // la concentración de la presentación (75 mg) elige la frase «75 mg 1 vez cada 2 semanas»
  assert.equal(d.querySelector('[data-f="cada_dias"]').value, "14");
  assert.equal(d.querySelector('[data-f="desplazamientos_dias"]').value, "0");
  assert.equal(d.querySelector('[data-f="primer_mantenimiento_dia"]').value, "14");
  assert.match(d.getElementById("cb_origen_txt").textContent, /Borrador de la ficha técnica de PRALUENT 75 MG PLUMA \(nº reg\. 111\).*75 mg 1 vez cada 2 semanas/);
  assert.equal(d.getElementById("cb_origen").hidden, false);
  assert.equal(d.activeElement.getAttribute("data-f"), "dosis");
  assert.match(d.getElementById("cb_estado").textContent, /Escriba la dosis de alirocumab/);
  // con la dosis, aparece el calendario: dosis el 30/11 y cada 14 días
  setValue(dom, d.activeElement, "75 mg");
  setValue(dom, d.getElementById("cal_inicio"), "2026-11-30", "change");
  const fechas = Array.from(d.querySelectorAll("#cal_meses .dia")).filter((x) => x.querySelector(".pildora")).map((x) => x.dataset.date);
  assert.deepEqual(fechas.slice(0, 4), ["2026-11-30", "2026-12-14", "2026-12-28", "2027-01-11"]);
  assert.equal(fechas.length, 6);
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("con varias propuestas hay selector de alternativas, conserva la dosis y recalcula", async () => {
  const { dom, d } = await page();
  await escribir(dom, d, "praluent");
  opciones(d)[1].dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  await wait(80);
  const sel = d.getElementById("cb_propuesta");
  assert.equal(sel.options.length, 2);
  assert.equal(sel.value, "1"); // 300 mg → «300 mg 1 vez cada 4 semanas»
  assert.equal(d.querySelector('[data-f="cada_dias"]').value, "28");
  setValue(dom, d.querySelector('[data-f="dosis"]'), "mi dosis");
  sel.value = "0";
  sel.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  assert.equal(d.querySelector('[data-f="cada_dias"]').value, "14");
  assert.equal(d.querySelector('[data-f="dosis"]').value, "mi dosis");
  assert.equal(d.getElementById("cb_estado").textContent, "");
  dom.window.close();
});

test("ficha sin pauta reconocible o error al leerla: mensaje claro, el nombre se conserva", async () => {
  for (const [ficha, re] of [
    [() => resp("Texto sin pauta alguna."), /no permite proponer una pauta automática/],
    [() => resp("x", { status: 500 }), /No se pudo obtener la ficha técnica/],
  ]) {
    const { dom, d } = await page((u) => (/docSegmentado/.test(u) ? ficha() : null));
    await escribir(dom, d, "praluent");
    opciones(d)[0].dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    await wait(80);
    assert.match(d.getElementById("cb_origen_txt").textContent, re);
    assert.equal(campo(d).value, "alirocumab");
    assert.deepEqual(dom.errors, []);
    dom.window.close();
  }
});

test("con varios fármacos, elegir en la segunda fila solo rellena esa fila", async () => {
  const { dom, d } = await page();
  setValue(dom, d.querySelector('[data-f="farmaco"]'), "Otro fármaco");
  setValue(dom, d.querySelector('[data-f="dosis"]'), "5 mg");
  d.getElementById("cb_add").click();
  const fila2 = d.querySelectorAll("#cb_items .cb-item")[1];
  const f2 = fila2.querySelector('[data-f="farmaco"]');
  f2.focus(); setValue(dom, f2, "praluent"); await wait(DEBOUNCE);
  fila2.querySelector(".far-combo li[role=option]:not([aria-disabled])")
    .dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  await wait(80);
  const filas = d.querySelectorAll("#cb_items .cb-item");
  assert.equal(filas.length, 2);
  assert.equal(filas[0].querySelector('[data-f="farmaco"]').value, "Otro fármaco");
  assert.equal(filas[0].querySelector('[data-f="dosis"]').value, "5 mg");
  assert.equal(filas[1].querySelector('[data-f="farmaco"]').value, "alirocumab");
  assert.match(d.getElementById("cb_origen_txt").textContent, /otro tipo|Borrador de la ficha/);
  dom.window.close();
});

test("privacidad: el desplegable solo envía a CIMA el texto del campo Fármaco", async () => {
  const { dom, d, calls } = await page();
  setValue(dom, d.getElementById("cal_paciente"), "PACIENTE-SECRETO-123");
  await escribir(dom, d, "praluent");
  assert.ok(calls.length > 0);
  for (const u of calls) {
    assert.match(u, /^https:\/\/cima\.aemps\.es\/cima\/rest\//);
    assert.ok(!/SECRETO/.test(decodeURIComponent(u)));
  }
  dom.window.close();
});

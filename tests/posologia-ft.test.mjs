import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadPage } from "./helpers/loadPage.mjs";

const require = createRequire(import.meta.url);
const RxPosologia = require("../js/posologia-ft.js");
// Todos los textos son SINTÉTICOS (inventados para las pruebas); no son citas de fichas reales.

test("una vez al día / cada 24 horas -> diaria con 1 toma", () => {
  for (const t of ["Tomar un comprimido una vez al día.", "Se administra cada 24 horas."]) {
    const r = RxPosologia.extraer(t);
    assert.equal(r.propuestas.length, 1, t);
    assert.equal(r.propuestas[0].tipo, "diaria");
    assert.equal(r.propuestas[0].veces_al_dia, 1);
    assert.ok(r.propuestas[0].frase.includes(t.replace(/\.$/, "")));
  }
});

test("dos veces al día / cada 12 horas -> 2 tomas; 'cada 12 horas' no es 1", () => {
  for (const t of ["Se toma dos veces al día con comida.", "Una cápsula cada 12 horas."]) {
    const r = RxPosologia.extraer(t);
    assert.equal(r.propuestas.length, 1, t);
    assert.equal(r.propuestas[0].veces_al_dia, 2, t);
  }
  assert.equal(RxPosologia.extraer("Una dosis cada 8 horas.").propuestas[0].veces_al_dia, 3);
});

test("horas que no dividen 24 -> aviso, sin propuesta", () => {
  const r = RxPosologia.extraer("Una dosis cada 7 horas.");
  assert.deepEqual(r.propuestas, []);
  assert.ok(r.avisos.length >= 1);
});

test("ciclo: 'días 1 a 21 de ciclos de 28 días' y '21 de cada 28 días'", () => {
  let r = RxPosologia.extraer("Se administra los días 1 a 21 de ciclos de 28 días.");
  assert.equal(r.propuestas.length, 1);
  assert.equal(r.propuestas[0].tipo, "ciclo");
  assert.equal(r.propuestas[0].dias_ciclo, "1-21");
  assert.equal(r.propuestas[0].ciclo_dias, 28);
  r = RxPosologia.extraer("Tomar 14 días de cada 21 días.");
  assert.equal(r.propuestas.length, 1);
  assert.equal(r.propuestas[0].dias_ciclo, "1-14");
  assert.equal(r.propuestas[0].ciclo_dias, 21);
});

test("ciclo con rango incoherente (días 1 a 30 de ciclos de 28) -> aviso, sin propuesta", () => {
  const r = RxPosologia.extraer("Los días 1 a 30 de ciclos de 28 días.");
  assert.deepEqual(r.propuestas, []);
  assert.ok(r.avisos.length >= 1);
});

test("ciclo y una vez al día en la misma frase: veces_al_dia se une a la propuesta de ciclo", () => {
  const r = RxPosologia.extraer("Una vez al día los días 1 a 21 de ciclos de 28 días.");
  assert.equal(r.propuestas.length, 1);
  assert.equal(r.propuestas[0].tipo, "ciclo");
  assert.equal(r.propuestas[0].veces_al_dia, 1);
});

test("cada N semanas / días -> intervalo; semanas = N*7", () => {
  let r = RxPosologia.extraer("Se inyecta cada 8 semanas.");
  assert.equal(r.propuestas[0].tipo, "intervalo");
  assert.equal(r.propuestas[0].cada_dias, 56);
  r = RxPosologia.extraer("Se repite cada 21 días.");
  assert.equal(r.propuestas[0].cada_dias, 21);
});

test("coma decimal: 'cada 2,0 semanas' = 14; 'cada 1,5 semanas' = 10,5 días -> aviso", () => {
  assert.equal(RxPosologia.extraer("Se aplica cada 2,0 semanas.").propuestas[0].cada_dias, 14);
  const r = RxPosologia.extraer("Se aplica cada 1,5 semanas.");
  assert.deepEqual(r.propuestas, []);
  assert.ok(r.avisos.length >= 1);
  assert.equal(RxPosologia.extraer("Se aplica cada 0,5 semanas.").propuestas.length, 0);
});

test("semanas 0, 2 y 4 y después cada 8 semanas -> desplazamientos [0,14,28], mantenimiento 56, cada 56", () => {
  const r = RxPosologia.extraer("Se administra en las semanas 0, 2 y 4 y después cada 8 semanas.");
  assert.equal(r.propuestas.length, 1);
  const p = r.propuestas[0];
  assert.equal(p.tipo, "intervalo");
  assert.deepEqual(p.desplazamientos_dias, [0, 14, 28]);
  assert.equal(p.primer_mantenimiento_dia, 56);
  assert.equal(p.cada_dias, 56);
  assert.ok(p.primer_mantenimiento_dia > p.desplazamientos_dias[p.desplazamientos_dias.length - 1]);
  assert.match(p.notas, /56/);
});

test("inducción cuyo mantenimiento no queda tras la última dosis inicial: no se inventa el mantenimiento", () => {
  const r = RxPosologia.extraer("Semanas 0, 4 y 8 y después cada 4 semanas.");
  assert.equal(r.propuestas.length, 1);
  const p = r.propuestas[0];
  assert.deepEqual(p.desplazamientos_dias, [0, 28, 56]);
  assert.equal(p.cada_dias, 28);
  assert.equal(p.primer_mantenimiento_dia, "");
  assert.ok(r.avisos.length >= 1);
});

test("inducción con semanas no crecientes o decimales -> aviso, sin propuesta", () => {
  assert.deepEqual(RxPosologia.extraer("Semanas 4, 2 y 0 y después cada 8 semanas.").propuestas, []);
  assert.deepEqual(RxPosologia.extraer("Semanas 0,5 y 2 y después cada 8 semanas.").propuestas, []);
});

test("varias frecuencias en el texto -> varias propuestas separadas, nunca fusionadas", () => {
  const t = "Tratamiento oral: una vez al día.\nTratamiento de mantenimiento: cada 12 semanas.\nAlternativa: dos veces al día.";
  const r = RxPosologia.extraer(t);
  assert.equal(r.propuestas.length, 3);
  assert.deepEqual(r.propuestas.map((p) => p.tipo), ["diaria", "intervalo", "diaria"]);
  assert.deepEqual([r.propuestas[0].veces_al_dia, r.propuestas[1].cada_dias, r.propuestas[2].veces_al_dia], [1, 84, 2]);
  assert.ok(r.propuestas.every((p) => p.frase && t.includes(p.frase)));
  assert.notEqual(r.propuestas[0].frase, r.propuestas[2].frase);
});

test("varias frecuencias en una misma frase tampoco se fusionan", () => {
  const r = RxPosologia.extraer("Puede darse una vez al día o bien cada 2 semanas.");
  assert.equal(r.propuestas.length, 2);
  assert.deepEqual(r.propuestas.map((p) => p.tipo).sort(), ["diaria", "intervalo"]);
  assert.equal(r.propuestas[0].frase, r.propuestas[1].frase);
});

test("texto sin pauta reconocible / vacío / no string: ninguna propuesta y aviso", () => {
  for (const t of ["Ajuste la dosis según la respuesta clínica y la tolerancia.", "", "   ", null, undefined, 42]) {
    const r = RxPosologia.extraer(t);
    assert.deepEqual(r.propuestas, [], String(t));
    assert.ok(r.avisos.length >= 1, String(t));
  }
});

test("nunca propone dosis: ninguna propuesta contiene 'dosis' ni cifras de mg", () => {
  const r = RxPosologia.extraer("La dosis recomendada es de 40 mg una vez al día.");
  assert.equal(r.propuestas.length, 1);
  assert.ok(!("dosis" in r.propuestas[0]));
  assert.ok(!/\bmg\b/.test(r.propuestas[0].notas || ""));
});

test("sin tildes ni mayúsculas también se reconoce", () => {
  assert.equal(RxPosologia.extraer("UNA VEZ AL DIA").propuestas[0].veces_al_dia, 1);
});

// ---- UI ----
const tick = () => new Promise((r) => setTimeout(r, 30));
const resp = (body, json) => ({ ok: true, status: 200, text: async () => (json ? JSON.stringify(body) : body), json: async () => (json ? body : JSON.parse(body)) });
const LISTA = { resultados: [{ nregistro: "12345", nombre: "FARMAX 10 mg", pactivos: "FARMAXINA", labtitular: "Lab", formaFarmaceutica: "COMPRIMIDO" }] };

async function ui(texto) {
  const dom = await loadPage({
    beforeParse(w) {
      w.fetch = async (url) => (String(url).includes("docSegmentado") ? resp(texto) : resp(LISTA, true));
    },
  });
  const d = dom.window.document;
  d.getElementById("far_buscar").value = "farm";
  d.getElementById("far_buscar_btn").click();
  await tick();
  d.querySelector("#far_resultados li button").click();
  await tick();
  return { dom, d };
}

test("UI: aviso de borrador, propuestas con frase origen, y 'Usar en el constructor' precarga sin dosis ni área/lugar adivinados", async () => {
  const { dom, d } = await ui("Se administra en las semanas 0, 2 y 4 y después cada 8 semanas. Alternativamente una vez al día.");
  const w = dom.window;
  assert.match(d.getElementById("sub-farmacos").textContent, /Borrador automático: revíselo y complételo; no sustituye la validación farmacéutica\./);
  const prop = d.getElementById("far_proponer");
  assert.equal(prop.disabled, false);
  assert.equal(d.querySelectorAll("#far_propuestas li").length, 0);
  prop.click();
  const lis = d.querySelectorAll("#far_propuestas li");
  assert.equal(lis.length, 2);
  assert.match(lis[0].textContent, /semanas 0, 2 y 4 y después cada 8 semanas/);
  lis[0].querySelector("button").click();
  assert.equal(d.getElementById("sub-btn-esquemas").getAttribute("aria-selected"), "true");
  assert.equal(d.getElementById("cal_constructor").hidden, false);
  const c = d.getElementById("cal_constructor");
  assert.equal(c.querySelector("#cb_tipo").value, "intervalo");
  assert.match(c.querySelector("#cb_nombre").value, /FARMAXINA/);
  assert.match(c.querySelector("#cb_nombre").value, /12345/);
  const row = c.querySelector(".cb-item");
  assert.equal(row.querySelector('[data-f="farmaco"]').value, "FARMAXINA");
  assert.equal(row.querySelector('[data-f="dosis"]').value, "");
  assert.equal(row.querySelector('[data-f="desplazamientos_dias"]').value, "0,14,28");
  assert.equal(row.querySelector('[data-f="primer_mantenimiento_dia"]').value, "56");
  assert.equal(row.querySelector('[data-f="cada_dias"]').value, "56");
  assert.equal(row.querySelector('[data-f="lugar"]').value, "");
  assert.equal(c.querySelector("#cb_area").value, "");
  // Sin dosis, área ni lugar no se puede crear: el farmacéutico debe completarlos.
  c.querySelector("#cb_crear").click();
  assert.match(c.querySelector("#cb_error").textContent, /\S/);
  // Completado por el farmacéutico: la pauta nace pendiente.
  c.querySelector("#cb_area").value = "Inmunomediadas";
  row.querySelector('[data-f="dosis"]').value = "(la indica el farmacéutico)";
  row.querySelector('[data-f="lugar"]').value = "casa_inyeccion";
  c.querySelector("#cb_crear").click();
  assert.equal(c.hidden, true);
  const reg = w.RxData.get([...w.RxData.byArea()["Inmunomediadas"]].pop().id);
  assert.equal(reg.estado, "pendiente");
  assert.deepEqual(dom.errors, []);
  w.close();
});

test("UI: propuesta de ciclo precarga días y duración; diaria deja ciclo vacío (no se inventa)", async () => {
  const { dom, d } = await ui("Los días 1 a 21 de ciclos de 28 días. Tomar dos veces al día.");
  d.getElementById("far_proponer").click();
  const lis = d.querySelectorAll("#far_propuestas li");
  assert.equal(lis.length, 2);
  lis[0].querySelector("button").click();
  const c = d.getElementById("cal_constructor");
  assert.equal(c.querySelector("#cb_tipo").value, "ciclos");
  assert.equal(c.querySelector("#cb_ciclo").value, "28");
  assert.equal(c.querySelector('.cb-item [data-f="dias"]').value, "1-21");
  d.getElementById("sub-btn-farmacos").click();
  d.querySelectorAll("#far_propuestas li")[1].querySelector("button").click();
  assert.equal(c.querySelector("#cb_ciclo").value, "");
  assert.equal(c.querySelector('.cb-item [data-f="dias"]').value, "");
  assert.equal(c.querySelector('.cb-item [data-f="veces_al_dia"]').value, "2");
  assert.deepEqual(dom.errors, []);
  dom.window.close();
});

test("UI: texto sin pauta muestra avisos y ninguna propuesta; la frase se escapa", async () => {
  const { dom, d } = await ui("Ajuste <img src=x onerror=window.__q=1> según respuesta.");
  d.getElementById("far_proponer").click();
  assert.equal(d.querySelectorAll("#far_propuestas li").length, 0);
  assert.match(d.getElementById("far_avisos").textContent, /\S/);
  assert.equal(d.querySelectorAll("#far_ficha img").length, 0);
  assert.equal(dom.window.__q, undefined);
  dom.window.close();
});

// ---- Ronda de correcciones 1 (frases sintéticas) ----
function sinPropuesta(t, re) {
  const r = RxPosologia.extraer(t);
  assert.deepEqual(r.propuestas, [], t);
  assert.ok(r.avisos.length >= 1, t);
  if (re) assert.match(r.avisos.join(" | "), re, t);
}

test("F1: máximos, límites y condicionales no son pauta: sin propuesta y aviso con el calificador", () => {
  sinPropuesta("Se puede repetir hasta un máximo de 3 veces al día.", /hasta|m[aá]ximo/i);
  sinPropuesta("No tomar más de 3 veces al día.", /m[aá]s de/i);
  sinPropuesta("La dosis máxima es 2 veces al día.", /m[aá]xim/i);
  sinPropuesta("Puede repetirse como máximo cada 4 horas.", /m[aá]ximo/i);
  sinPropuesta("Tomar un comprimido sin superar 2 dosis cada 24 horas.", /sin superar/i);
  sinPropuesta("Si es necesario, puede aumentarse a dos veces al día.", /si es necesario|puede aumentarse/i);
});

test("F2: descanso / sin tratamiento / rangos de días con 'cada': nunca un intervalo engañoso", () => {
  sinPropuesta("5 días de descanso de cada 28 días.", /descanso/i);
  sinPropuesta("Días 1-14 cada 21 días y luego descanso.", /descanso/i);
  let r = RxPosologia.extraer("Días 1-14 cada 21 días.");
  assert.equal(r.propuestas.length, 1);
  assert.equal(r.propuestas[0].tipo, "ciclo");
  assert.equal(r.propuestas[0].dias_ciclo, "1-14");
  assert.equal(r.propuestas[0].ciclo_dias, 21);
  r = RxPosologia.extraer("1 comprimido una vez al día durante 21 días seguido de 7 días de descanso, en ciclos de 28 días.");
  assert.equal(r.propuestas.length, 1);
  assert.equal(r.propuestas[0].tipo, "ciclo");
  assert.equal(r.propuestas[0].dias_ciclo, "1-21");
  assert.equal(r.propuestas[0].ciclo_dias, 28);
  assert.equal(r.propuestas[0].veces_al_dia, 1);
  r = RxPosologia.extraer("Una vez al día durante 14 días seguido de 7 días sin tratamiento (ciclo de 21 días).");
  assert.equal(r.propuestas.length, 1);
  assert.equal(r.propuestas[0].dias_ciclo, "1-14");
  assert.equal(r.propuestas[0].ciclo_dias, 21);
  sinPropuesta("Una vez al día durante 21 días seguido de 7 días de descanso, en ciclos de 30 días.", /ciclo|coherent/i);
  sinPropuesta("Tomar durante 21 días y descansar; ciclos de 28 días.", /descans|ciclo/i);
});

test("F3: inducción: 'semana 0, semana 4', días base 1, 'seguidas de'", () => {
  let r = RxPosologia.extraer("Semana 0, semana 4 y después cada 12 semanas.");
  assert.equal(r.propuestas.length, 1);
  assert.deepEqual(r.propuestas[0].desplazamientos_dias, [0, 28]);
  assert.equal(r.propuestas[0].cada_dias, 84);
  assert.equal(r.propuestas[0].primer_mantenimiento_dia, 84);
  r = RxPosologia.extraer("Días 1, 8 y 15 y después cada 28 días.");
  assert.deepEqual(r.propuestas[0].desplazamientos_dias, [0, 7, 14]);
  assert.match(r.propuestas[0].notas, /d[ií]a 1/i);
  r = RxPosologia.extraer("Dosis de inducción en las semanas 0, 2 y 6, seguidas de cada 8 semanas.");
  assert.equal(r.propuestas.length, 1);
  assert.deepEqual(r.propuestas[0].desplazamientos_dias, [0, 14, 42]);
  assert.equal(r.propuestas[0].cada_dias, 56);
});

test("F3b: unidades mezcladas en la lista inicial -> sin propuesta y aviso", () => {
  sinPropuesta("Semanas 0, días 14 y 28 y después cada 8 semanas.", /unidad|mezcl/i);
});

test("F4: inducción y mantenimiento en frases separadas: una sola propuesta unida (o aviso), nunca la inducción perdida", () => {
  let r = RxPosologia.extraer("Semanas 0, 2 y 4. Después, cada 8 semanas.");
  assert.equal(r.propuestas.length, 1);
  assert.deepEqual(r.propuestas[0].desplazamientos_dias, [0, 14, 28]);
  assert.equal(r.propuestas[0].cada_dias, 56);
  assert.match(r.propuestas[0].frase, /Semanas 0, 2 y 4\..*Después, cada 8 semanas/);
  r = RxPosologia.extraer("Después, cada 8 semanas.");
  assert.deepEqual(r.propuestas, []);
  assert.ok(r.avisos.length >= 1);
  r = RxPosologia.extraer("Semanas 0, 2 y 4. Se vigilará al paciente.");
  assert.deepEqual(r.propuestas, []);
  assert.match(r.avisos.join(" "), /inicial|inducci/i);
});

test("F5: 'cada N horas' se une al ciclo de la misma frase como veces al día", () => {
  const r = RxPosologia.extraer("Cada 12 horas los días 1 a 14 de ciclos de 21 días.");
  assert.equal(r.propuestas.length, 1);
  assert.equal(r.propuestas[0].tipo, "ciclo");
  assert.equal(r.propuestas[0].veces_al_dia, 2);
});

test("F6: duración dejada fuera -> propuesta con aviso propio; alternativas -> sin propuesta", () => {
  let r = RxPosologia.extraer("Administrar cada 4 semanas durante 12 semanas.");
  assert.equal(r.propuestas.length, 1);
  assert.equal(r.propuestas[0].cada_dias, 28);
  assert.match(r.propuestas[0].avisos.join(" "), /duraci[oó]n.*12 semanas/i);
  r = RxPosologia.extraer("Semanas 0, 2 y 4 y después cada 8 semanas durante 1 año.");
  assert.equal(r.propuestas.length, 1);
  assert.match(r.propuestas[0].avisos.join(" "), /duraci[oó]n.*1 a[nñ]o/i);
  sinPropuesta("Cada 3 días o 4 días.", /alternativ|o /i);
});

test("menores: rango de intervalo, dedupe, palabras numéricas, 'cada 8 h', una vez a la semana, dosis de carga", () => {
  sinPropuesta("Se aplica cada 2-4 semanas.", /rango/i);
  assert.equal(RxPosologia.extraer("Cada dos semanas.").propuestas[0].cada_dias, 14);
  assert.equal(RxPosologia.extraer("Una vez a la semana.").propuestas[0].cada_dias, 7);
  assert.equal(RxPosologia.extraer("Tomar cada 8 h.").propuestas[0].veces_al_dia, 3);
  assert.equal(RxPosologia.extraer("Una vez al día.\nUna vez al día.").propuestas.length, 1);
  sinPropuesta("Dosis de carga de 2 comprimidos una vez al día.", /carga/i);
});

test("UI F5: ciclo sin veces al día en la ficha precarga el campo en blanco con marca 'sin dato'", async () => {
  const { dom, d } = await ui("Los días 1 a 21 de ciclos de 28 días.");
  d.getElementById("far_proponer").click();
  d.querySelector("#far_propuestas li button").click();
  const v = d.querySelector('#cal_constructor .cb-item [data-f="veces_al_dia"]');
  assert.equal(v.value, "");
  assert.match(v.placeholder, /sin dato/i);
  dom.window.close();
});

test("UI F6: los avisos de cada propuesta se muestran", async () => {
  const { dom, d } = await ui("Administrar cada 4 semanas durante 12 semanas.");
  d.getElementById("far_proponer").click();
  assert.match(d.querySelector("#far_propuestas li").textContent, /duraci[oó]n/i);
  dom.window.close();
});

// ---- Final fix wave: guardas de calificadores ----
test("I2: calificadores no representables -> aviso con la frase, sin propuesta", () => {
  const casos = [
    ["Una vez al día en semanas alternas.", "alternas"],
    ["Días alternos, una vez al día.", "alternos"],
    ["Un día sí y otro no.", "dia si"],
    ["Dos veces al día, excepto los fines de semana.", "excepto"],
    ["Dos veces al día, salvo los sábados y domingos.", "salvo"],
    ["Una vez al día de lunes a viernes.", "lunes a viernes"],
    ["Durante la primera semana, una vez al día; después, cada 2 semanas.", "primera semana"],
    ["Durante las primeras 4 semanas una vez a la semana; después, una vez al mes.", "primeras 4 semanas"],
    ["Una vez al mes.", "al mes"],
    ["Dosis mensual de 10 mg.", "mensual"],
    ["Cada 3 meses.", "meses"],
    ["Una vez al día, luego una vez a la semana.", "luego"],
  ];
  for (const [t, frag] of casos) {
    const r = RxPosologia.extraer(t);
    assert.equal(r.propuestas.length, 0, t);
    assert.ok(r.avisos.some((a) => a.includes(t.replace(/\.$/, "")) && a.toLowerCase().includes(frag)), t + " :: " + r.avisos.join("|"));
  }
});

test("I2: frases válidas siguen igual", () => {
  assert.equal(RxPosologia.extraer("Una vez al día.").propuestas.length, 1);
  assert.equal(RxPosologia.extraer("Cada 8 semanas.").propuestas[0].cada_dias, 56);
  for (const t of ["Semanas 0, 2 y 4. Después, cada 8 semanas.", "Semanas 0, 2 y 4 y después cada 8 semanas"]) {
    const r = RxPosologia.extraer(t);
    assert.equal(r.propuestas.length, 1, t);
    assert.equal(r.propuestas[0].cada_dias, 56);
  }
  assert.equal(RxPosologia.extraer("Tomar después de las comidas, una vez al día.").propuestas.length, 1);
});

test("poblaciones: aviso no bloqueante en cada propuesta", () => {
  const r = RxPosologia.extraer("Adultos: cada 12 horas. Niños: una vez al día.");
  assert.equal(r.propuestas.length, 2);
  for (const p of r.propuestas) assert.ok(p.avisos.includes("La ficha distingue poblaciones: revise a cuál corresponde la frase."));
});

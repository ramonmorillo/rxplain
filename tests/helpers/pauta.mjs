// Helpers de pruebas de la vista Calendario: la pauta se define por el formulario, como el usuario.
export function setValue(dom, el, value, type = "input") {
  if (el.type === "checkbox") el.checked = !!value; else el.value = value;
  el.dispatchEvent(new dom.window.Event(type, { bubbles: true }));
}

// Rellena el formulario de pauta (#cal_pauta) y, si se indican, fecha de inicio, ciclos e indefinida.
// spec = { nombre, tipo: "ciclos"|"intervalo", ciclo_dias, validada, items: [{ farmaco, abrev, dosis, lugar,
//          veces_al_dia, dias | desplazamientos_dias, primer_mantenimiento_dia, cada_dias }],
//          inicio, n, indefinida, hasta }
export function definirPauta(dom, spec) {
  const d = dom.window.document;
  const $ = (id) => d.getElementById(id);
  setValue(dom, $("cb_tipo"), spec.tipo || "ciclos", "change");
  if (spec.nombre !== undefined) setValue(dom, $("cb_nombre"), spec.nombre);
  if (spec.ciclo_dias !== undefined) setValue(dom, $("cb_ciclo"), String(spec.ciclo_dias));
  while (d.querySelectorAll("#cb_items .cb-item").length < spec.items.length) $("cb_add").click();
  while (d.querySelectorAll("#cb_items .cb-item").length > spec.items.length) d.querySelector("#cb_items .cb-item [data-quitar]").click();
  spec.items.forEach((it, i) => {
    const row = d.querySelectorAll("#cb_items .cb-item")[i];
    Object.keys(it).forEach((k) => {
      const el = row.querySelector(`[data-f="${k}"]`);
      if (el) setValue(dom, el, String(it[k]), el.tagName === "SELECT" ? "change" : "input");
    });
  });
  if (spec.validada !== undefined) setValue(dom, $("cb_validada"), spec.validada, "change");
  if (spec.n !== undefined) setValue(dom, $("cal_ciclos"), String(spec.n));
  if (spec.indefinida !== undefined) setValue(dom, $("cal_indefinida"), spec.indefinida, "change");
  if (spec.hasta !== undefined) setValue(dom, $("cal_hasta"), spec.hasta, "change");
  if (spec.inicio !== undefined) setValue(dom, $("cal_inicio"), spec.inicio, "change");
  return d;
}

// Pauta de referencia equivalente a una parte de DRd: lenalidomida oral días 1–21 de un ciclo de 28 +
// daratumumab en hospital días 1, 8, 15 y 22. Sirve para pruebas de calendario, avisos y hoja.
export const PAUTA_REF = {
  nombre: "Pauta de referencia",
  tipo: "ciclos",
  ciclo_dias: 28,
  items: [
    { farmaco: "Lenalidomida", abrev: "Len", dosis: "25 mg", lugar: "casa", dias: "1-21" },
    { farmaco: "Daratumumab SC", abrev: "Dara", dosis: "1800 mg", lugar: "hospital", dias: "1,8,15,22" }
  ]
};

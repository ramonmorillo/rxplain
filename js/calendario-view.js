(function () {
  "use strict";

  // Schedule = RxEngine.buildSchedule(regimen, {start, n, delays}):
  //   { cycles:[{n,start,len,fase}], events:[{date,cycle,day,farmaco,abrev,dosis,veces,lugar,etiqueta}], end }
  // Los eventos NO vienen ordenados por fecha dentro de un ciclo: se agrupan aquí.
  // En pautas por intervalo, cycles = [] y event.cycle = nº de dosis.

  var WD = ["lun.", "mar.", "mié.", "jue.", "vie.", "sáb.", "dom."];
  var MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  var MES_LARGO = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto",
    "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  var CAB = ["L", "M", "X", "J", "V", "S", "D"];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function validIso(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return false;
    var p = s.split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return d.getUTCMonth() === +p[1] - 1 && d.getUTCDate() === +p[2];
  }

  function todayIso() {
    var t = new Date();
    return t.getFullYear() + "-" + pad(t.getMonth() + 1) + "-" + pad(t.getDate());
  }

  // "sáb. 21 nov"
  function fmtShort(iso) {
    return WD[RxEngine.isoDow(iso)] + " " + Number(iso.slice(8)) + " " + MES[Number(iso.slice(5, 7)) - 1];
  }

  function conflicts(schedule) {
    var seen = {};
    schedule.events.forEach(function (e) {
      if (e.lugar !== "hospital") return;
      if (RxEngine.isoDow(e.date) >= 5 || RxEngine.holidayName(e.date)) seen[e.date] = true;
    });
    return Object.keys(seen).sort();
  }

  function rangeOf(schedule) {
    var first = null;
    var last = schedule.end;
    schedule.events.forEach(function (e) {
      if (first === null || e.date < first) first = e.date;
      if (e.date > last) last = e.date;
    });
    if (schedule.cycles.length && (first === null || schedule.cycles[0].start < first)) {
      first = schedule.cycles[0].start;
    }
    return first === null ? null : { first: first, last: last };
  }

  function dayCell(iso, evs, cycleStart) {
    var hospital = evs.some(function (e) { return e.lugar === "hospital"; });
    var h = RxEngine.holidayName(iso);
    var cls = "dia" + (hospital ? " dia-hospital" : "") + (RxEngine.isoDow(iso) >= 5 ? " finde" : "") + (h ? " festivo" : "");
    var html = '<div class="' + cls + '" data-date="' + iso + '"' + (h ? ' title="' + esc(h) + '"' : "") + ">";
    html += '<span class="num">' + Number(iso.slice(8)) + "</span>";
    if (cycleStart) {
      html += '<span class="ciclo-ini" data-ciclo-inicio="' + cycleStart.n + '" data-date="' + iso + '">C' + cycleStart.n + "</span>";
    }
    if (hospital) html += '<span class="etq-hospital"><span class="etq-largo">HOSPITAL</span><span class="etq-corto" aria-hidden="true">HOSP.</span></span>';
    evs.forEach(function (e) {
      var tip = e.farmaco + " · " + e.dosis + (e.veces > 1 ? " · " + e.veces + " veces al día" : "") + (e.etiqueta ? " · " + e.etiqueta : "");
      html += '<span class="pildora lugar-' + esc(e.lugar) + '" title="' + esc(tip) + '">' + esc(e.abrev) + "</span>";
    });
    return html + "</div>";
  }

  function renderMonths(schedule) {
    var range = rangeOf(schedule);
    if (!range) return "";
    var byDate = {};
    schedule.events.forEach(function (e) { (byDate[e.date] = byDate[e.date] || []).push(e); });
    var starts = {};
    schedule.cycles.forEach(function (c) { starts[c.start] = c; });

    var y = +range.first.slice(0, 4), m = +range.first.slice(5, 7);
    var yEnd = +range.last.slice(0, 4), mEnd = +range.last.slice(5, 7);
    var out = "";
    while (y < yEnd || (y === yEnd && m <= mEnd)) {
      var firstIso = y + "-" + pad(m) + "-01";
      var days = new Date(Date.UTC(y, m, 0)).getUTCDate();
      out += '<section class="mes"><h3>' + MES_LARGO[m - 1] + " " + y + '</h3><div class="mes-grid">';
      CAB.forEach(function (c) { out += '<div class="cab">' + c + "</div>"; });
      for (var i = 0; i < RxEngine.isoDow(firstIso); i++) out += '<div class="vacio"></div>';
      for (var d = 1; d <= days; d++) {
        var iso = y + "-" + pad(m) + "-" + pad(d);
        out += dayCell(iso, byDate[iso] || [], starts[iso]);
      }
      out += "</div></section>";
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return out;
  }

  function list(items, cls) {
    if (!items || !items.length) return "";
    return '<ul class="' + cls + '">' + items.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>";
  }

  var HASTA_DEFECTO = "2027-12-31";

  // "2027-12-31" -> "31/12/2027"
  function fmtDMY(iso) { return iso.slice(8) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4); }

  // Recorta una agenda construida con el tope del motor a la fecha "hasta".
  // Devuelve { schedule, recortadoHasta }: recortadoHasta (iso) solo si el tope de 60
  // se alcanza antes de cubrir "hasta"; el calendario llega entonces hasta esa fecha.
  function cubrirHasta(schedule, hasta) {
    var recortado = null;
    if (schedule.cycles.length) {
      if (schedule.end < hasta) recortado = schedule.end;
    } else {
      var lastBy = {};
      schedule.events.forEach(function (e) { if (!lastBy[e.farmaco] || e.date > lastBy[e.farmaco]) lastBy[e.farmaco] = e.date; });
      Object.keys(lastBy).forEach(function (k) {
        if (lastBy[k] < hasta && (recortado === null || lastBy[k] < recortado)) recortado = lastBy[k];
      });
    }
    var events = schedule.events.filter(function (e) { return e.date <= hasta; });
    var cycles = schedule.cycles.filter(function (c) { return c.start <= hasta; });
    var end = schedule.end > hasta ? hasta : schedule.end;
    return { schedule: { cycles: cycles, events: events, end: end, recortadoHasta: recortado }, recortadoHasta: recortado };
  }

  function renderAvisos(regimen, schedule) {
    var html = "";
    if (schedule.ajusteN) {
      html += '<p class="aviso aviso-ajuste" role="alert"><strong>Valor de «' + (schedule.cycles.length ? "Ciclos" : "Dosis") + '» ajustado.</strong> ' +
        "Ha escrito «" + (schedule.ajusteN.pedido === "" ? "vacío" : esc(schedule.ajusteN.pedido)) + "»; se han calendarizado " +
        schedule.ajusteN.efectivo + " (solo se admiten números enteros de 1 a 60).</p>";
    }
    if (schedule.recortadoHasta) {
      html += '<p class="aviso aviso-recorte" role="alert"><strong>Calendario recortado hasta ' + fmtDMY(schedule.recortadoHasta) +
        ".</strong> El motor calcula como máximo 60 " + (schedule.cycles.length ? "ciclos" : "dosis") +
        " y no llega a la fecha «Calendario hasta».</p>";
    }
    if (regimen.estado !== "validado") {
      html += '<p class="aviso aviso-pendiente"><strong>Esquema pendiente de validación.</strong> ' +
        "No usar con pacientes hasta que un farmacéutico lo valide frente a la fuente.</p>";
    }
    if (regimen.supuestos && regimen.supuestos.length) {
      html += '<div class="aviso aviso-supuestos"><strong>Supuestos</strong>' + list(regimen.supuestos, "lista-avisos") + "</div>";
    }
    if (regimen.notas && regimen.notas.length) {
      html += '<div class="aviso aviso-notas"><strong>Notas</strong>' + list(regimen.notas, "lista-avisos") + "</div>";
    }
    var conf = conflicts(schedule);
    if (conf.length) {
      var txt = conf.map(function (iso) {
        var h = RxEngine.holidayName(iso);
        return fmtShort(iso) + (h ? " (" + h + ")" : "");
      }).join(", ");
      html += '<p class="aviso aviso-conflictos"><strong>Visitas al hospital en fin de semana o festivo:</strong> ' + esc(txt) + ".</p>";
    }
    return html;
  }

  var precargarImpl = null;

  function mount(root) {
    var B = window.RxBuilder;
    if (!B) {
      root.innerHTML = '<p class="aviso" role="alert">No se ha podido cargar el módulo de pautas. ' +
        "Compruebe que js/constructor-pauta.js está publicado junto a index.html.</p>";
      return;
    }
    var N_DEFECTO = "6";
    var state = { start: todayIso(), delays: {}, pauta: null, error: "", nManual: N_DEFECTO };

    var SUBS = [["farmacos", "Fármacos"], ["calendario", "Calendario"], ["informe", "Informe del paciente"]];
    var SUB_DEFAULT = "calendario";
    function panelAttrs(n) {
      return ' role="tabpanel" id="sub-' + n + '" aria-labelledby="sub-btn-' + n + '"' + (n === SUB_DEFAULT ? "" : " hidden");
    }

    root.innerHTML =
      '<nav class="cal-subtabs" id="subtabs" role="tablist" aria-label="Secciones del calendario">' +
      SUBS.map(function (s) {
        var on = s[0] === SUB_DEFAULT;
        return '<button type="button" role="tab" id="sub-btn-' + s[0] + '" aria-controls="sub-' + s[0] +
          '" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '">' + s[1] + "</button>";
      }).join("") + "</nav>" +
      '<div class="cal-reinicio-barra"><button type="button" id="cal_reiniciar" class="btn btn-sec" aria-expanded="false" aria-controls="cal_reinicio">↺ Empezar de nuevo</button></div>' +
      '<div id="cal_reinicio" class="cal-reinicio" role="group" aria-label="Confirmar empezar de nuevo" hidden>' +
      '<p><strong>Se borrarán los datos del paciente, la fecha, los ciclos, los retrasos y las búsquedas.</strong></p>' +
      '<label class="cal-check"><input type="checkbox" id="cal_reinicio_todo"> Borrar también la pauta y los datos del profesional</label>' +
      '<div class="cal-reinicio-botones"><button type="button" id="cal_reinicio_si" class="btn">Borrar</button> ' +
      '<button type="button" id="cal_reinicio_no" class="btn btn-sec">Cancelar</button></div></div>' +
      '<section class="cal-subpanel"' + panelAttrs("farmacos") + ">" +
      '<div id="farmacos_root"><p>Próximamente</p></div></section>' +
      '<section class="cal-subpanel"' + panelAttrs("calendario") + ">" +
      '<section id="cal_pauta" class="cal-constructor" aria-label="Pauta"></section>' +
      '<div id="cal_resumen" class="cal-resumen"><span id="cal_resumen_txt"></span></div>' +
      '<form class="cal-form" onsubmit="return false">' +
      '<label>Fecha de inicio <input type="date" id="cal_inicio"></label> ' +
      '<label><span id="cal_ciclos_lbl">Ciclos</span> <input id="cal_ciclos" type="number" inputmode="numeric" min="1" max="60"></label> ' +
      '<label class="cal-check"><span><input type="checkbox" id="cal_indefinida"> Pauta indefinida (se continúa hasta que su médico indique otra cosa)</span></label> ' +
      '<label>Calendario hasta <input type="date" id="cal_hasta" value="' + HASTA_DEFECTO + '"></label>' +
      '<div id="cal_retrasos" class="cal-retrasos"></div></form>' +
      '<div id="cal_avisos" class="cal-avisos"></div>' +
      '<div id="cal_meses" class="cal-meses"></div></section>' +
      '<section class="cal-subpanel"' + panelAttrs("informe") + ">" +
      '<form class="cal-form" onsubmit="return false">' +
      '<label>Identificador del paciente (opcional, no se guarda) <input id="cal_paciente" type="text" autocomplete="off"></label> ' +
      '<label>Hospital / centro <input id="inf_hospital" type="text" autocomplete="off" placeholder="Si se deja vacío se usa el de Infografía"></label> ' +
      '<label>Farmacéutico/a responsable <input id="inf_farmaceutico" type="text" autocomplete="off"></label> ' +
      '<label>Teléfono de contacto <input id="inf_telefono" type="text" inputmode="tel" autocomplete="off"></label> ' +
      '<button type="button" id="cal_imprimir" class="btn">Imprimir hoja del paciente</button></form>' +
      '<div id="informe_preview" class="informe-preview" aria-label="Vista previa del informe"></div></section>';

    var farRoot = root.querySelector("#farmacos_root");
    if (farRoot && window.RxFarmacos && window.RxCima) window.RxFarmacos.mount(farRoot);

    function goSub(name) { if (window.RxSubtabs) window.RxSubtabs.show(name); }

    var pautaEl = root.querySelector("#cal_pauta");
    var iniEl = root.querySelector("#cal_inicio");
    var cicEl = root.querySelector("#cal_ciclos");
    var lblEl = root.querySelector("#cal_ciclos_lbl");
    var retEl = root.querySelector("#cal_retrasos");
    var avisosEl = root.querySelector("#cal_avisos");
    var indefEl = root.querySelector("#cal_indefinida");
    var hastaEl = root.querySelector("#cal_hasta");
    var mesesEl = root.querySelector("#cal_meses");

    function regimen() { return state.pauta; }

    function paintIndef() {
      var on = indefEl.checked;
      hastaEl.disabled = !on;
      cicEl.disabled = on;
    }

    function rebuildDelays(schedule) {
      var r = regimen();
      if (!r || r.tipo === "intervalo") { retEl.innerHTML = ""; retEl.hidden = true; return; }
      var need = [];
      for (var c = 2; c <= schedule.cycles.length; c++) need.push(String(c));
      // Si los campos ya son los necesarios no se recrean: recrearlos destruiría el que
      // el usuario acaba de enfocar (el «change» de Ciclos llega justo al hacer clic en él).
      var have = Array.prototype.map.call(retEl.querySelectorAll("[data-delay]"), function (i) { return i.getAttribute("data-delay"); });
      if (need.length && have.join(",") === need.join(",")) {
        Array.prototype.forEach.call(retEl.querySelectorAll("[data-delay]"), function (i) {
          var v = state.delays[i.getAttribute("data-delay")];
          var want = v === undefined ? "" : String(v);
          if (i.value !== want && document.activeElement !== i) i.value = want;
        });
        retEl.hidden = false;
        return;
      }
      var html = "";
      need.forEach(function (c) {
        html += '<label>Retraso C' + c + ' (días) <input type="number" min="0" data-delay="' + c + '" value="' +
          esc(state.delays[c] === undefined ? "" : state.delays[c]) + '"></label> ';
      });
      retEl.innerHTML = html;
      retEl.hidden = !html;
    }

    function build() {
      var r = regimen();
      if (!r) return null;
      var start = validIso(iniEl.value) ? iniEl.value : null;
      if (!start) return { r: r, schedule: null };
      if (indefEl.checked) {
        var hasta = hastaEl.value;
        if (!validIso(hasta)) return { r: r, schedule: null, error: "Indique una fecha válida en «Calendario hasta»." };
        if (start > hasta) {
          return { r: r, schedule: null, error: "La fecha de inicio es posterior a «Calendario hasta» (" + fmtDMY(hasta) + "): no hay nada que calendarizar." };
        }
        var full = RxEngine.buildSchedule(r, { start: start, n: 60, delays: state.delays });
        var cov = cubrirHasta(full, hasta);
        var cnt = cov.schedule.cycles.length ||
          cov.schedule.events.reduce(function (m, e) { return e.cycle > m ? e.cycle : m; }, 0);
        cicEl.value = String(cnt || 1);
        return { r: r, schedule: cov.schedule, indefinida: true, hasta: hasta };
      }
      var sch = RxEngine.buildSchedule(r, { start: start, n: cicEl.value, delays: state.delays });
      // El motor acota n a 1..60 sin avisar: si el valor escrito difiere del calculado, se informa.
      var efectivo = sch.cycles.length || sch.events.reduce(function (m, e) { return e.cycle > m ? e.cycle : m; }, 0);
      var pedido = String(cicEl.value).trim();
      if (!/^\d+$/.test(pedido) || Number(pedido) !== efectivo) sch.ajusteN = { pedido: pedido, efectivo: efectivo };
      return { r: r, schedule: sch, indefinida: false };
    }

    function paintResumen() {
      var r = regimen();
      root.querySelector("#cal_resumen_txt").textContent = r
        ? r.nombre + " · " + (r.estado === "validado" ? "validada" : "pendiente de validación")
        : "Defina la pauta para ver el calendario.";
      lblEl.textContent = r && r.tipo === "intervalo" ? "Dosis" : "Ciclos";
    }

    function paint(rebuildDelayInputs) {
      paintResumen();
      var b = build();
      if (!b) {
        mesesEl.innerHTML = "";
        avisosEl.innerHTML = '<p class="aviso">Complete la pauta (fármaco, dosis y días) para ver el calendario.</p>';
        retEl.innerHTML = ""; retEl.hidden = true;
        paintPreview();
        return;
      }
      if (!b.schedule) {
        avisosEl.innerHTML = '<p class="aviso">' + esc(b.error || "Indique una fecha de inicio válida.") + "</p>";
        mesesEl.innerHTML = "";
        paintPreview();
        return;
      }
      if (rebuildDelayInputs) rebuildDelays(b.schedule);
      avisosEl.innerHTML = renderAvisos(b.r, b.schedule);
      mesesEl.innerHTML = renderMonths(b.schedule);
      paintPreview();
    }

    function hoy() {
      var h = window.RxCalendar && typeof window.RxCalendar.hoy === "function" ? window.RxCalendar.hoy() : null;
      return validIso(h) ? h : todayIso();
    }

    // Mismo HTML para la vista previa y para la hoja impresa.
    function sheetHTML(b) {
      return window.RxSheet.buildSheetHTML(b.schedule, b.r, {
        paciente: root.querySelector("#cal_paciente").value.trim(),
        profesional: {
          nombre: rootVal("inf_farmaceutico") || val("pharm_name"),
          centro: rootVal("inf_hospital") || val("center"),
          contacto: rootVal("inf_telefono") || val("contact"),
          fecha: val("date")
        },
        indefinida: !!b.indefinida,
        hasta: b.indefinida ? b.hasta : "",
        hoy: hoy()
      });
    }

    function rootVal(id) { var el = root.querySelector("#" + id); return el ? el.value.trim() : ""; }

    function paintPreview() {
      var host = root.querySelector("#informe_preview");
      if (!host) return;
      var b = build();
      if (!window.RxSheet || !b || !b.schedule) {
        host.innerHTML = '<p class="aviso">' + esc(b && b.error ? b.error : "Defina la pauta y una fecha de inicio válida para ver el informe.") + "</p>";
        return;
      }
      host.innerHTML = sheetHTML(b);
    }

    function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }

    function imprimir() {
      var b = build();
      if (!b) {
        avisosEl.innerHTML = '<p class="aviso">Complete la pauta (fármaco, dosis y días) antes de imprimir.</p>';
        goSub("calendario");
        return;
      }
      if (!b.schedule) {
        avisosEl.innerHTML = '<p class="aviso">' + esc(b.error || "Indique una fecha de inicio válida.") + "</p>";
        goSub("calendario");
        return;
      }
      limpiarHoja();
      var host = document.getElementById("hojaPaciente");
      if (!host || !window.RxSheet) return;
      host.innerHTML = sheetHTML(b);
      document.body.dataset.printing = "calendario";
      host.hidden = false;
      window.addEventListener("afterprint", limpiarHoja, { once: true });
      try {
        window.print();
      } catch (err) {
        limpiarHoja();
      }
    }

    // Una sola limpieza compartida: quita el modo impresión y los datos del paciente del DOM.
    function limpiarHoja() {
      window.removeEventListener("afterprint", limpiarHoja);
      delete document.body.dataset.printing;
      var host = document.getElementById("hojaPaciente");
      if (host) { host.innerHTML = ""; host.hidden = true; }
    }
    // Si afterprint no llega, ningún cambio de pestaña ni la impresión de la infografía puede heredar la hoja.
    document.addEventListener("click", function (e) {
      var t = e.target && e.target.closest ? e.target.closest("#tabs [role=tab], #print") : null;
      if (t) limpiarHoja();
    }, true);
    root.querySelector("#cal_imprimir").addEventListener("click", imprimir);
    root.querySelector("#cal_paciente").addEventListener("input", paintPreview);
    // Datos del profesional (pestaña Infografía): refrescan la vista previa.
    document.addEventListener("input", function (e) {
      var id = e.target && e.target.id;
      if (id === "pharm_name" || id === "center" || id === "contact" || id === "date" ||
          id === "inf_hospital" || id === "inf_farmaceutico" || id === "inf_telefono") paintPreview();
    });
    document.addEventListener("click", function (e) {
      if (e.target && e.target.closest && e.target.closest("#sub-btn-informe")) paintPreview();
    });
    // Mostrar Informe (clic, flechas o API) o volver a la pestaña Calendario: la vista previa se repinta.
    document.addEventListener("rx:subtab", function (e) { if (e.detail && e.detail.name === "informe") paintPreview(); });
    document.addEventListener("rx:tab", function (e) { if (e.detail && e.detail.name === "calendario") paintPreview(); });

    // ---- Pauta (formulario editable; el calendario se recalcula en vivo) ----
    function opt(v, t, sel) { return '<option value="' + esc(v) + '"' + (sel ? " selected" : "") + ">" + esc(t) + "</option>"; }

    function itemRow() {
      var lug = [["casa", "Casa (oral)"], ["casa_inyeccion", "Casa (inyección)"], ["hospital", "Hospital"]];
      return '<div class="cb-item">' +
        '<label>Fármaco <input type="text" data-f="farmaco" autocomplete="off"></label>' +
        '<label>Abreviatura (opcional) <input type="text" data-f="abrev" maxlength="8" autocomplete="off"></label>' +
        '<label>Dosis (texto libre) <input type="text" data-f="dosis" autocomplete="off" placeholder="p. ej. 40 mg"></label>' +
        '<label>Lugar <select data-f="lugar">' + lug.map(function (l) { return opt(l[0], l[1]); }).join("") + "</select></label>" +
        '<label>Veces al día (1–6) <input type="text" data-f="veces_al_dia" inputmode="numeric" value="1"></label>' +
        '<label class="cb-ciclos">Días del ciclo (1 = primer día del ciclo) <input type="text" data-f="dias" autocomplete="off" placeholder="1-21 o 1,8,15"></label>' +
        '<label class="cb-intervalo">Dosis iniciales: días desde el inicio (0 = día de inicio) <input type="text" data-f="desplazamientos_dias" autocomplete="off" placeholder="0,14,28"></label>' +
        '<label class="cb-intervalo">Primer mantenimiento: días desde el inicio (0 = día de inicio) <input type="text" data-f="primer_mantenimiento_dia" inputmode="numeric" placeholder="56"></label>' +
        '<label class="cb-intervalo">Repetir cada (días) <input type="text" data-f="cada_dias" inputmode="numeric" placeholder="56"></label>' +
        '<button type="button" class="btn btn-sec" data-quitar>Quitar fármaco</button></div>';
    }

    function tipoEl() { return pautaEl.querySelector("#cb_tipo"); }

    function applyTipo() {
      var t = tipoEl().value;
      pautaEl.querySelector("#cb_ciclo_wrap").hidden = t !== "ciclos";
      Array.prototype.forEach.call(pautaEl.querySelectorAll(".cb-ciclos"), function (e) { e.hidden = t !== "ciclos"; });
      Array.prototype.forEach.call(pautaEl.querySelectorAll(".cb-intervalo"), function (e) { e.hidden = t !== "intervalo"; });
    }

    function addRow() {
      var tmp = document.createElement("div");
      tmp.innerHTML = itemRow();
      pautaEl.querySelector("#cb_items").appendChild(tmp.firstChild);
      applyTipo();
      return pautaEl.querySelector("#cb_items").lastChild;
    }

    function renderPauta() {
      pautaEl.innerHTML =
        "<h2>Pauta</h2>" +
        '<p class="cb-ayuda">Defina qué se toma y cuándo; el calendario se actualiza al escribir. ' +
        "¿Parte de un medicamento? Búsquelo en <strong>Fármacos</strong> y pulse «Usar en el calendario». " +
        "La dosis es solo un texto: la herramienta no calcula dosis.</p>" +
        '<p id="cb_origen" class="aviso cb-origen" hidden></p>' +
        '<p class="cb-ejemplos">Ejemplos: <button type="button" class="btn btn-sec" id="cal_ej_bio">Biológico cada N semanas</button> ' +
        '<button type="button" class="btn btn-sec" id="cal_ej_oral">Oral días 1–21 de 28</button></p>' +
        '<div class="cb-campos">' +
        '<label>Nombre de la pauta (opcional) <input type="text" id="cb_nombre" autocomplete="off"></label>' +
        '<label>Tipo de pauta <select id="cb_tipo">' + opt("ciclos", "Por ciclos (se repite cada N días)") +
        opt("intervalo", "Por intervalo (dosis sueltas cada N días)") + "</select></label>" +
        '<label id="cb_ciclo_wrap">Duración del ciclo (días) <input type="text" id="cb_ciclo" inputmode="numeric" value="28"></label></div>' +
        '<div id="cb_items"></div>' +
        '<p><button type="button" class="btn btn-sec" id="cb_add">Añadir fármaco</button></p>' +
        '<label class="cb-indef"><span><input type="checkbox" id="cb_validada"> Pauta revisada y validada por el farmacéutico ' +
        "(si no se marca, la hoja lleva el aviso «NO ENTREGAR AL PACIENTE»)</span></label>" +
        '<p id="cb_estado" class="cb-estado" role="status" aria-live="polite"></p>';
      addRow();
      applyTipo();
    }

    function readForm() {
      var f = {
        nombre: pautaEl.querySelector("#cb_nombre").value,
        tipo: tipoEl().value,
        ciclo_dias: pautaEl.querySelector("#cb_ciclo").value,
        validada: pautaEl.querySelector("#cb_validada").checked,
        fecha_revision: todayIso(),
        items: []
      };
      Array.prototype.forEach.call(pautaEl.querySelectorAll(".cb-item"), function (row) {
        var it = {};
        Array.prototype.forEach.call(row.querySelectorAll("[data-f]"), function (el) { it[el.getAttribute("data-f")] = el.value; });
        f.items.push(it);
      });
      return f;
    }

    // Reinterpreta el formulario: pauta válida (o null + mensaje) y repinta.
    function recompute() {
      try {
        state.pauta = B.buildRegimen(B.formFromText(readForm()));
        state.error = "";
      } catch (err) {
        state.pauta = null;
        state.error = err && err.message ? err.message : "La pauta no es válida.";
      }
      pautaEl.querySelector("#cb_estado").textContent = state.error;
    }

    function onPauta() { recompute(); paint(true); }
    pautaEl.addEventListener("input", onPauta);
    pautaEl.addEventListener("change", function (e) {
      if (e.target && e.target.id === "cb_tipo") applyTipo();
      onPauta();
    });
    pautaEl.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest("button") : null;
      if (!btn) return;
      if (btn.id === "cb_add") { addRow(); onPauta(); }
      else if (btn.id === "cal_ej_bio") cargar(B.EJEMPLOS.biologico());
      else if (btn.id === "cal_ej_oral") cargar(B.EJEMPLOS.oral21de28());
      else if (btn.hasAttribute("data-quitar")) {
        var rows = pautaEl.querySelectorAll(".cb-item");
        if (rows.length > 1) { btn.closest(".cb-item").remove(); onPauta(); }
        else pautaEl.querySelector("#cb_estado").textContent = "Debe quedar al menos un fármaco.";
      }
    });

    // Vuelca un borrador en el formulario. f = { nombre, tipo, ciclo_dias, n, indefinida, origen, items:[{…}] }.
    // Lo que no se conoce queda vacío y la dosis la escribe el farmacéutico.
    function cargar(f) {
      renderPauta();
      pautaEl.querySelector("#cb_nombre").value = f.nombre || "";
      if (f.tipo) tipoEl().value = f.tipo;
      if (f.ciclo_dias !== undefined && f.ciclo_dias !== "") pautaEl.querySelector("#cb_ciclo").value = String(f.ciclo_dias);
      pautaEl.querySelector("#cb_items").innerHTML = "";
      (f.items && f.items.length ? f.items : [{}]).forEach(function (it) {
        var row = addRow();
        Object.keys(it).forEach(function (k) {
          var e = row.querySelector('[data-f="' + k + '"]');
          if (e && it[k] !== undefined && it[k] !== null && String(it[k]) !== "") e.value = String(it[k]);
        });
        var vd = row.querySelector('[data-f="veces_al_dia"]');
        if (vd && it.veces_al_dia === "") { vd.value = ""; vd.setAttribute("placeholder", "sin dato en la ficha (vacío = 1): indíquelo"); }
      });
      applyTipo();
      var origen = pautaEl.querySelector("#cb_origen");
      if (f.origen) { origen.textContent = f.origen; origen.hidden = false; }
      if (f.n) { state.nManual = String(f.n); }
      indefEl.checked = !!f.indefinida;
      cicEl.value = state.nManual;
      paintIndef();
      state.delays = {};
      recompute();
      paint(true);
    }

    function precargar(f) {
      if (!f) return false;
      cargar(f);
      goSub("calendario");
      var vacio = pautaEl.querySelector('.cb-item [data-f="dosis"]');
      var campos = pautaEl.querySelectorAll('.cb-item input[data-f]:not([hidden])');
      Array.prototype.some.call(campos, function (c) {
        if (c.closest("label") && c.closest("label").hidden) return false;
        if (c.value === "" && c.getAttribute("data-f") !== "abrev") { vacio = c; return true; }
        return false;
      });
      if (vacio) {
        if (typeof vacio.scrollIntoView === "function") { try { vacio.scrollIntoView({ block: "center" }); } catch (e) { /* sin scroll */ } }
        if (vacio.focus) vacio.focus();
      }
      return true;
    }
    precargarImpl = precargar;

    // ---- Empezar de nuevo (confirmación en línea, sin window.confirm) ----
    var reiBtn = root.querySelector("#cal_reiniciar");
    var reiBox = root.querySelector("#cal_reinicio");
    var reiTodo = root.querySelector("#cal_reinicio_todo");
    function cerrarReinicio() {
      reiBox.hidden = true;
      reiTodo.checked = false;
      reiBtn.setAttribute("aria-expanded", "false");
    }
    reiBtn.addEventListener("click", function () {
      reiBox.hidden = false;
      reiBtn.setAttribute("aria-expanded", "true");
      root.querySelector("#cal_reinicio_no").focus();
    });
    root.querySelector("#cal_reinicio_no").addEventListener("click", function () { cerrarReinicio(); reiBtn.focus(); });
    root.querySelector("#cal_reinicio_si").addEventListener("click", function () {
      empezarDeNuevo(reiTodo.checked);
      cerrarReinicio();
      reiBtn.focus();
    });

    // Borra todo lo del paciente; la pauta y los datos del profesional solo si se pide.
    function empezarDeNuevo(todo) {
      limpiarHoja();
      root.querySelector("#cal_paciente").value = "";
      if (todo) {
        ["inf_hospital", "inf_farmaceutico", "inf_telefono"].forEach(function (id) { root.querySelector("#" + id).value = ""; });
        renderPauta();
      }
      state.delays = {};
      state.start = hoy();
      iniEl.value = state.start;
      hastaEl.value = HASTA_DEFECTO;
      indefEl.checked = false;
      state.nManual = N_DEFECTO;
      cicEl.value = N_DEFECTO;
      paintIndef();
      if (window.RxFarmacos && typeof window.RxFarmacos.reset === "function") window.RxFarmacos.reset();
      recompute();
      paint(true);
      goSub("calendario");
    }

    iniEl.addEventListener("change", function () { paint(false); });
    iniEl.addEventListener("input", function () { paint(false); });
    cicEl.addEventListener("input", function () { state.nManual = cicEl.value; paint(true); });
    cicEl.addEventListener("change", function () { state.nManual = cicEl.value; paint(true); });
    indefEl.addEventListener("change", function () {
      paintIndef();
      if (!indefEl.checked && state.nManual !== undefined) cicEl.value = state.nManual;
      paint(true);
    });
    hastaEl.addEventListener("input", function () { paint(true); });
    hastaEl.addEventListener("change", function () { paint(true); });
    retEl.addEventListener("input", function (e) {
      var t = e.target;
      if (!t || !t.getAttribute || !t.getAttribute("data-delay")) return;
      state.delays[t.getAttribute("data-delay")] = t.value;
      paint(false);
    });

    renderPauta();
    iniEl.value = state.start;
    cicEl.value = N_DEFECTO;
    paintIndef();
    recompute();
    paint(true);
  }

  window.RxCalendar = { mount: mount, precargar: function (f) { return precargarImpl ? precargarImpl(f) : false; }, renderMonths: renderMonths, conflicts: conflicts };

  function auto() {
    var root = document.getElementById("calendarioRoot");
    if (root) mount(root);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", auto);
  else auto();
})();

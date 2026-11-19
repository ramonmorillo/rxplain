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
    if (hospital) html += '<span class="etq-hospital">HOSPITAL</span>';
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

  function renderAvisos(regimen, schedule) {
    var html = "";
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

  function mount(root) {
    if (!RxData.list().length) {
      root.innerHTML =
        '<form class="cal-form" onsubmit="return false">' +
        '<label>Esquema <select id="cal_esquema" disabled></select></label> ' +
        '<label>Fecha de inicio <input type="date" id="cal_inicio" disabled></label> ' +
        '<label>Ciclos <input id="cal_ciclos" type="number" disabled></label></form>' +
        '<p class="aviso" role="alert">No se han podido cargar los esquemas. ' +
        "Compruebe que la carpeta data/ está publicada junto a index.html.</p>";
      return;
    }
    var groups = RxData.byArea();
    var areas = Object.keys(groups);
    var state = { id: null, start: todayIso(), n: 1, delays: {} };

    root.innerHTML =
      '<form class="cal-form" onsubmit="return false">' +
      '<div class="cal-selector">' +
      '<label>Buscar esquema <input type="search" id="cal_buscar" autocomplete="off" placeholder="Nombre, fármaco, área…"></label> ' +
      '<label>Área <select id="cal_area"><option value="">Todas las áreas</option>' +
      areas.map(function (a) { return '<option value="' + esc(a) + '">' + esc(a) + "</option>"; }).join("") +
      "</select></label> " +
      '<label>Esquema <select id="cal_esquema"></select></label></div>' +
      '<label>Fecha de inicio <input type="date" id="cal_inicio"></label> ' +
      '<label><span id="cal_ciclos_lbl">Ciclos</span> <input id="cal_ciclos" type="number" inputmode="numeric" min="1" max="60"></label>' +
      '<label>Identificador del paciente (opcional, no se guarda) <input id="cal_paciente" type="text" autocomplete="off"></label> ' +
      '<button type="button" id="cal_imprimir" class="btn">Imprimir hoja del paciente</button>' +
      '<div id="cal_retrasos" class="cal-retrasos"></div></form>' +
      '<div id="cal_avisos" class="cal-avisos"></div>' +
      '<div id="cal_meses" class="cal-meses"></div>';

    var selEl = root.querySelector("#cal_esquema");
    var buscarEl = root.querySelector("#cal_buscar");
    var areaEl = root.querySelector("#cal_area");
    var iniEl = root.querySelector("#cal_inicio");
    var cicEl = root.querySelector("#cal_ciclos");
    var lblEl = root.querySelector("#cal_ciclos_lbl");
    var retEl = root.querySelector("#cal_retrasos");
    var avisosEl = root.querySelector("#cal_avisos");
    var mesesEl = root.querySelector("#cal_meses");

    function regimen() { return selEl.value ? RxData.get(selEl.value) : null; }

    // Minúsculas y sin diacríticos, para buscar "hematologia" y encontrar "Hematología".
    function norm(t) {
      return String(t == null ? "" : t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    }

    function haystack(r) {
      var items = (r.items || []).slice();
      (r.fases || []).forEach(function (f) { items = items.concat(f.items || []); });
      var drugs = items.map(function (it) { return (it.farmaco || "") + " " + (it.abrev || ""); });
      return norm([r.nombre, r.linea, r.area].concat(drugs).join(" "));
    }

    function matches() {
      var q = norm(buscarEl.value.trim());
      var area = areaEl.value;
      var out = {};
      areas.forEach(function (a) {
        if (area && a !== area) return;
        var rs = groups[a].filter(function (r) { return !q || haystack(r).indexOf(q) !== -1; });
        if (rs.length) out[a] = rs;
      });
      return out;
    }

    // Reconstruye las <option> de #cal_esquema. Devuelve true si cambió el esquema seleccionado.
    function refilter() {
      var prev = selEl.value;
      var found = matches();
      var ids = [];
      selEl.innerHTML = Object.keys(found).map(function (a) {
        return '<optgroup label="' + esc(a) + '">' + found[a].map(function (r) {
          ids.push(r.id);
          var est = r.estado === "validado" ? "✔ validado" : "⚠ pendiente";
          return '<option value="' + esc(r.id) + '">' + esc(r.nombre + " · " + r.linea + " · " + est) + "</option>";
        }).join("") + "</optgroup>";
      }).join("");
      if (ids.length) selEl.value = ids.indexOf(prev) !== -1 ? prev : ids[0];
      var msg = root.querySelector("#cal_sin_resultados");
      if (!ids.length && !msg) {
        msg = document.createElement("p");
        msg.id = "cal_sin_resultados";
        msg.setAttribute("role", "status");
        msg.textContent = "Sin esquemas que coincidan.";
        selEl.parentNode.parentNode.appendChild(msg);
      } else if (ids.length && msg) {
        msg.parentNode.removeChild(msg);
      }
      return selEl.value !== prev;
    }

    function resetForRegimen() {
      var r = regimen();
      state.delays = {};
      if (!r) return;
      cicEl.value = String(r.ciclos_defecto);
      lblEl.textContent = r.tipo === "intervalo" ? "Dosis" : "Ciclos";
    }

    function rebuildDelays(schedule) {
      var r = regimen();
      if (!r || r.tipo === "intervalo") { retEl.innerHTML = ""; retEl.hidden = true; return; }
      var html = "";
      for (var c = 2; c <= schedule.cycles.length; c++) {
        html += '<label>Retraso C' + c + ' (días) <input type="number" min="0" data-delay="' + c + '" value="' +
          esc(state.delays[c] === undefined ? "" : state.delays[c]) + '"></label> ';
      }
      retEl.innerHTML = html;
      retEl.hidden = !html;
    }

    function build() {
      var r = regimen();
      if (!r) return null;
      var start = validIso(iniEl.value) ? iniEl.value : null;
      if (!start) return { r: r, schedule: null };
      return { r: r, schedule: RxEngine.buildSchedule(r, { start: start, n: cicEl.value, delays: state.delays }) };
    }

    function paint(rebuildDelayInputs) {
      var b = build();
      if (!b) { mesesEl.innerHTML = ""; avisosEl.innerHTML = ""; return; }
      if (!b.schedule) {
        avisosEl.innerHTML = '<p class="aviso">Indique una fecha de inicio válida.</p>';
        mesesEl.innerHTML = "";
        return;
      }
      if (rebuildDelayInputs) rebuildDelays(b.schedule);
      avisosEl.innerHTML = renderAvisos(b.r, b.schedule);
      mesesEl.innerHTML = renderMonths(b.schedule);
    }

    function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }

    function imprimir() {
      var b = build();
      if (!b || !b.schedule) {
        avisosEl.innerHTML = '<p class="aviso">Indique una fecha de inicio válida.</p>';
        return;
      }
      limpiarHoja();
      var host = document.getElementById("hojaPaciente");
      if (!host || !window.RxSheet) return;
      host.innerHTML = window.RxSheet.buildSheetHTML(b.schedule, b.r, {
        paciente: root.querySelector("#cal_paciente").value.trim(),
        profesional: { nombre: val("pharm_name"), centro: val("center"), contacto: val("contact"), fecha: val("date") }
      });
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

    selEl.addEventListener("change", function () { resetForRegimen(); paint(true); });
    function onFilter() {
      if (refilter()) resetForRegimen();
      paint(true);
    }
    buscarEl.addEventListener("input", onFilter);
    areaEl.addEventListener("change", onFilter);
    iniEl.addEventListener("change", function () { paint(false); });
    iniEl.addEventListener("input", function () { paint(false); });
    cicEl.addEventListener("input", function () { paint(true); });
    cicEl.addEventListener("change", function () { paint(true); });
    retEl.addEventListener("input", function (e) {
      var t = e.target;
      if (!t || !t.getAttribute || !t.getAttribute("data-delay")) return;
      state.delays[t.getAttribute("data-delay")] = t.value;
      paint(false);
    });

    iniEl.value = state.start;
    refilter();
    if (selEl.options.length) { selEl.selectedIndex = 0; resetForRegimen(); }
    paint(true);
  }

  window.RxCalendar = { mount: mount, renderMonths: renderMonths, conflicts: conflicts };

  function auto() {
    var root = document.getElementById("calendarioRoot");
    if (root) mount(root);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", auto);
  else auto();
})();

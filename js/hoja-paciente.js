(function (root) {
  "use strict";

  // Hoja imprimible para el paciente. Todo texto de usuario o de pauta se escapa.
  // Blanco y negro: hospital = borde grueso + texto HOSPITAL; fármaco y lugar siempre como texto.

  var WD = ["lun.", "mar.", "mié.", "jue.", "vie.", "sáb.", "dom."];
  var WD_LARGO = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  var MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  var MES_LARGO = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto",
    "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  var CAB = ["L", "M", "X", "J", "V", "S", "D"];
  var LUGAR = { hospital: "hospital", casa: "casa", casa_inyeccion: "casa (inyección)" };

  function esc(s) {
    return String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function eng() { return root.RxEngine || (typeof require === "function" ? require("./schedule-engine.js") : null); }
  var BANNER = "ESQUEMA PENDIENTE DE VALIDACIÓN — NO ENTREGAR AL PACIENTE";
  function lugarTxt(l) { return LUGAR[l] || String(l || ""); }

  function fmtLong(iso) {
    var E = eng();
    return WD_LARGO[E.isoDow(iso)] + " " + Number(iso.slice(8)) + " de " + MES[Number(iso.slice(5, 7)) - 1] + " " + iso.slice(0, 4);
  }

  function sortedEvents(schedule) {
    return schedule.events.slice().sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
  }

  function groupByDate(events) {
    var map = {}, order = [];
    events.forEach(function (e) {
      if (!map[e.date]) { map[e.date] = []; order.push(e.date); }
      map[e.date].push(e);
    });
    return { map: map, dates: order };
  }

  function hospitalTable(g) {
    var rows = "";
    g.dates.forEach(function (d) {
      var hs = g.map[d].filter(function (e) { return e.lugar === "hospital"; });
      if (!hs.length) return;
      rows += "<tr><td>" + esc(fmtLong(d)) + "</td><td>" +
        hs.map(function (e) { return esc(e.farmaco); }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(", ") +
        "</td></tr>";
    });
    if (!rows) return "<p>No hay visitas al hospital en este calendario.</p>";
    return '<table class="hoja-tabla"><thead><tr><th>Día</th><th>Medicación en el hospital</th></tr></thead><tbody>' + rows + "</tbody></table>";
  }

  // Días enteros ordenados -> texto compacto: "1–21", "1, 8, 15, 22".
  function fmtDays(days) {
    var out = [], i = 0;
    while (i < days.length) {
      var j = i;
      while (j + 1 < days.length && days[j + 1] === days[j] + 1) j++;
      if (j - i >= 2) out.push(days[i] + "–" + days[j]);
      else for (var k = i; k <= j; k++) out.push(String(days[k]));
      i = j + 1;
    }
    return out.join(", ");
  }

  function fmtCycles(ns) {
    return fmtDays(ns.slice().sort(function (a, b) { return a - b; }));
  }

  function intervalText(regimen, farmaco) {
    var it = ((regimen && regimen.items) || []).filter(function (x) { return x.farmaco === farmaco; })[0];
    var n = it && Number(it.cada_dias);
    return n > 0 ? "Cada " + n + " días (ver calendario)" : "Según el calendario";
  }

  function homeMeds(events, regimen) {
    var groups = {}, order = [], rows = "";
    var intervalo = regimen && regimen.tipo === "intervalo";
    events.forEach(function (e) {
      if (e.lugar === "hospital") return;
      var gk = [e.farmaco, e.dosis, e.veces, e.lugar].join("|");
      if (!groups[gk]) { groups[gk] = { e: e, byCycle: {}, cycleOrder: [] }; order.push(gk); }
      var G = groups[gk], c = String(e.cycle);
      if (!G.byCycle[c]) { G.byCycle[c] = []; G.cycleOrder.push(c); }
      if (G.byCycle[c].indexOf(e.day) === -1) G.byCycle[c].push(e.day);
    });
    order.forEach(function (gk) {
      var G = groups[gk], e = G.e, pats = {}, patOrder = [];
      if (intervalo) {
        pats[""] = { txt: intervalText(regimen, e.farmaco) }; patOrder.push("");
      } else {
        G.cycleOrder.forEach(function (c) {
          var days = G.byCycle[c].slice().sort(function (a, b) { return a - b; });
          var p = days.join(",");
          if (!pats[p]) { pats[p] = { days: days, cycles: [] }; patOrder.push(p); }
          pats[p].cycles.push(Number(c));
        });
      }
      patOrder.forEach(function (p) {
        var P = pats[p];
        var txt = intervalo ? P.txt : fmtDays(P.days) +
          (patOrder.length > 1 ? " (ciclos " + fmtCycles(P.cycles) + ")" : "");
        rows += "<tr><td>" + esc(e.farmaco) + "</td><td>" + esc(e.dosis) + "</td><td>" +
          esc(e.veces) + (Number(e.veces) === 1 ? " vez al día" : " veces al día") + "</td><td>" +
          esc(txt) + "</td><td>" + esc(lugarTxt(e.lugar)) + "</td></tr>";
      });
    });
    if (!rows) return "<p>No hay medicación para tomar en casa.</p>";
    return '<table class="hoja-tabla"><thead><tr><th>Medicamento</th><th>Dosis</th><th>Veces</th><th>Qué días</th><th>Dónde</th></tr></thead><tbody>' +
      rows + '</tbody></table><p class="hoja-nota-dias"><strong>Tome la medicación solo los días marcados en el calendario.</strong></p>';
  }

  function months(schedule, g, pendiente) {
    var E = eng();
    var first = null, last = schedule.end;
    g.dates.forEach(function (d) { if (first === null || d < first) first = d; if (d > last) last = d; });
    if (schedule.cycles.length && (first === null || schedule.cycles[0].start < first)) first = schedule.cycles[0].start;
    if (first === null) return "";
    var starts = {};
    schedule.cycles.forEach(function (c) { starts[c.start] = c; });
    var y = +first.slice(0, 4), m = +first.slice(5, 7), yE = +last.slice(0, 4), mE = +last.slice(5, 7);
    var out = "";
    while (y < yE || (y === yE && m <= mE)) {
      var firstIso = y + "-" + pad(m) + "-01";
      var days = new Date(Date.UTC(y, m, 0)).getUTCDate();
      out += '<section class="hoja-mes"><h3>' + MES_LARGO[m - 1] + " " + y + "</h3>" +
        (pendiente ? '<p class="aviso-pendiente-mes">' + BANNER + "</p>" : "") + '<div class="hoja-grid">';
      CAB.forEach(function (c) { out += '<div class="hoja-cab">' + c + "</div>"; });
      for (var i = 0; i < E.isoDow(firstIso); i++) out += '<div class="hoja-vacio"></div>';
      for (var d = 1; d <= days; d++) {
        var iso = y + "-" + pad(m) + "-" + pad(d);
        var evs = g.map[iso] || [];
        var hosp = evs.some(function (e) { return e.lugar === "hospital"; });
        out += '<div class="hoja-dia' + (hosp ? " hoja-dia-hospital" : "") + '" data-date="' + iso + '"><b class="hoja-num">' + d + "</b>";
        if (starts[iso]) out += '<span class="hoja-ciclo">Ciclo ' + esc(starts[iso].n) + "</span>";
        if (hosp) out += '<span class="hoja-hosp">HOSPITAL</span>';
        evs.forEach(function (e) {
          out += '<span class="hoja-med">' + esc(e.abrev || e.farmaco) + " (" + esc(lugarTxt(e.lugar)) + ")</span>";
        });
        out += "</div>";
      }
      out += "</div></section>";
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return out;
  }

  var MAX_PROX = 8;
  function hoyLocal() {
    var t = new Date();
    return t.getFullYear() + "-" + pad(t.getMonth() + 1) + "-" + pad(t.getDate());
  }
  function validIso(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ""); }

  // Próximas 8 administraciones: desde el inicio, o desde hoy (incluido) si la pauta ya empezó.
  // hoy se inyecta por ctx.hoy; sin él, fecha local del navegador.
  function proximas(events, first, hoy) {
    var desde = first && first > hoy ? first : hoy;
    var list = events.filter(function (e) { return e.date >= desde; }).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      var x = String(a.farmaco), y = String(b.farmaco);
      return x < y ? -1 : x > y ? 1 : 0;
    }).slice(0, MAX_PROX);
    var out = '<section class="hoja-proximas"><h2>Sus próximas administraciones</h2>';
    if (!list.length) return out + "<p>0 administraciones pendientes a partir de la fecha de hoy.</p></section>";
    out += '<table class="hoja-tabla hoja-tabla-prox"><thead><tr><th>Día</th><th>Medicamento</th><th>Dosis</th><th>Dónde</th></tr></thead><tbody>';
    list.forEach(function (e) {
      var hosp = e.lugar === "hospital";
      var donde = hosp ? "<strong>HOSPITAL</strong>" : e.lugar === "casa" ? "En casa" : "En casa" + (e.lugar === "casa_inyeccion" ? " (inyección)" : e.lugar ? " (" + esc(e.lugar) + ")" : "");
      out += '<tr class="hoja-prox' + (hosp ? " hoja-prox-hospital" : "") + '"><td>' + esc(fmtLong(e.date)) + "</td><td>" +
        esc(e.farmaco) + "</td><td>" + esc(e.dosis) + (Number(e.veces) > 1 ? " (" + esc(e.veces) + " veces al día)" : "") +
        "</td><td>" + donde + "</td></tr>";
    });
    return out + "</tbody></table></section>";
  }

  function contactBlock(p) {
    p = p || {};
    var parts = [];
    if (p.nombre) parts.push("<p><strong>Farmacéutico/a:</strong> " + esc(p.nombre) + "</p>");
    if (p.centro) parts.push("<p><strong>Servicio/centro:</strong> " + esc(p.centro) + "</p>");
    if (p.contacto) parts.push("<p><strong>Contacto:</strong> " + esc(p.contacto) + "</p>");
    if (p.fecha) parts.push("<p><strong>Fecha:</strong> " + esc(p.fecha) + "</p>");
    if (!parts.length) return "";
    return '<section class="hoja-contacto"><h2>Contacto</h2>' + parts.join("") + "</section>";
  }

  function buildSheetHTML(schedule, regimen, ctx) {
    ctx = ctx || {};
    var events = sortedEvents(schedule);
    var g = groupByDate(events);
    var first = g.dates.length ? g.dates[0] : (schedule.cycles[0] && schedule.cycles[0].start) || "";
    var nCiclos = schedule.cycles.length;
    var html = '<article class="hoja">';
    var pendiente = regimen.estado !== "validado"; // fail-safe: solo "validado" exacto omite el aviso
    if (pendiente) {
      html += '<p class="aviso-pendiente">' + BANNER + "</p>";
    }
    html += "<h1>Calendario de tratamiento</h1>";
    if (ctx.paciente) html += '<p class="hoja-paciente"><strong>Paciente:</strong> ' + esc(ctx.paciente) + "</p>";
    html += '<p class="hoja-resumen"><strong>Esquema:</strong> ' + esc(regimen.nombre) +
      (regimen.linea ? " · " + esc(regimen.linea) : "") +
      (first ? " · <strong>Inicio:</strong> " + esc(fmtLong(first)) : "") +
      (nCiclos ? " · <strong>Ciclos:</strong> " + nCiclos : " · <strong>Dosis:</strong> " + g.dates.length) + "</p>";
    html += proximas(events, first, validIso(ctx.hoy) ? ctx.hoy : hoyLocal());
    html += "<h2>Días que tiene que venir al hospital</h2>" + hospitalTable(g);
    html += "<h2>Medicación en casa</h2>" + homeMeds(events, regimen);
    html += '<h2>Calendario mensual</h2><div class="hoja-meses">' + months(schedule, g, pendiente) + "</div>";
    html += contactBlock(ctx.profesional);
    html += '<p class="hoja-pie">Este informe no sustituye las indicaciones de su farmacéutico o médico.</p>';
    return html + "</article>";
  }

  var api = { buildSheetHTML: buildSheetHTML };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.RxSheet = api;
})(typeof window !== "undefined" ? window : globalThis);

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

  function homeMeds(events) {
    var seen = {}, rows = "";
    events.forEach(function (e) {
      if (e.lugar === "hospital") return;
      var k = [e.farmaco, e.dosis, e.veces, e.lugar].join("|");
      if (seen[k]) return;
      seen[k] = true;
      rows += "<tr><td>" + esc(e.farmaco) + "</td><td>" + esc(e.dosis) + "</td><td>" +
        esc(e.veces) + (Number(e.veces) === 1 ? " vez al día" : " veces al día") + "</td><td>" + esc(lugarTxt(e.lugar)) + "</td></tr>";
    });
    if (!rows) return "<p>No hay medicación para tomar en casa.</p>";
    return '<table class="hoja-tabla"><thead><tr><th>Medicamento</th><th>Dosis</th><th>Veces</th><th>Dónde</th></tr></thead><tbody>' + rows + "</tbody></table>";
  }

  function months(schedule, g) {
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
      out += '<section class="hoja-mes"><h3>' + MES_LARGO[m - 1] + " " + y + '</h3><div class="hoja-grid">';
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
    if (regimen.estado === "pendiente") {
      html += '<p class="aviso-pendiente">ESQUEMA PENDIENTE DE VALIDACIÓN — NO ENTREGAR AL PACIENTE</p>';
    }
    html += "<h1>Calendario de tratamiento</h1>";
    if (ctx.paciente) html += '<p class="hoja-paciente"><strong>Paciente:</strong> ' + esc(ctx.paciente) + "</p>";
    html += '<p class="hoja-resumen"><strong>Esquema:</strong> ' + esc(regimen.nombre) +
      (regimen.linea ? " · " + esc(regimen.linea) : "") +
      (first ? " · <strong>Inicio:</strong> " + esc(fmtLong(first)) : "") +
      (nCiclos ? " · <strong>Ciclos:</strong> " + nCiclos : " · <strong>Dosis:</strong> " + g.dates.length) + "</p>";
    html += "<h2>Días que tiene que venir al hospital</h2>" + hospitalTable(g);
    html += "<h2>Medicación en casa</h2>" + homeMeds(events);
    html += '<h2>Calendario mensual</h2><div class="hoja-meses">' + months(schedule, g) + "</div>";
    html += contactBlock(ctx.profesional);
    return html + "</article>";
  }

  var api = { buildSheetHTML: buildSheetHTML };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.RxSheet = api;
})(typeof window !== "undefined" ? window : globalThis);

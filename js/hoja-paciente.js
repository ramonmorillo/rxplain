(function (root) {
  "use strict";

  // Hoja imprimible para el paciente (A4 vertical). Todo texto de usuario o de pauta se escapa.
  // Se pagina aquí, de forma determinista: cada <section class="hoja-pagina"> es una hoja A4 con
  // su cabecera, su aviso de validación (si procede) y su pie con el mensaje fijo. Las alturas de
  // las semanas del calendario se calculan en mm para que ningún mes se parta entre páginas.
  // Blanco y negro: hospital = borde grueso + palabra HOSPITAL; casa/inyección = texto; sin depender
  // de colores de fondo (la impresión de fondos suele estar desactivada).

  var WD_CORTO = ["lun.", "mar.", "mié.", "jue.", "vie.", "sáb.", "dom."];
  var WD_LARGO = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  var MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  var MES_LARGO = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto",
    "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  var CAB = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  var BANNER = "ESQUEMA PENDIENTE DE VALIDACIÓN — NO ENTREGAR AL PACIENTE";
  var MENSAJE = "Consulte con su farmacéutico ante cualquier cambio de día de administración.";
  var DESCARGO = "Este informe no sustituye las indicaciones de su farmacéutico o médico.";

  // ---- Medidas (mm). Deben coincidir con css/calendario.css (bloque "Hoja del paciente"). ----
  var M = {
    pagina: 276,      // alto útil de cada hoja (A4 297 − márgenes de 10 mm − 1 mm de holgura)
    cab: 13,          // cabecera de las páginas interiores
    abrev: 6.5,       // línea de abreviaturas bajo la cabecera
    banner: 11,       // aviso de validación (incluido el margen)
    pie: 13,          // pie con el mensaje fijo
    mesTitulo: 9,
    mesCab: 6,
    mesSep: 5,        // separación entre meses
    gap: 1.1,         // separación entre semanas
    celdaPad: 2.4,    // relleno vertical + bordes
    celdaNum: 5.4,    // línea del número del día
    celdaLinea: 4.15, // línea de texto de 10 pt
    filaMin: 10,
    filaMax: 30,
    chars: 12,        // caracteres de 10 pt por línea en una celda (estimación prudente)
    h2: 11,
    th: 8,
    tdLinea: 5.1,     // línea de 12 pt
    tdPad: 2.4,
    nota: 9,
    descargo: 9,
    bloqueSep: 5
  };

  function esc(s) {
    return String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function eng() { return root.RxEngine || (typeof require === "function" ? require("./schedule-engine.js") : null); }
  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }
  function mm(x) { return (Math.round(x * 10) / 10) + "mm"; }

  function fmtLong(iso) {
    return WD_LARGO[eng().isoDow(iso)] + " " + Number(iso.slice(8)) + " de " + MES[Number(iso.slice(5, 7)) - 1] + " " + iso.slice(0, 4);
  }
  function fmtCorto(iso) {
    return WD_CORTO[eng().isoDow(iso)] + " " + Number(iso.slice(8)) + " " + MES[Number(iso.slice(5, 7)) - 1] + " " + iso.slice(0, 4);
  }
  function fmtDMY(iso) { return iso.slice(8) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4); }
  function validIso(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ""); }
  function hoyLocal() {
    var t = new Date();
    return t.getFullYear() + "-" + pad(t.getMonth() + 1) + "-" + pad(t.getDate());
  }

  function esFinde(iso) { return eng().isoDow(iso) >= 5; }
  function festivo(iso) { var E = eng(); return E.holidayName ? E.holidayName(iso) : ""; }

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

  function lugarLargo(l) {
    return l === "hospital" ? "HOSPITAL" : l === "casa" ? "En casa" : l === "casa_inyeccion" ? "Inyección en casa" : "En casa (" + String(l || "") + ")";
  }
  function corto(e) { return e.abrev || e.farmaco; }

  // ---------------------------------------------------------------- iconos (SVG en línea, solo trazos)
  var ICONO = {
    calendario: '<svg class="hoja-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M8 14l2.5 2.5L16 12"/></svg>',
    info: '<svg class="hoja-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r=".6"/></svg>',
    telefono: '<svg class="hoja-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3.5h3.5l1.8 4.5-2.3 1.4a11 11 0 0 0 6.6 6.6l1.4-2.3 4.5 1.8V19a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3 5.5a2 2 0 0 1 2-2z"/></svg>'
  };

  // ---------------------------------------------------------------- medicación en casa ("Qué días")
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
    var s = ns.slice().sort(function (a, b) { return a - b; });
    return (s.length === 1 ? "ciclo " : "ciclos ") + fmtDays(s);
  }
  function intervalText(regimen, farmaco) {
    var it = ((regimen && regimen.items) || []).filter(function (x) { return x.farmaco === farmaco; })[0];
    var n = it && Number(it.cada_dias);
    return n > 0 ? "Cada " + n + " días (ver calendario)" : "Según el calendario";
  }
  function esPrefijo(a, b) {
    if (a.length > b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // Ciclo cortado por el final del calendario (p. ej. pauta indefinida "hasta" 31/12): su patrón de días
  // queda incompleto; si es el comienzo del patrón del ciclo anterior se fusiona con él.
  function cicloRecortado(schedule) {
    var cs = schedule.cycles || [];
    if (!cs.length) return null;
    var c = cs[cs.length - 1];
    return eng().isoAdd(c.start, c.len - 1) > schedule.end ? String(c.n) : null;
  }

  function homeRows(events, regimen, schedule) {
    var groups = {}, order = [], rows = [];
    var intervalo = regimen && regimen.tipo === "intervalo";
    var recortado = cicloRecortado(schedule);
    events.forEach(function (e) {
      if (e.lugar === "hospital") return;
      var gk = [e.farmaco, e.dosis, e.veces, e.lugar].join("|");
      if (!groups[gk]) { groups[gk] = { e: e, byCycle: {}, cycleOrder: [] }; order.push(gk); }
      var G = groups[gk], c = String(e.cycle);
      if (!G.byCycle[c]) { G.byCycle[c] = []; G.cycleOrder.push(c); }
      if (G.byCycle[c].indexOf(e.day) === -1) G.byCycle[c].push(e.day);
    });
    order.forEach(function (gk) {
      var G = groups[gk], e = G.e, pats = {}, patOrder = [], prev = null;
      if (intervalo) {
        pats[""] = { txt: intervalText(regimen, e.farmaco) }; patOrder.push("");
      } else {
        G.cycleOrder.forEach(function (c) {
          var days = G.byCycle[c].slice().sort(function (a, b) { return a - b; });
          var p = days.join(",");
          if (c === recortado && prev !== null && !pats[p] && esPrefijo(days, pats[prev].days)) p = prev;
          if (!pats[p]) { pats[p] = { days: days, cycles: [] }; patOrder.push(p); }
          pats[p].cycles.push(Number(c));
          prev = p;
        });
      }
      patOrder.forEach(function (p) {
        var P = pats[p];
        var txt = intervalo ? P.txt : fmtDays(P.days) + (patOrder.length > 1 ? " (" + fmtCycles(P.cycles) + ")" : "");
        rows.push({
          farmaco: e.farmaco, dosis: e.dosis,
          veces: e.veces + (Number(e.veces) === 1 ? " vez al día" : " veces al día"),
          dias: txt, donde: lugarLargo(e.lugar)
        });
      });
    });
    return rows;
  }

  // ---------------------------------------------------------------- visitas al hospital
  function hospitalVisits(g) {
    var out = [];
    g.dates.forEach(function (d) {
      var hs = g.map[d].filter(function (e) { return e.lugar === "hospital"; });
      if (!hs.length) return;
      out.push({ date: d, meds: uniq(hs.map(function (e) { return e.farmaco; })).join(", "), aviso: esFinde(d) || !!festivo(d) });
    });
    return out;
  }

  // ---------------------------------------------------------------- estimación de alturas
  function lineas(txt, chars) { return Math.max(1, Math.ceil(String(txt).length / chars)); }

  function celdaInfo(evs, iso) {
    var hosp = uniq(evs.filter(function (e) { return e.lugar === "hospital"; }).map(corto));
    var casa = uniq(evs.filter(function (e) { return e.lugar !== "hospital" && e.lugar !== "casa_inyeccion"; }).map(corto));
    var iny = uniq(evs.filter(function (e) { return e.lugar === "casa_inyeccion"; }).map(corto));
    var fest = festivo(iso);
    var n = 0;
    if (hosp.length) n += 1 + lineas(hosp.join(", "), M.chars);
    if (casa.length) n += lineas("Casa: " + casa.join(", "), M.chars);
    if (iny.length) n += lineas("Inyección: " + iny.join(", "), M.chars);
    if (fest && !hosp.length) n += 1;
    return { hosp: hosp, casa: casa, iny: iny, festivo: fest, lineas: n };
  }

  // ---------------------------------------------------------------- calendario mensual
  function monthModels(schedule, g) {
    var E = eng();
    var first = null, last = schedule.end;
    g.dates.forEach(function (d) { if (first === null || d < first) first = d; if (d > last) last = d; });
    if (schedule.cycles.length && (first === null || schedule.cycles[0].start < first)) first = schedule.cycles[0].start;
    if (first === null) return [];
    var starts = {};
    schedule.cycles.forEach(function (c) { starts[c.start] = c; });
    var y = +first.slice(0, 4), m = +first.slice(5, 7), yE = +last.slice(0, 4), mE = +last.slice(5, 7);
    var out = [];
    while (y < yE || (y === yE && m <= mE)) {
      var firstIso = y + "-" + pad(m) + "-01";
      var ndays = new Date(Date.UTC(y, m, 0)).getUTCDate();
      var cells = [], i;
      for (i = 0; i < E.isoDow(firstIso); i++) cells.push(null);
      for (var d = 1; d <= ndays; d++) {
        var iso = y + "-" + pad(m) + "-" + pad(d);
        var evs = g.map[iso] || [];
        cells.push({ iso: iso, d: d, evs: evs, info: celdaInfo(evs, iso), ciclo: starts[iso] || null, fuera: iso < first || iso > last });
      }
      while (cells.length % 7) cells.push(null);
      var weeks = [];
      for (i = 0; i < cells.length; i += 7) {
        var wk = cells.slice(i, i + 7), maxL = 0;
        wk.forEach(function (c) { if (c && c.info.lineas > maxL) maxL = c.info.lineas; });
        weeks.push({ cells: wk, h: Math.max(M.filaMin, M.celdaPad + M.celdaNum + maxL * M.celdaLinea) });
      }
      out.push({ y: y, m: m, weeks: weeks });
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return out;
  }

  function monthFixed(mo) { return M.mesTitulo + M.mesCab + mo.weeks.length * M.gap; }
  function monthRows(mo) { return mo.weeks.reduce(function (s, w) { return s + w.h; }, 0); }
  function groupHeight(group, scale) {
    return group.reduce(function (s, mo, i) { return s + monthFixed(mo) + monthRows(mo) * scale + (i ? M.mesSep : 0); }, 0);
  }

  // Meses por página: 3 si caben todos los grupos, si no 2, y si ni así, reparto voraz (1–3).
  function packMonths(months, budget) {
    function chunk(k) { var o = []; for (var i = 0; i < months.length; i += k) o.push(months.slice(i, i + k)); return o; }
    function fits(groups) { return groups.every(function (gr) { return groupHeight(gr, 1) <= budget; }); }
    var groups = null;
    if (months.length > 1 && fits(chunk(3))) groups = chunk(3);
    else if (fits(chunk(2))) groups = chunk(2);
    else {
      groups = [];
      var cur = [];
      months.forEach(function (mo) {
        if (cur.length && (cur.length === 3 || groupHeight(cur.concat([mo]), 1) > budget)) { groups.push(cur); cur = []; }
        cur.push(mo);
      });
      if (cur.length) groups.push(cur);
    }
    // Escala común: las semanas crecen para llenar las páginas, igual en todas (aspecto uniforme).
    var scale = 1.6;
    groups.forEach(function (gr) {
      if (gr.length < 2 && groups.length > 1) return; // un mes suelto no fija la escala de las demás
      var fixed = gr.reduce(function (s, mo, i) { return s + monthFixed(mo) + (i ? M.mesSep : 0); }, 0);
      var rows = gr.reduce(function (s, mo) { return s + monthRows(mo); }, 0);
      scale = Math.min(scale, (budget - fixed) / rows);
    });
    scale = Math.max(1, scale);
    return { groups: groups, scale: scale };
  }

  function cellHTML(c) {
    if (!c) return '<div class="hoja-vacio" aria-hidden="true"></div>';
    var I = c.info, hosp = I.hosp.length > 0;
    var aviso = hosp && (esFinde(c.iso) || I.festivo);
    var cls = "hoja-dia" + (hosp ? " hoja-dia-hospital" : "") + (esFinde(c.iso) ? " hoja-finde" : "") +
      (I.festivo ? " hoja-festivo" : "") + (c.fuera ? " hoja-fuera" : "");
    var h = '<div class="' + cls + '" data-date="' + c.iso + '"><div class="hoja-dia-top"><b class="hoja-num">' + c.d + "</b>";
    if (c.ciclo) h += '<span class="hoja-ciclo">Ciclo ' + esc(c.ciclo.n) + "</span>";
    h += "</div>";
    if (hosp) {
      h += '<span class="hoja-hosp">' + (aviso ? '<span class="hoja-alerta">⚠</span> ' : "") + "HOSPITAL</span>" +
        '<span class="hoja-med hoja-med-hosp">' + esc(I.hosp.join(", ")) + "</span>";
    }
    if (I.casa.length) h += '<span class="hoja-med"><em>Casa:</em> ' + esc(I.casa.join(", ")) + "</span>";
    if (I.iny.length) h += '<span class="hoja-med"><em>Inyección:</em> ' + esc(I.iny.join(", ")) + "</span>";
    if (I.festivo && !hosp) h += '<span class="hoja-fest">Festivo</span>';
    return h + "</div>";
  }

  function monthHTML(mo, scale) {
    var h = '<section class="hoja-mes"><h3 class="hoja-mes-titulo">' + MES_LARGO[mo.m - 1] + ' <span>' + mo.y + "</span></h3>" +
      '<div class="hoja-semana hoja-semana-cab">';
    CAB.forEach(function (c, i) { h += '<div class="hoja-cab' + (i >= 5 ? " hoja-cab-finde" : "") + '">' + c + "</div>"; });
    h += "</div>";
    mo.weeks.forEach(function (w) {
      h += '<div class="hoja-semana" style="--h:' + mm(Math.min(M.filaMax, w.h * scale)) + '">' + w.cells.map(cellHTML).join("") + "</div>";
    });
    return h + "</section>";
  }

  // ---------------------------------------------------------------- portada
  function proximas(events, first, hoy, presupuesto) {
    var desde = first && first > hoy ? first : hoy;
    var list = events.filter(function (e) { return e.date >= desde; }).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      var x = String(a.farmaco), y = String(b.farmaco);
      return x < y ? -1 : x > y ? 1 : 0;
    }).slice(0, MAX_PROX);
    var out = '<section class="hoja-proximas"><h2 class="hoja-h2">Sus próximas administraciones</h2>';
    if (!list.length) return out + '<p class="hoja-vacia">0 administraciones pendientes a partir de la fecha de hoy.</p></section>';
    var g = groupByDate(list);
    // La portada es una sola hoja: si las tarjetas no caben en el espacio estimado, se muestran menos fechas.
    if (presupuesto) {
      var alto = function (d) {
        var n = g.map[d].reduce(function (t, e) { return t + lineas(e.farmaco + " " + e.dosis + (e.etiqueta ? " " + e.etiqueta : ""), 30); }, 0);
        return Math.max(15.5, 5 + n * 4.4);
      };
      var usado = 0, k = 0;
      for (var i = 0; i < g.dates.length; i += 2) {
        var fila = Math.max(alto(g.dates[i]), g.dates[i + 1] ? alto(g.dates[i + 1]) : 0) + 2.2;
        if (k >= 2 && usado + fila > presupuesto) break;
        usado += fila; k = Math.min(g.dates.length, i + 2);
      }
      g.dates = g.dates.slice(0, k);
    }
    out += '<ol class="hoja-tarjetas">';
    g.dates.forEach(function (d) {
      var evs = g.map[d], hosp = evs.some(function (e) { return e.lugar === "hospital"; });
      var aviso = hosp && (esFinde(d) || festivo(d));
      var lugares = uniq(evs.map(function (e) { return e.lugar; }));
      var donde = hosp ? (aviso ? "⚠ " : "") + "HOSPITAL" : lugares.length === 1 ? lugarLargo(lugares[0]) : "En casa";
      out += '<li class="hoja-prox' + (hosp ? " hoja-prox-hospital" : "") + '" data-date="' + d + '">' +
        '<p class="hoja-prox-fecha"><span class="hoja-prox-dow">' + WD_LARGO[eng().isoDow(d)] + "</span>" +
        '<span class="hoja-prox-dia">' + Number(d.slice(8)) + "</span>" +
        '<span class="hoja-prox-mes">' + MES[Number(d.slice(5, 7)) - 1] + " " + d.slice(0, 4) + "</span></p>" +
        '<div class="hoja-prox-info"><p class="hoja-prox-donde">' + esc(donde) + '</p><ul class="hoja-prox-meds">';
      evs.forEach(function (e) {
        var otro = (hosp && e.lugar !== "hospital") || (!hosp && lugares.length > 1);
        out += '<li class="hoja-prox-med"><b>' + esc(e.farmaco) + "</b> " + esc(e.dosis) +
          (Number(e.veces) > 1 ? " (" + esc(e.veces) + " veces al día)" : "") +
          (e.etiqueta ? " " + esc(e.etiqueta) : "") +
          (otro ? ' <span class="hoja-prox-lugar">· ' + esc(lugarLargo(e.lugar).toLowerCase()) + "</span>" : "") + "</li>";
      });
      out += "</ul></div></li>";
    });
    return out + "</ol></section>";
  }
  var MAX_PROX = 8;

  function abreviaturas(events) {
    var seen = {}, out = [];
    events.forEach(function (e) {
      if (e.abrev && e.abrev !== e.farmaco && !seen[e.abrev]) { seen[e.abrev] = 1; out.push([e.abrev, e.farmaco]); }
    });
    return out;
  }
  function abrevHTML(ab) {
    return ab.map(function (a) { return "<b>" + esc(a[0]) + "</b> = " + esc(a[1]); }).join(" · ");
  }

  function leyenda(events, ab, conCiclos) {
    var lug = {};
    events.forEach(function (e) { lug[e.lugar] = 1; });
    var items = [];
    items.push('<li><span class="hoja-ley-muestra hoja-ley-hosp">HOSPITAL</span><span>Venga al hospital ese día.</span></li>');
    if (lug.casa || !events.length) items.push('<li><span class="hoja-ley-muestra"><em>Casa:</em></span><span>Tómelo en casa.</span></li>');
    if (lug.casa_inyeccion) items.push('<li><span class="hoja-ley-muestra"><em>Inyección:</em></span><span>Inyección que se pone en casa.</span></li>');
    if (conCiclos) items.push('<li><span class="hoja-ley-muestra hoja-ley-ciclo">Ciclo 2</span><span>Primer día de cada ciclo.</span></li>');
    items.push('<li><span class="hoja-ley-muestra">⚠ Festivo</span><span>Festivo o fin de semana: confirme la cita.</span></li>');
    return '<section class="hoja-leyenda"><h2 class="hoja-h2">Cómo leer el calendario</h2><ul class="hoja-ley-lista">' + items.join("") + "</ul>" +
      (ab.length ? '<p class="hoja-abrev"><span>Abreviaturas:</span> ' + abrevHTML(ab) + "</p>" : "") + "</section>";
  }

  function contactBlock(p) {
    p = p || {};
    var rows = [];
    if (p.centro) rows.push(["Hospital", esc(p.centro), ""]);
    if (p.nombre) rows.push(["Farmacéutico/a responsable", esc(p.nombre), ""]);
    if (p.contacto) rows.push(["Teléfono", esc(p.contacto), " hoja-tel"]);
    if (p.fecha) rows.push(["Fecha", esc(p.fecha), ""]);
    if (!rows.length) return "";
    return '<section class="hoja-contacto">' + ICONO.telefono + '<div><h2 class="hoja-contacto-titulo">Si tiene dudas, contacte con nosotros</h2><dl style="--n:' + rows.length + '">' +
      rows.map(function (r) { return '<div class="hoja-contacto-fila' + r[2] + '"><dt>' + r[0] + "</dt><dd>" + r[1] + "</dd></div>"; }).join("") +
      "</dl></div></section>";
  }

  function portada(o) {
    var r = o.regimen, ctx = o.ctx, p = ctx.profesional || {};
    var h = '<header class="hoja-portada-cab"><div class="hoja-portada-id">' +
      '<p class="hoja-kicker">Servicio de Farmacia Hospitalaria</p>' +
      (p.centro ? '<p class="hoja-hospital">' + esc(p.centro) + "</p>" : "") +
      "</div>" + ICONO.calendario + "</header>";
    h += '<h1 class="hoja-titulo">Su calendario de tratamiento</h1>';
    var datos = [];
    if (ctx.paciente) datos.push(["Paciente", esc(ctx.paciente), " hoja-dato-ancho"]);
    datos.push(["Tratamiento", esc(r.nombre) + (r.linea ? ' <span class="hoja-linea">' + esc(r.linea) + "</span>" : ""), ""]);
    if (o.first) datos.push(["Fecha de inicio", esc(fmtLong(o.first)), ""]);
    datos.push(o.nCiclos ? ["Ciclos", String(o.nCiclos), ""] : ["Días con dosis", String(o.nDias), ""]);
    h += '<dl class="hoja-datos">' + datos.map(function (d) {
      return '<div class="hoja-dato' + d[2] + '"><dt>' + d[0] + "</dt><dd>" + d[1] + "</dd></div>";
    }).join("") + "</dl>";
    h += '<div class="hoja-mensaje" role="note">' + ICONO.info + "<p>" + MENSAJE + "</p></div>";
    if (ctx.indefinida) {
      h += '<p class="hoja-indefinida"><strong>Pauta indefinida:</strong> se continúa hasta que su médico indique otra cosa.' +
        (validIso(ctx.hasta) ? " Este calendario llega hasta el " + esc(fmtDMY(ctx.hasta)) + "." : "") + "</p>";
      if (o.schedule.recortadoHasta && validIso(o.schedule.recortadoHasta)) {
        h += '<p class="hoja-recorte"><strong>Calendario recortado hasta ' + esc(fmtDMY(o.schedule.recortadoHasta)) + ".</strong></p>";
      }
    }
    // Espacio para las tarjetas (mm), calibrado con Chrome: portada completa (aviso, nota de pauta
    // indefinida y contacto) deja ~64 mm; se suma lo que falte y se resta el aviso de recorte.
    var pres = 64 + (o.pendiente ? 0 : 11) + (ctx.indefinida ? 0 : 10) + (contactBlock(p) ? 0 : 27) -
      (ctx.indefinida && o.schedule.recortadoHasta ? 9 : 0) + (ctx.paciente ? 0 : 12);
    h += proximas(o.events, o.first, validIso(ctx.hoy) ? ctx.hoy : hoyLocal(), pres);
    h += '<div class="hoja-portada-pie">' + leyenda(o.events, o.ab, o.nCiclos > 0) + contactBlock(p) + "</div>";
    return h;
  }

  // ---------------------------------------------------------------- resumen final
  function visitsTable(list) {
    if (!list.length) return "";
    return '<table class="hoja-tabla hoja-tabla-visitas"><thead><tr><th>Día</th><th>Medicación en el hospital</th></tr></thead><tbody>' +
      list.map(function (v) {
        return '<tr data-date="' + v.date + '"><td class="hoja-td-fecha">' + (v.aviso ? "⚠ " : "") + esc(fmtCorto(v.date)) + "</td><td>" + esc(v.meds) + "</td></tr>";
      }).join("") + "</tbody></table>";
  }
  function visitH(v) { return M.tdPad + M.tdLinea * Math.max(lineas(v.meds, 22), 1); }
  function colsH(list) {
    if (mismaMed(list)) return rejillaH(list.length);
    var half = Math.ceil(list.length / 2), a = 0, b = 0;
    list.forEach(function (v, i) { if (i < half) a += visitH(v); else b += visitH(v); });
    return M.th + Math.max(a, b);
  }
  // Si todas las visitas llevan la misma medicación, basta una línea con ella y una rejilla de fechas.
  function mismaMed(list) { return list.length > 0 && list.every(function (v) { return v.meds === list[0].meds; }); }
  var REJ_COLS = 4, REJ_FILA = 7.6, REJ_CAP = 10;
  function rejillaH(n) { return REJ_CAP + Math.ceil(n / REJ_COLS) * REJ_FILA; }
  function visitsBlock(list, cont) {
    if (mismaMed(list)) {
      var filas = Math.ceil(list.length / REJ_COLS), cols = [];
      for (var c = 0; c < REJ_COLS; c++) cols.push(list.slice(c * filas, (c + 1) * filas));
      return '<section class="hoja-visitas"><h2 class="hoja-h2">Días que tiene que venir al hospital' + (cont ? " (continuación)" : "") + "</h2>" +
        '<p class="hoja-visitas-med">En cada visita: <b>' + esc(list[0].meds) + "</b></p>" +
        '<ol class="hoja-fechas" style="--filas:' + filas + '">' + list.map(function (v) {
          return '<li data-date="' + v.date + '">' + (v.aviso ? "⚠ " : "") + esc(fmtCorto(v.date)) + "</li>";
        }).join("") + "</ol></section>";
    }
    var half = Math.ceil(list.length / 2);
    return '<section class="hoja-visitas"><h2 class="hoja-h2">Días que tiene que venir al hospital' + (cont ? " (continuación)" : "") + "</h2>" +
      '<div class="hoja-visitas-cols">' + visitsTable(list.slice(0, half)) + visitsTable(list.slice(half)) + "</div></section>";
  }
  function medRowH(r) {
    var n = Math.max(lineas(r.farmaco, 24), lineas(r.dosis, 13), lineas(r.veces, 13), lineas(r.dias, 18), lineas(r.donde, 11));
    return M.tdPad + n * M.tdLinea;
  }
  function medsBlock(rows, cont, last) {
    var h = '<section class="hoja-casa"><h2 class="hoja-h2">Medicación en casa' + (cont ? " (continuación)" : "") + "</h2>";
    if (!rows.length) return h + '<p class="hoja-vacia">No hay medicación para tomar en casa.</p></section>';
    h += '<table class="hoja-tabla hoja-tabla-casa"><thead><tr><th>Medicamento</th><th>Dosis</th><th>Veces al día</th><th>Qué días</th><th>Dónde</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return "<tr><td><b>" + esc(r.farmaco) + "</b></td><td>" + esc(r.dosis) + "</td><td>" + esc(r.veces) + "</td><td>" + esc(r.dias) + "</td><td>" + esc(r.donde) + "</td></tr>";
      }).join("") + "</tbody></table>";
    if (last) h += '<p class="hoja-nota-dias"><strong>Tome la medicación solo los días marcados en el calendario.</strong></p>';
    return h + "</section>";
  }

  // Devuelve una lista de páginas de resumen [{html, h}]; la última lleva el descargo.
  function summaryPages(visits, meds, budget) {
    var pages = [];
    var noVisits = '<section class="hoja-visitas"><h2 class="hoja-h2">Días que tiene que venir al hospital</h2><p class="hoja-vacia">No hay visitas al hospital en este calendario.</p></section>';
    var visitsAll = visits.length ? M.h2 + colsH(visits) : M.h2 + 10;
    var medsH = M.h2 + (meds.length ? M.th + meds.reduce(function (s, r) { return s + medRowH(r); }, 0) + M.nota : 10);
    var tail = M.descargo;
    var desc = '<p class="hoja-descargo">' + DESCARGO + "</p>";
    if (visitsAll + M.bloqueSep + medsH + tail <= budget) {
      return [{ html: (visits.length ? visitsBlock(visits, false) : noVisits) + medsBlock(meds, false, true) + desc, h: visitsAll + M.bloqueSep + medsH + tail }];
    }
    // Visitas repartidas en tantas páginas como hagan falta.
    var rest = visits.slice(), cont = false;
    if (!rest.length) pages.push({ html: noVisits, h: M.h2 + 10 });
    while (rest.length) {
      var k = rest.length;
      while (k > 1 && M.h2 + colsH(rest.slice(0, k)) > budget) k--;
      var take = rest.slice(0, k);
      rest = rest.slice(k);
      pages.push({ html: visitsBlock(take, cont), h: M.h2 + colsH(take) });
      cont = true;
    }
    // Medicación en casa: en la última página si cabe; si no, en páginas propias.
    var lastP = pages[pages.length - 1];
    if (lastP.h + M.bloqueSep + medsH + tail <= budget) {
      lastP.html += medsBlock(meds, false, true) + desc;
      lastP.h += M.bloqueSep + medsH + tail;
      return pages;
    }
    var mrest = meds.slice(), mcont = false;
    if (!mrest.length) { pages.push({ html: medsBlock([], false, true) + desc, h: medsH + tail }); return pages; }
    while (mrest.length) {
      var used = M.h2 + M.th + M.nota + tail, j = 0;
      while (j < mrest.length && used + medRowH(mrest[j]) <= budget) { used += medRowH(mrest[j]); j++; }
      if (j === 0) j = 1;
      var part = mrest.slice(0, j);
      mrest = mrest.slice(j);
      pages.push({ html: medsBlock(part, mcont, !mrest.length) + (mrest.length ? "" : desc), h: used });
      mcont = true;
    }
    return pages;
  }

  // ---------------------------------------------------------------- montaje
  function buildSheetHTML(schedule, regimen, ctx) {
    ctx = ctx || {};
    var p = ctx.profesional || {};
    var events = sortedEvents(schedule);
    var g = groupByDate(events);
    var first = g.dates.length ? g.dates[0] : (schedule.cycles[0] && schedule.cycles[0].start) || "";
    var pendiente = regimen.estado !== "validado"; // fail-safe: solo "validado" exacto omite el aviso
    var ab = abreviaturas(events);

    var cuerpo = M.pagina - M.cab - M.pie - (pendiente ? M.banner : 0);
    var budgetMeses = cuerpo - (ab.length ? M.abrev : 0);

    var months = monthModels(schedule, g);
    var pack = months.length ? packMonths(months, budgetMeses) : { groups: [], scale: 1 };
    var pages = [{ kind: "portada", html: portada({ regimen: regimen, ctx: ctx, events: events, first: first, nCiclos: schedule.cycles.length, nDias: g.dates.length, schedule: schedule, ab: ab, pendiente: pendiente }) }];
    pack.groups.forEach(function (gr) {
      pages.push({
        kind: "meses",
        html: '<div class="hoja-meses">' + gr.map(function (mo) { return monthHTML(mo, pack.scale); }).join("") + "</div>",
        h: gr.reduce(function (s, mo, i) {
          return s + monthFixed(mo) + mo.weeks.reduce(function (t, w) { return t + Math.min(M.filaMax, w.h * pack.scale); }, 0) + (i ? M.mesSep : 0);
        }, 0),
        abrev: ab.length > 0
      });
    });
    var sums = summaryPages(hospitalVisits(g), homeRows(events, regimen, schedule), cuerpo);
    var lastMes = pages[pages.length - 1];
    if (lastMes.kind === "meses" && sums.length === 1 && lastMes.h + (ab.length ? M.abrev : 0) + M.bloqueSep + sums[0].h <= cuerpo) {
      lastMes.html += '<div class="hoja-resumen">' + sums[0].html + "</div>";
    } else {
      sums.forEach(function (s) { pages.push({ kind: "resumen", html: '<div class="hoja-resumen">' + s.html + "</div>" }); });
    }

    var total = pages.length;
    var cabTxt = p.centro ? esc(p.centro) : "Su calendario de tratamiento";
    var quien = (ctx.paciente ? esc(ctx.paciente) + " · " : "") + esc(regimen.nombre);
    var html = '<article class="hoja" data-paginas="' + total + '">';
    pages.forEach(function (pg, i) {
      html += '<section class="hoja-pagina hoja-pagina-' + pg.kind + '" data-pagina="' + (i + 1) + '">';
      var banner = pendiente ? '<p class="aviso-pendiente hoja-banner"><span aria-hidden="true">⚠</span> ' + BANNER + "</p>" : "";
      if (pg.kind === "portada") html += banner;
      else {
        html += '<header class="hoja-cab-pag"><p class="hoja-cab-hosp">' + cabTxt + '</p><p class="hoja-cab-quien">' + quien + "</p></header>" + banner;
        if (pg.kind === "meses" && ab.length) html += '<p class="hoja-abrev hoja-abrev-pag"><span>Abreviaturas:</span> ' + abrevHTML(ab) + "</p>";
      }
      html += '<div class="hoja-cuerpo">' + pg.html + "</div>";
      html += '<footer class="hoja-pie-pag"><p class="hoja-pie-msg">' + MENSAJE + '</p><p class="hoja-pie-num">Hoja ' + (i + 1) + " de " + total + "</p></footer>";
      html += "</section>";
    });
    return html + "</article>";
  }

  var api = { buildSheetHTML: buildSheetHTML, MENSAJE: MENSAJE, BANNER: BANNER };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.RxSheet = api;
})(typeof window !== "undefined" ? window : globalThis);

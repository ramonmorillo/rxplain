(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RxEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DAY_MS = 86400000;

  function toUtc(iso) {
    var p = iso.split("-");
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }

  function fromUtc(ms) {
    var d = new Date(ms);
    var m = d.getUTCMonth() + 1;
    var day = d.getUTCDate();
    return d.getUTCFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  function isoAdd(iso, n) {
    return fromUtc(toUtc(iso) + n * DAY_MS);
  }

  // 0 = lunes ... 6 = domingo
  function isoDow(iso) {
    return (new Date(toUtc(iso)).getUTCDay() + 6) % 7;
  }

  function isoDiff(a, b) {
    return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
  }

  var FIXED = {
    "01-01": "Año Nuevo",
    "01-06": "Reyes",
    "02-28": "Día de Andalucía",
    "05-01": "Día del Trabajo",
    "08-15": "Asunción",
    "10-12": "Fiesta Nacional",
    "11-01": "Todos los Santos",
    "12-06": "Constitución",
    "12-08": "Inmaculada",
    "12-25": "Navidad"
  };

  // Domingo de Pascua (algoritmo gregoriano anónimo)
  function easterSunday(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100;
    var d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var month = Math.floor((h + l - 7 * m + 114) / 31);
    var day = ((h + l - 7 * m + 114) % 31) + 1;
    return fromUtc(Date.UTC(y, month - 1, day));
  }

  function holidayName(iso) {
    if (FIXED[iso.slice(5)]) return FIXED[iso.slice(5)];
    var easter = easterSunday(+iso.slice(0, 4));
    if (iso === isoAdd(easter, -3)) return "Jueves Santo";
    if (iso === isoAdd(easter, -2)) return "Viernes Santo";
    return undefined;
  }

  function clampN(n) {
    var v = Math.floor(Number(n));
    if (v === Infinity) return 60;
    if (!isFinite(v) || v < 1) return 1;
    return v > 60 ? 60 : v;
  }

  function delayOf(delays, c) {
    var d = delays ? Number(delays[c]) : 0;
    return isFinite(d) && d > 0 ? Math.floor(d) : 0;
  }

  function phaseFor(fases, c) {
    for (var i = 0; i < fases.length; i++) {
      var f = fases[i];
      if (f.desde <= c && (f.hasta === null || f.hasta === undefined || c <= f.hasta)) return f;
    }
    return fases[fases.length - 1];
  }

  function buildCycles(regimen, opts) {
    if (!regimen || !Array.isArray(regimen.fases) || !regimen.fases.length) {
      throw new Error("La pauta por ciclos necesita al menos una entrada en 'fases'.");
    }
    var n = clampN(opts.n);
    var cycles = [];
    var events = [];
    var start = opts.start;
    var end = start;
    for (var c = 1; c <= n; c++) {
      var fase = phaseFor(regimen.fases, c);
      if (c > 1) start = isoAdd(start, cycles[c - 2].len + delayOf(opts.delays, c));
      cycles.push({ n: c, start: start, len: fase.duracion, fase: fase.etiqueta });
      end = isoAdd(start, fase.duracion - 1);
      fase.items.forEach(function (it) {
        it.dias.forEach(function (day) {
          if (day > fase.duracion) return;
          events.push({
            date: isoAdd(start, day - 1),
            cycle: c,
            day: day,
            farmaco: it.farmaco,
            abrev: it.abrev,
            dosis: it.dosis,
            veces: it.veces_al_dia === undefined || it.veces_al_dia === null ? 1 : it.veces_al_dia,
            horas: Array.isArray(it.horas) ? it.horas.slice() : [],
            lugar: it.lugar,
            etiqueta: it.etiqueta || ""
          });
        });
      });
    }
    return { cycles: cycles, events: events, end: end };
  }

  // Pautas por intervalo: dosis en desplazamientos_dias, luego
  // primer_mantenimiento_dia y +cada_dias; opts.n sustituye a dosis_totales.
  // En los eventos, cycle = nº de dosis y day = día de la pauta (inicio = 1).
  function buildIntervals(regimen, opts) {
    if (!regimen || !Array.isArray(regimen.items) || !regimen.items.length) {
      throw new Error("La pauta por intervalo necesita al menos una entrada en 'items'.");
    }
    var total = clampN(opts.n);
    var events = [];
    var end = opts.start;
    regimen.items.forEach(function (it) {
      var offsets = (it.desplazamientos_dias || []).slice();
      var k = 0;
      while (offsets.length < total) {
        offsets.push(it.primer_mantenimiento_dia + k * it.cada_dias);
        k++;
      }
      offsets.slice(0, total).forEach(function (off, i) {
        var date = isoAdd(opts.start, off);
        if (date > end) end = date;
        events.push({
          date: date,
          cycle: i + 1,
          day: off + 1,
          farmaco: it.farmaco,
          abrev: it.abrev,
          dosis: it.dosis,
          veces: it.veces_al_dia === undefined || it.veces_al_dia === null ? 1 : it.veces_al_dia,
            horas: Array.isArray(it.horas) ? it.horas.slice() : [],
          lugar: it.lugar,
          etiqueta: it.etiqueta || ""
        });
      });
    });
    events.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return { cycles: [], events: events, end: end };
  }

  function buildSchedule(regimen, opts) {
    if (regimen && regimen.tipo === "intervalo") return buildIntervals(regimen, opts);
    return buildCycles(regimen, opts);
  }

  return {
    isoAdd: isoAdd,
    isoDow: isoDow,
    isoDiff: isoDiff,
    holidayName: holidayName,
    buildSchedule: buildSchedule
  };
});

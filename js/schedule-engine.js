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

  return {
    isoAdd: isoAdd,
    isoDow: isoDow,
    isoDiff: isoDiff,
    holidayName: holidayName
  };
});

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./regimen-data.js"));
  } else {
    root.RxBuilder = factory(root.RxData);
  }
})(typeof self !== "undefined" ? self : this, function (RxData) {
  "use strict";

  var LUGARES = ["hospital", "casa", "casa_inyeccion"];
  var FUENTE = "Pauta definida por el usuario (sin validar)";
  var FUENTE_VALIDADA = "Pauta definida y validada por el usuario";

  function fail(msg) { throw new Error(msg); }

  function txt(v) { return v === undefined || v === null ? "" : String(v).trim(); }

  // Entero desde número o texto ("28"); null si no lo es.
  function toInt(v) {
    if (typeof v === "number") return isFinite(v) && Math.floor(v) === v ? v : null;
    var t = txt(v);
    if (!/^-?\d+$/.test(t)) return null;
    return parseInt(t, 10);
  }

  // "1-21", "1,8,15", "1-3, 8" -> [1,2,3,8]. Conserva el orden escrito (la validación decide).
  function parseDias(text, opts) {
    var min = opts && opts.min !== undefined ? opts.min : 1;
    var t = txt(text);
    if (!t) return [];
    var out = [];
    t.split(/[,;]/).forEach(function (part) {
      var p = part.trim();
      if (!p) fail("Hay una coma sobrante o un valor vacío en la lista de días.");
      var m = /^(\d+)\s*[-–—]\s*(\d+)$/.exec(p);
      if (m) {
        var a = parseInt(m[1], 10), b = parseInt(m[2], 10);
        if (a > b) fail("El rango \"" + p + "\" está al revés: escriba primero el día menor (por ejemplo 1-21).");
        if (b - a > 400) fail("El rango \"" + p + "\" es demasiado largo.");
        for (var i = a; i <= b; i++) out.push(i);
      } else if (/^\d+$/.test(p)) {
        out.push(parseInt(p, 10));
      } else {
        fail("\"" + p + "\" no es un número de día válido. Use números separados por comas o rangos como 1-21.");
      }
    });
    return out;
  }

  // "08:00, 20:00" · "8:00 y 20.30" · ["08:00","20:00"] -> ["08:00","20:00"] (ordenadas). Lanza si no son horas 24 h.
  var MAX_HORAS = 6;
  function parseHoras(v, nombre) {
    var trozos = Array.isArray(v) ? v.map(String) : txt(v).replace(/\s+y\s+/gi, ",").split(/[,;]|\s+/);
    var out = [];
    trozos.forEach(function (t) {
      t = t.trim();
      if (!t) return;
      var m = /^([01]?\d|2[0-3])[:.]([0-5]\d)$/.exec(t);
      if (!m) fail("«" + t + "» no es una hora válida en " + nombre + " (use formato 24 h, por ejemplo 08:00 o 20:30).");
      out.push((m[1].length === 1 ? "0" : "") + m[1] + ":" + m[2]);
    });
    out.sort();
    out.forEach(function (h, i) { if (i > 0 && h === out[i - 1]) fail("La hora " + h + " de " + nombre + " está repetida."); });
    if (out.length > MAX_HORAS) fail("Como máximo " + MAX_HORAS + " horas al día en " + nombre + ".");
    return out;
  }

  function checkDias(dias, max, nombre) {
    if (!Array.isArray(dias) || !dias.length) fail("Indique al menos un día para " + nombre + ".");
    var prev = null;
    dias.forEach(function (d) {
      if (typeof d !== "number" || !isFinite(d) || Math.floor(d) !== d) {
        fail("Los días de " + nombre + " deben ser números enteros.");
      }
      if (d < 1 || d > max) {
        fail("El día " + d + " de " + nombre + " está fuera del ciclo (debe estar entre 1 y " + max + ").");
      }
      if (dias.indexOf(d) !== dias.lastIndexOf(d)) {
        fail("El día " + d + " de " + nombre + " está repetido.");
      }
      if (prev !== null && d < prev) {
        fail("Los días de " + nombre + " deben ir en orden creciente (hay un " + d + " después de un " + prev + ").");
      }
      prev = d;
    });
  }

  function buildItem(it, tipo, cicloDias) {
    if (!it || typeof it !== "object") fail("Fármaco no válido.");
    var farmaco = txt(it.farmaco);
    if (!farmaco) fail("Escriba el nombre del fármaco en cada fila.");
    var dosis = txt(it.dosis);
    if (!dosis) fail("Escriba la dosis de " + farmaco + " (texto libre, por ejemplo \"40 mg\").");
    var abrev = txt(it.abrev) || farmaco.slice(0, 4);
    if (LUGARES.indexOf(it.lugar) === -1) {
      fail("Elija el lugar de administración de " + farmaco + " (hospital, casa o casa con inyección). Lugar recibido: " + txt(it.lugar) + ".");
    }
    var veces = 1;
    if (it.veces_al_dia !== undefined && it.veces_al_dia !== null && txt(it.veces_al_dia) !== "") {
      veces = toInt(it.veces_al_dia);
      if (veces === null || veces < 1 || veces > 6) {
        fail("Las veces al día de " + farmaco + " deben ser un entero entre 1 y 6.");
      }
    }
    // Horas opcionales: nunca se inventan. Si se indican, deben cuadrar con las veces al día (o fijarlas si no se dieron).
    var horas = parseHoras(it.horas, farmaco);
    if (horas.length) {
      var explicita = it.veces_al_dia !== undefined && it.veces_al_dia !== null && txt(it.veces_al_dia) !== "";
      if (explicita && veces !== horas.length) {
        fail("Las horas de " + farmaco + " (" + horas.length + ") no coinciden con las veces al día (" + veces + "): indique " +
          horas.length + " veces al día o ajuste las horas.");
      }
      veces = horas.length;
    }
    var out = { farmaco: farmaco, abrev: abrev, dosis: dosis, lugar: it.lugar, veces_al_dia: veces, horas: horas };
    if (tipo === "ciclos") {
      checkDias(it.dias, cicloDias, farmaco);
      out.dias = it.dias.slice();
      return out;
    }
    var desp = it.desplazamientos_dias;
    if (!Array.isArray(desp) || !desp.every(function (d) { return typeof d === "number" && isFinite(d) && Math.floor(d) === d && d >= 0; })) {
      fail("Los desplazamientos de " + farmaco + " deben ser números enteros de 0 o más (días desde el inicio).");
    }
    desp.forEach(function (d, i) {
      if (desp.indexOf(d) !== i) fail("El día " + d + " de las dosis iniciales de " + farmaco + " está repetido.");
      if (i > 0 && d < desp[i - 1]) {
        fail("Las dosis iniciales de " + farmaco + " deben ir en orden creciente (hay un " + d + " después de un " + desp[i - 1] + ").");
      }
    });
    var pm = toInt(it.primer_mantenimiento_dia);
    if (pm === null || pm < 0) fail("El día del primer mantenimiento de " + farmaco + " debe ser un entero de 0 o más.");
    if (desp.length && pm <= desp[desp.length - 1]) {
      fail("El primer mantenimiento (día " + pm + ") debe ser posterior a la última dosis inicial (día " + desp[desp.length - 1] + ") de " + farmaco + ".");
    }
    var cada = toInt(it.cada_dias);
    if (cada === null || cada < 1) fail("El campo \"cada (días)\" de " + farmaco + " debe ser un entero de 1 o más.");
    out.desplazamientos_dias = desp.slice();
    out.primer_mantenimiento_dia = pm;
    out.cada_dias = cada;
    return out;
  }

  // Construye la pauta a partir del formulario ya interpretado. Pura: no guarda nada ni toca el DOM.
  // form.validada === true (casilla explícita del farmacéutico) la marca «validado» con form.fecha_revision;
  // en cualquier otro caso queda «pendiente» y la hoja lleva el aviso de no entregar.
  function buildRegimen(form) {
    if (!form || typeof form !== "object") fail("Formulario vacío.");
    if (form.tipo !== "ciclos" && form.tipo !== "intervalo") fail("Elija el tipo de pauta (por ciclos o por intervalo).");
    if (!Array.isArray(form.items) || !form.items.length) fail("Añada al menos un fármaco.");

    var cicloDias = null;
    if (form.tipo === "ciclos") {
      cicloDias = toInt(form.ciclo_dias);
      if (cicloDias === null || cicloDias < 1 || cicloDias > 366) {
        fail("La duración del ciclo debe ser un entero entre 1 y 366 días.");
      }
    }
    var items = form.items.map(function (it) { return buildItem(it, form.tipo, cicloDias); });
    var nombre = txt(form.nombre) || items[0].farmaco;

    var validada = form.validada === true;
    var revision = null;
    if (validada) {
      revision = txt(form.fecha_revision);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(revision)) fail("Falta la fecha de revisión para marcar la pauta como validada.");
    }

    var r = {
      id: "pauta",
      nombre: nombre,
      linea: "Pauta propia",
      estado: validada ? "validado" : "pendiente",
      fecha_revision: revision,
      fuente: validada ? FUENTE_VALIDADA : FUENTE,
      ciclos_defecto: 1
    };
    if (!validada) r.supuestos = ["Pauta definida por el usuario: no ha sido validada frente a ninguna fuente."];
    if (form.tipo === "intervalo") {
      r.tipo = "intervalo";
      items.forEach(function (it) { it.dosis_totales = 1; });
      r.items = items;
    } else {
      r.fases = [{ desde: 1, hasta: null, duracion: cicloDias, etiqueta: "Pauta propia", items: items }];
    }
    return RxData.check(r);
  }

  // Convierte el formulario "de texto" (días como "1-21") en el que espera buildRegimen.
  function formFromText(f) {
    var out = {};
    Object.keys(f).forEach(function (k) { out[k] = f[k]; });
    out.items = (f.items || []).map(function (it) {
      var o = {};
      Object.keys(it).forEach(function (k) { o[k] = it[k]; });
      if (f.tipo === "intervalo") {
        o.desplazamientos_dias = parseDias(it.desplazamientos_dias, { min: 0 });
      } else {
        o.dias = parseDias(it.dias);
      }
      return o;
    });
    return out;
  }

  var EJEMPLOS = {
    biologico: function () {
      return {
        nombre: "Biológico cada N semanas", tipo: "intervalo", n: 8,
        items: [{ farmaco: "Fármaco biológico", abrev: "Bio", dosis: "(indique la dosis)", lugar: "casa_inyeccion",
          desplazamientos_dias: "0,14,28", primer_mantenimiento_dia: "56", cada_dias: "56" }]
      };
    },
    oral21de28: function () {
      return {
        nombre: "Oral días 1–21 de 28", tipo: "ciclos", n: 6, ciclo_dias: "28",
        items: [{ farmaco: "Fármaco oral", abrev: "Oral", dosis: "(indique la dosis)", lugar: "casa", dias: "1-21" }]
      };
    }
  };

  return {
    LUGARES: LUGARES, FUENTE: FUENTE, EJEMPLOS: EJEMPLOS,
    parseDias: parseDias, parseHoras: parseHoras, formFromText: formFromText, buildRegimen: buildRegimen
  };
});

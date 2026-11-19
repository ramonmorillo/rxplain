(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RxData = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var AREAS = ["Hematología", "Oncología", "Inmunomediadas"];
  var ESTADOS = ["validado", "pendiente"];
  var LUGARES = ["hospital", "casa", "casa_inyeccion"];
  var DURACIONES = ["limitada", "indefinida"];
  var registry = [];

  function fail(field, msg) {
    throw new Error("Esquema inválido, campo '" + field + "': " + msg);
  }

  function isNum(v) {
    return typeof v === "number" && isFinite(v);
  }

  function nonEmptyStr(v) {
    return typeof v === "string" && v.trim() !== "";
  }

  function checkItemLugar(it) {
    if (!it || typeof it !== "object") fail("items", "cada item debe ser un objeto");
    ["farmaco", "abrev", "dosis"].forEach(function (k) {
      if (!nonEmptyStr(it[k])) fail(k, "obligatorio en cada item (texto no vacío)");
    });
    if (LUGARES.indexOf(it.lugar) === -1) {
      fail("lugar", "debe ser uno de " + LUGARES.join(", ") + " (recibido: " + it.lugar + ")");
    }
  }

  function validate(r) {
    if (!r || typeof r !== "object") fail("id", "el esquema debe ser un objeto");
    if (!nonEmptyStr(r.id)) fail("id", "obligatorio");
    if (registry.some(function (x) { return x.id === r.id; })) {
      fail("id", "duplicado: " + r.id);
    }
    if (!nonEmptyStr(r.nombre)) fail("nombre", "obligatorio");
    if (AREAS.indexOf(r.area) === -1) fail("area", "debe ser uno de " + AREAS.join(", "));
    if (!nonEmptyStr(r.linea)) fail("linea", "obligatorio");
    if (ESTADOS.indexOf(r.estado) === -1) fail("estado", "debe ser uno de " + ESTADOS.join(", "));
    if (!nonEmptyStr(r.fuente)) fail("fuente", "obligatorio (texto no vacío)");
    if (r.fecha_revision === null || r.fecha_revision === undefined) {
      if (r.estado !== "pendiente") fail("fecha_revision", "solo puede ser null si estado es 'pendiente'");
    } else if (typeof r.fecha_revision !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.fecha_revision)) {
      fail("fecha_revision", "debe tener formato YYYY-MM-DD");
    }
    if (!isNum(r.ciclos_defecto) || r.ciclos_defecto < 1) fail("ciclos_defecto", "debe ser un número >= 1");
    if (r.duracion !== undefined && DURACIONES.indexOf(r.duracion) === -1) {
      fail("duracion", "debe ser uno de " + DURACIONES.join(", ") + " (recibido: " + r.duracion + ")");
    }
    ["notas", "supuestos"].forEach(function (k) {
      if (r[k] !== undefined && !Array.isArray(r[k])) fail(k, "debe ser un array de textos");
    });

    if (r.tipo === "intervalo") {
      if (!Array.isArray(r.items) || !r.items.length) fail("items", "no puede estar vacío");
      r.items.forEach(function (it) {
        checkItemLugar(it);
        if (!Array.isArray(it.desplazamientos_dias) ||
            !it.desplazamientos_dias.every(function (d) { return isNum(d) && d >= 0; })) {
          fail("desplazamientos_dias", "debe ser un array de números >= 0");
        }
        ["primer_mantenimiento_dia", "cada_dias", "dosis_totales"].forEach(function (k) {
          if (!isNum(it[k])) fail(k, "debe ser numérico");
        });
      });
      return;
    }

    if (!Array.isArray(r.fases) || !r.fases.length) fail("fases", "no puede estar vacío");
    r.fases.forEach(function (f) {
      if (!isNum(f.desde)) fail("desde", "obligatorio en cada fase");
      if (!isNum(f.duracion) || f.duracion < 1 || Math.floor(f.duracion) !== f.duracion) {
        fail("duracion", "debe ser un entero positivo");
      }
      if (!nonEmptyStr(f.etiqueta)) fail("etiqueta", "obligatorio en cada fase");
      if (!Array.isArray(f.items) || !f.items.length) fail("items", "no puede estar vacío en cada fase");
      f.items.forEach(function (it) {
        checkItemLugar(it);
        if (!Array.isArray(it.dias) || !it.dias.length) fail("dias", "no puede estar vacío");
        it.dias.forEach(function (d) {
          if (!isNum(d) || Math.floor(d) !== d || d < 1) fail("dias", "deben ser enteros >= 1");
          if (d > f.duracion) fail("dias", "el día " + d + " supera la duración de la fase (" + f.duracion + ")");
        });
      });
    });
  }

  function register(r) {
    validate(r);
    registry.push(r);
  }

  function list() {
    return registry.slice();
  }

  function get(id) {
    return registry.filter(function (r) { return r.id === id; })[0];
  }

  function byArea() {
    var out = {};
    registry.forEach(function (r) {
      (out[r.area] = out[r.area] || []).push(r);
    });
    return out;
  }

  // Quita un esquema del registro (p. ej. una pauta propia al empezar de nuevo). Devuelve true si existía.
  function remove(id) {
    var n = registry.length;
    registry = registry.filter(function (r) { return r.id !== id; });
    return registry.length !== n;
  }

  function _reset() {
    registry = [];
  }

  return { register: register, list: list, get: get, byArea: byArea, remove: remove, _reset: _reset };
});

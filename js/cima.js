(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RxCima = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Cliente mínimo de CIMA/AEMPS. `fetch` se inyecta (tests). Solo recibe el nombre
  // de un fármaco o un nº de registro: nunca datos del paciente.
  // El formato de docSegmentado NO está verificado: se acepta JSON o HTML/texto.
  var BASE = "https://cima.aemps.es/cima/rest";
  var NREG = /^[A-Za-z0-9]{1,20}$/;
  var SECC = /^\d{1,2}(\.\d{1,2}){0,3}$/;

  function fichaUrl(nregistro) {
    return "https://cima.aemps.es/cima/publico/home.html#medicamento?" + encodeURIComponent(nregistro);
  }

  function str(v) { return v == null ? "" : String(v); }

  function htmlToText(html) {
    var s = str(html)
      .replace(/\s*\n\s*/g, " ")
      .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6]|table|ul|ol)\s*>/gi, "\n");
    var out;
    if (typeof DOMParser !== "undefined") {
      // DOMParser no ejecuta scripts ni carga recursos.
      out = new DOMParser().parseFromString(s, "text/html").body.textContent || "";
    } else {
      out = s.replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
    }
    return out.replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  // Recoge los textos de una respuesta JSON de forma defensiva.
  function collect(node, acc, depth) {
    if (depth > 6 || node == null) return;
    if (typeof node === "string") { acc.push(node); return; }
    if (Array.isArray(node)) { node.forEach(function (n) { collect(n, acc, depth + 1); }); return; }
    if (typeof node === "object") {
      var found = false;
      ["contenido", "texto", "content", "html"].forEach(function (k) {
        if (node[k] != null) { collect(node[k], acc, depth + 1); found = true; }
      });
      if (!found && node.resultados != null) collect(node.resultados, acc, depth + 1);
    }
  }

  function create(opts) {
    opts = opts || {};
    var f = opts.fetch;
    var base = (opts.base || BASE).replace(/\/+$/, "");

    function get(url, what) {
      if (typeof f !== "function") return Promise.reject(new Error("No hay conexión disponible para consultar CIMA."));
      var p;
      try { p = Promise.resolve(f(url)); } catch (e) { p = Promise.reject(e); }
      return p.then(
        function (res) {
          if (!res || !res.ok) {
            throw new Error("CIMA respondió con un error (HTTP " + (res && res.status) + ") al " + what + ".");
          }
          return res;
        },
        function () { throw new Error("No se pudo conectar con CIMA para " + what + ". Revise la conexión."); }
      );
    }

    function readText(res) {
      return Promise.resolve().then(function () { return res.text(); })
        .catch(function () { throw new Error("La respuesta de CIMA no se pudo leer."); });
    }

    function buscar(nombre) {
      var q = str(nombre).trim();
      if (!q) return Promise.reject(new Error("Escriba un nombre de fármaco para buscar."));
      var url = base + "/medicamentos?nombre=" + encodeURIComponent(q) + "&pagina=1";
      return get(url, "buscar el medicamento").then(readText).then(function (txt) {
        var data;
        try { data = JSON.parse(txt); } catch (e) { throw new Error("CIMA devolvió una respuesta que no se entiende."); }
        var items = Array.isArray(data) ? data : (data && (data.resultados || data.items)) || [];
        if (!Array.isArray(items)) items = [];
        var out = [];
        items.forEach(function (m) {
          if (!m || typeof m !== "object") return;
          var nreg = str(m.nregistro);
          if (!NREG.test(nreg)) return;
          var ff = m.formaFarmaceutica;
          out.push({
            nregistro: nreg,
            nombre: str(m.nombre),
            pactivos: str(m.pactivos),
            formaFarmaceutica: str(ff && typeof ff === "object" ? ff.nombre : ff),
            labtitular: str(m.labtitular),
            url: fichaUrl(nreg)
          });
        });
        return out;
      });
    }

    function apartado(nregistro, seccion) {
      var nreg = str(nregistro);
      var sec = seccion == null ? "4.2" : str(seccion);
      if (!NREG.test(nreg)) return Promise.reject(new Error("Número de registro no válido."));
      if (!SECC.test(sec)) return Promise.reject(new Error("Sección no válida."));
      var url = base + "/docSegmentado/contenido/1?nregistro=" + encodeURIComponent(nreg) +
        "&seccion=" + encodeURIComponent(sec);
      return get(url, "leer la ficha técnica").then(readText).then(function (raw) {
        var parts = [];
        var t = raw.trim();
        var parsed;
        var isJson = false;
        if (t && (t.charAt(0) === "[" || t.charAt(0) === "{")) {
          try { parsed = JSON.parse(t); isJson = true; } catch (e) { isJson = false; }
        }
        if (isJson) collect(parsed, parts, 0); else parts.push(raw);
        var texto = parts.map(htmlToText).filter(Boolean).join("\n\n").trim();
        if (!texto) throw new Error("CIMA no devolvió texto para el apartado " + sec + " de este medicamento.");
        return { texto: texto, url: fichaUrl(nreg) };
      });
    }

    return { buscar: buscar, apartado: apartado };
  }

  return { create: create, BASE: BASE, htmlToText: htmlToText, fichaUrl: fichaUrl };
});

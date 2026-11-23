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

    // Una petición de búsqueda: nunca rechaza; devuelve {ok, status, items, error}.
    function pedir(url) {
      if (typeof f !== "function") return Promise.resolve({ ok: false, status: null, items: [], error: "No hay conexión disponible para consultar CIMA." });
      var p;
      try { p = Promise.resolve(f(url)); } catch (e) { p = Promise.reject(e); }
      return p.then(function (res) {
        var status = res && res.status != null ? res.status : null;
        if (!res || !res.ok) {
          return { ok: false, status: status, items: [], error: "CIMA respondió con un error (HTTP " + status + ") al buscar el medicamento." };
        }
        return Promise.resolve().then(function () { return res.text(); }).then(function (txt) {
          var data;
          try { data = JSON.parse(txt); } catch (e) {
            return { ok: false, status: status, items: [], error: "CIMA devolvió una respuesta que no se entiende." };
          }
          var items = Array.isArray(data) ? data : (data && (data.resultados || data.items)) || [];
          if (!Array.isArray(items)) items = [];
          return { ok: true, status: status, items: items, error: "" };
        }, function () {
          return { ok: false, status: status, items: [], error: "La respuesta de CIMA no se pudo leer." };
        });
      }, function () {
        return { ok: false, status: null, items: [], error: "No se pudo conectar con CIMA para buscar el medicamento. Revise la conexión." };
      });
    }

    function textoDiag(reqs, descartados) {
      var t = "Diagnóstico: " + reqs.map(function (r) {
        return r.via + ": " + (r.status != null ? "HTTP " + r.status : "sin respuesta") +
          (r.ok ? ", " + r.items.length + " elemento(s)" : ", fallo");
      }).join("; ") + ".";
      if (descartados) t += " " + descartados + " resultados descartados por formato.";
      return t;
    }

    // Busca por nombre comercial y por principio activo en paralelo y fusiona.
    // Devuelve { items, diagnostico, mensajeVacio }; rechaza solo si fallan ambas.
    function buscarDetalle(nombre) {
      var q = str(nombre).trim();
      if (!q) return Promise.reject(new Error("Escriba un nombre de fármaco para buscar."));
      var enc = encodeURIComponent(q);
      return Promise.all([
        pedir(base + "/medicamentos?nombre=" + enc),
        pedir(base + "/medicamentos?practiv1=" + enc)
      ]).then(function (rs) {
        rs[0].via = "nombre comercial";
        rs[1].via = "principio activo";
        if (!rs[0].ok && !rs[1].ok) {
          var msgs = [rs[0].error];
          if (rs[1].error !== rs[0].error) msgs.push(rs[1].error);
          var err = new Error(msgs.join(" "));
          err.diagnostico = textoDiag(rs, 0);
          throw err;
        }
        var seen = {}, out = [], dropped = 0;
        rs.forEach(function (r) {
          r.items.forEach(function (m) {
            if (!m || typeof m !== "object") { dropped++; return; }
            var nreg = str(m.nregistro);
            if (!NREG.test(nreg)) { dropped++; return; }
            if (seen[nreg]) return;
            seen[nreg] = true;
            var ff = m.formaFarmaceutica;
            out.push({
              nregistro: nreg,
              nombre: str(m.nombre),
              // La lista de CIMA no incluye «pactivos»; el VTM (p. ej. «adalimumab») es el principio activo virtual.
              pactivos: str(m.pactivos) || str(m.vtm && typeof m.vtm === "object" ? m.vtm.nombre : m.vtm),
              formaFarmaceutica: str(ff && typeof ff === "object" ? ff.nombre : ff),
              labtitular: str(m.labtitular),
              url: fichaUrl(nreg)
            });
          });
        });
        return {
          items: out,
          diagnostico: textoDiag(rs, dropped),
          descartados: dropped,
          mensajeVacio: "CIMA no devolvió medicamentos para \u00ab" + q + "\u00bb (se buscó por nombre comercial y por principio activo). " +
            "Pruebe el nombre completo (p. ej. \u00abadalimumab\u00bb o \u00abHumira\u00bb) o el principio activo."
        };
      });
    }

    function buscar(nombre) {
      return buscarDetalle(nombre).then(function (r) { return r.items; });
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

    return { buscar: buscar, buscarDetalle: buscarDetalle, apartado: apartado };
  }

  return { create: create, BASE: BASE, htmlToText: htmlToText, fichaUrl: fichaUrl };
});

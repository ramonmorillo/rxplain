(function () {
  "use strict";
  // Sub-pestaña Fármacos: búsqueda en CIMA (solo al pulsar Buscar / Enter) y lectura
  // del apartado 4.2. Todo el texto externo se inserta con textContent.
  var selected = null; // fármaco normalizado: { nregistro, pactivos, nombre, url } (solo memoria)
  var seq = 0;

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }

  function mount(rootEl, opts) {
    opts = opts || {};
    if (!rootEl) return;
    var cima = opts.cima || null;
    function client() {
      if (!cima) {
        var w = typeof window !== "undefined" ? window : {};
        cima = window.RxCima.create({ fetch: typeof w.fetch === "function" ? w.fetch.bind(w) : null });
      }
      return cima;
    }

    rootEl.textContent = "";
    var form = el("form", { id: "far_form", class: "cal-form", novalidate: "" });
    var lab = el("label");
    lab.appendChild(document.createTextNode("Buscar fármaco en CIMA "));
    var inp = el("input", { type: "search", id: "far_buscar", autocomplete: "off", placeholder: "Nombre comercial o principio activo" });
    lab.appendChild(inp);
    var btn = el("button", { type: "submit", id: "far_buscar_btn", class: "btn" }, "Buscar");
    form.appendChild(lab); form.appendChild(document.createTextNode(" ")); form.appendChild(btn);
    var nota = el("p", { class: "tiny far-nota" },
      "Solo se envía a CIMA/AEMPS el nombre del fármaco al pulsar Buscar; nunca datos del paciente.");
    var estado = el("p", { id: "far_estado", class: "far-estado", role: "status", "aria-live": "polite" });
    var diag = el("p", { id: "far_diag", class: "tiny far-diag" });
    var lista = el("ul", { id: "far_resultados", class: "far-resultados" });
    var ficha = el("section", { id: "far_ficha", class: "far-ficha", hidden: "", "aria-label": "Apartado 4.2 de la ficha técnica" });
    rootEl.appendChild(form); rootEl.appendChild(nota); rootEl.appendChild(estado);
    rootEl.appendChild(diag); rootEl.appendChild(lista); rootEl.appendChild(ficha);

    function setEstado(t) { estado.textContent = t || ""; }

    function describir(p) {
      if (p.tipo === "diaria") return "Diaria: " + p.veces_al_dia + " vez/veces al día.";
      if (p.tipo === "ciclo") return "Ciclo de " + p.ciclo_dias + " días; días " + p.dias_ciclo + (p.veces_al_dia ? "; " + p.veces_al_dia + " vez/veces al día" : "; veces al día: sin dato en la ficha") + ".";
      var t = "Intervalo: cada " + p.cada_dias + " días";
      if (p.desplazamientos_dias && p.desplazamientos_dias.length) {
        t += "; dosis iniciales en los días " + p.desplazamientos_dias.join(", ") +
          "; primer mantenimiento: " + (p.primer_mantenimiento_dia === "" ? "sin determinar" : "día " + p.primer_mantenimiento_dia);
      }
      return t + ".";
    }

    function usar(p) {
      var s = selected || {};
      var farmaco = s.pactivos || s.nombre || "";
      var it = { farmaco: farmaco, abrev: farmaco.slice(0, 4), dosis: "", lugar: "" };
      var f = { nombre: farmaco + " — borrador de la ficha técnica (nº reg. " + (s.nregistro || "—") + ")", items: [it] };
      if (p.tipo === "intervalo") {
        f.tipo = "intervalo";
        it.desplazamientos_dias = (p.desplazamientos_dias || []).join(",");
        it.primer_mantenimiento_dia = p.primer_mantenimiento_dia;
        it.cada_dias = p.cada_dias;
      } else {
        f.tipo = "ciclos";
        f.ciclo_dias = p.ciclo_dias || "";
        it.dias = p.dias_ciclo || "";
        it.veces_al_dia = p.veces_al_dia || ""; // vacío = sin dato en la ficha (el constructor lo marca)
      }
      if (window.RxCalendar && window.RxCalendar.precargar(f) && window.RxSubtabs) window.RxSubtabs.show("esquemas");
    }

    function elegir(m) {
      var my = ++seq;
      selected = { nregistro: m.nregistro, pactivos: m.pactivos, nombre: m.nombre, url: m.url };
      ficha.hidden = false;
      ficha.textContent = "";
      var h = el("h3", {}, m.nombre || m.nregistro);
      var sub = el("p", { class: "tiny" }, "Principio activo: " + (m.pactivos || "—") + " · nº registro " + m.nregistro);
      var a = el("a", { href: m.url, target: "_blank", rel: "noopener" }, "Ver ficha técnica en CIMA");
      var pre = el("pre", { id: "far_texto", class: "far-texto" }, "");
      var prop = el("button", { type: "button", id: "far_proponer", class: "btn btn-sec", disabled: "" }, "Proponer pauta");
      var borrador = el("p", { class: "aviso far-borrador", id: "far_borrador" },
        "Borrador automático: revíselo y complételo; no sustituye la validación farmacéutica.");
      var propLista = el("ul", { id: "far_propuestas", class: "far-propuestas" });
      var avLista = el("ul", { id: "far_avisos", class: "far-avisos" });
      ficha.appendChild(h); ficha.appendChild(sub);
      var p = el("p"); p.appendChild(a); ficha.appendChild(p);
      ficha.appendChild(pre); ficha.appendChild(borrador); ficha.appendChild(prop);
      ficha.appendChild(propLista); ficha.appendChild(avLista);
      var textoFt = "";
      prop.addEventListener("click", function () {
        propLista.textContent = ""; avLista.textContent = "";
        var r = window.RxPosologia.extraer(textoFt);
        r.propuestas.forEach(function (pp) {
          var li = el("li", { class: "far-propuesta" });
          li.appendChild(el("blockquote", { class: "far-frase" }, pp.frase));
          li.appendChild(el("p", { class: "tiny" }, describir(pp)));
          li.appendChild(el("p", { class: "tiny" }, pp.notas));
          (pp.avisos || []).forEach(function (t) { li.appendChild(el("p", { class: "aviso far-aviso-prop" }, "Aviso: " + t)); });
          var b = el("button", { type: "button", class: "btn" }, "Usar en el constructor");
          b.addEventListener("click", function () { usar(pp); });
          li.appendChild(b);
          propLista.appendChild(li);
        });
        r.avisos.forEach(function (t) { avLista.appendChild(el("li", {}, t)); });
        setEstado(r.propuestas.length
          ? r.propuestas.length + " propuesta(s) de pauta. Compruebe cada una con la frase de la ficha."
          : "No se propone ninguna pauta.");
      });
      setEstado("Cargando el apartado 4.2…");
      var c;
      try { c = client().apartado(m.nregistro, "4.2"); } catch (e) { c = Promise.reject(e); }
      c.then(function (r) {
        if (my !== seq) return;
        pre.textContent = r.texto;
        textoFt = r.texto;
        prop.disabled = false;
        setEstado("Apartado 4.2 cargado. Compruebe siempre el texto en la ficha técnica oficial.");
      }, function (e) {
        if (my !== seq) return;
        setEstado("No se pudo obtener el apartado 4.2 (" + ((e && e.message) || "error") +
          "). Consulte la ficha técnica en CIMA con el enlace.");
      });
    }

    function pintar(items) {
      lista.textContent = "";
      items.forEach(function (m) {
        var li = el("li");
        li.appendChild(el("strong", {}, m.nombre || m.nregistro));
        li.appendChild(el("span", { class: "far-meta" },
          " · " + (m.pactivos || "sin principio activo") + (m.formaFarmaceutica ? " · " + m.formaFarmaceutica : "") +
          (m.labtitular ? " · " + m.labtitular : "")));
        li.appendChild(document.createTextNode(" "));
        var b = el("button", { type: "button", class: "btn btn-sec far-elegir" }, "Ver 4.2");
        b.addEventListener("click", function () { elegir(m); });
        li.appendChild(b);
        li.appendChild(document.createTextNode(" "));
        li.appendChild(el("a", { href: m.url, target: "_blank", rel: "noopener" }, "CIMA"));
        lista.appendChild(li);
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = inp.value.trim();
      if (!q) { setEstado("Escriba un nombre de fármaco para buscar."); return; }
      var my = ++seq;
      lista.textContent = "";
      ficha.hidden = true; ficha.textContent = "";
      selected = null;
      diag.textContent = "";
      setEstado("Buscando en CIMA…");
      var c;
      try {
        var cl = client();
        c = typeof cl.buscarDetalle === "function"
          ? cl.buscarDetalle(q)
          : cl.buscar(q).then(function (items) { return { items: items, diagnostico: "", mensajeVacio: "Sin resultados en CIMA para \u00ab" + q + "\u00bb." }; });
      } catch (err) { c = Promise.reject(err); }
      c.then(function (r) {
        if (my !== seq) return;
        diag.textContent = r.diagnostico || "";
        if (!r.items.length) { setEstado(r.mensajeVacio); return; }
        setEstado(r.items.length + " resultado(s). Elija uno para ver el apartado 4.2.");
        pintar(r.items);
      }, function (err) {
        if (my !== seq) return;
        diag.textContent = (err && err.diagnostico) || "";
        setEstado((err && err.message) || "No se pudo consultar CIMA.");
      });
    });
  }

  window.RxFarmacos = { mount: mount, seleccionado: function () { return selected ? Object.assign({}, selected) : null; } };
})();

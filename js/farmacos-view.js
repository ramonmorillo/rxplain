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
    var lista = el("ul", { id: "far_resultados", class: "far-resultados" });
    var ficha = el("section", { id: "far_ficha", class: "far-ficha", hidden: "", "aria-label": "Apartado 4.2 de la ficha técnica" });
    rootEl.appendChild(form); rootEl.appendChild(nota); rootEl.appendChild(estado);
    rootEl.appendChild(lista); rootEl.appendChild(ficha);

    function setEstado(t) { estado.textContent = t || ""; }

    function elegir(m) {
      var my = ++seq;
      selected = { nregistro: m.nregistro, pactivos: m.pactivos, nombre: m.nombre, url: m.url };
      ficha.hidden = false;
      ficha.textContent = "";
      var h = el("h3", {}, m.nombre || m.nregistro);
      var sub = el("p", { class: "tiny" }, "Principio activo: " + (m.pactivos || "—") + " · nº registro " + m.nregistro);
      var a = el("a", { href: m.url, target: "_blank", rel: "noopener" }, "Ver ficha técnica en CIMA");
      var pre = el("pre", { id: "far_texto", class: "far-texto" }, "");
      var prop = el("button", { type: "button", id: "far_proponer", class: "btn btn-sec", disabled: "", title: "Disponible en la siguiente fase" }, "Proponer pauta");
      ficha.appendChild(h); ficha.appendChild(sub);
      var p = el("p"); p.appendChild(a); ficha.appendChild(p);
      ficha.appendChild(pre); ficha.appendChild(prop);
      setEstado("Cargando el apartado 4.2…");
      var c;
      try { c = client().apartado(m.nregistro, "4.2"); } catch (e) { c = Promise.reject(e); }
      c.then(function (r) {
        if (my !== seq) return;
        pre.textContent = r.texto;
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
      setEstado("Buscando en CIMA…");
      var c;
      try { c = client().buscar(q); } catch (err) { c = Promise.reject(err); }
      c.then(function (items) {
        if (my !== seq) return;
        if (!items.length) { setEstado("Sin resultados en CIMA para «" + q + "»."); return; }
        setEstado(items.length + " resultado(s). Elija uno para ver el apartado 4.2.");
        pintar(items);
      }, function (err) {
        if (my !== seq) return;
        setEstado((err && err.message) || "No se pudo consultar CIMA.");
      });
    });
  }

  window.RxFarmacos = { mount: mount, seleccionado: function () { return selected ? Object.assign({}, selected) : null; } };
})();

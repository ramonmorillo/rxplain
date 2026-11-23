(function () {
  "use strict";
  // Desplegable de fármacos (combobox ARIA) para un <input>. Mientras se escribe (≥ minChars, con pausa)
  // consulta `buscar(texto)` y lista las opciones; al elegir una llama a onPick(item).
  // Todo el texto externo se inserta con textContent. A CIMA solo viaja el texto del campo Fármaco.
  var uid = 0;

  function attach(input, opts) {
    opts = opts || {};
    var minChars = opts.minChars || 3;
    var delay = opts.delay === undefined ? 350 : opts.delay;
    var max = opts.max || 50;
    var id = "far_combo_" + (++uid);
    var timer = null, seq = 0, items = [], active = -1, closedFor = null;

    var list = document.createElement("ul");
    list.id = id; list.className = "far-combo"; list.setAttribute("role", "listbox"); list.hidden = true;
    var host = input.closest("label") || input.parentNode;
    host.classList.add("far-combo-host");
    host.appendChild(list);

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", id);
    input.setAttribute("autocomplete", "off");

    function close() {
      list.hidden = true; active = -1;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    }

    function open() { list.hidden = false; input.setAttribute("aria-expanded", "true"); }

    function setActive(i) {
      var opts_ = list.querySelectorAll('[role="option"]:not([aria-disabled])');
      if (!opts_.length) return;
      active = (i + opts_.length) % opts_.length;
      Array.prototype.forEach.call(opts_, function (o, k) {
        var on = k === active;
        o.setAttribute("aria-selected", on ? "true" : "false");
        if (on) {
          input.setAttribute("aria-activedescendant", o.id);
          if (typeof o.scrollIntoView === "function") { try { o.scrollIntoView({ block: "nearest" }); } catch (e) { /* sin scroll */ } }
        }
      });
    }

    function nota(texto) {
      list.textContent = "";
      var li = document.createElement("li");
      li.setAttribute("role", "option"); li.setAttribute("aria-disabled", "true"); li.className = "far-combo-nota";
      li.id = id + "_nota"; li.textContent = texto;
      list.appendChild(li); open();
    }

    function pick(item) {
      closedFor = input.value;
      close();
      if (opts.onPick) opts.onPick(item);
    }

    function render(found) {
      items = found.slice(0, max);
      list.textContent = "";
      active = -1;
      if (!items.length) { nota("Sin resultados en CIMA. Puede escribir el fármaco a mano."); return; }
      items.forEach(function (m, k) {
        var li = document.createElement("li");
        li.setAttribute("role", "option"); li.id = id + "_" + k; li.setAttribute("aria-selected", "false");
        var n = document.createElement("strong"); n.textContent = m.nombre || m.nregistro;
        var meta = document.createElement("span"); meta.className = "far-meta";
        meta.textContent = " · " + (m.pactivos || "sin principio activo") + (m.formaFarmaceutica ? " · " + m.formaFarmaceutica : "") +
          (m.labtitular ? " · " + m.labtitular : "");
        li.appendChild(n); li.appendChild(meta);
        // mousedown (no click): evita que el blur del campo cierre la lista antes de elegir
        li.addEventListener("mousedown", function (e) { e.preventDefault(); pick(m); });
        list.appendChild(li);
      });
      if (found.length > max) {
        var mas = document.createElement("li");
        mas.setAttribute("role", "option"); mas.setAttribute("aria-disabled", "true"); mas.className = "far-combo-nota";
        mas.textContent = "Mostrando " + max + " de " + found.length + ". Escriba más texto para afinar.";
        list.appendChild(mas);
      }
      open();
    }

    function consultar() {
      var q = input.value.trim();
      var my = ++seq;
      if (q.length < minChars || q === closedFor) { close(); return; }
      nota("Buscando en CIMA…");
      var p;
      try { p = Promise.resolve(opts.buscar(q)); } catch (e) { p = Promise.reject(e); }
      p.then(function (found) { if (my === seq) render(found || []); },
        function () { if (my === seq) nota("No se pudo consultar CIMA. Puede escribir el fármaco a mano."); });
    }

    input.addEventListener("input", function () {
      closedFor = null;
      clearTimeout(timer);
      if (input.value.trim().length < minChars) { seq++; close(); return; }
      timer = setTimeout(consultar, delay);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (list.hidden) { if (input.value.trim().length >= minChars) { e.preventDefault(); clearTimeout(timer); consultar(); } return; }
        e.preventDefault(); setActive(active + (e.key === "ArrowDown" ? 1 : -1));
      } else if (e.key === "Enter") {
        if (!list.hidden && active >= 0) { e.preventDefault(); pick(items[active]); }
      } else if (e.key === "Escape") {
        if (!list.hidden) { e.preventDefault(); seq++; close(); }
      }
    });
    input.addEventListener("blur", function () { seq++; clearTimeout(timer); close(); });

    return { close: close, destroy: function () { seq++; clearTimeout(timer); if (list.parentNode) list.parentNode.removeChild(list); } };
  }

  window.RxFarmacoCombo = { attach: attach };
})();

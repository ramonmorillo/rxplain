(function () {
  "use strict";
  // Paneles de la página. «inicio», «infografia», «calendario» y «guia» tienen botón en la barra superior;
  // «legal» se abre desde el pie y no lo tiene.
  var NAMES = ["inicio", "infografia", "calendario", "guia", "legal"];
  var DEFAULT = "inicio";
  var TITLES = {
    inicio: "RxPlain · Traducción farmacoterapéutica",
    infografia: "Infografía · RxPlain",
    calendario: "Calendario · RxPlain",
    guia: "Guía de uso · RxPlain",
    legal: "Aviso legal y privacidad · RxPlain"
  };

  function show(name) {
    if (NAMES.indexOf(name) === -1) return;
    NAMES.forEach(function (n) {
      var btn = document.getElementById("tab-btn-" + n);
      var panel = document.getElementById("tab-" + n);
      var active = n === name;
      if (btn) {
        btn.setAttribute("aria-selected", active ? "true" : "false");
        btn.tabIndex = active ? 0 : -1;
      }
      if (panel) panel.hidden = !active;
    });
    document.title = TITLES[name];
    document.dispatchEvent(new CustomEvent("rx:tab", { detail: { name: name } }));
  }

  // Enlaces internos entre paneles: <a|button data-goto-tab="calendario" [href="#id-destino"]>
  function irA(el) {
    var name = el.getAttribute("data-goto-tab");
    show(name);
    var href = el.getAttribute("href");
    var destino = href && href.charAt(0) === "#" ? document.getElementById(href.slice(1)) : null;
    var scroll = function () {
      if (destino && typeof destino.scrollIntoView === "function") { try { destino.scrollIntoView({ block: "start" }); return; } catch (e) { /* sin scroll */ } }
      (document.scrollingElement || document.documentElement).scrollTop = 0;
    };
    scroll();
  }

  function init() {
    var nav = document.getElementById("tabs");
    if (!nav) return;
    var buttons = Array.prototype.slice.call(nav.querySelectorAll('[role="tab"]'));
    buttons.forEach(function (btn, i) {
      btn.addEventListener("click", function () {
        show(btn.id.replace("tab-btn-", ""));
      });
      btn.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var next = buttons[(i + d + buttons.length) % buttons.length];
        next.focus();
        show(next.id.replace("tab-btn-", ""));
      });
    });
    document.addEventListener("click", function (e) {
      var el = e.target && e.target.closest ? e.target.closest("[data-goto-tab]") : null;
      if (!el) return;
      e.preventDefault();
      irA(el);
    });
    // Enlace directo: index.html#calendario abre esa pestaña (sin escribir el hash al navegar).
    var h = (window.location && window.location.hash ? window.location.hash.slice(1) : "").toLowerCase();
    show(NAMES.indexOf(h) !== -1 ? h : DEFAULT);
  }

  window.RxTabs = { show: show, NAMES: NAMES.slice(), DEFAULT: DEFAULT };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

(function () {
  "use strict";
  // Sub-pestañas de la pestaña Calendario. Botones #sub-btn-<n>, paneles #sub-<n>.
  // Los paneles siempre existen en el DOM; solo se oculta con `hidden`.
  var NAMES = ["farmacos", "esquemas", "calendario", "informe"];
  var DEFAULT = "calendario";

  function show(name) {
    if (NAMES.indexOf(name) === -1) return;
    NAMES.forEach(function (n) {
      var btn = document.getElementById("sub-btn-" + n);
      var panel = document.getElementById("sub-" + n);
      var active = n === name;
      if (btn) {
        btn.setAttribute("aria-selected", active ? "true" : "false");
        btn.tabIndex = active ? 0 : -1;
      }
      if (panel) panel.hidden = !active;
    });
    document.dispatchEvent(new CustomEvent("rx:subtab", { detail: { name: name } }));
  }

  function nameOf(el) {
    return el && el.id ? el.id.replace("sub-btn-", "") : "";
  }

  // Delegación en document: sigue funcionando si mount() vuelve a pintar el DOM.
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("#subtabs [role=tab]") : null;
    if (t) show(nameOf(t));
  });
  document.addEventListener("keydown", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("#subtabs [role=tab]") : null;
    if (!t) return;
    var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    var i = NAMES.indexOf(nameOf(t));
    var next = document.getElementById("sub-btn-" + NAMES[(i + d + NAMES.length) % NAMES.length]);
    if (next) { next.focus(); show(nameOf(next)); }
  });

  window.RxSubtabs = { show: show, NAMES: NAMES.slice(), DEFAULT: DEFAULT };
})();

(function () {
  "use strict";
  // Pestaña «Guía de uso»: impresión/PDF de la propia guía (el acceso lo gestiona tabs.js con data-goto-tab).

  function limpiar() {
    window.removeEventListener("afterprint", limpiar);
    delete document.body.dataset.printing;
  }

  function imprimir() {
    document.body.dataset.printing = "guia";
    window.addEventListener("afterprint", limpiar, { once: true });
    try { window.print(); } catch (e) { limpiar(); }
  }

  function init() {
    var p = document.getElementById("guiaImprimir");
    if (p) p.addEventListener("click", imprimir);
    // Si afterprint no llega, cambiar de pestaña no deja el modo impresión de la guía puesto.
    document.addEventListener("rx:tab", function () { if (document.body.dataset.printing === "guia") limpiar(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

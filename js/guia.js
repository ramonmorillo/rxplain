(function () {
  "use strict";
  // Pestaña «Guía de uso»: acceso desde la cabecera e impresión/PDF de la propia guía.

  function abrir() {
    if (window.RxTabs) window.RxTabs.show("guia");
    var t = document.getElementById("guia-titulo");
    if (t && typeof t.scrollIntoView === "function") { try { t.scrollIntoView({ block: "start" }); } catch (e) { /* sin scroll */ } }
  }

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
    var a = document.getElementById("openGuia");
    if (a) a.addEventListener("click", abrir);
    var p = document.getElementById("guiaImprimir");
    if (p) p.addEventListener("click", imprimir);
    // Si afterprint no llega, cambiar de pestaña no deja el modo impresión de la guía puesto.
    document.addEventListener("rx:tab", function () { if (document.body.dataset.printing === "guia") limpiar(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

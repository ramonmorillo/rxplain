(function () {
  var RX = typeof RxData !== "undefined" ? RxData : require("../../js/regimen-data.js");
  var H = typeof RxHelpers !== "undefined" ? RxHelpers : (typeof require === "function" ? require("./helpers.js") : null);
  if (!H) { if (typeof console !== "undefined") console.error("RxHelpers no disponible: data/regimens/helpers.js no se cargó; esquema omitido."); return; }
  var isa = H.isa, cfz = H.cfz, dexC = H.dexC;
  RX.register({
    id: "mieloma-isa-kd",
    nombre: "Isa-Kd",
    area: "Hematología",
    linea: "2ª línea",
    ensayo: "IKEMA",
    estado: "pendiente",
    fecha_revision: null,
    fuente: H.FUENTE_MIELOMA,
    ciclos_defecto: 12,
    supuestos: ["Dexametasona 20 mg por día marcado", H.NOTA_CD38],
    fases: [
      { desde: 1, hasta: 1, duracion: 28, etiqueta: "C1", items: [isa([1, 8, 15, 22]), cfz("20 mg/m²", [1, 2]), cfz("56 mg/m²", [8, 9, 15, 16]), dexC([1, 2, 8, 9, 15, 16, 22])] },
      { desde: 2, hasta: null, duracion: 28, etiqueta: "C2 en adelante", items: [isa([1, 15]), cfz("56 mg/m²", [1, 2, 8, 9, 15, 16]), dexC([1, 2, 8, 9, 15, 16])] }
    ]
  });
})();

(function () {
  var RX = typeof RxData !== "undefined" ? RxData : require("../../js/regimen-data.js");
  var H = typeof RxHelpers !== "undefined" ? RxHelpers : (typeof require === "function" ? require("./helpers.js") : null);
  if (!H) { if (typeof console !== "undefined") console.error("RxHelpers no disponible: data/regimens/helpers.js no se cargó; esquema omitido."); return; }
  var R = H.R, it = H.it, btz = H.btz;
  RX.register({
    id: "mieloma-vrd-swog",
    nombre: "VRD (SWOG)",
    area: "Hematología",
    linea: "1ª línea · no candidatos",
    estado: "pendiente",
    fecha_revision: null,
    fuente: H.FUENTE_MIELOMA,
    ciclos_defecto: 8,
    fases: [
      { desde: 1, hasta: null, duracion: 21, etiqueta: "Todos los ciclos", items: [btz([1, 4, 8, 11]), it("Lenalidomida", "Len", "25 mg", "casa", R(1, 14)), it("Dexametasona", "Dex", "20 mg", "casa", [1, 2, 4, 5, 8, 9, 11, 12])] }
    ]
  });
})();

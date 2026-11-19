(function () {
  var RX = typeof RxData !== "undefined" ? RxData : require("../../js/regimen-data.js");
  var H = typeof RxHelpers !== "undefined" ? RxHelpers : (typeof require === "function" ? require("./helpers.js") : null);
  if (!H) { if (typeof console !== "undefined") console.error("RxHelpers no disponible: data/regimens/helpers.js no se cargó; esquema omitido."); return; }
  var R = H.R, len = H.len, dexH = H.dexH, dexC = H.dexC, dara = H.dara;
  RX.register({
    id: "mieloma-drd",
    nombre: "DRd",
    area: "Hematología",
    linea: "1ª línea · no candidatos",
    ensayo: "MAIA",
    estado: "pendiente",
    fecha_revision: null,
    fuente: H.FUENTE_MIELOMA,
    ciclos_defecto: 12,
    continuo: true,
    supuestos: [
      "Dos tonos de rojo en el Excel interpretados como dexametasona fraccionada: 20 mg el día de daratumumab (premedicación en hospital) + 20 mg al día siguiente en casa",
      H.NOTA_CD38
    ],
    fases: [
      { desde: 1, hasta: 2, duracion: 28, etiqueta: "C1–2", items: [len(R(1, 21)), dexH([1, 8, 15, 22], "premed."), dexC([2, 9, 16, 23]), dara([1, 8, 15, 22])] },
      { desde: 3, hasta: 6, duracion: 28, etiqueta: "C3–6", items: [len(R(1, 21)), dexH([1, 15], "premed."), dexC([2, 16]), dara([1, 15])] },
      { desde: 7, hasta: null, duracion: 28, etiqueta: "C7 en adelante", items: [len(R(1, 21)), dexH([1], "premed."), dexC([2]), dara([1])] }
    ]
  });
})();

(function () {
  var RX = typeof RxData !== "undefined" ? RxData : require("../../js/regimen-data.js");
  var FUENTE = "Pestaña Esquemas del Excel de costes de mieloma múltiple del Servicio (vía artefacto HematoFH)";
  var SW = "La demo original permitía alternar daratumumab/isatuximab entre vía SC e IV; ese cambio se ha eliminado y se muestra la vía almacenada.";
  function R(a, b) { var o = []; for (var i = a; i <= b; i++) o.push(i); return o; }
  function it(farmaco, abrev, dosis, lugar, dias, etiqueta) {
    var o = { farmaco: farmaco, abrev: abrev, dosis: dosis, lugar: lugar, dias: dias };
    if (etiqueta) o.etiqueta = etiqueta;
    return o;
  }
  var LEN = function (d) { return it("Lenalidomida", "Len", "25 mg", "casa", d); };
  var DEXH = function (d, e) { return it("Dexametasona", "Dex", "20 mg", "hospital", d, e); };
  var DEXC = function (d) { return it("Dexametasona", "Dex", "20 mg", "casa", d); };
  var DARA = function (d) { return it("Daratumumab SC", "Dara", "1800 mg", "hospital", d); };
  var ISA = function (d) { return it("Isatuximab IV", "Isa", "10 mg/kg", "hospital", d); };
  var BTZ = function (d) { return it("Bortezomib SC", "Btz", "1,3 mg/m²", "hospital", d); };
  var CFZ = function (dosis, d) { return it("Carfilzomib IV", "Cfz", dosis, "hospital", d); };

  RX.register({
    id: "mieloma-isa-kd",
    nombre: "Isa-Kd",
    area: "Hematología",
    linea: "2ª línea",
    ensayo: "IKEMA",
    estado: "pendiente",
    fecha_revision: null,
    fuente: FUENTE,
    ciclos_defecto: 12,
    supuestos: ["Dexametasona 20 mg por día marcado", SW],
    fases: [
      { desde: 1, hasta: 1, duracion: 28, etiqueta: "C1", items: [ISA([1, 8, 15, 22]), CFZ("20 mg/m²", [1, 2]), CFZ("56 mg/m²", [8, 9, 15, 16]), DEXC([1, 2, 8, 9, 15, 16, 22])] },
      { desde: 2, hasta: null, duracion: 28, etiqueta: "C2 en adelante", items: [ISA([1, 15]), CFZ("56 mg/m²", [1, 2, 8, 9, 15, 16]), DEXC([1, 2, 8, 9, 15, 16])] }
    ]
  });
})();

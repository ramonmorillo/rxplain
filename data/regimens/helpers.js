(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RxHelpers = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function R(a, b) { var o = []; for (var i = a; i <= b; i++) o.push(i); return o; }

  function it(farmaco, abrev, dosis, lugar, dias, etiqueta) {
    var o = { farmaco: farmaco, abrev: abrev, dosis: dosis, lugar: lugar, dias: dias };
    if (etiqueta) o.etiqueta = etiqueta;
    return o;
  }

  return {
    FUENTE_MIELOMA: "Pestaña Esquemas del Excel de costes de mieloma múltiple del Servicio (vía artefacto HematoFH)",
    NOTA_CD38: "La demo original permitía alternar daratumumab/isatuximab entre vía SC e IV; ese cambio se ha eliminado y se muestra la vía almacenada.",
    R: R,
    it: it,
    len: function (d) { return it("Lenalidomida", "Len", "25 mg", "casa", d); },
    dexH: function (d, e) { return it("Dexametasona", "Dex", "20 mg", "hospital", d, e); },
    dexC: function (d) { return it("Dexametasona", "Dex", "20 mg", "casa", d); },
    dara: function (d) { return it("Daratumumab SC", "Dara", "1800 mg", "hospital", d); },
    isa: function (d) { return it("Isatuximab IV", "Isa", "10 mg/kg", "hospital", d); },
    btz: function (d) { return it("Bortezomib SC", "Btz", "1,3 mg/m²", "hospital", d); },
    cfz: function (dosis, d) { return it("Carfilzomib IV", "Cfz", dosis, "hospital", d); }
  };
});

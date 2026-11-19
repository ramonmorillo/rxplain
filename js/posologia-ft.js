(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RxPosologia = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  // Extractor conservador de la frecuencia (no de la dosis) desde el texto del apartado 4.2.
  // Regla de oro: NUNCA adivina. Lo que no entiende queda vacío y se avisa; cada propuesta
  // lleva la frase de la que sale. No se extrae ni se calcula ninguna dosis.

  var NUM_WORDS = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 };
  var NOTA_BASE = "Solo se ha leído la frecuencia; la dosis, el lugar y el área los completa el farmacéutico.";

  function norm(s) {
    return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  function num(tok) { return parseFloat(String(tok).replace(",", ".")); }
  function isInt(x) { return isFinite(x) && Math.abs(x - Math.round(x)) < 1e-9; }
  function blank(w, m) {
    return w.slice(0, m.index) + new Array(m[0].length + 1).join(" ") + w.slice(m.index + m[0].length);
  }
  function splitSentences(text) {
    return text.split(/\n+|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡0-9])/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function unitDays(u) { return /^sem/.test(u) ? 7 : 1; }

  function sentence(frase, props, avisos) {
    var w = norm(frase);
    var found = []; // { pos, p }
    function aviso(msg) { avisos.push("«" + frase + "»: " + msg); }
    function add(pos, p) { p.frase = frase; found.push({ pos: pos, p: p }); }
    var m;

    // 1) Inducción + mantenimiento: "semanas 0, 2 y 4 y después cada 8 semanas"
    var reInd = /(semanas?|dias?)\s+(\d+(?:[.,]\d+)?(?:\s*(?:,|y|e)\s*\d+(?:[.,]\d+)?)*)\s*[,;]?\s*(?:y\s+)?(?:despues|posteriormente|luego|a continuacion)\b[^.]*?\bcada\s+(\d+(?:[.,]\d+)?)\s*(semanas?|dias?)/;
    m = reInd.exec(w);
    if (m) {
      var idx = m.index, mult = unitDays(m[1]);
      var weeks = (m[2].match(/\d+(?:[.,]\d+)?/g) || []).map(num);
      var cada = num(m[3]) * unitDays(m[4]);
      w = blank(w, m);
      var ok = weeks.length > 0 && weeks.every(function (x) { return isInt(x * mult) && x >= 0; });
      if (!ok) aviso("las semanas/días iniciales no son números enteros; no se propone pauta.");
      else if (!weeks.every(function (x, i) { return i === 0 || x > weeks[i - 1]; })) aviso("las dosis iniciales no están en orden creciente; no se propone pauta.");
      else if (!isInt(cada) || cada < 1) aviso("el intervalo de mantenimiento no equivale a un número entero de días; no se propone pauta.");
      else {
        var desp = weeks.map(function (x) { return Math.round(x * mult); });
        var last = desp[desp.length - 1];
        var p = { tipo: "intervalo", desplazamientos_dias: desp, cada_dias: Math.round(cada), primer_mantenimiento_dia: "", notas: NOTA_BASE };
        if (p.cada_dias > last) {
          p.primer_mantenimiento_dia = p.cada_dias;
          p.notas += " Primer mantenimiento situado en el día " + p.cada_dias + " (el intervalo contado desde el día 0); compruebe en la ficha si debe contarse desde la última dosis inicial.";
        } else {
          aviso("el primer mantenimiento no queda después de la última dosis inicial (día " + last + "); se deja vacío para que lo indique el farmacéutico.");
          p.notas += " Primer mantenimiento sin determinar.";
        }
        add(idx, p);
      }
    }

    // 2) Ciclos
    var reC1 = /\bdias?\s+(\d+)\s*(?:a|al|-)\s*(\d+)\s+(?:de|del)\s+(?:cada\s+|los\s+|un\s+)?ciclos?\s+de\s+(\d+)\s*dias?/;
    var reC2 = /\b(\d+)\s*dias?\s+de\s+cada\s+(\d+)\s*dias?/;
    var ciclos = [];
    [[reC1, true], [reC2, false]].forEach(function (pair) {
      var mm = pair[0].exec(w);
      if (!mm) return;
      var a = pair[1] ? parseInt(mm[1], 10) : 1;
      var b = parseInt(pair[1] ? mm[2] : mm[1], 10);
      var y = parseInt(pair[1] ? mm[3] : mm[2], 10);
      w = blank(w, mm);
      if (a < 1 || a > b || b > y) { aviso("los días del ciclo (" + a + " a " + b + " de " + y + ") no son coherentes; no se propone pauta."); return; }
      var p = { tipo: "ciclo", dias_ciclo: a + "-" + b, ciclo_dias: y, notas: NOTA_BASE };
      ciclos.push(p);
      add(mm.index, p);
    });

    // 3) Intervalos y horas: "cada N semanas|días|horas"
    var reCada = /\bcada\s+(\d+(?:[.,]\d+)?)\s*(semanas?|dias?|horas?)\b/g;
    var matches = [];
    while ((m = reCada.exec(w))) matches.push(m);
    matches.forEach(function (mm) {
      var v = num(mm[1]), u = mm[2];
      if (/^hor/.test(u)) {
        var n = 24 / v;
        if (!isInt(v) || !isInt(n) || n < 1 || n > 6) { aviso("«cada " + mm[1] + " horas» no equivale a un número entero de tomas al día (1 a 6); no se propone pauta."); return; }
        add(mm.index, { tipo: "diaria", veces_al_dia: Math.round(n), notas: NOTA_BASE + " Falta la duración del ciclo y los días." });
        return;
      }
      var d = v * unitDays(u);
      if (!isInt(d) || d < 1) { aviso("«cada " + mm[1] + " " + u + "» no equivale a un número entero de días; no se propone pauta."); return; }
      add(mm.index, { tipo: "intervalo", cada_dias: Math.round(d), desplazamientos_dias: [], primer_mantenimiento_dia: "", notas: NOTA_BASE });
    });
    w = w.replace(reCada, function (s) { return new Array(s.length + 1).join(" "); });

    // 4) Veces al día
    var reD = /\b(una|un|dos|tres|cuatro|cinco|seis|[1-6])\s+(?:vez|veces)\s+(?:al|por)\s+dia\b/g;
    var daily = [];
    while ((m = reD.exec(w))) daily.push(m);
    daily.forEach(function (mm) {
      var n = NUM_WORDS[mm[1]] || parseInt(mm[1], 10);
      if (ciclos.length === 1 && daily.length === 1) { ciclos[0].veces_al_dia = n; return; }
      add(mm.index, { tipo: "diaria", veces_al_dia: n, notas: NOTA_BASE + " Falta la duración del ciclo y los días." });
    });

    found.sort(function (a, b) { return a.pos - b.pos; });
    found.forEach(function (f) { props.push(f.p); });
  }

  function extraer(texto) {
    var props = [], avisos = [];
    if (typeof texto !== "string" || !texto.trim()) {
      return { propuestas: [], avisos: ["No hay texto del apartado 4.2 del que extraer una pauta."] };
    }
    splitSentences(texto).forEach(function (s) { sentence(s, props, avisos); });
    if (!props.length) {
      avisos.unshift("No se reconoció ninguna pauta en el texto; no se propone nada. Revise la ficha técnica y cree la pauta a mano.");
    }
    return { propuestas: props, avisos: avisos };
  }

  return { extraer: extraer };
});

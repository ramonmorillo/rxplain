(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RxPosologia = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  // Extractor conservador de la frecuencia (no de la dosis) desde el texto del apartado 4.2.
  // Regla de oro: NUNCA adivina. Si una frase contiene un calificador que no se entiende del
  // todo (máximos, condicionales, descansos, duraciones, alternativas...) o no se propone nada
  // o la propuesta lleva un aviso propio que nombra lo no recogido.

  var WORDS = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };
  var NW = "un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce";
  var NUM = "(?:\\d+(?:[.,]\\d+)?|" + NW + ")";
  var NOTA_BASE = "Solo se ha leído la frecuencia; la dosis, el lugar y el área los completa el farmacéutico.";
  var CONN = "(?:despues|posteriormente|luego|a continuacion|seguid[oa]s?\\s+de)";
  var HEAD = "(semanas?|dias?)\\s+(\\d+(?:[.,]\\d+)?(?:\\s*(?:,|y|e)\\s*(?:(?:semanas?|dias?)\\s+)?\\d+(?:[.,]\\d+)?)*)";
  var BLOQ = /\b(hasta un maximo|hasta|maximo|maxima|no mas de|mas de|sin superar|no superar|como maximo|si es necesario|si fuera necesario|si precisa|puede aumentarse|puede reducirse|puede aumentar|puede reducir|segun necesidad|en caso de|dosis de carga|dosis de ataque)\b/;

  // Calificadores que la pauta (una sola frecuencia) no sabe representar: nunca se adivina.
  var GUARD = /\b(alternas|alternos|dias? si|excepto|salvo|fines? de semana|lunes a viernes|sabados?|domingos?|primer(?:a|as|os)\s+(?:\w+\s+)?semanas?|al mes|mensual\w*|cada\s+\w+\s+meses|cada\s+mes|meses)\b/;
  var CONN_GUARD = /\b(despues(?!\s+de\s+(?:la|las|el|los|comer|cada)\b)|luego|a continuacion)\b/;
  var POBL = /\b(adultos?|ninos?|pediatric\w*|ancianos?|insuficiencia\s+(?:renal|hepatica))\b/;

  function norm(s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function num(tok) { return WORDS[tok] !== undefined ? WORDS[tok] : parseFloat(String(tok).replace(",", ".")); }
  function isInt(x) { return isFinite(x) && Math.abs(x - Math.round(x)) < 1e-9; }
  function blank(w, m) { return w.slice(0, m.index) + new Array(m[0].length + 1).join(" ") + w.slice(m.index + m[0].length); }
  function splitSentences(text) {
    return text.split(/\n+|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡0-9])/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function unitDays(u) { return /^sem/.test(u) ? 7 : 1; }
  function newProp(tipo, extra, notas) {
    var p = { tipo: tipo, notas: notas || NOTA_BASE, avisos: [] };
    Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
    return p;
  }

  // frase: lo que se muestra; src: texto con el que se busca (puede unir dos frases)
  function sentence(frase, src, props, avisos) {
    var w = norm(src);
    var found = [];
    function aviso(msg) { avisos.push("«" + frase + "»: " + msg); }
    function add(pos, p) { p.frase = frase; found.push({ pos: pos, p: p }); }
    var m, dropped = false;

    m = GUARD.exec(w);
    if (m) { aviso("contiene «" + m[1] + "» (calendario o fases que no se pueden representar con una sola frecuencia); no se propone pauta."); return; }
    if (CONN_GUARD.test(w) && !new RegExp("\\b" + HEAD + "\\s*[,;]?\\s*(?:y\\s+)?" + CONN + "\\b[^.]*?\\bcada\\s+(" + NUM + ")\\s*(semanas?|dias?)").test(w)) {
      aviso("contiene «" + CONN_GUARD.exec(w)[1] + "» (una secuencia de fases que no se puede representar); no se propone pauta."); return;
    }

    m = BLOQ.exec(w);
    if (m) { aviso("contiene «" + m[1] + "» (máximo, límite, condición o dosis especial); no se propone pauta."); return; }
    if (/\bcada\s+\w+\s*(?:semanas?|dias?|horas?)?\s+o\s+(?:cada\s+)?\d/.test(w)) {
      aviso("plantea alternativas («o»); no se propone pauta."); return;
    }
    if (/\bcada\s+\d+(?:[.,]\d+)?\s*(?:-|a)\s*\d+(?:[.,]\d+)?\s*(?:semanas?|dias?|horas?)/.test(w)) {
      aviso("indica un rango de intervalo («cada N-M…»); no se propone pauta."); return;
    }

    // 1) Inducción + mantenimiento
    var reInd = new RegExp("\\b" + HEAD + "\\s*[,;]?\\s*(?:y\\s+)?" + CONN + "\\b[^.]*?\\bcada\\s+(" + NUM + ")\\s*(semanas?|dias?)");
    m = reInd.exec(w);
    if (m) {
      var idx = m.index;
      var units = (m[0].match(/semanas?|dias?/g) || []).slice(0, -1).map(function (u) { return /^sem/.test(u) ? "s" : "d"; });
      var weeks = (m[2].match(/\d+(?:[.,]\d+)?/g) || []).map(num);
      var cada = num(m[3]) * unitDays(m[4]);
      w = blank(w, m);
      var uniq = units.filter(function (u, i) { return units.indexOf(u) === i; });
      var byDay = uniq[0] === "d";
      var mult = byDay ? 1 : 7;
      if (uniq.length !== 1) { aviso("la lista de dosis iniciales mezcla unidades (semanas y días); no se propone pauta."); dropped = true; }
      else if (!weeks.every(function (x) { return isInt(x * mult) && x >= (byDay ? 1 : 0); })) { aviso("las dosis iniciales no son números enteros válidos; no se propone pauta."); dropped = true; }
      else if (!weeks.every(function (x, i) { return i === 0 || x > weeks[i - 1]; })) { aviso("las dosis iniciales no están en orden creciente; no se propone pauta."); dropped = true; }
      else if (!isInt(cada) || cada < 1) { aviso("el intervalo de mantenimiento no equivale a un número entero de días; no se propone pauta."); dropped = true; }
      else {
        var desp = weeks.map(function (x) { return Math.round(x * mult) - (byDay ? 1 : 0); });
        var last = desp[desp.length - 1];
        var p = newProp("intervalo", { desplazamientos_dias: desp, cada_dias: Math.round(cada), primer_mantenimiento_dia: "" });
        if (byDay) p.notas += " Los días de la ficha se han convertido a desplazamientos desde el día de inicio (día 1 = desplazamiento 0).";
        if (p.cada_dias > last) {
          p.primer_mantenimiento_dia = p.cada_dias;
          p.notas += " Primer mantenimiento situado en el día " + p.cada_dias + " (el intervalo contado desde el día 0); compruebe en la ficha si debe contarse desde la última dosis inicial.";
        } else {
          p.avisos.push("el primer mantenimiento no queda después de la última dosis inicial (día " + last + "); se deja vacío para que lo indique el farmacéutico.");
          p.notas += " Primer mantenimiento sin determinar.";
        }
        add(idx, p);
      }
    }

    // 2) Ciclos
    var ciclos = [];
    function cicloProp(pos, a, b, y, extraNota) {
      if (a < 1 || a > b || b > y) { aviso("los días del ciclo (" + a + " a " + b + " de " + y + ") no son coherentes; no se propone pauta."); dropped = true; return; }
      var p = newProp("ciclo", { dias_ciclo: a + "-" + b, ciclo_dias: y }, NOTA_BASE + (extraNota || ""));
      ciclos.push(p); add(pos, p);
    }
    var reCD = /\bdurante\s+(\d+)\s*dias?\s*,?\s*seguid[oa]s?\s+de\s+(\d+)\s*dias?\s+(?:de\s+descanso|sin\s+tratamiento|libres?|de\s+pausa)\s*(?:[,(]\s*)?(?:(?:en\s+)?ciclos?\s+de\s+(\d+)\s*dias?\)?)?/;
    m = reCD.exec(w);
    if (m) {
      var D = parseInt(m[1], 10), R = parseInt(m[2], 10), C = m[3] ? parseInt(m[3], 10) : null;
      w = blank(w, m);
      if (C !== null && C !== D + R) { aviso("el ciclo indicado (" + C + " días) no coincide con " + D + " de tratamiento + " + R + " de descanso; no se propone pauta."); dropped = true; }
      else cicloProp(m.index, 1, D, D + R, C === null ? " Duración del ciclo deducida (tratamiento + descanso); compruébela." : "");
    }
    var reC1 = /\bdias?\s+(\d+)\s*(?:a|al|-)\s*(\d+)\s+(?:de|del)\s+(?:cada\s+|los\s+|un\s+)?ciclos?\s+de\s+(\d+)\s*dias?/;
    m = reC1.exec(w);
    if (m) { w = blank(w, m); cicloProp(m.index, parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)); }
    var reC3 = /\bdias?\s+(\d+)\s*(?:a|al|-)\s*(\d+)\s*,?\s*(?:de\s+)?cada\s+(\d+)\s*dias?/;
    m = reC3.exec(w);
    if (m) { w = blank(w, m); cicloProp(m.index, parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)); }
    var reC2 = /\b(\d+)\s*dias?\s+de\s+cada\s+(\d+)\s*dias?/;
    m = reC2.exec(w);
    if (m) { w = blank(w, m); cicloProp(m.index, 1, parseInt(m[1], 10), parseInt(m[2], 10)); }

    if (dropped) return;

    // Calificadores de ciclo/descanso no consumidos: no se propone nada de esta frase
    var rest = /\b(descans\w*|sin tratamiento|pausa|libres?)\b/.exec(w);
    var rango = /\bdias?\s+\d+\s*(?:-|a|al)\s*\d+/.exec(w);
    var ciclo = /\bciclos?\s+de\s+\d+/.exec(w);
    var bad = rest || rango || ciclo;
    if (bad) {
      aviso("contiene «" + bad[0].trim() + "» (descanso, rango de días o ciclo) que no se ha podido interpretar; no se propone pauta.");
      return;
    }

    // 3) Intervalos y horas
    var reCada = new RegExp("\\bcada\\s+(" + NUM + ")\\s*(semanas?|dias?|horas?|h)\\b", "g");
    var dailies = [];
    var ms = [];
    while ((m = reCada.exec(w))) ms.push(m);
    ms.forEach(function (mm) {
      var v = num(mm[1]), u = mm[2];
      if (/^h/.test(u)) {
        var n = 24 / v;
        if (!isInt(v) || !isInt(n) || n < 1 || n > 6) { aviso("«cada " + mm[1] + " horas» no equivale a un número entero de tomas al día (1 a 6); no se propone pauta."); return; }
        dailies.push({ pos: mm.index, n: Math.round(n) });
        return;
      }
      var d = v * unitDays(u);
      if (!isInt(d) || d < 1) { aviso("«cada " + mm[1] + " " + u + "» no equivale a un número entero de días; no se propone pauta."); return; }
      add(mm.index, newProp("intervalo", { cada_dias: Math.round(d), desplazamientos_dias: [], primer_mantenimiento_dia: "" }));
    });
    w = w.replace(reCada, function (s) { return new Array(s.length + 1).join(" "); });
    var reSem = /\b(una|1)\s+vez\s+a\s+la\s+semana\b/g;
    while ((m = reSem.exec(w))) add(m.index, newProp("intervalo", { cada_dias: 7, desplazamientos_dias: [], primer_mantenimiento_dia: "" }));

    // 4) Veces al día
    var reD = /\b(una|un|dos|tres|cuatro|cinco|seis|[1-6])\s+(?:vez|veces)\s+(?:al|por)\s+dia\b/g;
    while ((m = reD.exec(w))) dailies.push({ pos: m.index, n: WORDS[m[1]] || parseInt(m[1], 10) });
    if (ciclos.length === 1 && dailies.length === 1) ciclos[0].veces_al_dia = dailies[0].n;
    else dailies.forEach(function (dd) {
      add(dd.pos, newProp("diaria", { veces_al_dia: dd.n }, NOTA_BASE + " Falta la duración del ciclo y los días."));
    });

    // 5) Duración no recogida
    var dur = new RegExp("\\bdurante\\s+(" + NUM + ")\\s*(semanas?|dias?|meses|mes|anos?|horas?)").exec(w);
    if (dur) {
      var orig = /durante\s+\S+\s+\S+/i.exec(src.normalize("NFD").replace(/[̀-ͯ]/g, ""));
      var txt = orig ? orig[0].replace(/^durante\s+/i, "") : dur[1] + " " + dur[2];
      found.forEach(function (f) {
        f.p.avisos.push("duración de " + txt + " no incluida; ajuste el nº de dosis o ciclos.");
      });
    }

    found.sort(function (a, b) { return a.pos - b.pos; });
    found.forEach(function (f) { props.push(f.p); });
  }

  function headOrphan(w) {
    if (/\bcada\b/.test(w) || new RegExp(CONN).test(w)) return false;
    var m = new RegExp("\\b" + HEAD).exec(w);
    return !!m && (m[2].match(/\d+(?:[.,]\d+)?/g) || []).length >= 2;
  }

  function extraer(texto) {
    var props = [], avisos = [];
    if (typeof texto !== "string" || !texto.trim()) {
      return { propuestas: [], avisos: ["No hay texto del apartado 4.2 del que extraer una pauta."] };
    }
    var ss = splitSentences(texto);
    for (var i = 0; i < ss.length; i++) {
      var s = ss[i], w = norm(s), nx = ss[i + 1];
      var contin = function (x) { return !!x && /^(despues|posteriormente|luego|a continuacion)\b(?!\s+de\s+la\b)/.test(norm(x)) && /\bcada\b/.test(norm(x)); };
      if (headOrphan(w)) {
        if (contin(nx)) {
          sentence(s + " " + nx, s.replace(/[.!?]+\s*$/, "") + " " + nx, props, avisos);
          i++;
        } else {
          avisos.push("«" + s + "»: lista de dosis iniciales sin mantenimiento reconocido; no se propone pauta.");
        }
        continue;
      }
      if (contin(s)) {
        avisos.push("«" + s + "»: continúa una pauta anterior (inducción) que no se ha podido unir; no se propone pauta.");
        continue;
      }
      sentence(s, s, props, avisos);
    }
    var seen = {};
    props = props.filter(function (p) { var k = JSON.stringify(p); if (seen[k]) return false; seen[k] = 1; return true; });
    if (!props.length) {
      avisos.unshift("No se reconoció ninguna pauta en el texto; no se propone nada. Revise la ficha técnica y cree la pauta a mano.");
    }
    if (POBL.test(norm(texto))) {
      props.forEach(function (p) { p.avisos.push("La ficha distingue poblaciones: revise a cuál corresponde la frase."); });
    }
    props.forEach(function (p) { p.avisos.forEach(function (a) { avisos.push("«" + p.frase + "»: " + a); }); });
    return { propuestas: props, avisos: avisos };
  }

  return { extraer: extraer };
});

  const meds = [];
  const $ = (id)=>document.getElementById(id);

  function escapeHtml(str){
    return (str||"").replace(/[&<>"']/g, (c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  function sanitizeLines(text, max=8){
    return (text||"").split("\n").map(s=>s.trim().replace(/^[-•]\s*/, "")).filter(Boolean).slice(0, max);
  }

  function renderMedList(){
    $("count").textContent = meds.length.toString();
    if (!meds.length){
      $("medList").innerHTML = `<div class="emptyList">Todavía no hay medicamentos añadidos. Complete los campos del tratamiento y pulse “Añadir medicamento”.</div>`;
      return;
    }
    $("medList").innerHTML = meds.map((m,i)=>{
      const src = m.cima?.nregistro ? `<div class="medListMeta"><b>Fuente:</b> CIMA/AEMPS · nregistro ${escapeHtml(m.cima.nregistro)}</div>` : "";
      const notes = (m.warn||[]).length ? `<div class="medListMeta"><b>Alertas:</b> ${escapeHtml((m.warn||[]).slice(0,2).join(" · "))}</div>` : "";
      return `
        <article class="medListCard">
          <div class="medListCardHeader">
            <div>
              <h3 class="medListTitle">${escapeHtml(m.name)}</h3>
              <div class="medListMeta"><b>Cómo se toma:</b> ${escapeHtml(m.dose || "Pendiente de completar")}</div>
              ${m.indication ? `<div class="medListMeta"><b>Para qué:</b> ${escapeHtml(m.indication)}</div>` : ""}
              ${notes}${src}
              <div class="medListActions">
                <button class="miniBtn" type="button" data-action="edit" data-index="${i}">Editar</button>
                <button class="miniBtn danger" type="button" data-action="delete" data-index="${i}">Eliminar</button>
              </div>
            </div>
            <span class="medListIndex">${i+1}</span>
          </div>
        </article>`;
    }).join("");
    [...$("medList").querySelectorAll("button[data-action]")].forEach((button)=>{
      button.addEventListener("click", ()=>{
        const index = Number(button.getAttribute("data-index"));
        const action = button.getAttribute("data-action");
        if (action === "edit") editMedication(index);
        if (action === "delete") deleteMedication(index);
      });
    });
  }

  function editMedication(index){
    const med = meds[index];
    if (!med) return;
    $("m_name").value = med.name || "";
    $("m_ind").value = med.indication || "";
    $("m_dose").value = med.dose || "";
    $("m_benefit").value = med.benefit || "";
    $("m_ae").value = (med.ae || []).map(x=>`- ${x}`).join("\n");
    $("m_warn").value = (med.warn || []).map(x=>`- ${x}`).join("\n");
    $("m_notes").value = (med.notes || []).map(x=>`- ${x}`).join("\n");
    if (med.cima?.nregistro){
      window.__lastCima = { nregistro: med.cima.nregistro, nombre: med.name || "", url_cima: med.cima.url };
    } else {
      window.__lastCima = null;
    }
    meds.splice(index, 1);
    renderMedList();
    hideCimaImgPanel();
    $("m_name").scrollIntoView({behavior:"smooth", block:"center"});
    $("m_name").focus();
  }

  function deleteMedication(index){
    if (index < 0 || index >= meds.length) return;
    meds.splice(index, 1);
    renderMedList();
    if (!meds.length){
      $("outputWrap").style.display = "none";
      $("print").disabled = true;
    }
  }

  function resetMedInputs(){
    ["m_name","m_ind","m_dose","m_benefit","m_ae","m_warn","m_notes"].forEach(id=>$(id).value="");
    $("m_name").focus();
  }

  function addMedication(obj){
    meds.push(obj);
    renderMedList();
  }

  function computeTags(){
    const course = $("course").value;
    const lit = $("lit").value;
    const age = $("age").value;
    const ctx = $("ctx").value;
    const hasWarn = meds.some(m=>m.warn?.length);
    const hasNormal = meds.some(m=>m.ae?.length);
    const anyCima = meds.some(m=>m.cima?.nregistro);
    const tags = [
      course==="cronico" ? {t:"Proceso crónico", cls:"ok"} : {t:"Proceso agudo", cls:"ok"},
      {t:`${meds.length} medicamento${meds.length===1 ? "" : "s"}`, cls:""},
      {t:`Alfabetización: ${lit}`, cls:""},
      {t:`Edad: ${age}`, cls:""},
      {t:`Contexto: ${ctx}`, cls:""}
    ];
    if (hasWarn) tags.push({t:"Señales de alarma", cls:"danger"});
    if (hasNormal) tags.push({t:"Efectos esperables", cls:"warn"});
    if (anyCima) tags.push({t:"CIMA/AEMPS", cls:""});
    return tags;
  }

  function pickTopMessages(){
    const scored = meds.map(m=>{
      let s=0;
      if ((m.warn||[]).length) s+=5;
      if ((m.benefit||"").length>20) s+=2;
      if ((m.notes||[]).length) s+=1;
      return {m,s};
    }).sort((a,b)=>b.s-a.s);

    return scored.slice(0,3).map(x=>{
      const m=x.m;
      const w=(m.warn||[])[0];
      const b=(m.benefit||"");
      if (w) return `Prioridad: <b>${escapeHtml(m.name)}</b> — vigilar: ${escapeHtml(w)}`;
      if (b) return `Clave: <b>${escapeHtml(m.name)}</b> — ${escapeHtml(b)}`;
      return `Clave: <b>${escapeHtml(m.name)}</b>`;
    });
  }

  function bullets(items, fallback){
    const values = items && items.length ? items : [fallback];
    return values.slice(0,6).map(x=>`<li>${escapeHtml(x)}</li>`).join("");
  }

  function buildOutput(){
    const course = $("course").value;
    const indication = $("indication").value.trim();
    const goals = sanitizeLines($("goals").value, 6);
    const eduGoal = $("edu_goal").value.trim();
    const pharmName = $("pharm_name").value.trim();
    const center = $("center").value.trim();
    const contact = $("contact").value.trim();
    const date = $("date").value.trim();

    const headerLines = [];
    if (indication) headerLines.push(`<b>Indicación principal:</b> ${escapeHtml(indication)}`);
    if (goals.length) headerLines.push(`<b>Objetivos en salud:</b> ${goals.map(g=>escapeHtml(g)).join(" · ")}`);
    if (eduGoal) headerLines.push(`<b>Objetivo educativo:</b> ${escapeHtml(eduGoal)}`);
    if (!headerLines.length) headerLines.push("Información adaptada para facilitar el uso correcto del tratamiento.");

    const tags = computeTags();
    const topMsgs = pickTopMessages();

    const medCards = meds.map((m)=>{
      const notes = (m.notes||[]).slice(0,4);
      const cimaLine = m.cima?.nregistro
        ? `<li><b>Fuente:</b> <a href="${escapeHtml(m.cima.url)}" target="_blank" rel="noopener">CIMA/AEMPS</a> · nregistro ${escapeHtml(m.cima.nregistro)}</li>`
        : "";
      return `
        <article class="patientMedCard">
          <header class="patientMedHeader">
            <span class="iconBadge">💊</span>
            <div>
              <h4>${escapeHtml(m.name)}</h4>
              <p>${m.benefit ? escapeHtml(m.benefit) : "Información revisada por el farmacéutico para este paciente."}</p>
            </div>
          </header>
          <div class="patientMedBody">
            <section class="infoTile"><h5><span class="iconBadge">🎯</span>Para qué sirve</h5><ul>${m.indication ? `<li>${escapeHtml(m.indication)}</li>` : "<li>Según la indicación explicada por tu equipo sanitario.</li>"}${cimaLine}</ul></section>
            <section class="infoTile"><h5><span class="iconBadge">🕒</span>Cómo tomarlo</h5><ul>${m.dose ? `<li>${escapeHtml(m.dose)}</li>` : "<li>Según la pauta indicada por tu equipo sanitario.</li>"}${course==="cronico" ? "<li>La regularidad es más importante que hacerlo perfecto.</li>" : "<li>Completa la duración indicada aunque mejores.</li>"}</ul></section>
            <section class="infoTile normal"><h5><span class="iconBadge">🙂</span>Qué puede ser normal notar</h5><ul>${bullets(m.ae, "Si notas molestias leves al inicio, suele ser transitorio.")}</ul></section>
            <section class="infoTile warning"><h5><span class="iconBadge">🚨</span>Cuándo debe avisar</h5><ul>${bullets(m.warn, "Si aparece un síntoma intenso, persistente o preocupante, consulta.")}</ul></section>
            ${notes.length ? `<section class="infoTile precautions"><h5><span class="iconBadge">🛡️</span>Precauciones relevantes</h5><ul>${notes.map(n=>`<li>${escapeHtml(n)}</li>`).join("")}</ul></section>` : ""}
          </div>
        </article>`;
    }).join("");

    const contactBlock = (pharmName || center || contact || date) ? `
      <div class="contactBlock">
        <b>Tu referencia de contacto</b>
        ${pharmName ? `<div><b>Farmacéutico/a:</b> ${escapeHtml(pharmName)}</div>` : ""}
        ${center ? `<div><b>Centro/Servicio:</b> ${escapeHtml(center)}</div>` : ""}
        ${contact ? `<div><b>Contacto:</b> ${escapeHtml(contact)}</div>` : ""}
        ${date ? `<div><b>Fecha:</b> ${escapeHtml(date)}</div>` : ""}
      </div>` : "";

    const sourcesBlock = `
      <div class="sourcesBlock">
        <h4>Fuentes y recursos fiables</h4>
        <ul>
          <li><a href="https://www.ema.europa.eu/" target="_blank" rel="noopener">Agencia Europea del Medicamento (EMA)</a></li>
          <li><a href="https://www.aemps.gob.es/" target="_blank" rel="noopener">Agencia Española de Medicamentos y Productos Sanitarios (AEMPS)</a></li>
          <li><a href="https://cima.aemps.es/" target="_blank" rel="noopener">CIMA – Centro de Información online de Medicamentos (AEMPS)</a></li>
          <li><a href="https://www.sefh.es/" target="_blank" rel="noopener">Sociedad Española de Farmacia Hospitalaria (SEFH)</a></li>
          <li><a href="https://www.sefh.es/escuela-de-pacientes.php" target="_blank" rel="noopener">Escuela de Pacientes de la SEFH</a></li>
        </ul>
      </div>`;

    return `
      <div class="patientLead">
        <div>
          <h3>Tu tratamiento, explicado de forma clara</h3>
          <p class="sub">${headerLines.join("<br>")}</p>
        </div>
        <div class="printOnly"><b>RxPlain</b><br>Infografía revisable para paciente</div>
      </div>
      <div class="tags">${tags.slice(0,8).map(x=>`<span class="tag ${x.cls||""}">${escapeHtml(x.t)}</span>`).join("")}</div>
      <div class="priorityBox"><h4>Mensajes prioritarios (máx. 3)</h4><ul>${topMsgs.length ? topMsgs.map(x=>`<li>${x}</li>`).join("") : "<li>Integra el tratamiento en una rutina estable y pregunta si algo no queda claro.</li>"}</ul></div>
      <div class="medCards">${medCards}</div>
      ${contactBlock}
      ${sourcesBlock}
      <div class="authorBox"><b>RxPlain ha sido creada por Ramón Morillo en febrero de 2026</b> como herramienta de apoyo para la traducción farmacoterapéutica y la educación sanitaria en el ámbito de la Farmacia Hospitalaria.<br><small>Su finalidad es facilitar una comunicación más clara, personalizada y útil con los pacientes. No sustituye el juicio clínico del farmacéutico ni la ficha técnica o prospecto. Uso orientado a farmacéuticos de hospital en España.</small></div>
      <p class="foot">RxPlain · Creada por Ramón Morillo · Febrero 2026 · Farmacia Hospitalaria · España · Material informativo adaptado al perfil indicado. No sustituye la consulta con profesionales sanitarios.</p>`;
  }

  function addCurrentMedication(){
    const name = $("m_name").value.trim();
    if (!name) { alert("Falta el nombre del medicamento."); return; }
    const cima = window.__lastCima ? { ...window.__lastCima } : null;
    addMedication({
      name,
      indication: $("m_ind").value.trim(),
      dose: $("m_dose").value.trim(),
      benefit: $("m_benefit").value.trim(),
      ae: sanitizeLines($("m_ae").value, 8),
      warn: sanitizeLines($("m_warn").value, 8),
      notes: sanitizeLines($("m_notes").value, 6),
      cima: cima ? { nregistro: cima.nregistro, url: cima.url_cima } : null
    });
    window.__lastCima = null;
    $("cima_results").innerHTML = `<div class="tiny">Puede buscar otro medicamento en CIMA/AEMPS.</div>`;
    hideCimaImgPanel();
    resetMedInputs();
  }

  function loadExampleData(){
    meds.length=0;
    addMedication({name:"Atorvastatina",indication:"Reducir colesterol LDL y bajar el riesgo cardiovascular",dose:"1 vez al día, preferentemente por la noche, con o sin comida",benefit:"Ayuda a prevenir infarto e ictus a largo plazo",ae:["Molestias digestivas leves al inicio","Dolor muscular leve: coméntalo si aparece"],warn:["Dolor muscular intenso o debilidad marcada","Ictericia u orina muy oscura"],notes:["Evitar pomelo en grandes cantidades","Avisar si se añaden antibióticos nuevos"],cima:null});
    addMedication({name:"Enalapril/Hidroclorotiazida",indication:"Controlar la presión arterial",dose:"1 vez al día por la mañana",benefit:"Reduce el riesgo de complicaciones por hipertensión",ae:["Mareo al inicio: levántate despacio","Aumento de la diuresis"],warn:["Hinchazón de cara/labios o dificultad para respirar","Desmayo o mareo intenso persistente"],notes:["Hidratación adecuada","Control analítico según indicación médica"],cima:null});
    addMedication({name:"Metformina",indication:"Mejorar control de glucosa en diabetes tipo 2",dose:"Con comidas (desayuno y/o cena), según pauta",benefit:"Ayuda a controlar el azúcar y protege a largo plazo",ae:["Náuseas o diarrea al inicio: suele mejorar"],warn:["Vómitos persistentes o gran debilidad","Síntomas intensos tras deshidratación"],notes:["Tomarla con comida reduce molestias","En pruebas con contraste, avisa al equipo sanitario"],cima:null});
    $("age").value="adulto"; $("course").value="cronico"; $("lit").value="media"; $("ctx").value="general";
    $("indication").value="Riesgo cardiovascular elevado";
    $("goals").value="- Controlar presión arterial y LDL\n- Reducir riesgo de eventos cardiovasculares\n- Facilitar adherencia y minimizar efectos adversos";
    $("edu_goal").value="Integrar el tratamiento en 2 momentos del día y reconocer señales de alarma reales sin alarmismo.";
    renderMedList();
    $("cima_results").innerHTML = `<div class="tiny">Si quiere, pruebe a buscar en CIMA/AEMPS: escriba “atorv” o “metfor”.</div>`;
    document.getElementById("patientProfile").scrollIntoView({behavior:"smooth", block:"start"});
  }

  $("addMed").addEventListener("click", addCurrentMedication);
  $("loadExample").addEventListener("click", loadExampleData);
  // Desde la portada, cargar el ejemplo lleva a la Infografía para verlo.
  $("loadExampleHero").addEventListener("click", ()=>{ if (window.RxTabs) window.RxTabs.show("infografia"); loadExampleData(); });

  $("generate").addEventListener("click", ()=>{
    if (meds.length===0){ alert("Añade al menos 1 medicamento."); return; }
    $("output").innerHTML = buildOutput();
    $("outputWrap").style.display = "block";
    $("print").disabled = false;
    $("outputWrap").scrollIntoView({behavior:"smooth", block:"start"});
  });

  $("print").addEventListener("click", ()=>{
    if (!$("output").innerHTML.trim()) return;
    window.print();
  });

  $("clearAll").addEventListener("click", ()=>{
    meds.length = 0;
    renderMedList();
    $("output").innerHTML = "";
    $("outputWrap").style.display="none";
    $("print").disabled = true;
    resetMedInputs();
    $("cima_query").value = "";
    $("cima_results").innerHTML = `<div class="tiny">Escriba un nombre para buscar en CIMA/AEMPS (opcional).</div>`;
    ["indication","goals","edu_goal","pharm_name","center","contact","date"].forEach(id=>$(id).value="");
    window.__lastCima = null;
    hideCimaImgPanel();
  });

  const CIMA_API_BASE = "https://cima.aemps.es/cima/rest";

  function debounce(fn, ms){
    let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
  }

  async function cimaSearchByName(q){
    const url = `${CIMA_API_BASE}/medicamentos?nombre=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("No se pudo consultar CIMA");
    return res.json();
  }

  async function cimaGetByNregistro(nregistro){
    const url = `${CIMA_API_BASE}/medicamento?nregistro=${encodeURIComponent(nregistro)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("No se pudo obtener detalle del medicamento");
    return res.json();
  }

  function clasificarFotosCima(fotos){
    if (!Array.isArray(fotos) || !fotos.length) return { formaFarmac: [], materialAs: [] };
    const formaFarmac = fotos.filter(f => f.tipo === "formafarmac");
    const materialAs  = fotos.filter(f => f.tipo === "materialas");
    return { formaFarmac, materialAs };
  }

  function showCimaImgPanel(){ $("cimaImgPanel").style.display = "block"; }
  function hideCimaImgPanel(){ $("cimaImgPanel").style.display = "none"; $("cimaImgBody").innerHTML = ""; }

  function renderCimaFotos(fotos, nombre){
    const body = $("cimaImgBody");
    const { formaFarmac, materialAs } = clasificarFotosCima(fotos);
    if (!formaFarmac.length && !materialAs.length){
      body.innerHTML = `<div class="cimaImgPanel__msg">CIMA no dispone de imágenes para este medicamento/presentación.</div>`;
      showCimaImgPanel();
      return;
    }
    let html = "";
    if (formaFarmac.length){
      html += `<div class="cimaImgPanel__group"><h3>Forma farmacéutica</h3><div class="cimaImgPanel__grid">${formaFarmac.map(f => `<div class="cimaImgPanel__card" data-full="${escapeHtml(f.url || "")}"><img src="${escapeHtml(f.url || "")}" alt="Forma farmacéutica – ${escapeHtml(nombre)}" loading="lazy" /></div>`).join("")}</div></div>`;
    }
    if (materialAs.length){
      html += `<div class="cimaImgPanel__group"><h3>Material de acondicionamiento</h3><div class="cimaImgPanel__grid">${materialAs.map(f => `<div class="cimaImgPanel__card" data-full="${escapeHtml(f.url || "")}"><img src="${escapeHtml(f.url || "")}" alt="Acondicionamiento – ${escapeHtml(nombre)}" loading="lazy" /></div>`).join("")}</div></div>`;
    }
    body.innerHTML = html;
    showCimaImgPanel();
    [...body.querySelectorAll(".cimaImgPanel__card")].forEach(card => {
      card.addEventListener("click", () => {
        const src = card.getAttribute("data-full");
        if (src) openCimaModal(src);
      });
    });
  }

  function openCimaModal(src){
    const modal = $("cimaModal");
    const img = $("cimaModalImg");
    img.src = src;
    modal.classList.add("open");
  }

  function closeCimaModal(){
    const modal = $("cimaModal");
    modal.classList.remove("open");
    $("cimaModalImg").src = "";
  }

  $("cimaModal").addEventListener("click", (e) => {
    if (e.target === $("cimaModal") || e.target === $("cimaModalClose")) closeCimaModal();
  });
  $("cimaModalClose").addEventListener("click", closeCimaModal);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCimaModal(); });

  function renderCimaResults(items){
    const box = $("cima_results");
    if (!items || !items.length){
      box.innerHTML = `<div class="tiny">Sin resultados.</div>`;
      hideCimaImgPanel();
      return;
    }
    box.innerHTML = items.slice(0, 8).map((m)=>`
      <div class="resultItem" data-nregistro="${escapeHtml(m.nregistro||"")}">
        <div class="resultTitle">${escapeHtml(m.nombre || "Medicamento")}</div>
        <div class="resultMeta">nregistro: ${escapeHtml(m.nregistro || "—")}${m.pactivos ? ` · PA: ${escapeHtml(m.pactivos)}` : ""}</div>
      </div>`).join("");
    hideCimaImgPanel();
    [...box.querySelectorAll(".resultItem")].forEach(el=>{
      el.addEventListener("click", async ()=>{
        const nregistro = el.getAttribute("data-nregistro");
        if (!nregistro) return;
        $("cimaImgBody").innerHTML = `<div class="cimaImgPanel__loading">Cargando imágenes desde CIMA/AEMPS…</div>`;
        showCimaImgPanel();
        try{
          const detail = await cimaGetByNregistro(nregistro);
          $("m_name").value = detail.nombre || "";
          window.__lastCima = { nregistro, nombre: detail.nombre || "", url_cima: `https://cima.aemps.es/cima/publico/home.html#medicamento?${encodeURIComponent(nregistro)}`, fotos: detail.fotos || [] };
          box.innerHTML = `<div class="tiny">Seleccionado: <b>${escapeHtml(detail.nombre || "")}</b> (nregistro ${escapeHtml(nregistro)}). Complete los campos y pulse “Añadir medicamento”.</div>`;
          renderCimaFotos(detail.fotos || [], detail.nombre || "");
        }catch(e){
          $("cimaImgBody").innerHTML = `<div class="cimaImgPanel__msg">No se pudieron cargar las imágenes. ${escapeHtml(e.message)}</div>`;
          showCimaImgPanel();
          alert("Error al cargar detalle desde CIMA. " + e.message);
        }
      });
    });
  }

  const onCimaInput = debounce(async ()=>{
    const q = $("cima_query").value.trim();
    const box = $("cima_results");
    if (q.length < 3){
      box.innerHTML = `<div class="tiny">Escriba al menos 3 letras para buscar.</div>`;
      hideCimaImgPanel();
      return;
    }
    box.innerHTML = `<div class="tiny">Buscando en CIMA/AEMPS…</div>`;
    try{
      const data = await cimaSearchByName(q);
      const items = Array.isArray(data) ? data : (data?.resultados || data?.items || []);
      renderCimaResults(items);
    }catch(e){
      box.innerHTML = `<div class="tiny">No se pudo consultar CIMA/AEMPS. Si persiste, revise la conexión o pruebe más tarde.</div>`;
      hideCimaImgPanel();
    }
  }, 350);

  $("cima_query").addEventListener("input", onCimaInput);
  $("cima_results").innerHTML = `<div class="tiny">Escriba un nombre para buscar en CIMA/AEMPS (opcional).</div>`;
  renderMedList();

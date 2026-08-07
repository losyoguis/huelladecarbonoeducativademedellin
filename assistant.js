/* Asistente Ambiental SiMeCO2 v61 — OpenAI API con fallback local seguro */
(() => {
  'use strict';

  const ui = {};
  const history = [];
  const MAX_HISTORY = 16;
  const config = window.SIMECO_ASSISTANT_CONFIG || {};
  const monthMap = {
    enero:'01', febrero:'02', marzo:'03', abril:'04', mayo:'05', junio:'06',
    julio:'07', agosto:'08', septiembre:'09', setiembre:'09', octubre:'10', noviembre:'11', diciembre:'12'
  };

  const normalize = value => String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s.-]/g, ' ').replace(/\s+/g, ' ').trim();

  const number = value => Number(value) || 0;
  const format = value => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(number(value));
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const records = () => (typeof state !== 'undefined' && Array.isArray(state.records)) ? state.records : [];
  const assistantMeta = record => {
    try{ if(typeof getTerritorySyncMeta === 'function') return getTerritorySyncMeta(record) || {}; }catch{}
    return {};
  };
  const siteId = record => {
    const meta=assistantMeta(record);
    return meta.institutionGroupId ? `institution:${normalize(meta.institutionGroupId)}` : normalize(`${record.site || ''}|${record.address || ''}`);
  };
  const assistantEnergyException = record => {
    const list=Array.isArray(window.SIMECO_SERVICE_EXCEPTIONS?.exceptions) ? window.SIMECO_SERVICE_EXCEPTIONS.exceptions : [];
    const key=normalize(`${record.site || ''}|${record.address || ''}`);
    return list.find(ex=>ex.service==='energyKwh' && normalize(ex.key||`${ex.site||''}|${ex.address||''}`)===key) || null;
  };

  function periodFromQuestion(question){
    const q = normalize(question);
    const iso = q.match(/\b(20\d{2})[-/ ](0?[1-9]|1[0-2])\b/);
    if(iso) return `${iso[1]}-${String(iso[2]).padStart(2,'0')}`;
    const year = (q.match(/\b20\d{2}\b/) || [])[0];
    if(!year) return '';
    for(const [name, month] of Object.entries(monthMap)){
      if(q.includes(name)) return `${year}-${month}`;
    }
    return year;
  }

  function readablePeriod(period){
    const match = String(period || '').match(/^(20\d{2})-(\d{2})$/);
    if(!match) return period || 'sin periodo';
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return `${months[Number(match[2])-1]} de ${match[1]}`;
  }

  function aggregate(list){
    const map = new Map();
    list.forEach(record => {
      const key = siteId(record);
      if(!key) return;
      const meta=assistantMeta(record);
      if(!map.has(key)) map.set(key, { key, site:meta.institutionDisplayName || meta.displayName || meta.matchedName || record.site || 'Sede sin nombre', address:record.address || '', searchText:'', energy:0, water:0, co2:0, waste:0, energyAvailable:false, waterAvailable:false, energyException:null, periods:new Set(), rows:0 });
      const item = map.get(key);
      item.searchText += ` ${record.site||''} ${record.address||''} ${meta.displayName||''} ${meta.institutionDisplayName||''} ${meta.matchedName||''} ${meta.aliases||''}`;
      if(record.energyKwh!==null && record.energyKwh!==undefined && record.energyKwh!==''){ item.energy += number(record.energyKwh); item.energyAvailable=true; }
      if(record.waterM3!==null && record.waterM3!==undefined && record.waterM3!==''){ item.water += number(record.waterM3); item.waterAvailable=true; }
      if(record.co2kg!==null && record.co2kg!==undefined && record.co2kg!=='') item.co2 += number(record.co2kg);
      item.waste += number(record.wasteTon);
      item.energyException = item.energyException || assistantEnergyException(record);
      if(record.period) item.periods.add(record.period);
      item.rows += 1;
    });
    return [...map.values()].map(item => ({...item, energy:item.energyAvailable?item.energy:null, water:item.waterAvailable?item.water:null, co2:item.energyAvailable?item.co2:null, periodCount:item.periods.size, avg:item.energyAvailable && item.periods.size ? item.energy/item.periods.size : null})).sort((a,b)=>(b.energy??-1)-(a.energy??-1));
  }

  function fuzzyScore(text, query){
    const t = normalize(text), q = normalize(query);
    if(!q) return 0;
    if(t === q) return 1000;
    if(t.startsWith(q)) return 700;
    if(t.includes(q)) return 500;
    const tokens = q.split(' ').filter(Boolean);
    const found = tokens.filter(token => t.includes(token)).length;
    return found ? found * 80 - (tokens.length-found)*30 : 0;
  }

  function findSite(question, list){
    const items=aggregate(list);
    const fullQuestion=normalize(question);
    const exact=items
      .filter(item=>{
        const name=normalize(item.site);
        return name.length>=3 && fullQuestion.includes(name);
      })
      .sort((a,b)=>normalize(b.site).length-normalize(a.site).length)[0];
    if(exact) return exact;

    const q = fullQuestion
      .replace(/\b(cual|cuanto|cuanta|consumo|consumio|energia|emision|emisiones|co2|agua|sede|institucion|ie|i e|colegio|escuela|periodo|mes|ano|del|de|la|el|en|para|por|total|huella|carbono|prioridad)\b/g,' ')
      .replace(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/g,' ')
      .replace(/\b20\d{2}\b/g,' ')
      .split(/\s+/).filter(token=>token.length>=3).join(' ').trim();
    if(!q) return null;
    const candidates = items.map(item => ({item, score:Math.max(fuzzyScore(item.site,q), fuzzyScore(`${item.site} ${item.address} ${item.searchText||''}`,q))})).sort((a,b)=>b.score-a.score);
    return candidates[0]?.score >= 80 ? candidates[0].item : null;
  }

  function priorityFor(avg){
    if(typeof classifyEnergyIntensity === 'function') return classifyEnergyIntensity(avg);
    if(avg >= 5000) return {short:'Alta', level:'Alta prioridad'};
    if(avg >= 2000) return {short:'Media', level:'Prioridad media'};
    return {short:'Preventiva', level:'Prioridad preventiva'};
  }

  function filterByPeriod(list, period){
    if(!period) return list;
    return list.filter(record => String(record.period || '').startsWith(period));
  }

  function answer(question){
    const all = records();
    const q = normalize(question);
    if(!all.length) return 'Todavía no hay datos consolidados. Espera a que termine la carga de facturas y vuelve a preguntar.';

    const period = periodFromQuestion(question);
    const scoped = filterByPeriod(all, period);
    if(period && !scoped.length){
      return `No hay información cargada para ${readablePeriod(period)}. Consulta otro mes o revisa las facturas disponibles.`;
    }
    const scope = period ? scoped : all;
    const sites = aggregate(scope);
    const siteInScope = findSite(question, scope);
    const siteInAll = findSite(question, all);
    if(period && siteInAll && !siteInScope){
      return `Encontré la sede **${siteInAll.site}**, pero no tiene registros disponibles en ${readablePeriod(period)}.`;
    }
    const site = siteInScope || (!period ? siteInAll : null);

    if(/(hola|buenos dias|buenas tardes|buenas noches|quien eres|que puedes hacer)/.test(q)){
      return 'Hola. Soy el Asistente Ambiental SiMeCO₂. Puedo consultar consumos, emisiones, periodos, prioridades, sedes con mayor o menor consumo y explicar conceptos ambientales usando los datos cargados en esta plataforma.';
    }
    if(/(alcance 2|scope 2)/.test(q)){
      return 'El alcance 2 corresponde a las emisiones indirectas asociadas con la electricidad comprada y consumida por una institución. En SiMeCO₂ se estiman multiplicando los kWh registrados por el factor de emisión configurado.';
    }
    if(/(que significa co2e|que es co2e|co2 equivalente)/.test(q)){
      return 'CO₂e significa dióxido de carbono equivalente. Es una unidad que permite expresar el impacto climático de distintos gases de efecto invernadero como una cantidad comparable de CO₂.';
    }
    if(/(como se calcula|formula).*(huella|co2|emision)/.test(q) || /(huella|co2|emision).*(como se calcula|formula)/.test(q)){
      const factor = typeof FACTOR_CO2_KG_KWH !== 'undefined' ? FACTOR_CO2_KG_KWH : 0.126;
      return `SiMeCO₂ calcula las emisiones de alcance 2 así: consumo eléctrico en kWh × factor de emisión. El factor configurado actualmente es ${format(factor)} kg CO₂e/kWh.`;
    }
    if(/(arbol|arboles).*(significa|equivalencia|calcula|requiere)/.test(q)){
      const treeFactor = typeof TREE_CO2_KG_YEAR !== 'undefined' ? TREE_CO2_KG_YEAR : 22;
      return `La cifra de árboles es una equivalencia pedagógica anual. Divide las emisiones estimadas entre ${format(treeFactor)} kg de CO₂ por árbol/año. No representa una compensación certificada.`;
    }
    if(/(cuantos|cantidad|numero).*(sedes|instituciones)/.test(q)){
      return `${period ? `En ${readablePeriod(period)}` : 'En los datos disponibles'} hay ${format(sites.length)} sedes con registros.`;
    }
    if(/(mayor|mas alto|mas consume|consume mas|primer puesto|numero uno)/.test(q)){
      const top = sites[0];
      if(!top) return 'No encontré sedes con consumo para ese periodo.';
      return `${period ? `En ${readablePeriod(period)}, ` : ''}la sede con mayor consumo es **${top.site}**, con ${format(top.energy)} kWh, equivalentes a ${format(top.co2/1000)} t CO₂e.`;
    }
    if(/(menor|mas bajo|menos consume|consume menos|ultimo puesto)/.test(q)){
      const low = [...sites].filter(item=>item.energy>0).sort((a,b)=>a.energy-b.energy)[0];
      if(!low) return 'No encontré sedes con consumo para ese periodo.';
      return `${period ? `En ${readablePeriod(period)}, ` : ''}la sede con menor consumo registrado es **${low.site}**, con ${format(low.energy)} kWh, equivalentes a ${format(low.co2/1000)} t CO₂e.`;
    }
    if(/(ranking|top 10|diez sedes|10 sedes)/.test(q)){
      return sites.slice(0,10).map((item,index)=>`${index+1}. ${item.site}: ${format(item.energy)} kWh`).join('\n');
    }
    if(site){
      const rows = scope.filter(record => siteId(record) === site.key);
      const summary = aggregate(rows)[0] || site;
      const priority = priorityFor(summary.avg);
      if(summary.energy===null){
        const status=summary.energyException ? `La energía está marcada como **${summary.energyException.label||'contrato separado'}**: ${summary.energyException.dataState||summary.energyException.summary||'consumo aún no integrado'}.` : 'La energía no está identificada en los datos disponibles; esto no significa 0 kWh.';
        if(/(agua|acueducto)/.test(q)) return `${period ? `En ${readablePeriod(period)}, ` : ''}**${summary.site}** registra ${format(summary.water)} m³ de agua. ${status}`;
        return `Para **${summary.site}**, ${status} ${summary.water!==null?`El sistema sí registra ${format(summary.water)} m³ de agua en el alcance consultado.`:''}`;
      }
      if(/(prioridad|clasificacion|nivel)/.test(q)) return `La clasificación de **${summary.site}** es **${priority.short || priority.level}**, con un promedio aproximado de ${format(summary.avg)} kWh por periodo.`;
      if(/(agua|acueducto)/.test(q)) return `${period ? `En ${readablePeriod(period)}, ` : ''}**${summary.site}** registra ${format(summary.water)} m³ de agua en los datos disponibles.`;
      if(/(emision|co2|huella)/.test(q)) return `${period ? `En ${readablePeriod(period)}, ` : ''}**${summary.site}** registra una huella estimada de ${format(summary.co2/1000)} t CO₂e asociada al consumo eléctrico.`;
      return `${period ? `En ${readablePeriod(period)}, ` : ''}**${summary.site}** registra ${format(summary.energy)} kWh de energía, ${format(summary.co2/1000)} t CO₂e y ${format(summary.water)} m³ de agua. Su nivel es ${priority.short || priority.level}.`;
    }
    if(/(total|acumulado|toda medellin|medellin)/.test(q)){
      const total = scope.reduce((acc,record)=>{acc.energy+=number(record.energyKwh);acc.co2+=number(record.co2kg);acc.water+=number(record.waterM3);return acc;},{energy:0,co2:0,water:0});
      return `${period ? `En ${readablePeriod(period)}` : 'En todos los periodos'}, el sistema registra ${format(total.energy)} kWh, ${format(total.co2/1000)} t CO₂e y ${format(total.water)} m³ de agua.`;
    }
    if(/(factura|descargar)/.test(q)) return 'Para consultar o descargar una factura, entra en **Facturas por I.E.**, busca la institución y usa el enlace disponible en la columna Fuente.';
    if(/(recomendacion|acciones|que hacer|reducir)/.test(q)) return 'Las acciones prioritarias son: revisar consumos atípicos, controlar horarios de equipos, sustituir iluminación por LED, promover hábitos de apagado, medir por circuitos y evaluar energía solar cuando sea técnicamente viable.';

    return 'Puedo ayudarte con preguntas como: “¿qué sede consume más?”, “consumo de Manuel J. Betancur en junio de 2026”, “¿qué significa alcance 2?” o “muéstrame el top 10”. Incluye el nombre de la sede o el periodo para una respuesta más precisa.';
  }

  function markdownLite(text){
    let html = escape(text)
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      .replace(/`([^`]+)`/g,'<code>$1</code>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
    return html.replace(/\n/g,'<br>');
  }

  function resolvedApiUrl(){
    const override = localStorage.getItem('simeco2_assistant_api_url');
    if(override) return override;
    if(config.apiUrl) return String(config.apiUrl).trim();
    if(/vercel\.app$/i.test(location.hostname) || location.hostname==='localhost' || location.hostname==='127.0.0.1') return '/api/chat';
    return '';
  }

  function assistantSessionId(){
    const key='simeco2_assistant_session_v61';
    let id=localStorage.getItem(key);
    if(!id){ id=(window.crypto?.randomUUID?.() || `simeco-${Date.now()}-${Math.random().toString(36).slice(2)}`); localStorage.setItem(key,id); }
    return id;
  }

  function setAssistantStatus(mode, detail=''){
    const badge=document.getElementById('simecoAssistantStatus');
    if(!badge) return;
    badge.dataset.mode=mode;
    if(mode==='ai') badge.textContent='IA conectada';
    else if(mode==='checking') badge.textContent='Consultando…';
    else if(mode==='error') badge.textContent='Modo local';
    else badge.textContent='Modo local';
    badge.title=detail || (mode==='ai'?'Respuestas con OpenAI + datos SiMeCO₂':'Respuestas básicas desde el navegador');
  }

  async function probeApi(){
    const apiUrl=resolvedApiUrl();
    if(!config.preferAI || !apiUrl){ setAssistantStatus('local','API de IA no configurada en el cliente.'); return; }
    const healthUrl=apiUrl.replace(/\/chat(?:\?.*)?$/,'/health');
    try{
      setAssistantStatus('checking','Verificando conexión con el servidor.');
      const response=await fetch(healthUrl,{method:'GET',cache:'no-store'});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(payload?.error||`API ${response.status}`);
      if(payload.aiConfigured) setAssistantStatus('ai',`API SiMeCO₂ ${payload.version||''} · ${payload.model||'OpenAI'}`);
      else setAssistantStatus('error','La API de datos está disponible, pero OPENAI_API_KEY no está configurada.');
    }catch(error){ setAssistantStatus('error',error?.message||'API no disponible'); }
  }

  async function apiAnswer(question){
    const apiUrl=resolvedApiUrl();
    if(!config.preferAI || !apiUrl) return null;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(), Number(config.timeoutMs)||30000);
    try{
      setAssistantStatus('checking');
      const prior=history.slice(0,-1).slice(-8).map(item=>({role:item.role,text:item.text}));
      const response=await fetch(apiUrl,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({message:question,history:prior,sessionId:assistantSessionId()}),
        signal:controller.signal
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok || !payload?.text) throw new Error(payload?.error || `API ${response.status}`);
      setAssistantStatus('ai',`Modelo: ${payload.model||'OpenAI'}`);
      return payload.text;
    } finally { clearTimeout(timer); }
  }

  function addMessage(role, text){
    const message = document.createElement('div');
    message.className = `simeco-assistant-message ${role}`;
    message.innerHTML = `<div>${markdownLite(text)}</div>`;
    ui.messages.appendChild(message);
    ui.messages.scrollTop = ui.messages.scrollHeight;
    history.push({role,text});
    if(history.length > MAX_HISTORY) history.shift();
  }

  async function sendQuestion(text){
    const question = String(text || '').trim();
    if(!question || ui.send.disabled) return;
    addMessage('user', question);
    ui.input.value = '';
    ui.send.disabled = true;
    const typing = document.createElement('div');
    typing.className = 'simeco-assistant-message assistant typing';
    typing.innerHTML = '<div><span></span><span></span><span></span></div>';
    ui.messages.appendChild(typing);
    ui.messages.scrollTop = ui.messages.scrollHeight;
    try{
      let responseText=null;
      try{ responseText=await apiAnswer(question); }
      catch(error){
        console.warn('Asistente IA no disponible; se usa respuesta local.',error);
        setAssistantStatus('error',error?.message||'API no disponible');
      }
      if(!responseText) responseText=answer(question);
      typing.remove();
      addMessage('assistant', responseText);
    }catch(error){
      typing.remove();
      addMessage('assistant','No pude completar la consulta. Intenta nuevamente o usa los módulos de Histórico, Ranking y Búsqueda Institucional.');
      setAssistantStatus('error',error?.message||'Error');
    }finally{
      ui.send.disabled = false;
      ui.input.focus();
    }
  }

  function openAssistant(open = true){
    ui.panel.classList.toggle('open', open);
    ui.launcher.setAttribute('aria-expanded', String(open));
    ui.panel.setAttribute('aria-hidden', String(!open));
    if(open) setTimeout(()=>ui.input.focus(),100);
  }

  function init(){
    ui.launcher = document.getElementById('simecoAssistantLauncher');
    ui.panel = document.getElementById('simecoAssistantPanel');
    ui.close = document.getElementById('simecoAssistantClose');
    ui.reset = document.getElementById('simecoAssistantReset');
    ui.messages = document.getElementById('simecoAssistantMessages');
    ui.form = document.getElementById('simecoAssistantForm');
    ui.input = document.getElementById('simecoAssistantInput');
    ui.send = document.getElementById('simecoAssistantSend');
    if(!ui.launcher || !ui.panel) return;

    ui.launcher.addEventListener('click',()=>openAssistant(!ui.panel.classList.contains('open')));
    ui.close.addEventListener('click',()=>openAssistant(false));
    ui.reset.addEventListener('click',()=>{
      ui.messages.innerHTML=''; history.length=0;
      addMessage('assistant','Hola. Soy el Asistente Ambiental SiMeCO₂. Pregúntame por consumos, sedes, periodos, emisiones, prioridades o conceptos ambientales.');
    });
    ui.form.addEventListener('submit',event=>{event.preventDefault();sendQuestion(ui.input.value);});
    document.querySelectorAll('[data-assistant-question]').forEach(button=>button.addEventListener('click',()=>sendQuestion(button.dataset.assistantQuestion)));
    document.addEventListener('keydown',event=>{if(event.key==='Escape' && ui.panel.classList.contains('open')) openAssistant(false);});
    addMessage('assistant','Hola. Soy el Asistente Ambiental SiMeCO₂. Puedo consultar los datos reales del proyecto y, cuando la API esté configurada, generar informes, comparaciones, históricos y análisis con IA.');
    probeApi();
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded',init) : init();
})();

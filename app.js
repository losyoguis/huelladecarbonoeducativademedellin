/* SiMeCO2 Servicios Públicos - v60 agrupación institucional por sedes, calidad de datos, contratos separados, histórico multivariable y ranking por servicio */
let FACTOR_CO2_KG_KWH = 0.126; // kg CO2e/kWh. Ajustable desde el dashboard.
let TREE_CO2_KG_YEAR = 22; // kg CO2e capturados por árbol al año. Ajustable desde el dashboard.
const FACTOR_KEY = 'simeco2_factores_ambientales_v8';
const STORE_KEY = 'simeco2_servicios_v16';
const CONFIG_KEY = 'simeco2_repo_config_v7';
const DATA_VERSION = 'v76-informe-interactivo-tablas-maps-20260807';

const $ = (id)=>document.getElementById(id);
const state = loadStore();
let chartData = [];
let selectedSiteKey = "";
let autocompleteIndex = -1;
let isScanningData = false;
let dashboardSiteKey = "";
const siteAutocompleteState = new Map();
const territoryMetaCache = new WeakMap();
const recordSearchTextCache = new WeakMap();
const siteSearchOptionsCache = new Map();
const autocompleteTimers = new Map();
let recordsBySiteKeyCache = null;
let filteredRecordsCache = {key:'',rows:null};
let siteSearchDataRevision = 0;
let saveTimer = 0;
let filterTimer = 0;
let renderFrame = 0;
const RANKING_PAGE_SIZE = 10;
let rankingPage = 0;
let rankingRowsCache = [];
let rankingPeriod = "";
let rankingPriority = "";
let rankingMetric = "energyKwh";
let rankingSelectedKey = "";
let rankingAutocompleteIndex = -1;
let savingsPage = 0;
let savingsRowsCache = [];
let savingsPeriod = "";
let savingsSelectedKey = "";
let savingsAutocompleteIndex = -1;
const SAVINGS_PAGE_SIZE = 10;
const RECORD_TABLE_PAGE_SIZE = 200;
let recordTablePage = 0;

const SERVICE_METRICS = {
  energyKwh:{field:'energyKwh',label:'Energía eléctrica',short:'Energía',unit:'kWh',hasFlag:'hasEnergy',periodField:'energyPeriodCount',colorLabel:'eléctrico'},
  waterM3:{field:'waterM3',label:'Agua',short:'Agua',unit:'m³',hasFlag:'hasWater',periodField:'waterPeriodCount',colorLabel:'hídrico'},
  alcM3:{field:'alcM3',label:'Alcantarillado',short:'Alcantarillado',unit:'m³',hasFlag:'hasAlc',periodField:'alcPeriodCount',colorLabel:'de alcantarillado'},
  gasM3:{field:'gasM3',label:'Gas natural',short:'Gas',unit:'m³',hasFlag:'hasGas',periodField:'gasPeriodCount',colorLabel:'de gas'},
  wasteTon:{field:'wasteTon',label:'Aseo / residuos',short:'Residuos',unit:'t',hasFlag:'hasWaste',periodField:'wastePeriodCount',colorLabel:'de residuos'}
};
function serviceMetric(field){ return SERVICE_METRICS[field] || SERVICE_METRICS.energyKwh; }
function selectedHistoryMetric(){ return serviceMetric($('compareMetric')?.value || 'energyKwh'); }
function selectedRankingMetric(){ return serviceMetric(rankingMetric || $('rankingMetricFilter')?.value || 'energyKwh'); }

const PROJECT_LOADING_FACTS = [
  'SiMeCO₂ transforma los consumos de servicios públicos en información útil para la gestión ambiental escolar.',
  'La huella de carbono por electricidad corresponde al alcance 2: energía adquirida por las instituciones.',
  'El ranking ambiental permite identificar sedes prioritarias y orientar acciones de ahorro energético.',
  'Cada Plan de Gestión Ambiental puede incluir metas, responsables, indicadores, cronograma y evidencias.',
  'La plataforma reúne información histórica desde 2025 para comparar periodos y reconocer tendencias.',
  'Las equivalencias de CO₂e y árboles son estimaciones pedagógicas ajustables desde el sistema.',
  'Los datos consolidados apoyan decisiones de estudiantes, docentes y comunidades educativas.',
  'El asistente ambiental consulta la información ya procesada sin exponer claves ni servicios externos.'
];
const LOADING_STAGE_ORDER = ['files','read','consolidate','done'];
let invoiceFactIndex = 0;
let invoiceFactTimer = 0;
let invoiceHideTimer = 0;
let invoiceProgressState = {
  percent:0, processedFiles:0, totalFiles:0, currentPage:0, totalPages:0,
  records:0, stage:'files', detail:'Preparando la lectura de facturas…', currentFile:''
};


/* Clasificación territorial. Las coincidencias exactas tienen prioridad;
   los registros no identificados permanecen visibles como "Sin clasificar". */
const TERRITORY_CATALOG = [
  {match:['manuel j betancur','manuel jose betancur'], type:'Corregimiento', territory:'San Antonio de Prado', nucleus:'937'}
];
const CORREGIMIENTO_RULES = [
  ['san antonio de prado','San Antonio de Prado'],
  ['san cristobal','San Cristóbal'],
  ['altavista','Altavista'],
  ['santa elena','Santa Elena'],
  ['palmitas','San Sebastián de Palmitas']
];
function getTerritorySyncMeta(record){
  const sync=window.SIMECO_TERRITORIAL_SYNC;
  if(!sync || !record) return null;
  const exactKey=`${loose(record.site||'')}|${loose(record.address||'')}`;
  if(sync[exactKey]) return sync[exactKey];
  const address=loose(record.address||'');
  if(!address) return null;
  const matches=Object.values(sync).filter(item=>loose(item?.invoiceAddress||'')===address);
  return matches.length===1 ? matches[0] : null;
}
const MEDELLIN_COMMUNES=['Popular','Santa Cruz','Manrique','Aranjuez','Castilla','Doce de Octubre','Robledo','Villa Hermosa','Buenos Aires','La Candelaria','Laureles-Estadio','La América','San Javier','El Poblado','Guayabal','Belén'];
function territoryMeta(record){
  if(record && typeof record === 'object' && territoryMetaCache.has(record)) return territoryMetaCache.get(record);
  const synced=getTerritorySyncMeta(record);
  let result;
  if(synced){
    result={
      type:synced.territoryType||'Sin clasificar',
      territory:synced.commune||synced.territory||'Sin clasificar',
      nucleus:String(synced.nucleus||'Sin clasificar'),
      neighborhood:synced.neighborhood||'',
      zone:synced.zone||'',
      confidence:synced.confidence||''
    };
  }else{
    const hay=loose(`${record?.site||''} ${record?.address||''}`);
    const exact=TERRITORY_CATALOG.find(x=>x.match.some(m=>hay.includes(loose(m))));
    if(exact) result={...exact};
    else {
      for(const [needle,name] of CORREGIMIENTO_RULES){
        if(hay.includes(loose(needle))){ result={type:'Corregimiento',territory:name,nucleus:'Sin clasificar'}; break; }
      }
      if(!result){
        const comuna=hay.match(/(?:comuna|c)\s*0?([1-9]|1[0-6])\b/);
        result=comuna ? {type:'Comuna',territory:MEDELLIN_COMMUNES[Number(comuna[1])-1]||`Comuna ${Number(comuna[1])}`,nucleus:'Sin clasificar'} : {type:'Sin clasificar',territory:'Sin clasificar',nucleus:'Sin clasificar'};
      }
    }
  }
  if(record && typeof record === 'object') territoryMetaCache.set(record,result);
  return result;
}
function territoryFilterValues(prefix){
  const ids = prefix==='compare'
    ? ['compareTerritoryType','compareTerritory','compareNucleus']
    : prefix==='dashboard'
      ? ['dashboardTerritoryType','dashboardTerritory','dashboardNucleus']
      : ['territoryTypeFilter','territoryFilter','nucleusFilter'];
  return {type:$(ids[0])?.value||'',territory:$(ids[1])?.value||'',nucleus:$(ids[2])?.value||''};
}
function recordMatchesTerritory(record,filters){
  const meta=territoryMeta(record);
  return (!filters.type||meta.type===filters.type) && (!filters.territory||meta.territory===filters.territory) && (!filters.nucleus||meta.nucleus===filters.nucleus);
}
function territoryScopedRecords(prefix){
  const filters=territoryFilterValues(prefix);
  return state.records.filter(r=>recordMatchesTerritory(r,filters));
}
function setSelectOptions(id,options,placeholder){
  const el=$(id); if(!el) return;
  const current=el.value;
  el.innerHTML=`<option value="">${escapeHtml(placeholder)}</option>`+options.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  if(options.includes(current)) el.value=current;
  else el.value='';
  syncSearchableSelect(id,true);
}
function updateTerritoryCascade(prefix,changed=''){
  const ids = prefix==='compare'
    ? {type:'compareTerritoryType',territory:'compareTerritory',nucleus:'compareNucleus'}
    : prefix==='dashboard'
      ? {type:'dashboardTerritoryType',territory:'dashboardTerritory',nucleus:'dashboardNucleus'}
      : {type:'territoryTypeFilter',territory:'territoryFilter',nucleus:'nucleusFilter'};
  const type=$(ids.type)?.value||'';
  if(changed==='type'){ if($(ids.territory)) $(ids.territory).value=''; if($(ids.nucleus)) $(ids.nucleus).value=''; }
  if(changed==='territory' && $(ids.nucleus)) $(ids.nucleus).value='';
  const metas=state.records.map(territoryMeta).filter(m=>!type||m.type===type);
  const baseTerritories = type==='Comuna' ? MEDELLIN_COMMUNES : type==='Corregimiento' ? ['Altavista','San Antonio de Prado','San Cristóbal','San Sebastián de Palmitas','Santa Elena'] : [];
  const territories=[...new Set([...baseTerritories,...metas.map(m=>m.territory)])].filter(Boolean).sort((a,b)=>a.localeCompare(b,'es'));
  setSelectOptions(ids.territory,territories,'Todos los territorios');
  const territory=$(ids.territory)?.value||'';
  const nuclei=[...new Set(metas.filter(m=>!territory||m.territory===territory).map(m=>m.nucleus))].sort((a,b)=>a.localeCompare(b,'es'));
  setSelectOptions(ids.nucleus,nuclei,'Todos los núcleos');
}
function refreshAllTerritoryFilters(){
  ['compare','dashboard','table'].forEach(prefix=>updateTerritoryCascade(prefix));
}
function bindTerritoryFilters(){
  const configs=[
    ['compare','compareTerritoryType','compareTerritory','compareNucleus',()=>{ if($('compareSite')) $('compareSite').value=''; const f=siteAutocompleteState.get('compareSiteSearch'); if(f){f.input.value='';f.clear.classList.remove('visible');} renderCompareControls({keepSite:true}); comparePeriods(); }],
    ['dashboard','dashboardTerritoryType','dashboardTerritory','dashboardNucleus',()=>{ dashboardSiteKey=''; const f=siteAutocompleteState.get('dashboardSiteSearch'); if(f){f.input.value='';f.clear.classList.remove('visible');} renderDashboard(); }],
    ['table','territoryTypeFilter','territoryFilter','nucleusFilter',()=>{ selectedSiteKey=''; if($('siteSearch')) $('siteSearch').value=''; applyFilters(); }]
  ];
  configs.forEach(([prefix,typeId,territoryId,nucleusId,render])=>{
    $(typeId)?.addEventListener('change',()=>{updateTerritoryCascade(prefix,'type');render();});
    $(territoryId)?.addEventListener('change',()=>{updateTerritoryCascade(prefix,'territory');render();});
    $(nucleusId)?.addEventListener('change',render);
  });
  $('clearDashboardTerritoryBtn')?.addEventListener('click',()=>{
    ['dashboardTerritoryType','dashboardTerritory','dashboardNucleus'].forEach(id=>{if($(id)) $(id).value='';});
    updateTerritoryCascade('dashboard'); dashboardSiteKey='';
    const f=siteAutocompleteState.get('dashboardSiteSearch'); if(f){f.input.value='';f.clear.classList.remove('visible');}
    renderDashboard(); syncAllSearchableSelects();
  });
}


function initGoogleSitesResponsiveMode(){
  const embedded=window.self!==window.top;
  document.documentElement.classList.toggle('is-embedded',embedded);
  document.body.classList.toggle('is-embedded',embedded);

  const applyViewportClass=()=>{
    const width=Math.round(document.documentElement.clientWidth||window.innerWidth||0);
    document.body.classList.toggle('viewport-phone',width<=620);
    document.body.classList.toggle('viewport-tablet',width>620&&width<=980);
    document.body.classList.toggle('viewport-compact',width<=1180);
    document.documentElement.style.setProperty('--simeco-viewport-width',`${width}px`);
  };
  applyViewportClass();

  let resizeTimer=0;
  const onResize=()=>{
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(()=>{
      applyViewportClass();
      // Los canvas se redibujan solo después de estabilizar el ancho.
      if($('siteChart')&&rankingRowsCache.length) drawSiteChart(rankingRowsCache);
      if($('savingsSiteChart')&&savingsRowsCache.length) drawSavingsChart(savingsRowsCache);
      if($('chart')) drawChart(comparisonGroups($('compareMode')?.value||'month'));
    },120);
  };
  window.addEventListener('resize',onResize,{passive:true});

  if(window.ResizeObserver){
    const observer=new ResizeObserver(entries=>{
      const width=Math.round(entries[0]?.contentRect?.width||0);
      if(width) onResize();
    });
    observer.observe(document.documentElement);
  }

  // Mejora el uso táctil dentro del iframe de Google Sites.
  document.addEventListener('focusin',e=>{
    if(!document.body.classList.contains('viewport-phone')) return;
    if(e.target.matches('input,select,textarea')){
      setTimeout(()=>e.target.scrollIntoView({block:'center',behavior:'smooth'}),120);
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  initGoogleSitesResponsiveMode();
  initPdfJs();
  initConfig();
  initFactors();
  bindEvents();
  bindTerritoryFilters();
  requestAnimationFrame(() => {
    renderAll();
    initSearchableSelects();
    refreshAllTerritoryFilters();
    if(state.records.length){
      log(`Datos listos: ${state.records.length} registros precargados. La verificación de PDF queda bajo demanda para acelerar el inicio.`);
      setInvoiceLoading(false, 'Datos listos para consultar.');
    }else{
      log('No se encontraron registros precargados. Iniciando recuperación de facturas...');
      setTimeout(() => scanDataFolder({automatic:true}), 180);
    }
  });
});


/* Autocompletado global para todos los selectores de búsqueda y filtros.
   Conserva el <select> original para no romper la lógica existente. */
const searchableSelects = new Map();

function initSearchableSelects(){
  document.querySelectorAll('select:not([data-no-searchable="true"])').forEach(enhanceSearchableSelect);
}

function enhanceSearchableSelect(select){
  if(!select || searchableSelects.has(select.id) || !select.id) return;
  select.classList.add('native-search-select');
  const wrap=document.createElement('div');
  wrap.className='searchable-select';
  wrap.dataset.for=select.id;
  const input=document.createElement('input');
  input.type='search';
  input.className='searchable-select-input';
  input.autocomplete='off';
  input.spellcheck=false;
  input.setAttribute('role','combobox');
  input.setAttribute('aria-autocomplete','list');
  input.setAttribute('aria-expanded','false');
  input.setAttribute('aria-label', select.closest('label')?.childNodes?.[0]?.textContent?.trim() || 'Buscar opción');
  const toggle=document.createElement('button');
  toggle.type='button';
  toggle.className='searchable-select-toggle';
  toggle.setAttribute('aria-label','Mostrar opciones');
  toggle.textContent='⌄';
  const list=document.createElement('div');
  list.className='searchable-select-list';
  list.setAttribute('role','listbox');
  list.hidden=true;
  wrap.append(input,toggle,list);
  select.insertAdjacentElement('afterend',wrap);
  const item={select,wrap,input,toggle,list,index:-1,observer:null};
  searchableSelects.set(select.id,item);
  const render=()=>renderSearchableOptions(item,input.value);
  input.addEventListener('focus',render);
  input.addEventListener('input',()=>scheduleAutocomplete(`select:${select.id}`,render,30));
  input.addEventListener('keydown',e=>handleSearchableKeydown(e,item));
  toggle.addEventListener('click',()=>{ if(list.hidden){ input.focus(); renderSearchableOptions(item,''); } else closeSearchableSelect(item); });
  list.addEventListener('mousedown',e=>{
    const btn=e.target.closest('.searchable-select-option');
    if(!btn) return;
    e.preventDefault();
    chooseSearchableOption(item,btn.dataset.value);
  });
  select.addEventListener('change',()=>syncSearchableSelect(select.id));
  item.observer=new MutationObserver(()=>syncSearchableSelect(select.id,true));
  item.observer.observe(select,{childList:true,subtree:true,characterData:true});
  document.addEventListener('click',e=>{ if(!wrap.contains(e.target)) closeSearchableSelect(item); });
  syncSearchableSelect(select.id,true);
}

function searchableOptions(select){
  return [...select.options].map(o=>({value:o.value,label:o.textContent.trim(),disabled:o.disabled}));
}

function renderSearchableOptions(item,query=''){
  const q=loose(query);
  let options=searchableOptions(item.select).filter(o=>!o.disabled);
  if(q){
    options=options.map(o=>{
      const label=loose(o.label);
      let score=-1;
      if(label===q) score=1000;
      else if(label.startsWith(q)) score=700;
      else if(label.includes(q)) score=500;
      else {
        const tokens=searchTokens(q);
        if(tokens.every(t=>label.includes(t))) score=300+tokens.length;
      }
      return {...o,score};
    }).filter(o=>o.score>=0).sort((a,b)=>b.score-a.score || a.label.localeCompare(b.label,'es'));
  }
  item.index=options.length ? 0 : -1;
  item.list.innerHTML=options.length ? options.map((o,i)=>`<button type="button" class="searchable-select-option${i===0?' active':''}" role="option" data-value="${escapeHtml(o.value)}"><span>${highlightMatch(o.label,query)}</span>${o.value===item.select.value?'<em>Seleccionado</em>':''}</button>`).join('') : '<div class="searchable-select-empty">No hay coincidencias</div>';
  item.list.hidden=false;
  item.input.setAttribute('aria-expanded','true');
}

function chooseSearchableOption(item,value){
  item.select.value=value;
  syncSearchableSelect(item.select.id);
  closeSearchableSelect(item);
  item.select.dispatchEvent(new Event('change',{bubbles:true}));
}

function handleSearchableKeydown(e,item){
  const opts=[...item.list.querySelectorAll('.searchable-select-option')];
  if(e.key==='Escape'){ closeSearchableSelect(item); return; }
  if(e.key==='Tab'){ closeSearchableSelect(item); return; }
  if(item.list.hidden && (e.key==='ArrowDown' || e.key==='Enter')){ e.preventDefault(); renderSearchableOptions(item,item.input.value); return; }
  if(!opts.length) return;
  if(e.key==='ArrowDown'){ e.preventDefault(); item.index=(item.index+1)%opts.length; }
  else if(e.key==='ArrowUp'){ e.preventDefault(); item.index=(item.index-1+opts.length)%opts.length; }
  else if(e.key==='Enter'){ e.preventDefault(); chooseSearchableOption(item,opts[Math.max(0,item.index)].dataset.value); return; }
  else return;
  opts.forEach((o,i)=>o.classList.toggle('active',i===item.index));
  opts[item.index]?.scrollIntoView({block:'nearest'});
}

function closeSearchableSelect(item){
  item.list.hidden=true;
  item.input.setAttribute('aria-expanded','false');
  item.index=-1;
  const selected=item.select.selectedOptions[0];
  item.input.value=selected ? selected.textContent.trim() : '';
}

function syncSearchableSelect(id,rebuild=false){
  const item=searchableSelects.get(id);
  if(!item) return;
  const selected=item.select.selectedOptions[0];
  item.input.value=selected ? selected.textContent.trim() : '';
  item.input.placeholder=searchableOptions(item.select)[0]?.label || 'Buscar…';
  if(rebuild && !item.list.hidden) renderSearchableOptions(item,item.input.value);
}

function syncAllSearchableSelects(){
  searchableSelects.forEach((_,id)=>syncSearchableSelect(id));
}


function scheduleAutocomplete(key,callback,delay=45){
  const prev=autocompleteTimers.get(key);
  if(prev) clearTimeout(prev);
  autocompleteTimers.set(key,setTimeout(()=>{
    autocompleteTimers.delete(key);
    requestAnimationFrame(callback);
  },delay));
}

function initSiteAutocompleteField(config){
  const input=$(config.inputId), list=$(config.listId), clear=$(config.clearId);
  if(!input || !list || !clear) return;
  const stateItem={...config,input,list,clear,index:-1};
  siteAutocompleteState.set(config.inputId,stateItem);
  input.addEventListener('input',()=>{
    stateItem.index=-1;
    clear.classList.toggle('visible',Boolean(input.value));
    // Mientras se escribe solo se actualizan sugerencias; los cálculos pesados
    // se ejecutan al seleccionar una sede o al limpiar el campo.
    if(config.mode==='compare') $('compareSite').value='';
    else dashboardSiteKey='';
    const value=input.value;
    scheduleAutocomplete(`field:${config.inputId}`,()=>renderSiteAutocomplete(stateItem,value),35);
  });
  input.addEventListener('focus',()=>renderSiteAutocomplete(stateItem,input.value));
  input.addEventListener('keydown',e=>handleSiteFieldKeydown(e,stateItem));
  list.addEventListener('mousedown',e=>{
    const map=e.target.closest('[data-map-address]');
    if(map){e.preventDefault();e.stopPropagation();openAddressInGoogleMaps(map.dataset.mapAddress,map.dataset.mapSchool||'');return;}
    const btn=e.target.closest('.autocomplete-option');
    if(!btn) return;
    e.preventDefault();
    chooseSiteFieldSuggestion(stateItem,btn.dataset.key);
  });
  clear.addEventListener('click',()=>clearSiteAutocompleteField(stateItem,true));
  document.addEventListener('click',e=>{ if(!input.closest('.autocomplete').contains(e.target)) closeSiteAutocomplete(stateItem); });
}
function renderSiteAutocomplete(item,query=''){
  const q=String(query||'').trim();
  const options=siteSearchOptions(item.mode==='compare'?'compare':'dashboard').map(x=>({...x,score:suggestionScore(x,q)})).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score || a.site.localeCompare(b.site,'es')).slice(0,12);
  item.index=-1;
  if(!options.length){
    item.list.innerHTML='<div class="autocomplete-empty">No se encontraron sedes. Prueba con otra palabra.</div>';
  }else{
    item.list.innerHTML=options.map(x=>`<button type="button" class="autocomplete-option" role="option" data-key="${escapeHtml(x.key)}"><span><strong>${highlightMatch(x.displaySite||x.site,q)}</strong><small>${x.displaySite!==x.site?`En factura: ${highlightMatch(x.site,q)} · `:''}${mapAddressAction(x.addressLabel||x.address,highlightMatch(x.addressLabel||x.address||'Sin dirección registrada',q),x.displaySite||x.site)} · ${escapeHtml(x.meta?.territory||'Sin clasificar')} · Núcleo ${escapeHtml(x.meta?.nucleus||'Sin clasificar')}</small></span><em>${x.periodCount} periodo${x.periodCount===1?'':'s'}</em></button>`).join('');
  }
  item.list.hidden=false;
  item.input.setAttribute('aria-expanded','true');
}
function chooseSiteFieldSuggestion(item,key){
  const option=siteSearchOptions(item.mode==='compare'?'compare':'dashboard').find(x=>x.key===key);
  if(!option) return;
  item.input.value=option.displaySite||option.site;
  item.clear.classList.add('visible');
  if(item.mode==='compare'){
    $('compareSite').value=key;
    renderCompareControls({keepSite:true});
    comparePeriods();
  }else{
    dashboardSiteKey=key;
    const reportBtn=$('generateSelectedReportBtn');
    if(reportBtn) reportBtn.disabled=false;
    renderDashboard();
  }
  closeSiteAutocomplete(item);
}
function clearSiteAutocompleteField(item,focus=false){
  item.input.value='';
  item.clear.classList.remove('visible');
  if(item.mode==='compare'){
    $('compareSite').value='';
    renderCompareControls({keepSite:true});
    comparePeriods();
  }else{
    dashboardSiteKey='';
    const reportBtn=$('generateSelectedReportBtn');
    if(reportBtn) reportBtn.disabled=true;
    renderDashboard();
  }
  closeSiteAutocomplete(item);
  if(focus) item.input.focus();
}
function closeSiteAutocomplete(item){
  item.list.hidden=true;
  item.input.setAttribute('aria-expanded','false');
  item.index=-1;
}
function handleSiteFieldKeydown(e,item){
  if(e.key==='Escape'){ closeSiteAutocomplete(item); return; }
  if((e.key==='ArrowDown'||e.key==='ArrowUp') && item.list.hidden) renderSiteAutocomplete(item,item.input.value);
  const opts=[...item.list.querySelectorAll('.autocomplete-option')];
  if(!opts.length) return;
  if(e.key==='ArrowDown'){ e.preventDefault(); item.index=(item.index+1)%opts.length; }
  else if(e.key==='ArrowUp'){ e.preventDefault(); item.index=(item.index-1+opts.length)%opts.length; }
  else if(e.key==='Enter'){
    e.preventDefault();
    const target=opts[Math.max(0,item.index)];
    if(target) chooseSiteFieldSuggestion(item,target.dataset.key);
    return;
  }else return;
  opts.forEach((o,i)=>o.classList.toggle('active',i===item.index));
  opts[item.index]?.scrollIntoView({block:'nearest'});
}
function refreshSiteAutocompleteFields(){
  const compare=$('compareSite');
  const compareInput=$('compareSiteSearch');
  if(compare && compareInput){
    const selected=siteSearchOptions('compare').find(x=>x.key===compare.value);
    if(selected && !compareInput.value) compareInput.value=selected.site;
  }
}

let pdfJsPromise = null;
function initPdfJs(){
  const pdfStatus = $('pdfStatus');
  if(window.pdfjsLib){
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    if(pdfStatus){ pdfStatus.textContent = 'PDF.js activo'; pdfStatus.classList.remove('bad'); }
  } else if(pdfStatus) {
    pdfStatus.textContent = 'PDF.js se cargará solo al actualizar/importar facturas';
    pdfStatus.classList.remove('bad');
  }
}
function ensurePdfJs(){
  if(window.pdfjsLib){ initPdfJs(); return Promise.resolve(window.pdfjsLib); }
  if(pdfJsPromise) return pdfJsPromise;
  const pdfStatus=$('pdfStatus');
  if(pdfStatus) pdfStatus.textContent='Cargando lector PDF…';
  pdfJsPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async=true;
    script.onload=()=>{ initPdfJs(); resolve(window.pdfjsLib); };
    script.onerror=()=>{ pdfJsPromise=null; if(pdfStatus){pdfStatus.textContent='No fue posible cargar PDF.js';pdfStatus.classList.add('bad');} reject(new Error('No fue posible cargar PDF.js. Revisa la conexión a internet.')); };
    document.head.appendChild(script);
  });
  return pdfJsPromise;
}
function bindEvent(id,event,handler,options){
  const element=$(id);
  if(element) element.addEventListener(event,handler,options);
  return element;
}
function bindEvents(){
  bindEvent('scanDataBtn','click',scanDataFolder);
  document.querySelectorAll('.mobile-section-tab[data-action="actualizar"]').forEach(button=>button.addEventListener('click',()=>scanDataFolder()));
  bindEvent('localPdfInput','change',handleLocalPdf);
  bindEvent('clearBtn','click',()=>{ if(confirm('¿Reiniciar todos los datos importados?')){ localStorage.removeItem(STORE_KEY); location.reload(); }});
  bindEvent('saveRepoBtn','click',saveConfig);
  bindEvent('updateFactorsBtn','click',updateFactors);
  ['periodFilter','serviceFilter','sortFilter'].forEach(id=>bindEvent(id,'change',applyFilters));
  bindEvent('siteSearch','input',handleSiteSearchInput);
  bindEvent('siteSearch','keydown',handleAutocompleteKeydown);
  bindEvent('siteSearch','focus',()=>renderAutocompleteSuggestions($('siteSearch')?.value||''));
  bindEvent('clearSearchBtn','click',clearSiteSearch);
  bindEvent('clearFiltersBtn','click',clearAllFilters);
  bindEvent('siteSuggestions','mousedown',handleSuggestionClick);
  document.addEventListener('click',e=>{ const box=$('siteAutocomplete'); if(box && !box.contains(e.target)) closeAutocomplete(); });
  bindEvent('downloadFilteredPdfBtn','click',downloadFilteredPdfReport);
  bindEvent('downloadHistoryPdfBtn','click',downloadHistoryPdfReport);
  bindEvent('compareMode','change',()=>{renderCompareControls();comparePeriods();});
  bindEvent('compareMetric','change',()=>{renderCompareControls({keepSite:true});comparePeriods();});
  bindEvent('compareSite','change',()=>{renderCompareControls({keepSite:true});comparePeriods();});
  initSiteAutocompleteField({inputId:'compareSiteSearch',listId:'compareSiteSuggestions',clearId:'clearCompareSiteBtn',mode:'compare'});
  initSiteAutocompleteField({inputId:'dashboardSiteSearch',listId:'dashboardSiteSuggestions',clearId:'clearDashboardSiteBtn',mode:'dashboard'});
  bindEvent('compareBtn','click',comparePeriods);
  bindEvent('printPlanBtn','click',printCurrentPlan);
  bindEvent('downloadPlanBtn','click',downloadCurrentPlan);
  bindEvent('exportCsvBtn','click',exportCsv);
  bindEvent('exportJsonBtn','click',exportJson);
  bindEvent('environmentBody','click',handlePlanButtonClick);
  bindEvent('generateSelectedReportBtn','click',generateSelectedSiteReport);
  bindEvent('planReport','click',handlePlanInteractiveClick);
  bindEvent('refreshRankingBtn','click',refreshFullRanking);
  bindEvent('rankingMetricFilter','change',()=>{rankingMetric=$('rankingMetricFilter')?.value||'energyKwh';rankingSelectedKey='';rankingPage=0;renderRanking();});
  bindEvent('rankingPeriodFilter','change',()=>{rankingPeriod=$('rankingPeriodFilter')?.value||'';rankingSelectedKey='';rankingPage=0;renderRanking();});
  bindEvent('rankingPriorityFilters','click',handleRankingPriorityClick);
  bindEvent('rankingSiteSearch','input',handleRankingSearchInput);
  bindEvent('rankingSiteSearch','focus',()=>renderRankingSuggestions($('rankingSiteSearch')?.value||''));
  bindEvent('rankingSiteSearch','keydown',handleRankingSearchKeydown);
  bindEvent('rankingSiteSuggestions','mousedown',handleRankingSuggestionClick);
  bindEvent('clearRankingSearchBtn','click',clearRankingSearch);
  document.addEventListener('click',e=>{ const box=$('rankingSiteAutocomplete'); if(box && !box.contains(e.target)) closeRankingSuggestions(); });
  bindEvent('siteChart','click',handleRankingCanvasMapClick);
  bindEvent('siteChart','mousemove',e=>handleCanvasMapPointer(e,rankingMapHitZones));
  bindEvent('rankingFirstBtn','click',()=>setRankingPage(0));
  bindEvent('rankingPrevBtn','click',()=>setRankingPage(rankingPage-1));
  bindEvent('rankingNextBtn','click',()=>setRankingPage(rankingPage+1));
  bindEvent('rankingLastBtn','click',()=>setRankingPage(Math.max(0,Math.ceil(rankingRowsCache.length/RANKING_PAGE_SIZE)-1)));
  bindEvent('savingsPeriodFilter','change',()=>{savingsPeriod=$('savingsPeriodFilter')?.value||'';savingsSelectedKey='';savingsPage=0;renderSavingsRanking();});
  bindEvent('savingsSiteSearch','input',handleSavingsSearchInput);
  bindEvent('savingsSiteSearch','focus',()=>renderSavingsSuggestions($('savingsSiteSearch')?.value||''));
  bindEvent('savingsSiteSearch','keydown',handleSavingsSearchKeydown);
  bindEvent('savingsSiteSuggestions','mousedown',handleSavingsSuggestionClick);
  bindEvent('clearSavingsSearchBtn','click',clearSavingsSearch);
  bindEvent('refreshSavingsRankingBtn','click',refreshSavingsRanking);
  bindEvent('savingsSiteChart','click',handleSavingsCanvasMapClick);
  bindEvent('savingsSiteChart','mousemove',e=>handleCanvasMapPointer(e,savingsMapHitZones));
  bindEvent('savingsFirstBtn','click',()=>setSavingsPage(0));
  bindEvent('savingsPrevBtn','click',()=>setSavingsPage(savingsPage-1));
  bindEvent('savingsNextBtn','click',()=>setSavingsPage(savingsPage+1));
  bindEvent('savingsLastBtn','click',()=>setSavingsPage(Math.max(0,Math.ceil(savingsRowsCache.length/SAVINGS_PAGE_SIZE)-1)));
  document.addEventListener('click',e=>{ const box=$('savingsSiteAutocomplete'); if(box && !box.contains(e.target)) closeSavingsSuggestions(); });
  bindEvent('qualityBody','click',handleQualityActionClick);
}
function initConfig(){
  const cfg = getRepoConfig();
  if($('repoOwner')) $('repoOwner').value = cfg.owner || '';
  if($('repoName')) $('repoName').value = cfg.repo || '';
  if($('repoBranch')) $('repoBranch').value = cfg.branch || 'main';
}
function detectGitHubRepo(){
  const host = location.hostname;
  const parts = location.pathname.split('/').filter(Boolean);
  if(host.endsWith('github.io') && parts[0]){
    return {owner: host.replace('.github.io',''), repo: parts[0]};
  }
  return {};
}
function loadConfig(){ try{return JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}')}catch{return {}} }
function getRepoConfig(){
  const saved = loadConfig();
  const detected = detectGitHubRepo();
  const ownerFromInput = $('repoOwner') ? $('repoOwner').value.trim() : '';
  const repoFromInput = $('repoName') ? $('repoName').value.trim() : '';
  const branchFromInput = $('repoBranch') ? $('repoBranch').value.trim() : '';
  return {
    owner: ownerFromInput || saved.owner || detected.owner || '',
    repo: repoFromInput || saved.repo || detected.repo || '',
    branch: branchFromInput || saved.branch || 'main'
  };
}
function initFactors(){
  try{
    const saved = JSON.parse(localStorage.getItem(FACTOR_KEY)||"{}");
    FACTOR_CO2_KG_KWH = Number(saved.co2Factor) || FACTOR_CO2_KG_KWH;
    TREE_CO2_KG_YEAR = Number(saved.treeFactor) || TREE_CO2_KG_YEAR;
  }catch{}
  if($("factorCo2Input")) $("factorCo2Input").value = FACTOR_CO2_KG_KWH;
  if($("treeFactorInput")) $("treeFactorInput").value = TREE_CO2_KG_YEAR;
  recalculateCo2();
}
function updateFactors(){
  FACTOR_CO2_KG_KWH = Math.max(0, Number($("factorCo2Input").value) || 0.126);
  TREE_CO2_KG_YEAR = Math.max(0.1, Number($("treeFactorInput").value) || 22);
  localStorage.setItem(FACTOR_KEY, JSON.stringify({co2Factor:FACTOR_CO2_KG_KWH, treeFactor:TREE_CO2_KG_YEAR}));
  recalculateCo2();
  saveStore();
  renderAll();
  log("Factores actualizados: " + FACTOR_CO2_KG_KWH + " kg CO₂e/kWh y " + TREE_CO2_KG_YEAR + " kg CO₂e/árbol/año.");
}
function recalculateCo2(){
  state.records.forEach(r=>{ r.co2kg = round((Number(r.energyKwh)||0)*FACTOR_CO2_KG_KWH,2); });
}
function saveConfig(){
  const cfg = getRepoConfig();
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  log(`Configuración guardada: ${cfg.owner}/${cfg.repo}@${cfg.branch}`);
}
function cloneData(value){
  if(value==null) return value;
  try{return structuredClone(value);}catch{return JSON.parse(JSON.stringify(value));}
}
function canonicalBundle(){
  // v65: los datos precargados ya son objetos nuevos reconstruidos por el bundle compacto.
  // Evitamos structuredClone de miles de registros en cada arranque; al recargar la página
  // el bundle vuelve a reconstruirse desde cero, por lo que compartir estos objetos es seguro.
  const records=Array.isArray(window.SIMECO_REGISTROS) ? window.SIMECO_REGISTROS : [];
  const bundle=window.SIMECO_SUMMARY_BUNDLE && typeof window.SIMECO_SUMMARY_BUNDLE==='object' ? window.SIMECO_SUMMARY_BUNDLE : {};
  const summaries=Array.isArray(bundle.summaries) ? bundle.summaries : [];
  const sourceNames=new Set(records.map(r=>r?.source).filter(Boolean));
  const files={};
  Object.entries(bundle.files||{}).forEach(([name,meta])=>{
    if(sourceNames.has(name)) files[name]={...meta, fingerprint:meta.fingerprint||meta.sha||name};
  });
  return {records,summaries,files};
}
function rebuildSites(records){
  const sites={};
  (records||[]).forEach(r=>{ if(r?.site) sites[siteKey(r.site,r.address)]={site:r.site,address:r.address||''}; });
  return sites;
}
function loadStore(){
  const canonical=canonicalBundle();
  let saved=null;
  try{ saved=JSON.parse(localStorage.getItem(STORE_KEY)||'null'); }catch{}
  if(!saved || saved.dataVersion!==DATA_VERSION){
    return {dataVersion:DATA_VERSION, records:canonical.records, summaries:canonical.summaries, files:canonical.files, sites:rebuildSites(canonical.records)};
  }
  const overriddenSources=new Set();
  Object.entries(saved.files||{}).forEach(([name,meta])=>{
    const base=canonical.files[name];
    if(base && meta?.fingerprint && meta.fingerprint!==base.fingerprint) overriddenSources.add(name);
  });
  const recordMap=new Map();
  canonical.records.filter(r=>!overriddenSources.has(r.source)).forEach(r=>recordMap.set(r.key||`${r.period}|${r.source}|${r.page}|${r.site}`,r));
  (Array.isArray(saved.records)?saved.records:[]).forEach(r=>{
    const key=r.key||`${r.period}|${r.source}|${r.page}|${r.site}`;
    if(!recordMap.has(key) || overriddenSources.has(r.source)) recordMap.set(key,r);
  });
  const summaryMap=new Map();
  canonical.summaries.filter(r=>!overriddenSources.has(r.source)).forEach(r=>summaryMap.set(r.source||r.period,r));
  (Array.isArray(saved.summaries)?saved.summaries:[]).forEach(r=>{
    const key=r.source||r.period;
    if(!summaryMap.has(key) || overriddenSources.has(r.source)) summaryMap.set(key,r);
  });
  const records=[...recordMap.values()];
  return {
    ...saved,
    dataVersion:DATA_VERSION,
    records,
    summaries:[...summaryMap.values()].sort((a,b)=>String(a.period).localeCompare(String(b.period))),
    files:{...canonical.files,...(saved.files||{})},
    sites:rebuildSites(records)
  };
}
function compactStorePayload(){
  const canonical=canonicalBundle();
  const customFiles={};
  Object.entries(state.files||{}).forEach(([name,meta])=>{
    const base=canonical.files[name];
    if(!base || (meta?.fingerprint && meta.fingerprint!==base.fingerprint)) customFiles[name]=meta;
  });
  const customSources=new Set(Object.keys(customFiles));
  const records=(state.records||[]).filter(r=>customSources.has(r.source) || r.sourceUrl==='local' || !canonical.files[r.source]);
  const summaries=(state.summaries||[]).filter(r=>customSources.has(r.source) || !canonical.files[r.source]);
  return {dataVersion:DATA_VERSION,records,summaries,files:customFiles};
}
function saveStore(immediate=false){
  clearTimeout(saveTimer);
  const persist=()=>{
    try{ localStorage.setItem(STORE_KEY,JSON.stringify(compactStorePayload())); }
    catch(err){ console.warn('No fue posible guardar la caché local:',err); }
  };
  if(immediate) persist(); else saveTimer=setTimeout(persist,120);
}
function scheduleRenderAll(){
  if(renderFrame) cancelAnimationFrame(renderFrame);
  renderFrame=requestAnimationFrame(()=>{ renderFrame=0; renderAll(); });
}
function log(msg){
  const box=$('logBox');
  if(!box){ console.info('[SiMeCO₂]',msg); return; }
  const t=new Date().toLocaleTimeString();
  box.textContent += `[${t}] ${msg}\n`;
  box.scrollTop=box.scrollHeight;
}
async function scanDataFolder(options={}){
  if(isScanningData){
    log('La carga de facturas ya está en progreso. Espere un momento...');
    return;
  }
  isScanningData = true;
  if(!options.quiet){
    resetInvoiceProgress(options.automatic ? 'Preparando la carga automática de facturas…' : 'Preparando la actualización de facturas…');
    setInvoiceLoading(true, options.automatic ? 'Espere, cargando facturas...' : 'Espere, actualizando facturas...');
  }
  try{
    const result=await scanDataFolderCore({showProgress:!options.quiet});
    if(!options.quiet){
      const message=result?.failed ? `Carga finalizada con ${result.failed} factura${result.failed===1?'':'s'} pendiente${result.failed===1?'':'s'} de revisión.` : 'Facturas cargadas correctamente.';
      setInvoiceLoading(false,message);
    }
  }catch(err){
    console.error(err);
    log(`Error general durante la carga: ${err.message}`);
    if(!options.quiet) setInvoiceLoading(false, 'No fue posible completar la carga de facturas.', true);
  }finally{
    isScanningData = false;
  }
}

function resetInvoiceProgress(detail='Preparando la lectura y consolidación de la información disponible.'){
  invoiceProgressState = {
    percent:0, processedFiles:0, totalFiles:0, currentPage:0, totalPages:0,
    records:state.records.length, stage:'files', detail, currentFile:''
  };
  updateInvoiceProgress(invoiceProgressState);
}

function startInvoiceFactRotation(){
  clearInterval(invoiceFactTimer);
  const fact=$('invoiceProjectFact');
  if(fact) fact.textContent=PROJECT_LOADING_FACTS[invoiceFactIndex%PROJECT_LOADING_FACTS.length];
  invoiceFactTimer=setInterval(()=>{
    invoiceFactIndex=(invoiceFactIndex+1)%PROJECT_LOADING_FACTS.length;
    const target=$('invoiceProjectFact');
    if(!target) return;
    target.classList.remove('fact-enter');
    void target.offsetWidth;
    target.textContent=PROJECT_LOADING_FACTS[invoiceFactIndex];
    target.classList.add('fact-enter');
  },4600);
}

function stopInvoiceFactRotation(){
  clearInterval(invoiceFactTimer);
  invoiceFactTimer=0;
}

function updateInvoiceProgress(patch={}){
  invoiceProgressState={...invoiceProgressState,...patch};
  const stateNow=invoiceProgressState;
  const percent=Math.max(0,Math.min(100,Number(stateNow.percent)||0));
  const rounded=Math.round(percent);
  const bar=$('invoiceProgressBar');
  const track=$('invoiceProgressTrack');
  const percentText=$('invoiceProgressPercent');
  const counter=$('invoiceProgressCounter');
  const detail=$('invoiceLoadingDetail');
  const files=$('invoiceLoadingFiles');
  const pages=$('invoiceLoadingPages');
  const records=$('invoiceLoadingRecords');
  if(bar) bar.style.width=`${percent}%`;
  if(track) track.setAttribute('aria-valuenow',String(rounded));
  if(percentText) percentText.textContent=`${rounded}%`;
  if(counter){
    const total=Number(stateNow.totalFiles)||0;
    const processed=Math.min(total,Number(stateNow.processedFiles)||0);
    counter.textContent=total ? `${processed} de ${total} facturas verificadas` : 'Preparando archivos…';
  }
  if(detail){
    const file=stateNow.currentFile ? ` ${stateNow.currentFile}` : '';
    detail.textContent=(stateNow.detail||'Procesando información…')+file;
  }
  if(files) files.textContent=`${Number(stateNow.processedFiles)||0}/${Number(stateNow.totalFiles)||0}`;
  if(pages) pages.textContent=stateNow.totalPages ? `${Number(stateNow.currentPage)||0}/${Number(stateNow.totalPages)||0}` : '—';
  if(records) records.textContent=new Intl.NumberFormat('es-CO').format(Number(stateNow.records)||0);
  const stage=stateNow.stage||'files';
  const activeIndex=Math.max(0,LOADING_STAGE_ORDER.indexOf(stage));
  document.querySelectorAll('[data-loading-stage]').forEach(el=>{
    const index=LOADING_STAGE_ORDER.indexOf(el.dataset.loadingStage);
    el.classList.toggle('active',index===activeIndex);
    el.classList.toggle('completed',index<activeIndex || stage==='done');
  });
}

function setInvoiceLoading(active, message, isError=false){
  const overlay = $('invoiceLoading');
  const text = $('invoiceLoadingText');
  const buttons = [$('scanDataBtn'),...document.querySelectorAll('.mobile-section-tab[data-action="actualizar"]')].filter(Boolean);
  clearTimeout(invoiceHideTimer);
  if(text) text.textContent = message || (active ? 'Espere, cargando facturas...' : 'Carga finalizada.');
  if(overlay){
    overlay.classList.toggle('error', Boolean(isError));
    if(active){
      overlay.setAttribute('aria-hidden','false');
      overlay.classList.add('active');
      overlay.classList.remove('completed','success');
      document.body.classList.add('invoice-loading-open');
      startInvoiceFactRotation();
    }else{
      updateInvoiceProgress({
        percent:isError ? invoiceProgressState.percent : 100,
        stage:isError ? invoiceProgressState.stage : 'done',
        detail:isError ? 'Revisa el registro de actualización para conocer el detalle del error.' : 'La información quedó lista para consultar en la plataforma.',
        processedFiles:invoiceProgressState.totalFiles || invoiceProgressState.processedFiles
      });
      overlay.setAttribute('aria-hidden','false');
      overlay.classList.add(isError?'error':'success');
      overlay.classList.add('active','completed');
      stopInvoiceFactRotation();
      invoiceHideTimer=setTimeout(()=>{
        overlay.classList.remove('active','completed','success','error');
        overlay.setAttribute('aria-hidden','true');
        document.body.classList.remove('invoice-loading-open');
      },isError ? 2200 : 1050);
    }
  }
  buttons.forEach(button=>{
    button.disabled = active;
    button.classList.toggle('is-loading', active);
    button.setAttribute('aria-busy', active ? 'true' : 'false');
  });
}

async function scanDataFolderCore(options={}){
  const showProgress=Boolean(options.showProgress);
  log('Buscando PDFs nuevos en carpeta /data...');
  const cfg = getRepoConfig();
  let files = [];
  if(cfg.owner && cfg.repo){
    try{
      const api = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/data?ref=${encodeURIComponent(cfg.branch)}`;
      const res = await fetch(api, {cache:'default'});
      if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json();
      files = json.filter(f=>f.type==='file' && f.name.toLowerCase().endsWith('.pdf')).map(f=>({name:f.name,url:f.download_url,sha:f.sha}));
      log(`GitHub API: ${files.length} PDF encontrados en /data.`);
    } catch(err){
      log(`No se pudo leer GitHub API (${err.message}). Intentando data/manifest.json...`);
    }
  }
  if(!files.length){
    try{
      const res = await fetch('data/manifest.json', {cache:'no-cache'});
      if(res.ok){
        const manifest = await res.json();
        const arr = Array.isArray(manifest) ? manifest : manifest.files || [];
        files = arr.filter(x => String(typeof x==='string'?x:x.name).toLowerCase().endsWith('.pdf')).map(x=> typeof x==='string' ? {name:x,url:'data/'+encodeURIComponent(x)} : {name:x.name,url:x.url||('data/'+encodeURIComponent(x.name))});
        log(`Manifest: ${files.length} PDF encontrados.`);
      }
    }catch(err){ log(`No se pudo leer manifest.json: ${err.message}`); }
  }
  if(!files.length){
    log('No se encontraron PDF. En GitHub público basta subir los PDF a /data. En local usa data/manifest.json.');
    if(showProgress) updateInvoiceProgress({stage:'files',detail:'No se encontraron facturas PDF en la carpeta /data.'});
    throw new Error('No se encontraron facturas PDF para procesar.');
  }
  let imported=0, skipped=0, failed=0;
  const pending=[];
  for(const file of files){
    const fingerprint=file.sha || file.url || file.name;
    const previous=state.files[file.name];
    if(previous && previous.fingerprint===fingerprint) skipped++;
    else pending.push({...file,fingerprint});
  }

  const fileProgress=new Map();
  const totalFiles=files.length;
  const reportFileProgress=(file,fraction,meta={})=>{
    fileProgress.set(file.fingerprint,Math.max(0,Math.min(1,Number(fraction)||0)));
    const fractions=[...fileProgress.values()];
    const completedPending=fractions.filter(value=>value>=1).length;
    const processedFiles=skipped+completedPending;
    const overall=((skipped+fractions.reduce((sum,value)=>sum+value,0))/Math.max(1,totalFiles))*100;
    if(showProgress) updateInvoiceProgress({
      percent:overall,
      processedFiles,
      totalFiles,
      records:state.records.length,
      currentFile:meta.currentFile===false ? '' : `· ${file.name}`,
      currentPage:meta.currentPage||0,
      totalPages:meta.totalPages||0,
      stage:meta.stage||'read',
      detail:meta.detail||'Procesando'
    });
  };

  if(showProgress){
    updateInvoiceProgress({
      percent:(skipped/Math.max(1,totalFiles))*100,
      processedFiles:skipped,totalFiles,records:state.records.length,
      stage:pending.length?'read':'done',
      detail:pending.length ? `Se encontraron ${totalFiles} facturas. Iniciando la lectura…` : 'Todas las facturas ya estaban procesadas.',
      currentFile:'',currentPage:0,totalPages:0
    });
  }

  const concurrency=Math.min(2,pending.length);
  let cursor=0;
  async function importWorker(){
    while(cursor<pending.length){
      const file=pending[cursor++];
      try{
        reportFileProgress(file,.025,{stage:'read',detail:'Descargando factura',currentPage:0,totalPages:0});
        log(`Importando ${file.name}...`);
        const response=await fetch(file.url,{cache:'force-cache'});
        if(!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const buf=await response.arrayBuffer();
        reportFileProgress(file,.08,{stage:'read',detail:'Factura descargada. Preparando páginas',currentPage:0,totalPages:0});
        const result=await parsePdfArrayBuffer(buf,file.name,file.url,progress=>{
          const pageFraction=progress.totalPages ? progress.currentPage/progress.totalPages : 0;
          reportFileProgress(file,.08+(pageFraction*.78),{
            stage:'read',
            detail:'Leyendo y reconociendo páginas',
            currentPage:progress.currentPage,
            totalPages:progress.totalPages
          });
        });
        reportFileProgress(file,.93,{stage:'consolidate',detail:'Consolidando sedes e indicadores',currentPage:result.numPages||0,totalPages:result.numPages||0});
        if(result.records.length){
          addImport(result,file.fingerprint);
          imported++;
          log(`OK ${file.name}: ${result.records.length} registros, periodo ${result.period}.`);
        }else{
          failed++;
          log(`Sin registros estructurados en ${file.name}. Muestra: ${result.sample.slice(0,500).replace(/\s+/g,' ')}`);
        }
        reportFileProgress(file,1,{stage:'consolidate',detail:result.records.length?'Factura consolidada':'Factura revisada sin registros estructurados',currentPage:result.numPages||0,totalPages:result.numPages||0});
      }catch(err){
        failed++;
        log(`Error importando ${file.name}: ${err.message}`);
        reportFileProgress(file,1,{stage:'consolidate',detail:'La factura presentó un error y el proceso continúa',currentPage:0,totalPages:0});
      }
    }
  }
  if(concurrency) await Promise.all(Array.from({length:concurrency},()=>importWorker()));
  if(showProgress){
    updateInvoiceProgress({
      percent:100,processedFiles:totalFiles,totalFiles,records:state.records.length,
      stage:'done',detail:`Consolidación terminada: ${imported} nuevas, ${skipped} ya existentes y ${failed} con novedad.`,
      currentFile:'',currentPage:0,totalPages:0
    });
  }
  log(`Proceso terminado. Importados: ${imported}. Omitidos ya existentes: ${skipped}. Fallidos: ${failed}.`);
  saveStore(); scheduleRenderAll();
  if(pending.length && failed===pending.length && imported===0){
    throw new Error(`No fue posible consolidar ninguna de las ${pending.length} facturas pendientes.`);
  }
  return {imported,skipped,failed,total:totalFiles};
}
async function handleLocalPdf(ev){
  const file = ev.target.files[0]; if(!file) return;
  if(isScanningData){
    alert('Ya hay una carga de facturas en progreso. Espera a que finalice.');
    ev.target.value='';
    return;
  }
  isScanningData=true;
  resetInvoiceProgress('Preparando la factura seleccionada desde este dispositivo…');
  updateInvoiceProgress({totalFiles:1,processedFiles:0,currentFile:`· ${file.name}`,records:state.records.length});
  setInvoiceLoading(true,'Espere, cargando la factura...');
  log(`Leyendo PDF local: ${file.name}`);
  try{
    const buf = await file.arrayBuffer();
    const result = await parsePdfArrayBuffer(buf, file.name, 'local',progress=>{
      updateInvoiceProgress({
        percent:8+(progress.currentPage/Math.max(1,progress.totalPages))*78,
        processedFiles:0,totalFiles:1,currentFile:`· ${file.name}`,
        currentPage:progress.currentPage,totalPages:progress.totalPages,
        records:state.records.length,stage:'read',detail:'Leyendo y reconociendo páginas'
      });
    });
    updateInvoiceProgress({percent:93,stage:'consolidate',detail:'Consolidando sedes e indicadores',currentPage:result.numPages,totalPages:result.numPages});
    if(result.records.length){
      const fingerprint = 'local-'+file.name+'-'+file.size+'-'+file.lastModified;
      addImport(result, fingerprint);
      saveStore(); scheduleRenderAll();
      updateInvoiceProgress({percent:100,processedFiles:1,totalFiles:1,records:state.records.length,stage:'done',detail:'Factura local consolidada correctamente',currentFile:''});
      log(`PDF local importado: ${result.records.length} registros, periodo ${result.period}.`);
      setInvoiceLoading(false,'Factura cargada correctamente.');
    } else {
      log(`PDF abierto, pero no se estructuraron registros. Muestra: ${result.sample.slice(0,1000).replace(/\s+/g,' ')}`);
      setInvoiceLoading(false,'No se encontraron registros estructurados en la factura.',true);
    }
  }catch(err){
    console.error(err);
    log(`Error importando PDF local: ${err.message}`);
    setInvoiceLoading(false,'No fue posible cargar la factura seleccionada.',true);
  }finally{
    isScanningData=false;
    ev.target.value='';
  }
}
function addImport(result, fingerprint){
  // Sustituye la versión anterior de la misma factura para evitar duplicados y cachés mezcladas.
  state.records=(state.records||[]).filter(r=>r.source!==result.fileName);
  invalidateSearchCaches();
  const existingKeys=new Set();
  for(const r of result.records||[]){
    if(!existingKeys.has(r.key)){ state.records.push(r); existingKeys.add(r.key); }
  }
  if(result.summary){
    state.summaries=(state.summaries||[]).filter(r=>r.source!==result.fileName && r.period!==result.summary.period);
    state.summaries.push(result.summary);
    state.summaries.sort((a,b)=>String(a.period).localeCompare(String(b.period)));
  }
  state.sites=rebuildSites(state.records);
  state.files[result.fileName]={name:result.fileName, fingerprint, period:result.period, importedAt:new Date().toISOString(), count:(result.records||[]).length};
}

async function parsePdfArrayBuffer(arrayBuffer, fileName, sourceUrl, onProgress=null){
  await ensurePdfJs();
  if(!window.pdfjsLib) throw new Error('PDF.js no está disponible.');
  const pdf = await pdfjsLib.getDocument({data:arrayBuffer}).promise;
  log(`PDF cargado: ${fileName}, ${pdf.numPages} páginas.`);
  if(typeof onProgress==='function') onProgress({currentPage:0,totalPages:pdf.numPages});
  let allText = '';
  const allLines = [];
  for(let p=1;p<=pdf.numPages;p++){
    const page = await pdf.getPage(p);
    const content = await page.getTextContent({disableCombineTextItems:false});
    const items = content.items.map(it=>({str:it.str||'', x:it.transform[4]||0, y:it.transform[5]||0})).filter(i=>i.str.trim());
    const lines = groupTextItemsIntoLines(items);
    allLines.push(...lines.map(line=>({page:p, text:line})));
    allText += `\nPÁGINA ${p}\n` + lines.join('\n');
    page.cleanup();
    if(typeof onProgress==='function') onProgress({currentPage:p,totalPages:pdf.numPages});
    if(p%40===0) log(`Leídas ${p}/${pdf.numPages} páginas...`);
    if(p%12===0) await new Promise(resolve=>setTimeout(resolve,0));
  }
  const period = detectPeriod(allText, fileName);
  const blocks = makeBlocks(allLines);
  log(`Marcadores de sede encontrados: ${blocks.length}. Periodo detectado: ${period}.`);
  const summary = parseSummary(allText);
  const records = [];
  blocks.forEach((block, idx)=>{
    const rec = parseBlock(block, period, fileName, sourceUrl, idx);
    if(rec && hasAnyMeasure(rec)) records.push(rec);
  });
  const summaryRecord={
    period, source:fileName, sourceUrl,
    waterM3:summary.waterM3, alcM3:summary.alcM3, energyKwh:summary.energyKwh, gasM3:summary.gasM3,
    waterValue:summary.waterValue, alcValue:summary.alcValue, energyValue:summary.energyValue, gasValue:summary.gasValue,
    otherValue:summary.wasteValue, verifiedFrom:'Resumen de facturación, página 1'
  };
  // El resumen oficial se guarda por separado: nunca se mezcla como una sede ni duplica el ranking.
  return {fileName, period, records, summary:summaryRecord, numPages:pdf.numPages, sample:allText.slice(0,3000)};
}
function groupTextItemsIntoLines(items){
  items.sort((a,b)=> Math.abs(b.y-a.y)>3 ? b.y-a.y : a.x-b.x);
  const lines=[];
  let current=[], cy=null;
  for(const it of items){
    if(cy===null || Math.abs(it.y-cy)<=3){ current.push(it); cy = cy===null ? it.y : (cy+it.y)/2; }
    else { lines.push(current.sort((a,b)=>a.x-b.x).map(i=>i.str).join(' ')); current=[it]; cy=it.y; }
  }
  if(current.length) lines.push(current.sort((a,b)=>a.x-b.x).map(i=>i.str).join(' '));
  return lines.map(cleanPdfText).filter(Boolean);
}
function cleanPdfText(s){ return String(s).replace(/\s+/g,' ').replace(/\s+([,.;:])/g,'$1').trim(); }
function loose(s){ return cleanPdfText(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9$.,%#/-]+/g,' ').trim(); }
function serviceExceptions(){
  const source=window.SIMECO_SERVICE_EXCEPTIONS;
  return Array.isArray(source?.exceptions)?source.exceptions:[];
}
function serviceExceptionForSite(row,service='energyKwh'){
  if(!row) return null;
  const normKey=value=>loose(value||'').replace(/[^a-z0-9]+/g,' ').trim();
  const key=`${row.site||''}|${row.address||''}`;
  return serviceExceptions().find(item=>item?.service===service && normKey(item?.key||'')===normKey(key)) || null;
}
function energyDataState(row){
  if(row?.hasEnergy) return {code:'identified',label:'Energía identificada',shortLabel:'Identificada',detail:'La sede tiene lecturas eléctricas asociadas.',exception:null};
  const exception=serviceExceptionForSite(row,'energyKwh');
  if(exception) return {code:'external',label:exception.label||'Energía en contrato separado',shortLabel:exception.shortLabel||'Contrato separado',detail:exception.summary||exception.dataState||'La energía se gestiona mediante una fuente contractual separada.',exception};
  return {code:'pending',label:'Energía no identificada',shortLabel:'No identificada',detail:`La sede tiene ${Number(row?.periodCount)||0} periodo(s) histórico(s), pero ninguna lectura eléctrica asociada a este nombre/dirección.`,exception:null};
}
function exceptionEvidenceHtml(exception){
  if(!exception) return '';
  const evidence=(exception.evidence||[]).map(item=>`<a class="secondary profile-evidence-link" href="${escapeHtml(item.url||'#')}" target="_blank" rel="noopener">${escapeHtml(item.title||'Ver evidencia')}</a>`).join('');
  return `<div class="external-contract-note"><strong>${escapeHtml(exception.label||'Servicio en contrato separado')}</strong><p>${escapeHtml(exception.summary||exception.dataState||'')}</p>${evidence?`<div class="evidence-links">${evidence}</div>`:''}${exception.recommendedAction?`<small><strong>Acción:</strong> ${escapeHtml(exception.recommendedAction)}</small>`:''}</div>`;
}
function renderServiceExceptions(){
  const panel=$('serviceExceptionsPanel'),body=$('serviceExceptionsBody');
  if(!panel||!body) return;
  const exceptions=serviceExceptions();
  panel.hidden=!exceptions.length;
  body.innerHTML=exceptions.map(ex=>`<article class="service-exception-card"><span class="quality-badge external">${escapeHtml(ex.shortLabel||ex.label||'Contrato separado')}</span><h3>${escapeHtml(ex.displayName||ex.site||'Sede')}</h3><p>${escapeHtml(ex.summary||'')}</p><small>${escapeHtml(ex.dataState||'')}</small><div class="evidence-links">${(ex.evidence||[]).map(ev=>`<a class="secondary" href="${escapeHtml(ev.url||'#')}" target="_blank" rel="noopener">${escapeHtml(ev.title||'Evidencia')}</a>`).join('')}</div></article>`).join('');
}
function compact(s){ return loose(s).replace(/\s+/g,''); }
function isServiceMarker(line){
  const c = compact(line);
  return c.includes('prestaciondelservicio') || c.includes('prestaci ondelservicio') || c.includes('prestacio ndelservicio');
}
function makeBlocks(lines){
  const blocks=[]; let current=null;
  for(const row of lines){
    if(isServiceMarker(row.text)){
      if(current) blocks.push(current);
      current = {page:row.page, lines:[row.text]};
    } else if(current){
      current.lines.push(row.text);
    }
  }
  if(current) blocks.push(current);
  return blocks;
}
function detectPeriod(text, fileName){
  const l = loose(text);
  const m = l.match(/resumen de facturaci\s*o\s*n\s+([a-z]+)\s+de\s+(20\d{2})/i) || l.match(/facturacion\s+([a-z]+)\s+de\s+(20\d{2})/i);
  const months = {enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',julio:'07',agosto:'08',septiembre:'09',setiembre:'09',octubre:'10',noviembre:'11',diciembre:'12'};
  if(m && months[m[1]]) return `${m[2]}-${months[m[1]]}`;
  const f = loose(fileName);
  for(const [name,num] of Object.entries(months)){ if(f.includes(name)){ const y=(f.match(/20\d{2}/)||['2025'])[0]; return `${y}-${num}`; } }
  return new Date().toISOString().slice(0,7);
}
function parseSummary(text){
  const head = text.slice(0,8000);
  return {
    waterM3: extractAfter(head, /ACTUAL\s+([\d.,]+)\s*m3[\s\S]{0,200}?Acueducto/i),
    alcM3: nthNumberByLabel(head, 'ACTUAL', 2, 'm3'),
    energyKwh: extractAfter(head, /ACTUAL\s+([\d.,]+)\s*kwh/i),
    gasM3: nthNumberByLabel(head, 'ACTUAL', 3, 'm3'),
    waterValue: valueAfter(head,'Total Acueducto'),
    alcValue: valueAfter(head,'Total Alcantarillado'),
    energyValue: valueAfter(head,'Total Energ'),
    gasValue: valueAfter(head,'Total Gas Natural'),
    wasteValue: valueAfter(text.slice(0,12000),'Total Otras Entidades')
  };
}
function nthNumberByLabel(text,label,n,unit){
  const re = new RegExp(label+'\\s+([\\d.,]+)\\s*'+unit,'gi'); let m, i=0;
  while((m=re.exec(text))){ i++; if(i===n) return parseNumber(m[1]); }
  return null;
}
function parseBlock(block, period, fileName, sourceUrl, idx){
  const text = block.lines.join('\n');
  const header = extractHeader(block.lines[0], block.lines[1]||'');
  if(!header.site) return null;
  const energyKwh = extractEnergyKwh(text);
  const waterM3 = extractServiceConsumption(text, 'agua') ?? extractBeforeTotal(text,'Total Agua','m3');
  const alcM3 = extractServiceConsumption(text, 'alcantarillado') ?? extractBeforeTotal(text,'Total Alcantarillado','m3');
  const gasM3 = extractServiceConsumption(text, 'gas') ?? extractBeforeTotal(text,'Total Gas','m3');
  const wasteTon = extractWasteTon(text);
  const rec = {
    key:`${period}|${siteKey(header.site,header.address)}|${block.page}|${idx}|${fileName}`,
    period, site:header.site, address:header.address,
    waterM3, alcM3, energyKwh, gasM3,
    waterValue:valueAfter(text,'Total Agua'), alcValue:valueAfter(text,'Total Alcantarillado'), energyValue:valueAfter(text,'Total Energ'), gasValue:valueAfter(text,'Total Gas'),
    wasteValue:valueAfter(text,'Total Aseo'), wasteTon,
    co2kg: round((energyKwh||0)*FACTOR_CO2_KG_KWH,2),
    source:fileName, sourceUrl, page:block.page, type:'sede'
  };
  return rec;
}
function extractHeader(line, nextLine){
  let raw = line;
  if(!/servicio\s*:/i.test(raw) && nextLine) raw += ' ' + nextLine;
  const m = raw.match(/servicio\s*:\s*(.+)$/i);
  let h = m ? m[1] : raw.replace(/.*servicio/i,'');
  h = cleanPdfText(h).replace(/\s*-\s*Municipio:.*$/i,'');
  const parts = h.split(/\s+-\s+/);
  const site = (parts.shift()||'').replace(/[.*]+$/,'').trim();
  const address = parts.join(' - ').trim();
  return {site, address};
}
function metricSegment(text,targetPattern,previousPatterns=[]){
  const target=new RegExp(`Total\\s+${targetPattern}\\b`,'i').exec(text);
  if(!target) return '';
  let start=0;
  const prefix=text.slice(0,target.index);
  previousPatterns.forEach(pattern=>{
    const re=new RegExp(`Total\\s+${pattern}\\b`,'gi');
    let match;
    while((match=re.exec(prefix))) start=Math.max(start,match.index+match[0].length);
  });
  return text.slice(start,target.index);
}
function lastMeasurementMatch(fragment,patterns,kind){
  for(const pattern of patterns){
    const matches=[...fragment.matchAll(pattern)];
    if(matches.length) return parseMeasurement(matches[matches.length-1][1],kind);
  }
  return null;
}
function extractServiceConsumption(text,service){
  if(service==='agua'){
    const segment=metricSegment(text,'(?:Agua|Acueducto)');
    return lastMeasurementMatch(segment,[/Consumo\s+[A-Za-z]{3,4}-\d{2}\s+([\d.,]+)\s*x/gi,/([\d.,]+)\s*(?:m3|mt\s*3|m³)[\s\S]{0,80}?=\s*Consumo/gi],'water');
  }
  if(service==='alcantarillado'){
    const segment=metricSegment(text,'Alcantarillado',['(?:Agua|Acueducto)']);
    return lastMeasurementMatch(segment,[/Consumo\s+[A-Za-z]{3,4}-\d{2}\s+([\d.,]+)\s*x/gi,/([\d.,]+)\s*(?:m3|mt\s*3|m³)[\s\S]{0,80}?=\s*Consumo/gi],'water');
  }
  if(service==='gas'){
    const segment=metricSegment(text,'Gas',['Energ[ií]a','Alcantarillado','(?:Agua|Acueducto)']);
    return lastMeasurementMatch(segment,[/Consumo\s+[A-Za-z]{3,4}-\d{2}\s+([\d.,]+)\s*x/gi,/([\d.,]+)\s*(?:m3|mt\s*3|m³)[\s\S]{0,80}?=\s*Consumo/gi],'gas');
  }
  return null;
}
function extractBeforeTotal(text,totalLabel,unit){
  const label=loose(totalLabel);
  if(label.includes('alcantarillado')) return extractServiceConsumption(text,'alcantarillado');
  if(label.includes('gas')) return extractServiceConsumption(text,'gas');
  return extractServiceConsumption(text,'agua');
}
function extractEnergyKwh(text){
  const segment=metricSegment(text,'Energ[ií]a',['Alcantarillado','(?:Agua|Acueducto)']);
  return lastMeasurementMatch(segment,[/Energ[ií]a(?:\s+activa)?\s+[A-Za-z]{3,4}-\d{2}\s+([\d.,]+)\s*x/gi,/Consumo\s+[A-Za-z]{3,4}-\d{2}\s+([\d.,]+)\s*x/gi,/([\d.,]+)\s*kWh[\s\S]{0,100}?=\s*Consumo/gi],'energy');
}
function extractWasteTon(text){
  const values=[];
  [/No\s+Aprov(?:echables)?-?Ordinarios\s+([\d.,]+)/i,/Barrido\s+y\s+limpieza\s+([\d.,]+)/i,/Limpieza\s+urbana\s+([\d.,]+)/i,/Rechazados\s+([\d.,]+)/i].forEach(re=>{
    const match=text.match(re);const value=match?parseMeasurement(match[1],'ton'):null;
    if(value!==null) values.push(value);
  });
  return values.length?round(values.reduce((a,b)=>a+b,0),5):null;
}
function valueAfter(text,label){
  const re=new RegExp(`${String(label).replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}[\\s\\S]{0,220}?\\$\\s*-?\\s*([\\d.,]+)`,'i');
  const match=text.match(re);
  return match?parseMoney(match[1]):null;
}
function extractAfter(text,re){ const m=text.match(re); return m?parseNumber(m[1]):null; }
function parseMeasurement(v,kind='generic'){
  if(v==null) return null;
  let s=String(v).trim().replace(/\s/g,'').replace(/[^0-9,.-]/g,'');
  if(!s) return null;
  const negative=s.startsWith('-');s=s.replace(/-/g,'');
  if(kind==='water'){
    if(s.includes(',')) s=s.replace(/\./g,'').replace(',','.');
    else if(s.includes('.')){const parts=s.split('.');if(parts.slice(1).every(part=>part.length===3)) s=parts.join('');}
  }else if(kind==='gas'||kind==='ton'){
    if(s.includes(',')) s=s.replace(/\./g,'').replace(',','.');
    else if((s.match(/\./g)||[]).length>1){const parts=s.split('.');s=parts.slice(0,-1).join('')+'.'+parts.at(-1);}
  }else if(kind==='energy'){
    if(s.includes(',')&&s.includes('.')) s=s.replace(/\./g,'').replace(',','.');
    else if(s.includes(',')) s=s.replace(',','.');
    else if(s.includes('.')){const parts=s.split('.');if(parts.slice(1).every(part=>part.length===3)) s=parts.join('');}
  }else{
    const commas=(s.match(/,/g)||[]).length,dots=(s.match(/\./g)||[]).length;
    if(commas&&dots){if(s.lastIndexOf(',')>s.lastIndexOf('.')) s=s.replace(/\./g,'').replace(',','.');else s=s.replace(/,/g,'');}
    else if(dots){const parts=s.split('.');if(parts.length>2||(parts.length===2&&parts[1].length===3&&parts[0]!=='0')) s=parts.join('');}
    else if(commas){const parts=s.split(',');s=(parts.length>2)?parts.join(''):parts.join('.');}
  }
  const n=parseFloat((negative?'-':'')+s);return Number.isFinite(n)?n:null;
}
function parseNumber(v){ return parseMeasurement(v,'generic'); }
function parseMoney(v){ return parseNumber(v); }
function round(n,d=2){ return Number.isFinite(n) ? Math.round(n*Math.pow(10,d))/Math.pow(10,d) : 0; }
function hasAnyMeasure(r){ return [r.waterM3,r.alcM3,r.energyKwh,r.gasM3,r.wasteValue,r.wasteTon].some(v=>v!==null && v!==undefined && v!==0); }
function rawSiteKey(site,address=''){ return `${loose(site)}|${loose(address)}`; }
function siteKey(site,address=''){
  const raw=rawSiteKey(site,address);
  const meta=window.SIMECO_TERRITORIAL_SYNC?.[raw];
  return meta?.institutionGroupId ? `institution:${loose(meta.institutionGroupId)}` : raw;
}
function preferredSiteName(record){
  const meta=getTerritorySyncMeta(record);
  return meta?.institutionDisplayName || meta?.displayName || record?.site || 'Sin nombre';
}
function siteSearchHaystack(record){
  if(record && recordSearchTextCache.has(record)) return recordSearchTextCache.get(record);
  const meta=getTerritorySyncMeta(record) || {};
  const text=loose(`${record?.site||''} ${record?.address||''} ${meta.institutionDisplayName||''} ${meta.displayName||''} ${meta.matchedName||''} ${meta.aliases||''} ${meta.institutionRole||''}`);
  if(record && typeof record==='object') recordSearchTextCache.set(record,text);
  return text;
}
function invalidateSearchCaches(){
  siteSearchDataRevision++;
  siteSearchOptionsCache.clear();
  recordsBySiteKeyCache=null;
  filteredRecordsCache={key:'',rows:null};
}
function recordsBySiteKey(){
  if(recordsBySiteKeyCache) return recordsBySiteKeyCache;
  const map=new Map();
  for(const r of state.records||[]){
    const key=siteKey(r.site,r.address);
    if(!map.has(key)) map.set(key,[]);
    map.get(key).push(r);
  }
  recordsBySiteKeyCache=map;
  return map;
}
function searchScopeSignature(scope){
  if(scope==='compare'||scope==='dashboard'||scope==='table'){
    const f=territoryFilterValues(scope);
    return `${scope}|${f.type||''}|${f.territory||''}|${f.nucleus||''}|${state.records.length}|${siteSearchDataRevision}`;
  }
  return `all|${state.records.length}|${siteSearchDataRevision}`;
}

function searchTokens(value){ return loose(value).split(/\s+/).filter(Boolean); }
function recordMatchesSearch(r, query){
  if(selectedSiteKey) return siteKey(r.site,r.address)===selectedSiteKey;
  const tokens = searchTokens(query);
  if(!tokens.length) return true;
  const haystack = siteSearchHaystack(r);
  return tokens.every(token=>haystack.includes(token));
}
function serviceHasValue(r, service){
  if(!service) return true;
  if(service==='energia') return Number(r.energyKwh)>0;
  if(service==='agua') return Number(r.waterM3)>0;
  if(service==='alcantarillado') return Number(r.alcM3)>0;
  if(service==='gas') return Number(r.gasM3)>0;
  if(service==='aseo') return Number(r.wasteValue)>0 || Number(r.wasteTon)>0;
  return true;
}
function sortRecords(records){
  const mode = $('sortFilter')?.value || 'period-desc';
  return [...records].sort((a,b)=>{
    if(mode==='period-asc') return String(a.period).localeCompare(String(b.period)) || String(a.site).localeCompare(String(b.site),'es');
    if(mode==='site-asc') return String(a.site).localeCompare(String(b.site),'es') || String(b.period).localeCompare(String(a.period));
    if(mode==='energy-desc') return (Number(b.energyKwh)||0)-(Number(a.energyKwh)||0);
    if(mode==='co2-desc') return (Number(b.co2kg)||0)-(Number(a.co2kg)||0);
    return String(b.period).localeCompare(String(a.period)) || String(a.site).localeCompare(String(b.site),'es');
  });
}
function filteredRecords(){
  const q=$('siteSearch')?.value||'';
  const p=$('periodFilter')?.value||'';
  const service=$('serviceFilter')?.value||'';
  const tf=territoryFilterValues('table');
  const sort=$('sortFilter')?.value||'period-desc';
  const cacheKey=[siteSearchDataRevision,selectedSiteKey,q,p,service,tf.type||'',tf.territory||'',tf.nucleus||'',sort].join('|');
  if(filteredRecordsCache.key===cacheKey && filteredRecordsCache.rows) return filteredRecordsCache.rows;
  const rows=sortRecords(state.records.filter(r=>recordMatchesTerritory(r,tf) && recordMatchesSearch(r,q) && (!p || r.period===p) && serviceHasValue(r,service)));
  filteredRecordsCache={key:cacheKey,rows};
  return rows;
}
function applyFilters(immediate=false,delay=120){
  clearTimeout(filterTimer);
  const run=()=>requestAnimationFrame(()=>{recordTablePage=0;filteredRecordsCache={key:'',rows:null};renderTable();renderFilterSummary();syncAllSearchableSelects();});
  if(immediate) run(); else filterTimer=setTimeout(run,delay);
}
function clearSiteSearch(){
  const input=$('siteSearch');
  if(!input) return;
  input.value='';selectedSiteKey='';$('clearSearchBtn')?.classList.remove('visible');closeAutocomplete();applyFilters();input.focus();
}
function clearAllFilters(){
  const input=$('siteSearch'); if(input) input.value='';
  selectedSiteKey='';
  ['territoryTypeFilter','territoryFilter','nucleusFilter'].forEach(id=>{if($(id)) $(id).value='';});
  updateTerritoryCascade('table');
  if($('periodFilter')) $('periodFilter').value='';
  if($('serviceFilter')) $('serviceFilter').value='';
  if($('sortFilter')) $('sortFilter').value='period-desc';
  $('clearSearchBtn')?.classList.remove('visible');closeAutocomplete();applyFilters();
}
function handleSiteSearchInput(){
  const input=$('siteSearch'); if(!input) return;
  selectedSiteKey='';
  $('clearSearchBtn')?.classList.toggle('visible',Boolean(input.value));
  const value=input.value;
  scheduleAutocomplete('main-site-search',()=>renderAutocompleteSuggestions(value),35);
  applyFilters(false,220);
}
function siteSearchOptions(scope='all'){
  const signature=searchScopeSignature(scope);
  const cached=siteSearchOptionsCache.get(signature);
  if(cached) return cached;
  const map = new Map();
  const records = scope==='compare' ? territoryScopedRecords('compare') : scope==='dashboard' ? territoryScopedRecords('dashboard') : scope==='table' ? territoryScopedRecords('table') : state.records;
  for(const r of records){
    const key=siteKey(r.site,r.address);
    if(!map.has(key)){
      const syncMeta=getTerritorySyncMeta(r) || {};
      const displaySite=syncMeta.institutionDisplayName||syncMeta.displayName||r.site||'Sin nombre';
      map.set(key,{key,site:r.site||'Sin nombre',displaySite,address:r.address||'',periods:new Set(),addresses:new Set(),invoiceSites:new Set(),meta:territoryMeta(r),searchText:'',invoiceSite:r.site||''});
    }
    const item=map.get(key);
    item.periods.add(r.period);
    if(r.address) item.addresses.add(r.address);
    if(r.site) item.invoiceSites.add(r.site);
    // Evita concatenar repetidamente el mismo texto para cada periodo.
    if(!item.searchText) item.searchText=siteSearchHaystack(r);
    else {
      const extra=siteSearchHaystack(r);
      if(extra && !item.searchText.includes(extra)) item.searchText+=` ${extra}`;
    }
  }
  const result=[...map.values()].map(x=>{
    const siteNorm=loose(x.displaySite||x.site),addressNorm=loose(x.address),searchNorm=x.searchText||`${siteNorm} ${addressNorm}`;
    return {...x,periodCount:x.periods.size,siteCount:x.addresses.size||1,addressLabel:x.addresses.size>1?`${x.addresses.size} sedes · ${[...x.addresses].join(' / ')}`:(x.address||'Sin dirección registrada'),invoiceSiteLabel:[...x.invoiceSites].join(' / '),_siteNorm:siteNorm,_addressNorm:addressNorm,_searchNorm:searchNorm};
  });
  siteSearchOptionsCache.set(signature,result);
  return result;
}

function suggestionScore(item, query){
  const q=loose(query), site=item._siteNorm||loose(item.displaySite||item.site), address=item._addressNorm||loose(item.address), all=item._searchNorm||item.searchText||`${site} ${address}`;
  if(!q) return 1;
  const tokens=searchTokens(q); if(!tokens.every(t=>all.includes(t))) return -1;
  let score=0; if(site===q) score+=1000; if(site.startsWith(q)) score+=600; if(site.includes(q)) score+=300; if(address.startsWith(q)) score+=120;
  const words=site.split(' ');
  tokens.forEach(t=>{ if(words.some(w=>w.startsWith(t))) score+=40; else if(site.includes(t)) score+=20; else score+=5; });
  return score;
}
function highlightMatch(text, query){
  let safe=escapeHtml(text||''); const tokens=[...new Set(searchTokens(query))].sort((a,b)=>b.length-a.length); if(!tokens.length) return safe;
  for(const token of tokens){ const re=new RegExp(`(${token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'gi'); safe=safe.replace(re,'<mark>$1</mark>'); }
  return safe;
}
function renderAutocompleteSuggestions(query=''){
  const box=$('siteSuggestions'),input=$('siteSearch'); if(!box||!input) return;
  const q=String(query||'').trim();
  const options=siteSearchOptions('table').map(x=>({...x,score:suggestionScore(x,q)})).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score || a.site.localeCompare(b.site,'es')).slice(0,10);
  autocompleteIndex=-1;
  if(!options.length){box.innerHTML='<div class="autocomplete-empty">No se encontraron sedes. Prueba con otra palabra.</div>';box.hidden=false;input.setAttribute('aria-expanded','true');return;}
  box.innerHTML=options.map((x,i)=>`<button type="button" class="autocomplete-option" role="option" data-key="${escapeHtml(x.key)}" data-index="${i}"><span><strong>${highlightMatch(x.displaySite||x.site,q)}</strong><small>${x.displaySite!==x.site?`En factura: ${highlightMatch(x.site,q)} · `:''}${mapAddressAction(x.addressLabel||x.address,highlightMatch(x.addressLabel||x.address||'Sin dirección registrada',q),x.displaySite||x.site)} · ${escapeHtml(x.meta?.territory||'Sin clasificar')} · Núcleo ${escapeHtml(x.meta?.nucleus||'Sin clasificar')}</small></span><em>${x.periodCount} periodo${x.periodCount===1?'':'s'}</em></button>`).join('');
  box.hidden=false;input.setAttribute('aria-expanded','true');
}
function closeAutocomplete(){
  const box=$('siteSuggestions'),input=$('siteSearch');
  if(box) box.hidden=true;if(input) input.setAttribute('aria-expanded','false');autocompleteIndex=-1;
}
function chooseSuggestion(button){
  const item=siteSearchOptions('table').find(x=>x.key===button.dataset.key); if(!item) return;
  selectedSiteKey=item.key; $('siteSearch').value=item.displaySite||item.site; $('clearSearchBtn').classList.add('visible'); closeAutocomplete(); applyFilters();
}
function handleSuggestionClick(e){ const btn=e.target.closest('.autocomplete-option'); if(btn) chooseSuggestion(btn); }
function handleAutocompleteKeydown(e){
  const box=$('siteSuggestions'); const opts=[...box.querySelectorAll('.autocomplete-option')];
  if(e.key==='Escape'){ closeAutocomplete(); return; }
  if((e.key==='ArrowDown'||e.key==='ArrowUp') && box.hidden){ renderAutocompleteSuggestions($('siteSearch').value); }
  if(!opts.length) return;
  if(e.key==='ArrowDown'){ e.preventDefault(); autocompleteIndex=(autocompleteIndex+1)%opts.length; }
  else if(e.key==='ArrowUp'){ e.preventDefault(); autocompleteIndex=(autocompleteIndex-1+opts.length)%opts.length; }
  else if(e.key==='Enter' && autocompleteIndex>=0){ e.preventDefault(); chooseSuggestion(opts[autocompleteIndex]); return; }
  else return;
  opts.forEach((o,i)=>o.classList.toggle('active',i===autocompleteIndex)); opts[autocompleteIndex].scrollIntoView({block:'nearest'});
}
function renderFilterSummary(){
  const count=$('filterResultCount'),active=$('activeFilters');
  if(!count&&!active) return;
  const recs=filteredRecords(),uniqueSites=new Set(recs.map(r=>siteKey(r.site,r.address))).size;
  if(count) count.textContent=`${recs.length} registro${recs.length===1?'':'s'} · ${uniqueSites} sede${uniqueSites===1?'':'s'}`;
  if(!active) return;
  const chips=[],q=$('siteSearch')?.value.trim()||'',p=$('periodFilter')?.value||'',service=$('serviceFilter');
  const tf=territoryFilterValues('table');
  if(tf.type) chips.push(`<button type="button" data-clear="territoryType">Ámbito: ${escapeHtml(tf.type)} ×</button>`);
  if(tf.territory) chips.push(`<button type="button" data-clear="territory">Territorio: ${escapeHtml(tf.territory)} ×</button>`);
  if(tf.nucleus) chips.push(`<button type="button" data-clear="nucleus">Núcleo: ${escapeHtml(tf.nucleus)} ×</button>`);
  if(q) chips.push(`<button type="button" data-clear="search">Búsqueda: ${escapeHtml(q)} ×</button>`);
  if(p) chips.push(`<button type="button" data-clear="period">Periodo: ${escapeHtml(p)} ×</button>`);
  if(service?.value) chips.push(`<button type="button" data-clear="service">${escapeHtml(service.selectedOptions[0]?.textContent||service.value)} ×</button>`);
  active.innerHTML=chips.join('')||'<span>Mostrando toda la información disponible.</span>';
  active.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
    const t=btn.dataset.clear;if(t==='search') return clearSiteSearch();
    if(t==='territoryType'){if($('territoryTypeFilter')) $('territoryTypeFilter').value='';updateTerritoryCascade('table','type');}
    else if(t==='territory'){if($('territoryFilter')) $('territoryFilter').value='';updateTerritoryCascade('table','territory');}
    else if(t==='nucleus'){if($('nucleusFilter')) $('nucleusFilter').value='';}
    else {const el=$(t==='period'?'periodFilter':'serviceFilter');if(el) el.value='';}
    applyFilters();
  }));
}
function renderAll(){
  recalculateCo2();refreshAllTerritoryFilters();renderControls();renderCards();renderExecutiveSummary();renderProjectImpact();renderDashboard();renderDataQuality();renderTable();renderRanking();
  if($('chart')) drawChart(comparisonGroups($('compareMode')?.value||'month'));
  updateHistorySourceNote();refreshSiteAutocompleteFields();
}
function renderControls(){
  const periods=[...new Set(state.records.map(r=>r.period))].sort();
  const periodFilter=$('periodFilter');
  if(periodFilter){const current=periodFilter.value;periodFilter.innerHTML='<option value="">Todos los periodos</option>'+periods.map(p=>`<option value="${p}">${p}</option>`).join('');periodFilter.value=current;}
  if($('compareA')&&$('compareB')) renderCompareControls();
  renderFilterSummary();syncAllSearchableSelects();
}
function renderCards(){
  const recs=state.records||[],official=officialSummaries();
  const periods=new Set([...recs.map(r=>r.period),...official.map(r=>r.period)].filter(Boolean)).size;
  const sites=new Set(recs.map(r=>siteKey(r.site,r.address))).size;
  const detailSum=field=>recs.reduce((a,r)=>a+(Number(r[field])||0),0),officialSum=field=>official.reduce((a,r)=>a+(Number(r[field])||0),0);
  const energy=official.length?officialSum('energyKwh'):detailSum('energyKwh'),water=official.length?officialSum('waterM3'):detailSum('waterM3'),co2kg=energy*FACTOR_CO2_KG_KWH;
  const values={kPeriods:periods,kSites:sites,kKwh:fmt(energy)+' kWh',kCo2:fmt(co2kg/1000)+' t CO₂e',kTrees:fmt(Math.ceil(co2kg/TREE_CO2_KG_YEAR)),kWater:fmt(water)+' m³',kWaste:fmt(detailSum('wasteTon'))+' t'};
  Object.entries(values).forEach(([id,value])=>{if($(id)) $(id).textContent=value;});
}
function renderSourceDownload(record){
  const name = String(record?.source || 'Factura PDF');
  const rawUrl = String(record?.sourceUrl || '');
  if(!rawUrl || rawUrl === 'local'){
    return `<span class="source-local" title="Este archivo fue cargado localmente y no tiene una URL permanente">${escapeHtml(name)}</span>`;
  }
  let url = rawUrl;
  if(!/^https?:\/\//i.test(url) && !url.startsWith('data/')) url = 'data/' + encodeURIComponent(name);
  const safeUrl = escapeHtml(url);
  return `<a class="source-download" href="${safeUrl}" download="${escapeHtml(name)}" target="_blank" rel="noopener" title="Descargar factura PDF">${escapeHtml(name)} <span aria-hidden="true">↓</span></a>`;
}
function renderRecordPagination(total){
  const body=$('recordsBody'); const wrap=body?.closest('.table-wrap'); if(!wrap) return;
  let nav=wrap.parentElement?.querySelector('.records-pagination');
  if(!nav){nav=document.createElement('div');nav.className='records-pagination';wrap.insertAdjacentElement('afterend',nav);}
  const pages=Math.max(1,Math.ceil(total/RECORD_TABLE_PAGE_SIZE));
  recordTablePage=Math.max(0,Math.min(recordTablePage,pages-1));
  const start=total?recordTablePage*RECORD_TABLE_PAGE_SIZE+1:0;
  const end=Math.min(total,(recordTablePage+1)*RECORD_TABLE_PAGE_SIZE);
  nav.innerHTML=`<span>Mostrando <strong>${start}-${end}</strong> de <strong>${total}</strong> registros</span><div><button type="button" class="secondary" data-record-page="prev" ${recordTablePage<=0?'disabled':''}>← Anterior</button><span>Página ${recordTablePage+1} de ${pages}</span><button type="button" class="secondary" data-record-page="next" ${recordTablePage>=pages-1?'disabled':''}>Siguiente →</button></div>`;
  nav.querySelector('[data-record-page="prev"]')?.addEventListener('click',()=>{recordTablePage=Math.max(0,recordTablePage-1);renderTable();wrap.scrollIntoView({block:'start',behavior:'smooth'});});
  nav.querySelector('[data-record-page="next"]')?.addEventListener('click',()=>{recordTablePage=Math.min(pages-1,recordTablePage+1);renderTable();wrap.scrollIntoView({block:'start',behavior:'smooth'});});
}
function renderTable(){
  const body=$('recordsBody');if(!body) return;
  const recs=filteredRecords();renderFilterSummary();
  const includeTerritory=(body.closest('table')?.querySelectorAll('thead th').length||0)>=13;
  const pages=Math.max(1,Math.ceil(recs.length/RECORD_TABLE_PAGE_SIZE));
  recordTablePage=Math.max(0,Math.min(recordTablePage,pages-1));
  const visible=recs.slice(recordTablePage*RECORD_TABLE_PAGE_SIZE,(recordTablePage+1)*RECORD_TABLE_PAGE_SIZE);
  const rows=visible.map(r=>{
    const meta=territoryMeta(r);
    return `<tr><td data-label="Periodo">${escapeHtml(r.period)}</td><td data-label="Sede">${escapeHtml(r.site||'Sin nombre')}</td><td data-label="Dirección">${mapAddressLink(r.address,r.address||'Sin dirección',preferredSiteName(r)||r.site)}</td>${includeTerritory?`<td data-label="Comuna/Corregimiento">${escapeHtml(meta.territory||'Sin clasificar')}</td><td data-label="Núcleo">${escapeHtml(meta.nucleus||'Sin clasificar')}</td>`:''}<td data-label="Agua m³">${num(r.waterM3)}</td><td data-label="Alc. m³">${num(r.alcM3)}</td><td data-label="Energía kWh">${num(r.energyKwh)}</td><td data-label="Gas m³">${num(r.gasM3)}</td><td data-label="Aseo $">${money(r.wasteValue)}</td><td data-label="Residuos t">${num(r.wasteTon)}</td><td data-label="CO₂ kg">${num(r.co2kg)}</td><td data-label="Fuente">${renderSourceDownload(r)}</td></tr>`;
  }).join('');
  const cols=includeTerritory?13:11;
  body.innerHTML=rows||`<tr><td colspan="${cols}"><div class="empty-filter-state"><strong>No hay coincidencias</strong><span>Prueba con menos palabras, cambia el periodo o limpia los filtros.</span><button type="button" onclick="clearAllFilters()" class="secondary">Limpiar filtros</button></div></td></tr>`;
  renderRecordPagination(recs.length);
}

function aggregateByPeriod(records){
  const map = {};
  for(const r of records){
    map[r.period] ||= {period:r.period, energyKwh:0, waterM3:0, alcM3:0, gasM3:0, wasteTon:0, co2kg:0};
    ['energyKwh','waterM3','alcM3','gasM3','wasteTon','co2kg'].forEach(k=>map[r.period][k]+=Number(r[k])||0);
  }
  return Object.values(map).sort((a,b)=>a.period.localeCompare(b.period));
}
function officialSummaries(){
  return (Array.isArray(state.summaries)?state.summaries:[])
    .filter(r=>r?.period && Number.isFinite(Number(r.energyKwh)))
    .map(r=>({...r,co2kg:(Number(r.energyKwh)||0)*FACTOR_CO2_KG_KWH}))
    .sort((a,b)=>String(a.period).localeCompare(String(b.period)));
}
function isGlobalCompareScope(){
  const site=$('compareSite')?.value||'';
  const filters=territoryFilterValues('compare');
  return !site && !filters.type && !filters.territory && !filters.nucleus;
}
function aggregateSummariesByComparison(mode){
  const map={};
  for(const r of officialSummaries()){
    const key=groupKeyForPeriod(r.period,mode);
    if(!key) continue;
    map[key] ||= {key,period:groupLabel(key,mode),energyKwh:0,waterM3:0,alcM3:0,gasM3:0,wasteTon:0,co2kg:0,records:0,official:true,sources:[],metricCounts:{energyKwh:0,waterM3:0,alcM3:0,gasM3:0,wasteTon:0}};
    ['energyKwh','waterM3','alcM3','gasM3'].forEach(k=>{
      if(r[k]!==null && r[k]!==undefined && r[k]!=='' && Number.isFinite(Number(r[k]))){map[key][k]+=Number(r[k]);map[key].metricCounts[k]+=1;}
    });
    map[key].co2kg=map[key].energyKwh*FACTOR_CO2_KG_KWH;
    map[key].records+=1;
    if(r.source) map[key].sources.push(r.source);
  }
  return Object.values(map).sort((a,b)=>a.key.localeCompare(b.key));
}
function comparisonGroups(mode){
  const metric=selectedHistoryMetric();
  // Los resúmenes oficiales contienen energía, agua, alcantarillado y gas. Para
  // residuos se usa el detalle por sede porque ese indicador no está en la portada.
  if(isGlobalCompareScope() && officialSummaries().length && metric.field!=='wasteTon') return aggregateSummariesByComparison(mode);
  return aggregateByComparison(recordsForCompareScope(),mode);
}
function historyGroupHasMetric(item,field){
  if(!item) return false;
  if(item.metricCounts && Object.prototype.hasOwnProperty.call(item.metricCounts,field)) return Number(item.metricCounts[field])>0;
  return item[field]!==null && item[field]!==undefined && item[field]!=='' && Number.isFinite(Number(item[field]));
}
function updateHistorySourceNote(){
  const el=$('historyDataSourceNote');if(!el) return;
  const summaries=officialSummaries();
  const metric=selectedHistoryMetric();
  if(isGlobalCompareScope()&&summaries.length&&metric.field!=='wasteTon'){
    const differences=summaries.map(r=>Math.abs(Number(r.reconciliation?.energyDifferencePct))).filter(Number.isFinite);
    const maxDifference=differences.length?Math.max(...differences):null;
    const last=summaries.at(-1)?.period||'';
    el.innerHTML=`<strong>Histórico oficial estable · ${escapeHtml(metric.label)}:</strong> ${summaries.length} periodos verificados directamente en el “Resumen de facturación” de la página 1 de cada PDF${last?`, hasta ${escapeHtml(groupLabel(last,'month'))}`:''}. ${metric.field==='energyKwh'&&maxDifference!==null?`La conciliación del detalle por sede presenta una diferencia máxima de ${fmt(maxDifference)}% frente al total oficial.`:'La gráfica general utiliza el total oficial disponible para este servicio y no suma sedes parciales.'}`;
  }else if(isGlobalCompareScope() && metric.field==='wasteTon'){
    el.innerHTML='<strong>Histórico de residuos / aseo:</strong> este indicador no está consolidado como volumen en la portada de la factura. La gráfica se construye con los registros detallados de las sedes donde el dato de residuos está disponible.';
  }else{
    el.innerHTML=`<strong>Detalle por sede · ${escapeHtml(metric.label)}:</strong> la comparación usa exclusivamente lecturas asociadas a la institución o dirección seleccionada. Los periodos sin lectura del indicador no se convierten en cero.`;
  }
}
function getSiteOptions(){
  return Object.values(state.sites).sort((a,b)=>String(a.site).localeCompare(String(b.site)));
}
function periodToParts(period){
  const m = String(period||'').match(/^(20\d{2})-(\d{2})$/);
  if(!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if(!year || month<1 || month>12) return null;
  return {year, month};
}
function groupKeyForPeriod(period, mode){
  const p = periodToParts(period);
  if(!p) return null;
  if(mode === 'year') return `${p.year}`;
  if(mode === 'semester') return `${p.year}-S${p.month<=6?1:2}`;
  if(mode === 'quarter') return `${p.year}-Q${Math.ceil(p.month/3)}`;
  return `${p.year}-${String(p.month).padStart(2,'0')}`;
}
function periodMonthShort(month){
  return ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][Math.max(0,Number(month||1)-1)] || '';
}
function groupLabel(key, mode){
  const k = String(key||'');
  if(mode === 'quarter'){
    const m = k.match(/^(20\d{2})-Q([1-4])$/);
    return m ? `Trim. ${m[2]} ${m[1]}` : k;
  }
  if(mode === 'semester'){
    const m = k.match(/^(20\d{2})-S([1-2])$/);
    return m ? `Sem. ${m[2]} ${m[1]}` : k;
  }
  if(mode === 'year') return k;
  const p = periodToParts(k);
  return p ? `${periodMonthShort(p.month)} ${p.year}` : k;
}
function chartLabelLines(item){
  const key = String(item?.key || item?.period || '');
  const p = periodToParts(key);
  if(p) return [periodMonthShort(p.month), String(p.year)];
  const q = key.match(/^(20\d{2})-Q([1-4])$/);
  if(q) return [`Trim. ${q[2]}`, q[1]];
  const s = key.match(/^(20\d{2})-S([1-2])$/);
  if(s) return [`Sem. ${s[2]}`, s[1]];
  const y = key.match(/^(20\d{2})$/);
  if(y) return [y[1]];
  return [String(item?.period || key)];
}
function compareModeLabel(mode){
  return {month:'Mes vs mes', quarter:'Trimestre vs trimestre', semester:'Semestre vs semestre', year:'Año vs año'}[mode] || 'Mes vs mes';
}
function recordsForCompareScope(){
  const site = $('compareSite') ? $('compareSite').value : '';
  return state.records.filter(r=>recordMatchesTerritory(r,territoryFilterValues('compare')) && (!site || siteKey(r.site,r.address) === site));
}
function aggregateByComparison(records, mode){
  const map = {};
  for(const r of records){
    const key = groupKeyForPeriod(r.period, mode);
    if(!key) continue;
    map[key] ||= {key, period:groupLabel(key, mode), energyKwh:0, waterM3:0, alcM3:0, gasM3:0, wasteTon:0, co2kg:0, records:0, metricCounts:{energyKwh:0,waterM3:0,alcM3:0,gasM3:0,wasteTon:0}};
    ['energyKwh','waterM3','alcM3','gasM3','wasteTon'].forEach(k=>{
      if(recordHasReading(r,k)){map[key][k]+=Number(r[k])||0;map[key].metricCounts[k]+=1;}
    });
    map[key].co2kg=map[key].energyKwh*FACTOR_CO2_KG_KWH;
    map[key].records += 1;
  }
  return Object.values(map).sort((a,b)=>a.key.localeCompare(b.key));
}
function renderCompareControls(opts={}){
  if(!$('compareA') || !$('compareB')) return;
  const currentSite = opts.keepSite && $('compareSite') ? $('compareSite').value : ($('compareSite') ? $('compareSite').value : '');
  if($('compareSite')){
    const siteOptions = aggregateBySite(territoryScopedRecords('compare')).map(x=>({site:x.site,displaySite:x.displaySite,address:x.address}));
    $('compareSite').innerHTML = '<option value="">Todas las sedes</option>' + siteOptions.map(s=>{
      const key = siteKey(s.site,s.address);
      const label = `${s.displaySite||s.site}${s.displaySite&&s.displaySite!==s.site?' · En factura: '+s.site:''}${s.address ? ' · '+s.address : ''}`;
      return `<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`;
    }).join('');
    if([...$('compareSite').options].some(o=>o.value===currentSite)) $('compareSite').value = currentSite;
    refreshSiteAutocompleteFields();
  }
  const mode = $('compareMode') ? $('compareMode').value : 'month';
  const currentA = $('compareA').value;
  const currentB = $('compareB').value;
  const groups = comparisonGroups(mode);
  const options = groups.map(g=>`<option value="${escapeHtml(g.key)}">${escapeHtml(g.period)}</option>`).join('');
  $('compareA').innerHTML = options;
  $('compareB').innerHTML = options;
  // v44: la comparación inicia siempre con la primera y la última fuente disponibles.
  if(groups.length){
    $('compareA').value = groups[0].key;
    $('compareB').value = groups[groups.length-1].key;
  }
}
function comparePeriods(){
  const mode = $('compareMode') ? $('compareMode').value : 'month';
  const site = $('compareSite') ? $('compareSite').value : '';
  const metric=selectedHistoryMetric();
  const a=$('compareA').value, b=$('compareB').value;
  const agg = comparisonGroups(mode);
  const A = agg.find(x=>x.key===a), B = agg.find(x=>x.key===b);
  if(!A||!B){
    $('compareResult').innerHTML='<p class="bad">Se requieren al menos dos periodos equivalentes para comparar con el filtro seleccionado.</p>';
    if($('compareNarrative')) $('compareNarrative').textContent = 'Aún no hay suficientes datos comparables para generar una interpretación automática.';
    drawChart(agg); updateHistorySourceNote(); return;
  }
  const siteText = site ? (($('compareSite').selectedOptions[0]||{}).textContent || 'Sede seleccionada') : 'Todas las sedes';
  const hasA=historyGroupHasMetric(A,metric.field), hasB=historyGroupHasMetric(B,metric.field);
  const summary = `<div class="compare-summary"><strong>${escapeHtml(compareModeLabel(mode))} · ${escapeHtml(metric.label)}</strong><span>${escapeHtml(siteText)}</span><small>${escapeHtml(A.period)} vs ${escapeHtml(B.period)}</small></div>`;
  if(!hasA || !hasB){
    $('compareResult').innerHTML=summary+`<div class="metric flat"><span>${escapeHtml(metric.label)}</span><strong>Comparación incompleta</strong><small>${!hasA?escapeHtml(A.period)+' sin lectura. ':''}${!hasB?escapeHtml(B.period)+' sin lectura.':''} Los datos ausentes no se interpretan como cero.</small></div>`;
    if($('compareNarrative')) $('compareNarrative').innerHTML=`<strong>Interpretación automática:</strong> No es metodológicamente correcto calcular una variación de ${escapeHtml(metric.label.toLowerCase())} porque al menos uno de los periodos no tiene una lectura identificada para el alcance seleccionado.`;
  }else{
    const diff=(Number(B[metric.field])||0)-(Number(A[metric.field])||0); const pct=(Number(A[metric.field])||0)? diff/Number(A[metric.field])*100 : null;
    const trendClass = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
    $('compareResult').innerHTML=summary+`<div class="metric ${trendClass}"><span>${escapeHtml(metric.label)}</span><strong>${diff>=0?'+':''}${fmt(diff)} ${metric.unit}</strong><small>${escapeHtml(A.period)}: ${fmt(A[metric.field])} ${metric.unit} · ${escapeHtml(B.period)}: ${fmt(B[metric.field])} ${metric.unit}${pct===null?'':` · ${pct>=0?'+':''}${fmt(pct)}%`}</small></div>${metric.field==='energyKwh'?`<div class="metric ${trendClass}"><span>Impacto en CO₂e</span><strong>${diff>=0?'+':''}${fmt(diff*FACTOR_CO2_KG_KWH/1000)} t</strong><small>Estimación asociada a la variación eléctrica.</small></div>`:''}`;
    if($('compareNarrative')) $('compareNarrative').innerHTML = buildComparisonNarrative(A, B, mode, siteText, metric.field);
  }
  drawChart(agg); updateHistorySourceNote();
}

function compactAxisValue(value){
  const n=Number(value)||0;
  if(Math.abs(n)>=1000000) return `${fmt(n/1000000)} M`;
  if(Math.abs(n)>=1000) return `${fmt(n/1000)} mil`;
  return fmt(n);
}
function renderHistoryDataTable(data){
  const box=$('historyDataTable');if(!box) return;
  if(!data.length){box.innerHTML='';return;}
  const metric=selectedHistoryMetric();
  box.innerHTML=`<details><summary>Ver valores exactos de la gráfica (${data.length} periodos)</summary><div class="history-table-scroll"><table><thead><tr><th>Periodo</th><th>${escapeHtml(metric.label)} (${metric.unit})</th><th>Fuente</th></tr></thead><tbody>${data.map(item=>`<tr><td>${escapeHtml(item.period||groupLabel(item.key,'month'))}</td><td><strong>${historyGroupHasMetric(item,metric.field)?fmt(item[metric.field]):'Sin dato'}</strong></td><td>${item.official?'Resumen oficial de factura':'Detalle consolidado de sedes'}</td></tr>`).join('')}</tbody></table></div></details>`;
}
function drawChart(data){
  chartData=Array.isArray(data)?data:[];
  const metric=selectedHistoryMetric();
  const c=$('chart');if(!c) return;
  const ctx=c.getContext('2d');if(!ctx) return;
  const cleanData=chartData.filter(item=>historyGroupHasMetric(item,metric.field));
  const canvasWidth=Math.max(1100,Math.max(cleanData.length,1)*98+180),canvasHeight=470;
  c.width=canvasWidth;c.height=canvasHeight;c.style.width=`${canvasWidth}px`;c.style.maxWidth='none';c.style.height=`${canvasHeight}px`;
  ctx.clearRect(0,0,canvasWidth,canvasHeight);
  ctx.fillStyle='#13312d';ctx.textAlign='left';ctx.font='bold 22px Arial';
  ctx.fillText(`Comparativo de ${metric.label.toLowerCase()} por periodo (${metric.unit})`,28,38);
  if(!cleanData.length){ctx.font='14px Arial';ctx.fillText(`Sin lecturas de ${metric.label.toLowerCase()} para el alcance seleccionado`,28,82);renderHistoryDataTable([]);return;}
  const top=76,left=92,right=34,bottom=88,w=canvasWidth-left-right,h=canvasHeight-top-bottom,baseY=top+h;
  const max=Math.max(...cleanData.map(d=>Number(d[metric.field])||0),1);
  const magnitude=Math.pow(10,Math.max(0,Math.floor(Math.log10(max))-1));
  const axisMax=Math.ceil(max/magnitude)*magnitude||max;
  ctx.font='12px Arial';ctx.textAlign='right';ctx.fillStyle='#5a726c';ctx.strokeStyle='#e3efeb';ctx.lineWidth=1;
  for(let step=0;step<=5;step++){
    const value=axisMax*(5-step)/5,y=top+h*step/5;
    ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(left+w,y);ctx.stroke(); ctx.fillText(compactAxisValue(value),left-10,y+4);
  }
  ctx.strokeStyle='#bfd7d0';ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(left,baseY);ctx.lineTo(left+w,baseY);ctx.stroke();
  const gap=w/cleanData.length,bw=Math.max(34,Math.min(58,gap*.56));
  cleanData.forEach((d,i)=>{
    const value=Number(d[metric.field])||0,x=left+i*gap+gap/2-bw/2;
    const rawHeight=(value/axisMax)*h,bh=value>0?Math.max(3,rawHeight):0,y=baseY-bh;
    const grad=ctx.createLinearGradient(0,y,0,baseY);grad.addColorStop(0,'#16d2a6');grad.addColorStop(1,'#0b9878');ctx.fillStyle=grad;
    if(bh>0){roundRect(ctx,x,y,bw,bh,Math.min(11,bh/2));ctx.fill();}
    ctx.fillStyle='#13312d';ctx.textAlign='center';ctx.font='bold 12px Arial';
    const labelRow=i%2,labelY=Math.max(top+14+labelRow*18,y-9-labelRow*2); ctx.fillText(fmt(value),x+bw/2,labelY);
    ctx.font='12px Arial';let textY=baseY+23; chartLabelLines(d).forEach(line=>{ctx.fillText(line,x+bw/2,textY);textY+=15;});
  });
  ctx.textAlign='left'; c.setAttribute('aria-label',`Comparativo de ${metric.label}: ${cleanData.map(d=>`${d.period||d.key}, ${fmt(d[metric.field])} ${metric.unit}`).join('; ')}`);
  renderHistoryDataTable(cleanData);
}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

function reportHeader(title, subtitle=''){
  const now=new Date().toLocaleString('es-CO',{dateStyle:'long',timeStyle:'short'});
  return `<header class="pdf-report-header"><div><span>SiMeCO₂ · Huella de Carbono Educativa de Medellín</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div><div class="pdf-report-badge">Informe ambiental<br><strong>${escapeHtml(now)}</strong></div></header>`;
}
function openPdfPrintDocument(title, subtitle, content){
  const w=window.open('', '_blank');
  if(!w){ alert('Permite las ventanas emergentes para generar el informe PDF.'); return; }
  const css=`
    @page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;color:#173f37;font-family:Arial,Helvetica,sans-serif;background:#fff;font-size:10.5pt;line-height:1.45}
    .pdf-report{max-width:190mm;margin:auto}.pdf-report-header{display:flex;justify-content:space-between;gap:20px;padding:20px 22px;margin-bottom:18px;border-radius:18px;background:linear-gradient(135deg,#075846,#0b9878);color:#fff}
    .pdf-report-header span{font-size:9pt;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.pdf-report-header h1{margin:5px 0 4px;font-size:24pt}.pdf-report-header p{margin:0;color:#d8fff4}.pdf-report-badge{min-width:150px;padding:12px;border:1px solid rgba(255,255,255,.35);border-radius:13px;text-align:right;font-size:8.5pt}
    .report-card{padding:15px 17px;margin:0 0 14px;border:1px solid #cfe4de;border-radius:14px;background:#f8fffc}.report-card h2{margin:0 0 8px;color:#08745c;font-size:15pt}.report-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0}.metric{padding:11px;border-radius:11px;background:#e9f8f3}.metric span{display:block;font-size:8.5pt;color:#4a6d65}.metric strong{font-size:14pt;color:#075846}
    table{width:100%;border-collapse:collapse;margin:10px 0 18px;font-size:8pt}th{background:#0b7d64;color:#fff;text-align:left;padding:7px 6px}td{padding:6px;border-bottom:1px solid #d7e8e3;vertical-align:top}tbody tr:nth-child(even){background:#f2faf7}
    .filters-line{padding:10px 13px;margin-bottom:14px;border-left:5px solid #f2b705;background:#fff8db;border-radius:8px}.footer-note{margin-top:20px;padding-top:10px;border-top:1px solid #cfe4de;color:#607b75;font-size:8pt}
    .plan-document{box-shadow:none!important;border:0!important;padding:0!important}.plan-document h2,.plan-document h3{color:#08745c}.plan-table{font-size:8pt}
    @media print{button{display:none!important}.pdf-report-header{-webkit-print-color-adjust:exact;print-color-adjust:exact}th,.metric,.filters-line{ -webkit-print-color-adjust:exact;print-color-adjust:exact}}
  `;
  const safeTitle = escapeHtml(title);
  w.document.open();
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle} - SiMeCO₂</title><style>${css}
    .pdf-toolbar{position:sticky;top:0;z-index:50;display:flex;justify-content:center;gap:10px;padding:12px;background:#eef8f5;border-bottom:1px solid #cfe4de}.pdf-toolbar button{border:0;border-radius:999px;padding:12px 20px;font-weight:900;cursor:pointer}.pdf-toolbar .save{background:#0b9878;color:#fff}.pdf-toolbar .close{background:#fff;color:#173f37;border:1px solid #cfe4de}@media print{.pdf-toolbar{display:none!important}}
  </style></head><body><div class="pdf-toolbar"><button class="save" onclick="window.print()">Guardar como PDF</button><button class="close" onclick="window.close()">Cerrar informe</button></div><main class="pdf-report">${reportHeader(title,subtitle)}${content}<p class="footer-note">Documento generado por SiMeCO₂. Presiona “Guardar como PDF” y selecciona esa opción en el cuadro de impresión.</p></main></body></html>`);
  w.document.close();
  try{ w.focus(); }catch(_err){}
}
function activeTerritoryText(prefix){
  const f=territoryFilterValues(prefix); const values=[];
  if(f.type) values.push(`Ámbito: ${f.type}`); if(f.territory) values.push(`Territorio: ${f.territory}`); if(f.nucleus) values.push(`Núcleo: ${f.nucleus}`);
  return values.length?values.join(' · '):'Todo Medellín';
}
function downloadFilteredPdfReport(){
  const recs=filteredRecords();
  if(!recs.length){alert('No hay registros para generar el informe PDF.');return;}
  const energy=recs.reduce((a,r)=>a+(Number(r.energyKwh)||0),0), co2=recs.reduce((a,r)=>a+(Number(r.co2kg)||0),0), water=recs.reduce((a,r)=>a+(Number(r.waterM3)||0),0);
  const rows=recs.map(r=>`<tr><td>${escapeHtml(r.period||'')}</td><td>${escapeHtml(r.site||'')}</td><td>${mapAddressLink(r.address,r.address||'Sin dirección',preferredSiteName(r)||r.site)}</td><td>${fmt(r.energyKwh)} kWh</td><td>${fmt(r.waterM3)} m³</td><td>${fmt(r.co2kg)} kg</td><td>${escapeHtml(r.source||'PDF')}</td></tr>`).join('');
  const filters=[activeTerritoryText('table'),$('periodFilter')?.value&&`Periodo: ${$('periodFilter').value}`,$('serviceFilter')?.value&&`Servicio: ${$('serviceFilter').value}`,$('siteSearch')?.value&&`Sede: ${$('siteSearch').value}`].filter(Boolean).join(' · ');
  openPdfPrintDocument('Informe de facturas por institución educativa',filters,`<div class="report-grid"><div class="metric"><span>Registros</span><strong>${recs.length}</strong></div><div class="metric"><span>Energía acumulada</span><strong>${fmt(energy)} kWh</strong></div><div class="metric"><span>Emisiones</span><strong>${fmt(co2/1000)} t CO₂e</strong></div></div><div class="report-card"><h2>Resumen de la consulta</h2><p>Agua acumulada: <strong>${fmt(water)} m³</strong></p></div><table><thead><tr><th>Periodo</th><th>Institución / sede</th><th>Dirección</th><th>Energía</th><th>Agua</th><th>CO₂e</th><th>Fuente</th></tr></thead><tbody>${rows}</tbody></table>`);
}
function downloadHistoryPdfReport(){
  const mode=$('compareMode')?.value||'month'; const metric=selectedHistoryMetric();
  const groups=comparisonGroups(mode).filter(g=>historyGroupHasMetric(g,metric.field));
  if(!groups.length){alert(`No hay datos históricos de ${metric.label.toLowerCase()} para generar el informe PDF.`);return;}
  const first=groups[0], last=groups[groups.length-1];
  if($('compareA')) $('compareA').value=first.key; if($('compareB')) $('compareB').value=last.key; comparePeriods();
  const rows=[first,last].map(r=>`<tr><td>${escapeHtml(r.period)}</td><td>${isGlobalCompareScope()&&r.official?'Total Medellín · Resumen oficial PDF':'Alcance seleccionado'}</td><td>${fmt(r[metric.field])} ${metric.unit}</td></tr>`).join('');
  const narrative=$('compareNarrative')?.textContent||`Comparación entre ${first.period} y ${last.period}.`;
  const sourceText=isGlobalCompareScope()&&metric.field!=='wasteTon'?'Fuente: resumen consolidado oficial de la primera página de cada factura PDF.':'Fuente: registros detallados de las sedes incluidas en el filtro.';
  const diff=Number(last[metric.field])-Number(first[metric.field]);
  openPdfPrintDocument(`Informe histórico · ${metric.label}`,`${first.period} vs ${last.period}`,`<div class="filters-line">${escapeHtml(sourceText)}</div><div class="report-card"><h2>Comparación seleccionada</h2><p>${escapeHtml(narrative)}</p></div><div class="report-grid"><div class="metric"><span>Periodo inicial</span><strong>${escapeHtml(first.period)}</strong></div><div class="metric"><span>Periodo final</span><strong>${escapeHtml(last.period)}</strong></div><div class="metric"><span>Variación de ${escapeHtml(metric.short.toLowerCase())}</span><strong>${diff>=0?'+':''}${fmt(diff)} ${metric.unit}</strong></div></div><table><thead><tr><th>Periodo</th><th>Alcance</th><th>${escapeHtml(metric.label)}</th></tr></thead><tbody>${rows}</tbody></table>`);
}

function downloadDashboardPdfReport(){
  const recs=dashboardRecords();
  if(!recs.length){alert('No hay información para generar el informe PDF.');return;}
  const agg=aggregateBySite(recs);
  const rows=agg.map((x,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(x.displaySite||x.site)}</td><td>${mapAddressLink(x.address,x.address||'Sin dirección',x.displaySite||x.site)}</td><td>${x.periodCount}</td><td>${x.hasEnergy?`${fmt(x.energyKwh)} kWh`:'No identificada'}</td><td>${x.hasEnergy?`${fmt(x.co2kg/1000)} t`:'No calculable'}</td><td>${x.hasEnergy?fmt(x.trees):'No calculable'}</td><td>${escapeHtml(qualityStatusForSite(x).label)}</td></tr>`).join('');
  const energyRows=agg.filter(x=>x.hasEnergy),energy=energyRows.reduce((a,x)=>a+x.energyKwh,0),co2=energyRows.reduce((a,x)=>a+x.co2kg,0),pending=agg.filter(x=>!x.hasEnergy).length;
  openPdfPrintDocument('Informe ambiental por sede',activeTerritoryText('dashboard'),`<div class="report-grid"><div class="metric"><span>Sedes</span><strong>${agg.length}</strong></div><div class="metric"><span>Energía identificada</span><strong>${fmt(energy)} kWh</strong></div><div class="metric"><span>Sedes con energía no identificada</span><strong>${pending}</strong></div></div><table><thead><tr><th>#</th><th>Sede</th><th>Dirección</th><th>Periodos</th><th>Energía</th><th>CO₂e</th><th>Árboles</th><th>Calidad</th></tr></thead><tbody>${rows}</tbody></table>`);
}

function exportCsv(){
  const recs=filteredRecords();
  const headers=['periodo','sede','direccion','agua_m3','alcantarillado_m3','energia_kwh','gas_m3','aseo_valor','residuos_t','co2_kg','fuente'];
  const rows=recs.map(r=>[r.period,r.site,r.address,r.waterM3,r.alcM3,r.energyKwh,r.gasM3,r.wasteValue,r.wasteTon,r.co2kg,r.source]);
  downloadBlob([headers,...rows].map(row=>row.map(csvCell).join(',')).join('\n'),'simeco2_servicios.csv','text/csv;charset=utf-8');
}
function exportJson(){ downloadBlob(JSON.stringify(state,null,2),'simeco2_servicios.json','application/json'); }
function downloadBlob(content,name,type){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
function csvCell(v){ const s=(v??'').toString(); return '"'+s.replace(/"/g,'""')+'"'; }

function getGlobalStats(){
  const recs=state.records||[];
  const periodSeries=officialSummaries().length ? aggregateSummariesByComparison('month') : aggregateByPeriod(recs);
  const periods=periodSeries.map(r=>r.key||r.period).filter(Boolean).sort();
  const sites=aggregateBySite(recs.filter(r=>Number(r.energyKwh)>0));
  const detailSum=(field)=>recs.reduce((a,r)=>a+(Number(r[field])||0),0);
  const energy=periodSeries.reduce((a,r)=>a+(Number(r.energyKwh)||0),0);
  const water=periodSeries.reduce((a,r)=>a+(Number(r.waterM3)||0),0);
  const co2kg=energy*FACTOR_CO2_KG_KWH;
  const waste=detailSum('wasteTon');
  const trees=Math.ceil(co2kg/TREE_CO2_KG_YEAR);
  const topSite=sites[0]||null;
  return {recs,periods,periodSeries,sites,energy,co2kg,water,waste,trees,topSite};
}

function renderExecutiveSummary(){
  if(!$('executiveText')) return;
  const s = getGlobalStats();
  if(!s.recs.length){
    $('executiveText').textContent = 'SiMeCO₂ convierte información de servicios públicos en indicadores comprensibles para la gestión ambiental escolar. Actualiza el sistema para generar diagnóstico, priorización e informes institucionales.';
    return;
  }
  const periodText = s.periods.length ? `${groupLabel(s.periods[0], 'month')} a ${groupLabel(s.periods[s.periods.length-1], 'month')}` : 'periodo no definido';
  const topText = s.topSite ? ` La sede con mayor consumo acumulado es ${s.topSite.site}, con ${fmt(s.topSite.energyKwh)} kWh.` : '';
  $('executiveText').innerHTML = `Durante el periodo <strong>${escapeHtml(periodText)}</strong>, el sistema registra <strong>${fmt(s.energy)} kWh</strong> de energía eléctrica, equivalentes a <strong>${fmt(s.co2kg/1000)} toneladas de CO₂e</strong>. Para compensar pedagógicamente estas emisiones se requerirían aproximadamente <strong>${fmt(s.trees)} árboles/año</strong>.${escapeHtml(topText)}`;
}

function renderProjectImpact(){
  if(!$('impactGrid') || !$('smartAlerts')) return;
  const s = getGlobalStats();
  const high = s.sites.filter(x=>classifyEnergyIntensity(x.avgKwhMonth).cls==='high').length;
  const medium = s.sites.filter(x=>classifyEnergyIntensity(x.avgKwhMonth).cls==='medium').length;
  const low = s.sites.filter(x=>classifyEnergyIntensity(x.avgKwhMonth).cls==='low').length;
  $('impactGrid').innerHTML = `
    <article><span>Sedes priorizadas</span><strong>${fmt(high)}</strong><small>Alta prioridad energética</small></article>
    <article><span>Seguimiento medio</span><strong>${fmt(medium)}</strong><small>Requieren hábitos y control operativo</small></article>
    <article><span>Prevención</span><strong>${fmt(low)}</strong><small>Monitoreo y educación ambiental</small></article>
    <article><span>Planes potenciales</span><strong>${fmt(s.sites.length)}</strong><small>Informes de gestión generables</small></article>`;
  const alerts = buildSmartAlerts(s);
  $('smartAlerts').innerHTML = alerts.length ? alerts.join('') : `<div class="alert-card neutral"><strong>Sin alertas críticas.</strong><p>Cuando existan datos comparables, el sistema mostrará aumentos, reducciones y sedes prioritarias.</p></div>`;
}

function buildSmartAlerts(s){
  const alerts = [];
  if(!s.recs.length) return alerts;
  if(s.topSite){
    const p = classifyEnergyIntensity(s.topSite.avgKwhMonth);
    alerts.push(`<div class="alert-card ${p.cls}"><strong>Sede con mayor prioridad</strong><p>${escapeHtml(s.topSite.site)} concentra ${fmt(s.topSite.energyKwh)} kWh acumulados. Clasificación: ${escapeHtml(p.level)}.</p></div>`);
  }
  const byPeriod=s.periodSeries||aggregateByPeriod(s.recs);
  if(byPeriod.length >= 2){
    const a = byPeriod[byPeriod.length-2], b = byPeriod[byPeriod.length-1];
    const diff = b.energyKwh - a.energyKwh;
    const pct = a.energyKwh ? diff/a.energyKwh*100 : 0;
    if(diff > 0) alerts.push(`<div class="alert-card high"><strong>Aumento reciente de consumo</strong><p>Entre ${escapeHtml(a.period)} y ${escapeHtml(b.period)} la energía aumentó ${fmt(diff)} kWh (${fmt(pct)}%). Se recomienda revisar horarios, iluminación y equipos de alto consumo.</p></div>`);
    if(diff < 0) alerts.push(`<div class="alert-card low"><strong>Reducción reciente</strong><p>Entre ${escapeHtml(a.period)} y ${escapeHtml(b.period)} la energía disminuyó ${fmt(Math.abs(diff))} kWh (${fmt(Math.abs(pct))}%). Conviene documentar las buenas prácticas y replicarlas.</p></div>`);
  }
  const highSites = s.sites.filter(x=>classifyEnergyIntensity(x.avgKwhMonth).cls==='high');
  if(highSites.length) alerts.push(`<div class="alert-card medium"><strong>Ruta de intervención sugerida</strong><p>Iniciar diagnóstico técnico en ${fmt(highSites.length)} sede(s) de alta prioridad, validar iluminación LED, sensores, hábitos de apagado y prefactibilidad solar.</p></div>`);
  return alerts.slice(0,4);
}

function buildComparisonNarrative(A, B, mode, siteText, metricField='energyKwh'){
  const metric=serviceMetric(metricField);
  const av=Number(A?.[metric.field])||0, bv=Number(B?.[metric.field])||0;
  const diff=bv-av, pct=av?diff/av*100:null;
  const scope=escapeHtml(siteText||'Todas las sedes');
  const direction=diff>0?'aumentó':diff<0?'disminuyó':'se mantuvo estable';
  const amount=fmt(Math.abs(diff));
  const pctText=pct===null?'':` (${fmt(Math.abs(pct))}%)`;
  if(metric.field==='energyKwh'){
    const co2Diff=Math.abs(diff)*FACTOR_CO2_KG_KWH/1000;
    if(diff>0) return `<strong>Interpretación automática:</strong> En ${scope}, la energía ${direction} <strong>${amount} kWh</strong>${pctText}. El cambio equivale aproximadamente a <strong>${fmt(co2Diff)} t CO₂e adicionales</strong>. Se recomienda revisar jornadas, iluminación, climatización y equipos de mayor demanda.`;
    if(diff<0) return `<strong>Interpretación automática:</strong> En ${scope}, la energía ${direction} <strong>${amount} kWh</strong>${pctText}. La reducción evita aproximadamente <strong>${fmt(co2Diff)} t CO₂e</strong>. Conviene documentar las prácticas que explican la disminución.`;
    return `<strong>Interpretación automática:</strong> En ${scope}, la energía se mantuvo estable. Se recomienda sostener el monitoreo mensual y definir una meta gradual de eficiencia.`;
  }
  const advice={waterM3:'revisar fugas, sanitarios, puntos de lavado, riego y hábitos de uso eficiente del agua',alcM3:'contrastar el comportamiento con el consumo de agua y revisar cambios operativos o posibles inconsistencias de lectura',gasM3:'revisar cocinas, laboratorios, calentadores, horarios de operación y posibles fugas',wasteTon:'revisar separación en la fuente, aprovechamiento, frecuencia de recolección y generación de residuos'}[metric.field]||'revisar las causas del cambio y documentar acciones de mejora';
  return `<strong>Interpretación automática:</strong> En ${scope}, ${escapeHtml(metric.label.toLowerCase())} ${direction}${diff===0?'':` en <strong>${amount} ${metric.unit}</strong>${pctText}`}. Se recomienda ${advice}.`;
}

function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function googleMapsAddressUrl(address,schoolName=''){
  const raw=String(address||'').replace(/^\s*\d+\s+sedes:\s*/i,'').trim();
  const school=String(schoolName||'').replace(/\s+/g,' ').trim();
  if(!raw || /sin direcci[oó]n/i.test(raw)) return '';
  const query=[school,raw,'Medellín','Antioquia','Colombia'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
function mapAddressLink(address,label,schoolName=''){
  const raw=String(address||'').trim(), text=String(label||raw||'Sin dirección registrada'), school=String(schoolName||'').trim();
  const url=googleMapsAddressUrl(raw,school);
  if(!url) return `<span class="map-address map-address-unavailable">${escapeHtml(text)}</span>`;
  const title=school?`Abrir la ubicación de ${school} en Google Maps`:'Abrir esta dirección en Google Maps';
  return `<a class="map-address school-map-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">🏫 ${escapeHtml(text)}</a>`;
}
function openAddressInGoogleMaps(address,schoolName=''){
  const url=googleMapsAddressUrl(address,schoolName);
  if(url) window.open(url,'_blank','noopener,noreferrer');
}
function mapAddressAction(address,innerHtml,schoolName=''){
  const raw=String(address||'').trim(), school=String(schoolName||'').trim();
  if(!googleMapsAddressUrl(raw,school)) return innerHtml;
  return `<span class="map-address-action school-map-action" data-map-address="${escapeHtml(raw)}" data-map-school="${escapeHtml(school)}" title="Abrir ubicación precisa del colegio en Google Maps">🏫 ${innerHtml}</span>`;
}
function fmt(n){ return new Intl.NumberFormat('es-CO',{maximumFractionDigits:2}).format(Number(n)||0); }
function num(n){ return n==null||n==='' ? '—' : fmt(n); }
function money(n){ return n==null||n==='' ? '—' : '$ '+fmt(n); }

/* Calidad de datos - v58 */
function qualityStatusForSite(row){
  const meta=territoryMeta({site:row.site,address:row.address});
  const territorialOk=meta.type!=='Sin clasificar' && meta.territory!=='Sin clasificar';
  if(!row.periodCount) return {code:'review',label:'En revisión',detail:'No hay periodos válidos asociados.'};
  if(!row.hasEnergy){
    const energyState=energyDataState(row);
    if(energyState.code==='external') return {code:'external',label:'Energía en contrato separado',detail:energyState.detail};
    return {code:'pending',label:'Energía no identificada',detail:energyState.detail};
  }
  if(row.energyPeriodCount<row.periodCount || !territorialOk){
    const issues=[];
    if(row.energyPeriodCount<row.periodCount) issues.push(`energía en ${row.energyPeriodCount}/${row.periodCount} periodos`);
    if(!territorialOk) issues.push('clasificación territorial pendiente');
    return {code:'partial',label:'Datos parciales',detail:issues.join(' · ')};
  }
  return {code:'complete',label:'Datos completos',detail:`Energía identificada en ${row.energyPeriodCount}/${row.periodCount} periodos y sede territorialmente vinculada.`};
}
function qualityCoverageText(row,periodField,hasFlag){ return row[hasFlag]?`${row[periodField]}/${row.periodCount}`:'Sin dato'; }
function renderDataQuality(){
  const body=$('qualityBody'); if(!body) return;
  const rows=aggregateBySite(state.records||[]);
  const total=rows.length, energy=rows.filter(r=>r.hasEnergy).length;
  const external=rows.filter(r=>!r.hasEnergy && energyDataState(r).code==='external').length;
  const pending=rows.filter(r=>!r.hasEnergy && energyDataState(r).code!=='external').length;
  const territorial=rows.filter(r=>{const m=territoryMeta({site:r.site,address:r.address});return m.type!=='Sin clasificar'&&m.territory!=='Sin clasificar';}).length;
  const pct=(n,d)=>d?100*n/d:0;
  if($('qualityEnergyCoverage')) $('qualityEnergyCoverage').textContent=`${fmt(pct(energy,total))}%`;
  if($('qualityEnergyCoverageDetail')) $('qualityEnergyCoverageDetail').textContent=`${energy} de ${total} sedes`;
  if($('qualityEnergySites')) $('qualityEnergySites').textContent=fmt(energy);
  if($('qualityPendingSites')) $('qualityPendingSites').textContent=fmt(pending);
  if($('qualityExternalSites')) $('qualityExternalSites').textContent=fmt(external);
  if($('qualityTerritoryCoverage')) $('qualityTerritoryCoverage').textContent=`${fmt(pct(territorial,total))}%`;
  if($('qualityTerritoryCoverageDetail')) $('qualityTerritoryCoverageDetail').textContent=`${territorial} de ${total} sedes clasificadas`;
  const statusCounts={complete:0,partial:0,pending:0,external:0,review:0}; rows.forEach(r=>statusCounts[qualityStatusForSite(r).code]++);
  if($('qualitySummary')) $('qualitySummary').innerHTML=`<strong>${total} sedes evaluadas.</strong> ${statusCounts.complete} completas · ${statusCounts.partial} parciales · ${statusCounts.external} con energía en contrato separado · ${statusCounts.pending} con energía no identificada · ${statusCounts.review} en revisión. <span>Los estados describen cobertura y procedencia del dato, no desempeño ambiental.</span>`;
  renderServiceExceptions();
  const prioritized=[...rows].sort((a,b)=>{
    const order={pending:0,external:1,review:2,partial:3,complete:4}; const qa=qualityStatusForSite(a),qb=qualityStatusForSite(b);
    return order[qa.code]-order[qb.code] || String(a.displaySite||a.site).localeCompare(String(b.displaySite||b.site),'es');
  }).slice(0,60);
  body.innerHTML=prioritized.map(r=>{
    const q=qualityStatusForSite(r), meta=territoryMeta({site:r.site,address:r.address}), energyState=energyDataState(r);
    const energyCoverage=r.hasEnergy?qualityCoverageText(r,'energyPeriodCount','hasEnergy'):(energyState.code==='external'?'<span class="quality-badge external">Contrato separado</span>':'Sin dato');
    return `<tr><td><strong>${escapeHtml(r.displaySite||r.site)}</strong>${r.displaySite!==r.site?`<small class="invoice-alias">En factura: ${escapeHtml(r.site)}</small>`:''}</td><td>${mapAddressLink(r.address,r.address||'Sin dirección',preferredSiteName(r)||r.site)}</td><td><span class="quality-badge ${q.code}" title="${escapeHtml(q.detail)}">${escapeHtml(q.label)}</span><small class="quality-detail">${escapeHtml(q.detail)}</small></td><td>${energyCoverage}</td><td>${qualityCoverageText(r,'waterPeriodCount','hasWater')}</td><td>${qualityCoverageText(r,'alcPeriodCount','hasAlc')}</td><td>${qualityCoverageText(r,'gasPeriodCount','hasGas')}</td><td>${qualityCoverageText(r,'wastePeriodCount','hasWaste')}</td><td>${meta.territory!=='Sin clasificar'?`${escapeHtml(meta.territory)}${meta.nucleus&&meta.nucleus!=='Sin clasificar'?` · N. ${escapeHtml(meta.nucleus)}`:''}`:'<span class="not-available">Pendiente</span>'}</td><td><button type="button" class="secondary quality-open-site" data-quality-site-key="${escapeHtml(r.key)}">Ver ficha</button></td></tr>`;
  }).join('') || '<tr><td colspan="10">No hay registros para evaluar.</td></tr>';
}
function handleQualityActionClick(e){
  const btn=e.target.closest('[data-quality-site-key]'); if(!btn) return;
  const key=btn.dataset.qualitySiteKey; const row=aggregateBySite(state.records||[]).find(r=>r.key===key); if(!row) return;
  dashboardSiteKey=key;
  const field=siteAutocompleteState.get('dashboardSiteSearch'); if(field){field.input.value=row.displaySite||row.site;field.clear.classList.add('visible');}
  if($('generateSelectedReportBtn')) $('generateSelectedReportBtn').disabled=false;
  if(window.simecoOpenSection) window.simecoOpenSection('seccion-3',{scroll:false});
  renderDashboard(); requestAnimationFrame(()=>$('siteProfile')?.scrollIntoView({behavior:'smooth',block:'center'}));
}

/* Dashboard ambiental por sede - v9: conserva sedes aunque falte energía */
function dashboardRecords(){
  const q = $('dashboardSiteSearch') ? $('dashboardSiteSearch').value||'' : '';
  const tokens=searchTokens(q),territory=territoryFilterValues('dashboard');
  const source=dashboardSiteKey ? (recordsBySiteKey().get(dashboardSiteKey)||[]) : state.records;
  return source.filter(r=>{
    if(!recordMatchesTerritory(r,territory)) return false;
    if(dashboardSiteKey) return true;
    if(!tokens.length) return true;
    const haystack=siteSearchHaystack(r);
    return tokens.every(token=>haystack.includes(token));
  });
}
function recordHasReading(record,field){
  if(!record) return false;
  const raw=record[field];
  return raw!==null && raw!==undefined && raw!=='' && Number.isFinite(Number(raw));
}
function recordHasEnergyReading(record){ return recordHasReading(record,'energyKwh'); }
function aggregateBySite(records){
  const map = {};
  for(const r of records){
    const key = siteKey(r.site, r.address);
    if(!map[key]) map[key] = {
      key, site:r.site||'Sin nombre', displaySite:preferredSiteName(r), address:r.address||'', periods:new Set(), energyPeriods:new Set(), waterPeriods:new Set(), alcPeriods:new Set(), gasPeriods:new Set(), wastePeriods:new Set(),
      energyKwh:0, waterM3:0, alcM3:0, gasM3:0, wasteTon:0, wasteValue:0, co2kg:0, count:0, energyRecordCount:0, waterRecordCount:0, alcRecordCount:0, gasRecordCount:0, wasteRecordCount:0
    };
    const item=map[key];
    if(r.period) item.periods.add(r.period);
    if(recordHasReading(r,'energyKwh')){
      item.energyPeriods.add(r.period||`registro-${item.count}`);
      item.energyKwh += Number(r.energyKwh)||0;
      item.co2kg += (Number(r.energyKwh)||0)*FACTOR_CO2_KG_KWH;
      item.energyRecordCount += 1;
    }
    if(recordHasReading(r,'waterM3')){item.waterPeriods.add(r.period||`registro-${item.count}`);item.waterM3+=Number(r.waterM3)||0;item.waterRecordCount+=1;}
    if(recordHasReading(r,'alcM3')){item.alcPeriods.add(r.period||`registro-${item.count}`);item.alcM3+=Number(r.alcM3)||0;item.alcRecordCount+=1;}
    if(recordHasReading(r,'gasM3')){item.gasPeriods.add(r.period||`registro-${item.count}`);item.gasM3+=Number(r.gasM3)||0;item.gasRecordCount+=1;}
    if(recordHasReading(r,'wasteTon') || recordHasReading(r,'wasteValue')){item.wastePeriods.add(r.period||`registro-${item.count}`);item.wasteTon+=Number(r.wasteTon)||0;item.wasteValue+=Number(r.wasteValue)||0;item.wasteRecordCount+=1;}
    item.count += 1;
  }
  return Object.values(map).map(x=>{
    const periodCount=x.periods.size;
    const energyPeriodCount=x.energyPeriods.size;
    return {
      ...x,
      periodCount, energyPeriodCount,
      waterPeriodCount:x.waterPeriods.size, alcPeriodCount:x.alcPeriods.size, gasPeriodCount:x.gasPeriods.size, wastePeriodCount:x.wastePeriods.size,
      missingEnergyPeriodCount:Math.max(0,periodCount-energyPeriodCount),
      hasEnergy:x.energyRecordCount>0, hasWater:x.waterRecordCount>0, hasAlc:x.alcRecordCount>0, hasGas:x.gasRecordCount>0, hasWaste:x.wasteRecordCount>0,
      trees:x.energyRecordCount>0 ? Math.ceil((x.co2kg||0)/TREE_CO2_KG_YEAR) : null,
      avgKwhMonth:energyPeriodCount ? x.energyKwh/energyPeriodCount : null
    };
  }).sort((a,b)=>Number(b.hasEnergy)-Number(a.hasEnergy) || b.energyKwh-a.energyKwh || String(a.displaySite||a.site).localeCompare(String(b.displaySite||b.site),'es'));
}
function dashboardValue(row,field,unit=''){
  const hasFlag={energyKwh:'hasEnergy',waterM3:'hasWater',alcM3:'hasAlc',gasM3:'hasGas',wasteTon:'hasWaste'}[field];
  if(hasFlag && !row[hasFlag]) return '<span class="not-available">Sin dato</span>';
  return `${fmt(row[field])}${unit?` ${unit}`:''}`;
}
function updateDashboardNotice(rows){
  const notice=$('dashboardDataNotice');
  if(!notice) return;
  if(!rows.length){ notice.hidden=true; notice.innerHTML=''; return; }
  if(dashboardSiteKey && rows.length===1){
    const r=rows[0], available=[], energyState=energyDataState(r);
    if(r.hasWater) available.push(`agua en ${r.waterPeriodCount} periodo(s)`);
    if(r.hasAlc) available.push(`alcantarillado en ${r.alcPeriodCount} periodo(s)`);
    if(r.hasGas) available.push(`gas en ${r.gasPeriodCount} periodo(s)`);
    if(r.hasWaste) available.push(`aseo/residuos en ${r.wastePeriodCount} periodo(s)`);
    if(!r.hasEnergy){
      notice.hidden=false;
      notice.className=`dashboard-data-notice ${energyState.code==='external'?'external':'warning'}`;
      if(energyState.code==='external'){
        notice.innerHTML=`<strong>La sede sí fue encontrada.</strong> Hay ${fmt(r.periodCount,0)} periodo(s) en el consolidado${available.length?` con ${escapeHtml(available.join(', '))}`:''}. <strong>La energía se gestiona mediante un contrato separado de usuario no regulado</strong>, por lo que los kWh no deben inferirse desde estas facturas. CO₂e, árboles y ranking energético quedan pendientes hasta integrar esa fuente. ${exceptionEvidenceHtml(energyState.exception)}`;
      }else{
        notice.innerHTML=`<strong>La sede sí fue encontrada.</strong> Hay ${fmt(r.periodCount,0)} periodo(s) en las facturas${available.length?` con ${escapeHtml(available.join(', '))}`:''}. <strong>La energía no está identificada en las facturas consolidadas para este nombre/dirección</strong>; por eso CO₂e, árboles y promedio eléctrico se muestran como “No calculable” y nunca como cero.`;
      }
      return;
    }
    notice.hidden=false;
    notice.className='dashboard-data-notice ok';
    notice.innerHTML=`<strong>Consulta encontrada:</strong> ${escapeHtml(r.displaySite||r.site)} tiene ${fmt(r.periodCount,0)} periodo(s) registrados y ${fmt(r.energyPeriodCount,0)} con lectura de energía eléctrica.`;
    return;
  }
  notice.hidden=true; notice.innerHTML='';
}
function renderSiteProfile(rows){
  const box=$('siteProfile'); if(!box) return;
  if(!dashboardSiteKey || rows.length!==1){box.hidden=true;box.innerHTML='';return;}
  const r=rows[0], recs=recordsForSiteKey(r.key), meta=territoryMeta(recs[0]||{site:r.site,address:r.address}), sync=getTerritorySyncMeta(recs[0]||{site:r.site,address:r.address})||{};
  const profileAddresses=[...new Set(recs.map(x=>x.address).filter(Boolean))], profileInvoiceSites=[...new Set(recs.map(x=>x.site).filter(Boolean))];
  const profileAddressText=profileAddresses.length>1?`${profileAddresses.length} sedes: ${profileAddresses.join(' · ')}`:(r.address||'Sin dirección registrada');
  const profileInvoiceText=profileInvoiceSites.length>1?profileInvoiceSites.join(' · '):r.site;
  const quality=qualityStatusForSite(r), energyState=energyDataState(r); const periods=[...r.periods].sort(); const first=periods[0],last=periods[periods.length-1];
  const latest=[...recs].sort((a,b)=>String(b.period).localeCompare(String(a.period)))[0];
  const latestLink=latest?.sourceUrl&&latest.sourceUrl!=='local'?`<a class="secondary profile-evidence-link" href="${escapeHtml(latest.sourceUrl)}#page=${Math.max(1,Number(latest.page)||1)}" target="_blank" rel="noopener">Ver evidencia · ${escapeHtml(latest.source||'Factura')} · pág. ${Math.max(1,Number(latest.page)||1)}</a>`:'<span class="not-available">Sin enlace permanente a factura</span>';
  const serviceCards=[['energyKwh','energyPeriodCount','hasEnergy'],['waterM3','waterPeriodCount','hasWater'],['alcM3','alcPeriodCount','hasAlc'],['gasM3','gasPeriodCount','hasGas'],['wasteTon','wastePeriodCount','hasWaste']].map(([field,pf,hf])=>{const m=serviceMetric(field);let strong=r[hf]?`${fmt(r[field])} ${m.unit}`:'No identificada',small=r[hf]?`${r[pf]}/${r.periodCount} periodos con lectura`:'Sin lectura asociada';if(field==='energyKwh'&&!r[hf]&&energyState.code==='external'){strong='Contrato separado';small='Consumo pendiente de integrar desde la fuente no regulada';}return `<article><span>${escapeHtml(m.label)}</span><strong>${strong}</strong><small>${small}</small></article>`;}).join('');
  box.hidden=false;
  box.innerHTML=`<div class="site-profile-head"><div><span class="section-kicker">Ficha integral de sede</span><h3>${escapeHtml(r.displaySite||r.site)}</h3><p>${mapAddressLink(profileAddressText,profileAddressText,r.displaySite||r.site)}</p>${r.displaySite!==r.site||profileInvoiceSites.length>1?`<p class="invoice-alias">Nombre(s) en factura: ${escapeHtml(profileInvoiceText)}</p>`:''}</div><span class="quality-badge ${quality.code}" title="${escapeHtml(quality.detail)}">${escapeHtml(quality.label)}</span></div><div class="site-profile-meta"><span><strong>Territorio:</strong> ${escapeHtml(meta.territory||'Sin clasificar')}</span><span><strong>Núcleo:</strong> ${escapeHtml(meta.nucleus||'Sin clasificar')}</span><span><strong>Zona:</strong> ${escapeHtml(meta.zone||'Sin clasificar')}</span><span><strong>Periodo:</strong> ${escapeHtml(first||'—')} → ${escapeHtml(last||'—')}</span><span><strong>Confianza de vínculo:</strong> ${escapeHtml(sync.confidence||meta.confidence||'No definida')}${sync.matchScore?` · ${fmt(sync.matchScore)}%`:''}</span></div><div class="site-profile-services">${serviceCards}</div><div class="site-profile-quality"><strong>Lectura de calidad:</strong> ${escapeHtml(quality.detail)}${sync.note?` <span>${escapeHtml(sync.note)}</span>`:''}</div>${energyState.code==='external'?exceptionEvidenceHtml(energyState.exception):''}<div class="site-profile-evidence"><div><strong>Trazabilidad de factura consolidada</strong><p>La evidencia abre la factura y la página asociada al registro más reciente de esta sede.</p></div>${latestLink}</div>`;
}

function renderDashboard(){
  if(!$('environmentBody')) return;
  const rows = aggregateBySite(dashboardRecords());
  const energyRows=rows.filter(r=>r.hasEnergy);
  const totalKwh = energyRows.reduce((a,r)=>a+r.energyKwh,0);
  const totalCo2kg = energyRows.reduce((a,r)=>a+r.co2kg,0);
  const totalTrees = energyRows.length ? Math.ceil(totalCo2kg / TREE_CO2_KG_YEAR) : null;
  const totalWater = rows.filter(r=>r.hasWater).reduce((a,r)=>a+r.waterM3,0);
  const totalAlc = rows.filter(r=>r.hasAlc).reduce((a,r)=>a+r.alcM3,0);
  const totalGas = rows.filter(r=>r.hasGas).reduce((a,r)=>a+r.gasM3,0);
  const totalWaste = rows.filter(r=>r.hasWaste).reduce((a,r)=>a+r.wasteTon,0);
  const selectedNoEnergy=Boolean(dashboardSiteKey && rows.length===1 && !rows[0].hasEnergy);
  const selectedEnergyState=selectedNoEnergy?energyDataState(rows[0]):null;
  $('dashTotalKwh').textContent = selectedNoEnergy ? (selectedEnergyState?.code==='external'?'Contrato separado':'No identificada') : fmt(totalKwh) + ' kWh';
  $('dashTotalCo2').textContent = selectedNoEnergy ? (selectedEnergyState?.code==='external'?'Pendiente de integrar':'No calculable') : fmt(totalCo2kg/1000) + ' t CO₂e';
  $('dashTotalTrees').textContent = selectedNoEnergy ? (selectedEnergyState?.code==='external'?'Pendiente de integrar':'No calculable') : fmt(totalTrees||0) + ' árboles';
  if($('dashTotalWater')) $('dashTotalWater').textContent = rows.some(r=>r.hasWater) ? fmt(totalWater)+' m³' : 'Sin dato';
  if($('dashTotalAlc')) $('dashTotalAlc').textContent = rows.some(r=>r.hasAlc) ? fmt(totalAlc)+' m³' : 'Sin dato';
  if($('dashTotalGas')) $('dashTotalGas').textContent = rows.some(r=>r.hasGas) ? fmt(totalGas)+' m³' : 'Sin dato';
  if($('dashTotalWaste')) $('dashTotalWaste').textContent = rows.some(r=>r.hasWaste) ? fmt(totalWaste)+' t' : 'Sin dato';
  updateDashboardNotice(rows);
  renderSiteProfile(rows);
  if(!rows.length){
    $('environmentBody').innerHTML = '<tr><td colspan="14">No hay registros de servicios públicos para mostrar. Revisa la búsqueda o los filtros.</td></tr>';
    return;
  }
  const body = rows.map((r,i)=>{
    const energyState=energyDataState(r);
    const priority = r.hasEnergy ? classifyEnergyIntensity(r.avgKwhMonth) : (energyState.code==='external'?{level:'Energía en contrato separado',short:'Contrato separado',cls:'external'}:{level:'Energía no identificada',short:'No identificada',cls:'pending'});
    const energyText=r.hasEnergy?`<strong>${fmt(r.energyKwh)}</strong>`:(energyState.code==='external'?'<span class="quality-badge external">Contrato separado</span>':'<span class="not-available">No identificada</span>');
    const co2Text=r.hasEnergy?fmt(r.co2kg/1000):(energyState.code==='external'?'<span class="not-available">Pendiente de integrar</span>':'<span class="not-available">No calculable</span>');
    const treesText=r.hasEnergy?`<strong>${fmt(r.trees)}</strong>`:(energyState.code==='external'?'<span class="not-available">Pendiente de integrar</span>':'<span class="not-available">No calculable</span>');
    const avgText=r.hasEnergy?fmt(r.avgKwhMonth):(energyState.code==='external'?'<span class="not-available">Contrato separado</span>':'<span class="not-available">No identificada</span>');
    const invoiceAlias=r.displaySite!==r.site?`<small class="invoice-alias">En factura: ${escapeHtml(r.site)}</small>`:'';
    return `<tr>
    <td data-label="#">${i+1}</td>
    <td data-label="Sede"><strong>${escapeHtml(r.displaySite||r.site)}</strong>${invoiceAlias}</td>
    <td data-label="Dirección">${mapAddressLink(r.address,r.address||'Sin dirección',preferredSiteName(r)||r.site)}</td>
    <td data-label="Periodos">${fmt(r.periodCount)}</td>
    <td data-label="Energía total kWh">${energyText}</td>
    <td data-label="Agua m³">${dashboardValue(r,'waterM3')}</td>
    <td data-label="Alcantarillado m³">${dashboardValue(r,'alcM3')}</td>
    <td data-label="Gas m³">${dashboardValue(r,'gasM3')}</td>
    <td data-label="Aseo / residuos t">${dashboardValue(r,'wasteTon')}</td>
    <td data-label="CO₂e t">${co2Text}</td>
    <td data-label="Árboles requeridos">${treesText}</td>
    <td data-label="Promedio kWh/mes">${avgText}</td>
    <td data-label="Prioridad"><span class="priority-chip ${priority.cls}" title="${escapeHtml(priority.level)}">${escapeHtml(priority.short || priority.level)}</span></td>
    <td data-label="Plan" class="plan-cell"><button type="button" class="plan-btn primary" data-site-key="${escapeHtml(r.key)}" title="Generar, visualizar y descargar el Plan de Gestión de ${escapeHtml(r.displaySite||r.site)}">📄 Generar informe<br><small>${r.hasEnergy?'Plan de Gestión':'Informe con datos disponibles'}</small></button></td>
  </tr>`;
  }).join('');
  const totalRow = `<tr class="total-row"><td colspan="4">TOTAL / DATOS DISPONIBLES</td><td>${energyRows.length?fmt(totalKwh):'—'}</td><td>${rows.some(r=>r.hasWater)?fmt(totalWater):'—'}</td><td>${rows.some(r=>r.hasAlc)?fmt(totalAlc):'—'}</td><td>${rows.some(r=>r.hasGas)?fmt(totalGas):'—'}</td><td>${rows.some(r=>r.hasWaste)?fmt(totalWaste):'—'}</td><td>${energyRows.length?fmt(totalCo2kg/1000):'—'}</td><td>${energyRows.length?fmt(totalTrees||0):'—'}</td><td>—</td><td>—</td><td>—</td></tr>`;
  $('environmentBody').innerHTML = totalRow + body;
}

function getRankingPeriods(){
  return [...new Set((state.records||[]).map(r=>r.period).filter(Boolean))].sort();
}
function renderRankingPeriodOptions(){
  const select=$('rankingPeriodFilter');
  if(!select) return;
  const periods=getRankingPeriods();
  const current=rankingPeriod || select.value || '';
  select.innerHTML='<option value="">Todos los meses</option>'+periods.map(p=>`<option value="${escapeHtml(p)}">${escapeHtml(groupLabel(p,'month'))}</option>`).join('');
  if(periods.includes(current)){select.value=current;rankingPeriod=current;}
  else{select.value='';rankingPeriod='';}
}
function getFullRankingRows(){
  const metric=selectedRankingMetric();
  const records=(state.records||[]).filter(r=>!rankingPeriod || r.period===rankingPeriod);
  return aggregateBySite(records).map(row=>{
    const has=Boolean(row[metric.hasFlag]); const value=has?Number(row[metric.field])||0:null; const periodCount=Number(row[metric.periodField])||0;
    const rankingExternal=metric.field==='energyKwh' && !has && energyDataState(row).code==='external';
    return {...row,rankingHasValue:has,rankingValue:value,rankingPeriodCount:periodCount,rankingExternal};
  }).filter(row=>{
    if(!rankingPriority) return true;
    return metric.field==='energyKwh' && row.hasEnergy && classifyEnergyIntensity(row.avgKwhMonth).cls===rankingPriority;
  }).sort((a,b)=>Number(b.rankingHasValue)-Number(a.rankingHasValue) || (Number(b.rankingValue)||0)-(Number(a.rankingValue)||0) || String(a.displaySite||a.site).localeCompare(String(b.displaySite||b.site),'es'));
}
function updateRankingPriorityButtons(){
  const metric=selectedRankingMetric();
  document.querySelectorAll('#rankingPriorityFilters [data-priority]').forEach(btn=>{const active=(btn.dataset.priority||'')===rankingPriority;btn.classList.toggle('is-active',active);btn.setAttribute('aria-pressed',String(active));btn.disabled=metric.field!=='energyKwh';});
}
function handleRankingPriorityClick(e){
  const btn=e.target.closest('[data-priority]'); if(!btn||selectedRankingMetric().field!=='energyKwh') return;
  rankingPriority=btn.dataset.priority||''; rankingSelectedKey=''; rankingPage=0; if($('rankingSiteSearch')) $('rankingSiteSearch').value=''; $('clearRankingSearchBtn')?.classList.remove('visible'); closeRankingSuggestions(); renderRanking();
}
function rankingSearchOptions(){ return rankingRowsCache.map((r,index)=>({...r,index,key:siteKey(r.site,r.address)})); }
function closeRankingSuggestions(){const list=$('rankingSiteSuggestions'),input=$('rankingSiteSearch');if(list)list.hidden=true;if(input)input.setAttribute('aria-expanded','false');rankingAutocompleteIndex=-1;}
function clearRankingSearch(){rankingSelectedKey='';rankingAutocompleteIndex=-1;if($('rankingSiteSearch'))$('rankingSiteSearch').value='';if($('clearRankingSearchBtn'))$('clearRankingSearchBtn').classList.remove('visible');closeRankingSuggestions();rankingPage=0;drawSiteChart(rankingRowsCache);}
function rankingMatches(query){
  const tokens=loose(query).split(/\s+/).filter(Boolean),opts=rankingSearchOptions(); if(!tokens.length)return opts.slice(0,20);
  return opts.map(o=>{const hay=loose(`${o.displaySite||o.site} ${o.site} ${o.address}`);if(!tokens.every(t=>hay.includes(t)))return null;let score=0;const site=loose(`${o.displaySite||''} ${o.site||''}`),address=loose(o.address);tokens.forEach(t=>{if(site.startsWith(t))score+=8;else if(site.includes(t))score+=5;if(address.includes(t))score+=2;});return {...o,score};}).filter(Boolean).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,20);
}
function highlightRankingMatch(value,query){const safe=escapeHtml(value||''),token=loose(query).split(/\s+/).filter(Boolean)[0];if(!token)return safe;const raw=String(value||''),idx=loose(raw).indexOf(token);if(idx<0)return safe;return `${escapeHtml(raw.slice(0,idx))}<mark>${escapeHtml(raw.slice(idx,idx+token.length))}</mark>${escapeHtml(raw.slice(idx+token.length))}`;}
function renderRankingSuggestions(query=''){
  const list=$('rankingSiteSuggestions'),input=$('rankingSiteSearch');if(!list||!input)return;const metric=selectedRankingMetric(),matches=rankingMatches(query);rankingAutocompleteIndex=-1;
  list.innerHTML=matches.length?matches.map((o,i)=>{const coverage=o.rankingHasValue?`${o.rankingPeriodCount}/${o.periodCount} periodos con ${metric.short.toLowerCase()}`:(o.rankingExternal?'Energía en contrato separado · consumo pendiente de integrar':`${o.periodCount} periodo${o.periodCount===1?'':'s'} · Sin dato de ${metric.short.toLowerCase()}`);return `<button type="button" class="autocomplete-option" role="option" data-ranking-key="${escapeHtml(o.key)}" data-ranking-index="${o.index}"><span><strong>${highlightRankingMatch(o.displaySite||o.site,query)}</strong><small>${mapAddressAction(o.address,highlightRankingMatch(o.address||'Sin dirección',query),o.displaySite||o.site)} · ${escapeHtml(coverage)}</small></span><em>${o.rankingHasValue?`Puesto ${o.index+1}`:(o.rankingExternal?'Contrato separado':'Pendiente')}</em></button>`;}).join(''):'<div class="autocomplete-empty">No se encontraron instituciones o sedes en los históricos.</div>';
  list.hidden=false;input.setAttribute('aria-expanded','true');
}
function handleRankingSearchInput(){rankingSelectedKey='';const value=$('rankingSiteSearch').value;$('clearRankingSearchBtn')?.classList.toggle('visible',Boolean(value));scheduleAutocomplete('ranking-search',()=>renderRankingSuggestions(value),30);}
function selectRankingSuggestion(key,index){const row=rankingRowsCache[index]||rankingRowsCache.find(r=>siteKey(r.site,r.address)===key);if(!row)return;rankingSelectedKey=key;$('rankingSiteSearch').value=row.displaySite||row.site;$('clearRankingSearchBtn')?.classList.add('visible');closeRankingSuggestions();const actualIndex=rankingRowsCache.findIndex(r=>siteKey(r.site,r.address)===key);rankingPage=Math.max(0,Math.floor(actualIndex/RANKING_PAGE_SIZE));drawSiteChart(rankingRowsCache);requestAnimationFrame(()=>$('siteChart')?.scrollIntoView({behavior:'smooth',block:'center'}));}
function handleRankingSuggestionClick(e){const map=e.target.closest('[data-map-address]');if(map){e.preventDefault();e.stopPropagation();openAddressInGoogleMaps(map.dataset.mapAddress,map.dataset.mapSchool||'');return;}const btn=e.target.closest('[data-ranking-key]');if(!btn)return;e.preventDefault();selectRankingSuggestion(btn.dataset.rankingKey,Number(btn.dataset.rankingIndex));}
function handleRankingSearchKeydown(e){const list=$('rankingSiteSuggestions'),options=[...(list?.querySelectorAll('.autocomplete-option')||[])];if(e.key==='ArrowDown'){e.preventDefault();rankingAutocompleteIndex=Math.min(rankingAutocompleteIndex+1,options.length-1);}else if(e.key==='ArrowUp'){e.preventDefault();rankingAutocompleteIndex=Math.max(rankingAutocompleteIndex-1,0);}else if(e.key==='Enter'&&rankingAutocompleteIndex>=0&&options[rankingAutocompleteIndex]){e.preventDefault();options[rankingAutocompleteIndex].dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));return;}else if(e.key==='Escape'){closeRankingSuggestions();return;}else return;options.forEach((o,i)=>o.classList.toggle('active',i===rankingAutocompleteIndex));options[rankingAutocompleteIndex]?.scrollIntoView({block:'nearest'});}
function refreshFullRanking(){
  dashboardSiteKey='';const field=siteAutocompleteState.get('dashboardSiteSearch');if(field){field.input.value='';field.clear.classList.remove('visible');}
  rankingPeriod='';rankingPriority='';rankingSelectedKey='';rankingPage=0;rankingMetric=$('rankingMetricFilter')?.value||'energyKwh';renderRankingPeriodOptions();if($('rankingPeriodFilter'))$('rankingPeriodFilter').value='';if($('rankingSiteSearch'))$('rankingSiteSearch').value='';$('clearRankingSearchBtn')?.classList.remove('visible');closeRankingSuggestions();rankingRowsCache=getFullRankingRows();drawSiteChart(rankingRowsCache);log('Ranking actualizado: se muestran todas las sedes para el servicio seleccionado.');
}
function setRankingPage(page){const pages=Math.max(1,Math.ceil(rankingRowsCache.length/RANKING_PAGE_SIZE));rankingPage=Math.max(0,Math.min(Number(page)||0,pages-1));drawSiteChart(rankingRowsCache);}
function renderRanking(){
  renderRankingPeriodOptions(); rankingMetric=$('rankingMetricFilter')?.value||rankingMetric||'energyKwh'; if(rankingMetric!=='energyKwh')rankingPriority='';updateRankingPriorityButtons();rankingRowsCache=getFullRankingRows();
  if(rankingSelectedKey&&!rankingRowsCache.some(r=>siteKey(r.site,r.address)===rankingSelectedKey)){rankingSelectedKey='';if($('rankingSiteSearch'))$('rankingSiteSearch').value='';$('clearRankingSearchBtn')?.classList.remove('visible');}
  const metric=selectedRankingMetric(); if($('rankingTitle'))$('rankingTitle').textContent=`Ranking de sedes por ${metric.label.toLowerCase()}`; if($('rankingDescription'))$('rankingDescription').textContent=`Ordena de mayor a menor ${metric.label.toLowerCase()}. Las sedes sin lectura para este indicador permanecen visibles al final y no se interpretan como consumo cero.`;
  const pages=Math.max(1,Math.ceil(rankingRowsCache.length/RANKING_PAGE_SIZE));if(rankingPage>=pages)rankingPage=pages-1;drawSiteChart(rankingRowsCache);
  renderSavingsRanking();
}
function rankingAddressText(row){
  const raw=String(row?.addressLabel||row?.address||'').replace(/\s+/g,' ').trim();
  return raw || 'Sin dirección registrada';
}
let rankingMapHitZones=[];
let savingsMapHitZones=[];
function drawRankingIdentity(ctx,row,position,y,isSelected,layout={}){
  const nameRight=layout.nameRight||205,addressX=layout.addressX||218,addressWidth=layout.addressWidth||205;
  const name=`${position}. ${row.displaySite||row.site||'Sin nombre'}`;
  ctx.textAlign='right';ctx.font=isSelected?'bold 11.5px Arial':'11.5px Arial';ctx.fillStyle=isSelected?'#075846':'#315650';
  ctx.fillText(fitCanvasText(ctx,name,nameRight-30),nameRight,y+15);
  const address=rankingAddressText(row),pillY=y-2,pillH=24;
  ctx.fillStyle=isSelected?'#e0f7ef':'#eef8f5';roundRect(ctx,addressX,pillY,addressWidth,pillH,8);ctx.fill();
  ctx.strokeStyle=isSelected?'#8fd5c2':'#d4e8e2';ctx.lineWidth=1;roundRect(ctx,addressX,pillY,addressWidth,pillH,8);ctx.stroke();
  ctx.textAlign='left';ctx.font=isSelected?'bold 10.5px Arial':'10.5px Arial';ctx.fillStyle=isSelected?'#075846':'#526a65';
  ctx.fillText(fitCanvasText(ctx,`🏫 ${address}`,addressWidth-14),addressX+7,y+14);
  const zone={x:addressX,y:pillY,w:addressWidth,h:pillH,address,schoolName:row.displaySite||row.site||''};
  if(layout.hitZones) layout.hitZones.push(zone);
}
function drawSiteChart(rows){
  rankingMapHitZones=[];
  const c=$('siteChart');if(!c)return;const ctx=c.getContext('2d'),metric=selectedRankingMetric();ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#13312d';ctx.font='bold 17px Arial';ctx.textAlign='left';ctx.fillText(`Ranking de sedes por ${metric.label.toLowerCase()} (${metric.unit})`,24,34);ctx.font='12px Arial';ctx.fillStyle='#637772';ctx.fillText(`Mayor a menor · ${rankingPeriod?groupLabel(rankingPeriod,'month'):'todos los meses'} · cada sede se identifica por nombre y dirección · vista de 10 sedes.`,24,54);
  const total=rows.length,pages=Math.max(1,Math.ceil(total/RANKING_PAGE_SIZE));rankingPage=Math.max(0,Math.min(rankingPage,pages-1));const start=rankingPage*RANKING_PAGE_SIZE,visible=rows.slice(start,start+RANKING_PAGE_SIZE),end=Math.min(start+visible.length,total);
  if($('rankingPageInfo'))$('rankingPageInfo').textContent=total?`${start+1}–${end} de ${total} sedes · Página ${rankingPage+1} de ${pages}`:'Sin sedes disponibles';['rankingFirstBtn','rankingPrevBtn'].forEach(id=>{if($(id))$(id).disabled=rankingPage===0||!total;});['rankingNextBtn','rankingLastBtn'].forEach(id=>{if($(id))$(id).disabled=rankingPage>=pages-1||!total;});
  const measured=rows.filter(r=>r.rankingHasValue),external=rows.filter(r=>r.rankingExternal),pending=rows.filter(r=>!r.rankingHasValue&&!r.rankingExternal),most=measured[0],least=measured[measured.length-1];
  if($('rankingExtremes'))$('rankingExtremes').innerHTML=total?`${most?`<article><span>Mayor ${escapeHtml(metric.short.toLowerCase())}</span><strong>${escapeHtml(most.displaySite||most.site)}</strong><small>${mapAddressLink(rankingAddressText(most),rankingAddressText(most),most.displaySite||most.site)} · ${fmt(most.rankingValue)} ${metric.unit}</small></article>`:'<article><span>Mayor valor</span><strong>Sin lecturas</strong><small>No hay datos para comparar</small></article>'}${least?`<article><span>Menor valor con dato</span><strong>${escapeHtml(least.displaySite||least.site)}</strong><small>${mapAddressLink(rankingAddressText(least),rankingAddressText(least),least.displaySite||least.site)} · ${fmt(least.rankingValue)} ${metric.unit}</small></article>`:''}<article><span>Cobertura</span><strong>${measured.length} con dato · ${external.length} contrato separado · ${pending.length} pendientes</strong><small>${total} sedes históricas</small></article>`:'<p>No hay sedes históricas para construir el ranking.</p>';
  if(!visible.length){ctx.fillStyle='#13312d';ctx.fillText('Sin datos históricos para graficar',24,92);return;}
  const nameRight=205,addressX=218,addressWidth=205,padL=440,padR=28,valueX=Math.max(790,c.width-300),top=82,rowH=36,barH=20,max=Math.max(...measured.map(r=>Number(r.rankingValue)||0),1),maxBarW=Math.max(150,valueX-padL-18);ctx.font='12px Arial';
  visible.forEach((r,i)=>{const y=top+i*rowH,position=start+i+1,isSelected=rankingSelectedKey&&siteKey(r.site,r.address)===rankingSelectedKey;if(isSelected){ctx.fillStyle='#fff3bf';roundRect(ctx,12,y-7,c.width-24,rowH-1,10);ctx.fill();}drawRankingIdentity(ctx,r,position,y,isSelected,{nameRight,addressX,addressWidth,hitZones:rankingMapHitZones});if(r.rankingHasValue){const bw=Math.max(5,(r.rankingValue/max)*maxBarW),grad=ctx.createLinearGradient(padL,0,padL+bw,0);grad.addColorStop(0,'#0b9878');grad.addColorStop(1,'#0fc39a');ctx.fillStyle=grad;roundRect(ctx,padL,y,bw,barH,8);ctx.fill();}else{ctx.save();ctx.setLineDash([6,5]);ctx.strokeStyle='#9cafaa';ctx.lineWidth=1.5;roundRect(ctx,padL,y,maxBarW,barH,8);ctx.stroke();ctx.restore();}const available=c.width-valueX-padR,fullLabel=r.rankingHasValue?`${fmt(r.rankingValue)} ${metric.unit} · ${r.rankingPeriodCount}/${r.periodCount} periodos`:(r.rankingExternal?'Contrato separado · consumo pendiente de integrar':`Sin dato de ${metric.short.toLowerCase()} · ${r.periodCount} periodo${r.periodCount===1?'':'s'}`);ctx.fillStyle=r.rankingHasValue?'#13312d':'#637772';ctx.textAlign='left';ctx.font=r.rankingHasValue?'bold 11.5px Arial':'italic 11.5px Arial';ctx.fillText(fitCanvasText(ctx,fullLabel,available),valueX,y+15);});ctx.textAlign='left';
}


function monthBefore(period){
  const m=String(period||'').match(/^(\d{4})-(\d{2})$/); if(!m) return '';
  const d=new Date(Number(m[1]),Number(m[2])-2,1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function energyBySitePeriod(){
  const map=new Map();
  for(const r of state.records||[]){
    if(!r.period || !recordHasEnergyReading(r)) continue;
    const key=siteKey(r.site,r.address), id=`${key}@@${r.period}`;
    if(!map.has(id)) map.set(id,{key,period:r.period,site:r.site||'Sin nombre',displaySite:preferredSiteName(r),address:r.address||'',energyKwh:0});
    map.get(id).energyKwh += Number(r.energyKwh)||0;
  }
  return map;
}
function getSavingsPeriods(){
  return getRankingPeriods().filter(period=>getRankingPeriods().includes(monthBefore(period)));
}
function renderSavingsPeriodOptions(){
  const select=$('savingsPeriodFilter'); if(!select) return;
  const periods=getSavingsPeriods(), current=savingsPeriod||select.value||'';
  select.innerHTML='<option value="">Tendencia general · todos los meses</option>'+periods.map(p=>`<option value="${escapeHtml(p)}">${escapeHtml(groupLabel(p,'month'))} vs ${escapeHtml(groupLabel(monthBefore(p),'month'))}</option>`).join('');
  if(periods.includes(current)){select.value=current;savingsPeriod=current;} else {select.value='';savingsPeriod='';}
}
function buildSavingsRows(){
  const byPeriod=energyBySitePeriod(), periods=getRankingPeriods(), siteMeta=new Map();
  for(const item of byPeriod.values()) if(!siteMeta.has(item.key)) siteMeta.set(item.key,item);
  const rows=[];
  for(const [key,meta] of siteMeta.entries()){
    const comparisons=[];
    const targets=savingsPeriod?[savingsPeriod]:periods.filter(p=>periods.includes(monthBefore(p)));
    for(const currentPeriod of targets){
      const previousPeriod=monthBefore(currentPeriod);
      const prev=byPeriod.get(`${key}@@${previousPeriod}`), curr=byPeriod.get(`${key}@@${currentPeriod}`);
      if(!prev||!curr) continue;
      const previous=Number(prev.energyKwh)||0,current=Number(curr.energyKwh)||0;
      const delta=previous-current, pct=previous>0?(delta/previous)*100:null;
      comparisons.push({previousPeriod,currentPeriod,previous,current,delta,pct});
    }
    if(!comparisons.length) continue;
    const decreases=comparisons.filter(c=>c.delta>0), increases=comparisons.filter(c=>c.delta<0), equals=comparisons.filter(c=>c.delta===0);
    const savingsKwh=decreases.reduce((a,c)=>a+c.delta,0), increaseKwh=increases.reduce((a,c)=>a+Math.abs(c.delta),0), netSavingsKwh=comparisons.reduce((a,c)=>a+c.delta,0);
    const decreaseRate=100*decreases.length/comparisons.length;
    if(savingsPeriod){
      const c=comparisons[0];
      if(!(c&&c.delta>0)) continue;
      rows.push({...meta,comparisons,decreaseCount:1,increaseCount:0,equalCount:0,decreaseRate:100,savingsKwh:c.delta,netSavingsKwh:c.delta,increaseKwh:0,previousKwh:c.previous,currentKwh:c.current,savingsPercent:c.pct,rankingValue:c.delta});
    }else{
      if(!decreases.length || netSavingsKwh<=0) continue;
      rows.push({...meta,comparisons,decreaseCount:decreases.length,increaseCount:increases.length,equalCount:equals.length,decreaseRate,savingsKwh,netSavingsKwh,increaseKwh,savingsPercent:null,rankingValue:netSavingsKwh});
    }
  }
  if(!savingsPeriod && rows.length){
    const maxNet=Math.max(...rows.map(r=>Math.max(0,Number(r.netSavingsKwh)||0)),1);
    rows.forEach(r=>{
      const consistency=Math.max(0,Math.min(100,Number(r.decreaseRate)||0));
      const magnitude=100*Math.max(0,Number(r.netSavingsKwh)||0)/maxNet;
      r.managementScore=(0.70*consistency)+(0.30*magnitude);
      r.rankingValue=r.managementScore;
    });
  }
  return rows.sort((a,b)=>{
    if(savingsPeriod) return (b.rankingValue-a.rankingValue) || ((b.savingsPercent||0)-(a.savingsPercent||0)) || String(a.displaySite||a.site).localeCompare(String(b.displaySite||b.site),'es');
    return (b.managementScore-a.managementScore) || (b.decreaseRate-a.decreaseRate) || (b.netSavingsKwh-a.netSavingsKwh) || String(a.displaySite||a.site).localeCompare(String(b.displaySite||b.site),'es');
  });
}
function savingsSearchOptions(){return savingsRowsCache.map((r,index)=>({...r,index,key:r.key||siteKey(r.site,r.address)}));}
function closeSavingsSuggestions(){const list=$('savingsSiteSuggestions'),input=$('savingsSiteSearch');if(list)list.hidden=true;if(input)input.setAttribute('aria-expanded','false');savingsAutocompleteIndex=-1;}
function savingsMatches(query){
  const tokens=loose(query).split(/\s+/).filter(Boolean),opts=savingsSearchOptions(); if(!tokens.length)return opts.slice(0,20);
  return opts.map(o=>{const hay=loose(`${o.displaySite||o.site} ${o.site} ${o.address}`);if(!tokens.every(t=>hay.includes(t)))return null;let score=0;const site=loose(`${o.displaySite||''} ${o.site||''}`),address=loose(o.address);tokens.forEach(t=>{if(site.startsWith(t))score+=8;else if(site.includes(t))score+=5;if(address.includes(t))score+=2;});return {...o,score};}).filter(Boolean).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,20);
}
function renderSavingsSuggestions(query=''){
  const list=$('savingsSiteSuggestions'),input=$('savingsSiteSearch');if(!list||!input)return;const matches=savingsMatches(query);savingsAutocompleteIndex=-1;
  list.innerHTML=matches.length?matches.map(o=>`<button type="button" class="autocomplete-option" role="option" data-savings-key="${escapeHtml(o.key)}" data-savings-index="${o.index}"><span><strong>${highlightRankingMatch(o.displaySite||o.site,query)}</strong><small>${mapAddressAction(o.address,highlightRankingMatch(o.address||'Sin dirección',query),o.displaySite||o.site)} · ${savingsPeriod?`${fmt(o.savingsKwh)} kWh ahorrados`:`${o.decreaseCount}/${o.comparisons.length} comparaciones a la baja`}</small></span><em>Puesto ${o.index+1}</em></button>`).join(''):'<div class="autocomplete-empty">No hay sedes con ahorro verificable para esta selección.</div>';
  list.hidden=false;input.setAttribute('aria-expanded','true');
}
function handleSavingsSearchInput(){savingsSelectedKey='';const value=$('savingsSiteSearch').value;$('clearSavingsSearchBtn')?.classList.toggle('visible',Boolean(value));scheduleAutocomplete('savings-search',()=>renderSavingsSuggestions(value),30);}
function selectSavingsSuggestion(key,index){const row=savingsRowsCache[index]||savingsRowsCache.find(r=>r.key===key);if(!row)return;savingsSelectedKey=key;$('savingsSiteSearch').value=row.displaySite||row.site;$('clearSavingsSearchBtn')?.classList.add('visible');closeSavingsSuggestions();const actualIndex=savingsRowsCache.findIndex(r=>r.key===key);savingsPage=Math.max(0,Math.floor(actualIndex/SAVINGS_PAGE_SIZE));drawSavingsChart(savingsRowsCache);requestAnimationFrame(()=>$('savingsSiteChart')?.scrollIntoView({behavior:'smooth',block:'center'}));}
function handleSavingsSuggestionClick(e){const map=e.target.closest('[data-map-address]');if(map){e.preventDefault();e.stopPropagation();openAddressInGoogleMaps(map.dataset.mapAddress,map.dataset.mapSchool||'');return;}const btn=e.target.closest('[data-savings-key]');if(!btn)return;e.preventDefault();selectSavingsSuggestion(btn.dataset.savingsKey,Number(btn.dataset.savingsIndex));}
function handleSavingsSearchKeydown(e){const list=$('savingsSiteSuggestions'),options=[...(list?.querySelectorAll('.autocomplete-option')||[])];if(e.key==='ArrowDown'){e.preventDefault();savingsAutocompleteIndex=Math.min(savingsAutocompleteIndex+1,options.length-1);}else if(e.key==='ArrowUp'){e.preventDefault();savingsAutocompleteIndex=Math.max(savingsAutocompleteIndex-1,0);}else if(e.key==='Enter'&&savingsAutocompleteIndex>=0&&options[savingsAutocompleteIndex]){e.preventDefault();options[savingsAutocompleteIndex].dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));return;}else if(e.key==='Escape'){closeSavingsSuggestions();return;}else return;options.forEach((o,i)=>o.classList.toggle('active',i===savingsAutocompleteIndex));options[savingsAutocompleteIndex]?.scrollIntoView({block:'nearest'});}
function clearSavingsSearch(){savingsSelectedKey='';savingsAutocompleteIndex=-1;if($('savingsSiteSearch'))$('savingsSiteSearch').value='';$('clearSavingsSearchBtn')?.classList.remove('visible');closeSavingsSuggestions();savingsPage=0;drawSavingsChart(savingsRowsCache);}
function refreshSavingsRanking(){savingsPeriod='';savingsSelectedKey='';savingsPage=0;renderSavingsPeriodOptions();if($('savingsPeriodFilter'))$('savingsPeriodFilter').value='';if($('savingsSiteSearch'))$('savingsSiteSearch').value='';$('clearSavingsSearchBtn')?.classList.remove('visible');closeSavingsSuggestions();renderSavingsRanking();log('Ranking de ahorro actualizado: se recalcularon las reducciones eléctricas mes a mes.');}
function setSavingsPage(page){const pages=Math.max(1,Math.ceil(savingsRowsCache.length/SAVINGS_PAGE_SIZE));savingsPage=Math.max(0,Math.min(Number(page)||0,pages-1));drawSavingsChart(savingsRowsCache);}
function renderSavingsRanking(){
  if(!$('savingsSiteChart')) return;
  renderSavingsPeriodOptions();savingsRowsCache=buildSavingsRows();
  if(savingsSelectedKey&&!savingsRowsCache.some(r=>r.key===savingsSelectedKey)){savingsSelectedKey='';if($('savingsSiteSearch'))$('savingsSiteSearch').value='';$('clearSavingsSearchBtn')?.classList.remove('visible');}
  const pages=Math.max(1,Math.ceil(savingsRowsCache.length/SAVINGS_PAGE_SIZE));if(savingsPage>=pages)savingsPage=pages-1;drawSavingsChart(savingsRowsCache);
}
function renderSavingsTop3Interpretation(rows){
  const box=$('savingsTop3Interpretation'),method=$('savingsTop3Method');
  if(!box)return;
  const top=rows.slice(0,3);
  if(method){
    method.textContent=savingsPeriod
      ? `Lectura para ${groupLabel(savingsPeriod,'month')}: cada puesto compara el consumo con ${groupLabel(monthBefore(savingsPeriod),'month')}.`
      : 'Lectura de tendencia general: el Índice de Gestión del Ahorro combina 70% constancia y 30% magnitud del ahorro.';
  }
  if(!top.length){
    box.innerHTML='<p class="savings-top3-empty">No hay sedes con ahorro verificable para construir el ejemplo.</p>';
    return;
  }
  box.innerHTML=top.map((r,i)=>{
    const name=escapeHtml(r.displaySite||r.site||'Sede sin nombre');
    const address=escapeHtml(rankingAddressText(r));
    if(savingsPeriod){
      const prev=fmt(r.previousKwh),curr=fmt(r.currentKwh),saved=fmt(r.savingsKwh),pct=fmt(r.savingsPercent,1);
      return `<article class="savings-top3-card">
        <div class="savings-top3-place"><span>${i+1}</span><strong>${i===0?'Primer':i===1?'Segundo':'Tercer'} puesto</strong></div>
        <h4>${name}</h4>
        <p class="savings-top3-address">${mapAddressLink(rankingAddressText(r),rankingAddressText(r),r.displaySite||r.site)}</p>
        <p class="savings-top3-data"><strong>↓ ${saved} kWh</strong> · ${pct}% menos · ${prev} → ${curr} kWh</p>
        <p><strong>Interpretación:</strong> esta sede ocupa el puesto ${i+1} porque, entre ${escapeHtml(groupLabel(monthBefore(savingsPeriod),'month'))} y ${escapeHtml(groupLabel(savingsPeriod,'month'))}, redujo su consumo en <strong>${saved} kWh</strong>, equivalente a <strong>${pct}%</strong>. En este filtro mensual el orden prioriza la cantidad real de kWh ahorrados.</p>
      </article>`;
    }
    const score=fmt(r.managementScore,1),rate=fmt(r.decreaseRate,1),net=fmt(r.netSavingsKwh),dec=r.decreaseCount,total=r.comparisons.length;
    return `<article class="savings-top3-card">
      <div class="savings-top3-place"><span>${i+1}</span><strong>${i===0?'Primer':i===1?'Segundo':'Tercer'} puesto</strong></div>
      <h4>${name}</h4>
      <p class="savings-top3-address">${mapAddressLink(rankingAddressText(r),rankingAddressText(r),r.displaySite||r.site)}</p>
      <p class="savings-top3-data"><strong>🏆 ${score} puntos</strong> · ${dec}/${total} meses ↓ (${rate}%) · ahorro neto ${net} kWh</p>
      <p><strong>Interpretación:</strong> esta sede ocupa el puesto ${i+1} porque obtuvo <strong>${score} puntos</strong> en el Índice de Gestión del Ahorro. Logró disminuir el consumo en <strong>${dec} de ${total}</strong> comparaciones mensuales válidas (<strong>${rate}%</strong> de constancia) y acumuló un ahorro neto de <strong>${net} kWh</strong>. La posición combina principalmente la regularidad de las reducciones (70%) con la magnitud del ahorro (30%).</p>
    </article>`;
  }).join('');
}

function drawSavingsChart(rows){
  savingsMapHitZones=[];
  const c=$('savingsSiteChart');if(!c)return;const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#13312d';ctx.font='bold 17px Arial';ctx.textAlign='left';ctx.fillText('Ranking de sedes por ahorro de energía eléctrica (kWh)',24,34);ctx.font='12px Arial';ctx.fillStyle='#637772';ctx.fillText(savingsPeriod?`${groupLabel(savingsPeriod,'month')} frente a ${groupLabel(monthBefore(savingsPeriod),'month')} · nombre y dirección · mayor ahorro mensual a menor.`:'Tendencia general · Índice de Gestión del Ahorro: 70% constancia + 30% magnitud del ahorro · solo meses consecutivos válidos.',24,54);
  const total=rows.length,pages=Math.max(1,Math.ceil(total/SAVINGS_PAGE_SIZE));savingsPage=Math.max(0,Math.min(savingsPage,pages-1));const start=savingsPage*SAVINGS_PAGE_SIZE,visible=rows.slice(start,start+SAVINGS_PAGE_SIZE),end=Math.min(start+visible.length,total);
  if($('savingsPageInfo'))$('savingsPageInfo').textContent=total?`${start+1}–${end} de ${total} sedes con ahorro · Página ${savingsPage+1} de ${pages}`:'Sin sedes con ahorro verificable';['savingsFirstBtn','savingsPrevBtn'].forEach(id=>{if($(id))$(id).disabled=savingsPage===0||!total;});['savingsNextBtn','savingsLastBtn'].forEach(id=>{if($(id))$(id).disabled=savingsPage>=pages-1||!total;});
  renderSavingsTop3Interpretation(rows);
  const maxSaved=rows.reduce((m,r)=>Math.max(m,Number(r.rankingValue)||0),0),best=rows[0],bestRate=[...rows].sort((a,b)=>savingsPeriod?((b.savingsPercent||0)-(a.savingsPercent||0))||(b.rankingValue-a.rankingValue):(b.decreaseCount-a.decreaseCount)||(b.decreaseRate-a.decreaseRate)||(b.comparisons.length-a.comparisons.length)||(b.rankingValue-a.rankingValue))[0];
  if($('savingsRankingExtremes'))$('savingsRankingExtremes').innerHTML=total?`<article><span>${savingsPeriod?'Mayor ahorro':'Mejor gestión del ahorro'}</span><strong>${escapeHtml(best.displaySite||best.site)}</strong><small>${mapAddressLink(rankingAddressText(best),rankingAddressText(best),best.displaySite||best.site)} · ${savingsPeriod?`${fmt(best.rankingValue)} kWh${Number.isFinite(best.savingsPercent)?` · ${fmt(best.savingsPercent,1)}% menos`:''}`:`🏆 ${fmt(best.managementScore,1)} puntos · ahorro neto ${fmt(best.netSavingsKwh)} kWh`}</small></article><article><span>${savingsPeriod?'Mejor reducción':'Mayor constancia'}</span><strong>${escapeHtml(bestRate.displaySite||bestRate.site)}</strong><small>${mapAddressLink(rankingAddressText(bestRate),rankingAddressText(bestRate),bestRate.displaySite||bestRate.site)} · ${savingsPeriod?`${fmt(bestRate.savingsPercent,1)}% menos`:`${bestRate.decreaseCount}/${bestRate.comparisons.length} comparaciones a la baja · ${fmt(bestRate.decreaseRate,1)}%`}</small></article><article><span>Cobertura</span><strong>${total} sedes con ahorro verificable</strong><small>${savingsPeriod?`Comparación ${escapeHtml(groupLabel(monthBefore(savingsPeriod),'month'))} → ${escapeHtml(groupLabel(savingsPeriod,'month'))}`:'No se comparan meses faltantes ni lecturas ausentes'}</small></article>`:'<p>No hay reducciones de energía verificables para la selección actual.</p>';
  if(!visible.length){ctx.fillStyle='#13312d';ctx.font='13px Arial';ctx.fillText('No hay ahorro mensual verificable para graficar en esta selección.',24,94);return;}
  const nameRight=205,addressX=218,addressWidth=205,padL=440,padR=28,valueX=Math.max(790,c.width-300),top=82,rowH=36,barH=20,max=Math.max(maxSaved,1),maxBarW=Math.max(150,valueX-padL-18);ctx.font='12px Arial';
  visible.forEach((r,i)=>{const y=top+i*rowH,position=start+i+1,isSelected=savingsSelectedKey&&r.key===savingsSelectedKey;if(isSelected){ctx.fillStyle='#fff3bf';roundRect(ctx,12,y-7,c.width-24,rowH-1,10);ctx.fill();}drawRankingIdentity(ctx,r,position,y,isSelected,{nameRight,addressX,addressWidth,hitZones:savingsMapHitZones});const bw=Math.max(5,(r.rankingValue/max)*maxBarW),grad=ctx.createLinearGradient(padL,0,padL+bw,0);grad.addColorStop(0,'#0b9878');grad.addColorStop(1,'#0fc39a');ctx.fillStyle=grad;roundRect(ctx,padL,y,bw,barH,8);ctx.fill();const available=c.width-valueX-padR;let fullLabel;if(savingsPeriod){fullLabel=`↓ ${fmt(r.savingsKwh)} kWh · ${fmt(r.savingsPercent,1)}% · ${fmt(r.previousKwh)} → ${fmt(r.currentKwh)} kWh`;}else{fullLabel=`🏆 ${fmt(r.managementScore,1)} pts · ${r.decreaseCount}/${r.comparisons.length} meses ↓ (${fmt(r.decreaseRate,1)}%) · ahorro ${fmt(r.netSavingsKwh)} kWh`;}ctx.fillStyle='#13312d';ctx.textAlign='left';ctx.font='bold 11.5px Arial';ctx.fillText(fitCanvasText(ctx,fullLabel,available),valueX,y+15);});ctx.textAlign='left';
}

function canvasAddressAtEvent(canvas,event,zones){
  if(!canvas||!zones?.length)return null;
  const rect=canvas.getBoundingClientRect();
  const x=(event.clientX-rect.left)*(canvas.width/rect.width);
  const y=(event.clientY-rect.top)*(canvas.height/rect.height);
  return zones.find(z=>x>=z.x&&x<=z.x+z.w&&y>=z.y&&y<=z.y+z.h)||null;
}
function handleRankingCanvasMapClick(event){
  const zone=canvasAddressAtEvent($('siteChart'),event,rankingMapHitZones);
  if(zone) openAddressInGoogleMaps(zone.address,zone.schoolName);
}
function handleSavingsCanvasMapClick(event){
  const zone=canvasAddressAtEvent($('savingsSiteChart'),event,savingsMapHitZones);
  if(zone) openAddressInGoogleMaps(zone.address,zone.schoolName);
}
function handleCanvasMapPointer(event,zones){
  const canvas=event.currentTarget;
  canvas.style.cursor=canvasAddressAtEvent(canvas,event,zones)?'pointer':'default';
}

function fitCanvasText(ctx, text, maxWidth){
  if(maxWidth <= 30) return '';
  if(ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while(t.length > 3 && ctx.measureText(t + '…').width > maxWidth){
    t = t.slice(0, -1);
  }
  return t + '…';
}

/* Plan de Gestión personalizado por sede - v13 */
let CURRENT_PLAN_HTML = '';
let CURRENT_PLAN_FILENAME = 'plan-gestion-sede.html';

function shortSiteName(site){
  const s = String(site||'Sede').replace(/\s+/g,' ').trim();
  return s.length > 24 ? s.slice(0,24)+'…' : s;
}

function slugify(s){
  return loose(s||'sede').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'sede';
}

function handlePlanButtonClick(ev){
  const btn = ev.target.closest('.plan-btn');
  if(!btn) return;
  ev.preventDefault();
  ev.stopPropagation();
  const key = btn.getAttribute('data-site-key');
  if(!key){alert('No fue posible identificar la sede seleccionada.');return;}
  btn.disabled=true;
  btn.classList.add('is-generating');
  const originalHtml=btn.innerHTML;
  btn.innerHTML = '⏳ Generando informe…';
  setTimeout(()=>{
    try{
      const ok=generateManagementPlan(key);
      if(!ok) throw new Error('No se pudo construir el informe con los registros de la sede.');
    }catch(err){
      console.error('Error al generar informe por sede:',err);
      alert(`No fue posible generar el informe de esta sede. ${err?.message||'Intenta nuevamente.'}`);
    }finally{
      btn.disabled=false;
      btn.classList.remove('is-generating');
      btn.innerHTML = originalHtml || '📄 Generar informe<br><small>Plan de Gestión</small>';
    }
  }, 0);
}

function recordsForSiteKey(key){
  const indexed=recordsBySiteKey().get(key);
  const rows=indexed ? [...indexed] : state.records.filter(r => siteKey(r.site, r.address) === key);
  return rows.sort((a,b)=>String(a.period).localeCompare(String(b.period)));
}

function generateManagementPlan(key){
  const recs = recordsForSiteKey(key);
  if(!recs.length){
    log('No se encontraron registros para generar el plan de gestión.');
    alert('No se encontraron registros para generar el plan de gestión de esta sede.');
    return false;
  }
  const site = preferredSiteName(recs[0]);
  const invoiceSite = recs[0].site || 'Sede educativa';
  const address = recs[0].address || 'Sin dirección registrada';
  const periods = [...new Set(recs.map(r=>r.period))].sort();
  const energyRecs=recs.filter(recordHasEnergyReading);
  const hasEnergy=energyRecs.length>0;
  const energyPeriods=[...new Set(energyRecs.map(r=>r.period).filter(Boolean))];
  const energy = energyRecs.reduce((a,r)=>a+(Number(r.energyKwh)||0),0);
  const water = recs.reduce((a,r)=>a+(Number(r.waterM3)||0),0);
  const alc = recs.reduce((a,r)=>a+(Number(r.alcM3)||0),0);
  const gas = recs.reduce((a,r)=>a+(Number(r.gasM3)||0),0);
  const waste = recs.reduce((a,r)=>a+(Number(r.wasteTon)||0),0);
  const co2kg = hasEnergy ? energy * FACTOR_CO2_KG_KWH : null;
  const co2t = hasEnergy ? co2kg / 1000 : null;
  const trees = hasEnergy ? Math.ceil(co2kg / TREE_CO2_KG_YEAR) : null;
  const avgMonth = hasEnergy ? energy / Math.max(1,energyPeriods.length) : null;
  const annualProjection = hasEnergy ? avgMonth * 12 : null;
  const target15 = hasEnergy ? annualProjection * 0.15 : null;
  const target40 = hasEnergy ? annualProjection * 0.40 : null;
  const solar80 = hasEnergy ? annualProjection * 0.80 : null;
  const co2Target15 = hasEnergy ? target15 * FACTOR_CO2_KG_KWH / 1000 : null;
  const co2Target40 = hasEnergy ? target40 * FACTOR_CO2_KG_KWH / 1000 : null;
  const co2Solar80 = hasEnergy ? solar80 * FACTOR_CO2_KG_KWH / 1000 : null;
  const energyException=serviceExceptionForSite(recs[0],'energyKwh');
  const intensity = hasEnergy ? classifyEnergyIntensity(avgMonth) : (energyException?{level:'Energía en contrato separado',short:'Contrato separado',cls:'external',text:energyException.summary||energyException.dataState}:{level:'Energía no identificada',short:'No identificada',cls:'pending',text:'Las facturas cargadas contienen información de la sede, pero no una lectura de energía eléctrica individualizada para este nombre/dirección. Esto no significa consumo cero: debe investigarse si la cuenta está facturada bajo otro nombre, producto, contrato o dirección.'});
  const latest = recs[recs.length-1];
  const generatedAt = new Date().toLocaleDateString('es-CO', {year:'numeric', month:'long', day:'numeric'});

  CURRENT_PLAN_FILENAME = `plan-gestion-${slugify(site)}.html`;
  CURRENT_PLAN_HTML = buildPlanHtml({site,invoiceSite,address,periods,energyPeriods,hasEnergy,energyException,energy,water,alc,gas,waste,co2t,trees,avgMonth,annualProjection,target15,target40,solar80,co2Target15,co2Target40,co2Solar80,intensity,latest,generatedAt,recs});
  if($('planReport')){$('planReport').className='plan-report';$('planReport').innerHTML=CURRENT_PLAN_HTML;}
  if($('printPlanBtn')) $('printPlanBtn').disabled=false;
  if($('downloadPlanBtn')) $('downloadPlanBtn').disabled=false;
  if(window.simecoOpenSection) window.simecoOpenSection('seccion-3', {scroll:false});
  requestAnimationFrame(()=>$('planPanel')?.scrollIntoView({behavior:'smooth',block:'start'}));
  log(`Plan de Gestión generado para ${site}.`);
  return Boolean(CURRENT_PLAN_HTML);
}

function generateSelectedSiteReport(){
  if(!dashboardSiteKey){
    alert('Selecciona primero una institución o sede en el buscador de Informe por sede.');
    $('dashboardSiteSearch')?.focus();
    return;
  }
  const btn=$('generateSelectedReportBtn');
  if(btn){btn.disabled=true;btn.textContent='⏳ Generando…';}
  setTimeout(()=>{
    try{
      const ok=generateManagementPlan(dashboardSiteKey);
      if(!ok) throw new Error('No se encontraron datos suficientes para construir el informe.');
    }catch(err){
      console.error('Error en informe por sede:',err);
      alert(`No fue posible generar el informe. ${err?.message||''}`.trim());
    }finally{
      if(btn){btn.disabled=false;btn.textContent='📄 Generar informe de esta sede';}
    }
  },0);
}

function classifyEnergyIntensity(avgMonth){
  if(avgMonth >= 5000) return {level:'Alta prioridad', short:'Alta', cls:'high', text:'La sede presenta un consumo eléctrico mensual alto. Se recomienda priorizar diagnóstico técnico, medición por circuitos, sustitución LED y evaluación solar fotovoltaica.'};
  if(avgMonth >= 2000) return {level:'Prioridad media', short:'Media', cls:'medium', text:'La sede presenta un consumo eléctrico moderado. Se recomienda fortalecer hábitos de ahorro, optimizar iluminación y controlar horarios de equipos.'};
  return {level:'Prioridad preventiva', short:'Preventiva', cls:'low', text:'La sede presenta un consumo eléctrico bajo o moderado. Se recomienda mantener monitoreo, formación ambiental y acciones preventivas de eficiencia.'};
}


function buildPlanMetricSeries(recs){
  const byPeriod=new Map();
  for(const r of recs||[]){
    const period=String(r.period||'').trim();
    if(!period) continue;
    if(!byPeriod.has(period)){
      byPeriod.set(period,{
        period,energy:0,water:0,alc:0,gas:0,waste:0,
        energyCount:0,waterCount:0,alcCount:0,gasCount:0,wasteCount:0,
        sources:new Set()
      });
    }
    const x=byPeriod.get(period);
    if(recordHasEnergyReading(r)){x.energy+=Number(r.energyKwh)||0;x.energyCount++;}
    if(recordHasReading(r,'waterM3')){x.water+=Number(r.waterM3)||0;x.waterCount++;}
    if(recordHasReading(r,'alcM3')){x.alc+=Number(r.alcM3)||0;x.alcCount++;}
    if(recordHasReading(r,'gasM3')){x.gas+=Number(r.gasM3)||0;x.gasCount++;}
    if(recordHasReading(r,'wasteTon')){x.waste+=Number(r.wasteTon)||0;x.wasteCount++;}
    if(r.source)x.sources.add(r.source);
  }
  return [...byPeriod.values()]
    .map(x=>{
      const hasEnergy=x.energyCount>0;
      return {
        period:x.period,
        hasEnergy,
        energy:hasEnergy?x.energy:null,
        water:x.waterCount?x.water:null,
        alc:x.alcCount?x.alc:null,
        gas:x.gasCount?x.gas:null,
        waste:x.wasteCount?x.waste:null,
        co2:hasEnergy?(x.energy*FACTOR_CO2_KG_KWH)/1000:null,
        trees:hasEnergy?Math.ceil((x.energy*FACTOR_CO2_KG_KWH)/TREE_CO2_KG_YEAR):null,
        source:[...x.sources].join(' · ')||'PDF'
      };
    })
    .sort((a,b)=>a.period.localeCompare(b.period));
}
function shortPlanPeriodLabel(period){
  const m=String(period||'').match(/^(20\d{2})-(0[1-9]|1[0-2])$/);
  if(!m) return String(period||'');
  const months=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${months[Number(m[2])-1]} ${m[1].slice(2)}`;
}

function buildPlanBarChartSvg(rows, cfg={}){
  if(!rows || !rows.length) return `<div class="plan-chart-empty">No hay datos suficientes para graficar ${escapeHtml(cfg.title||'este indicador')}.</div>`;
  const minWidth=cfg.width||980;
  const width=Math.max(minWidth,rows.length*64+120);
  const manyRows=rows.length>12;
  const height=cfg.height||(manyRows?390:350);
  const padL=74,padR=28,padT=34,padB=manyRows?86:68;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const values = rows.map(r => Number(cfg.getValue ? cfg.getValue(r) : r.value) || 0);
  const max = Math.max(...values, 1);
  const step = chartW / rows.length;
  const barW = Math.max(22, Math.min(56, step * 0.52));
  const gradId = cfg.gradId || `grad-${Math.random().toString(36).slice(2,8)}`;
  const fmtValue = cfg.formatValue || ((v)=>fmt(v));
  const fmtLabel = cfg.formatLabel || ((r)=>escapeHtml(String(r.label || r.period || '')));
  const subtitle = cfg.subtitle ? `<p>${escapeHtml(cfg.subtitle)}</p>` : '';

  let grid = '';
  [0, .25, .5, .75, 1].forEach(ratio => {
    const y = padT + chartH - chartH * ratio;
    const value = max * ratio;
    grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${(padL+chartW).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#dcebe6" stroke-width="1" />`;
    grid += `<text x="${padL-10}" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#68817b">${escapeHtml(fmtValue(value))}</text>`;
  });

  let bars = '';
  rows.forEach((row, i) => {
    const value = values[i];
    const h = (value / max) * chartH;
    const x = padL + i * step + (step / 2) - (barW / 2);
    const y = padT + chartH - h;
    const label = fmtLabel(row);
    const valueText = escapeHtml(fmtValue(value));
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(h,2).toFixed(1)}" rx="10" fill="url(#${gradId})" />`;
    bars += `<text x="${(x+barW/2).toFixed(1)}" y="${Math.max(y-8,padT+14).toFixed(1)}" text-anchor="middle" font-size="11.5" font-weight="800" fill="#183c35">${valueText}</text>`;
    const labelX=(x+barW/2).toFixed(1),labelY=(padT+chartH+24).toFixed(1);
    bars += manyRows
      ? `<text x="${labelX}" y="${labelY}" text-anchor="end" font-size="11" font-weight="800" fill="#36524d" transform="rotate(-38 ${labelX} ${labelY})">${label}</text>`
      : `<text x="${labelX}" y="${labelY}" text-anchor="middle" font-size="11.5" font-weight="800" fill="#36524d">${label}</text>`;
  });

  return `
    <section class="plan-chart-card">
      <div class="plan-chart-head">
        <h4>${escapeHtml(cfg.title || 'Gráfico')}</h4>
        ${subtitle}
      </div>
      <div class="plan-chart-wrap">
        <svg class="plan-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(cfg.title || 'Gráfico')}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${cfg.colorA || '#18c6a0'}"></stop>
              <stop offset="100%" stop-color="${cfg.colorB || '#0b9878'}"></stop>
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="#ffffff" />
          ${grid}
          <line x1="${padL}" y1="${padT+chartH}" x2="${padL+chartW}" y2="${padT+chartH}" stroke="#b8d8ce" stroke-width="1.5" />
          ${bars}
        </svg>
      </div>
    </section>`;
}

function buildPlanReductionCharts(d){
  if(!d.hasEnergy) return `<div class="plan-note plan-data-warning"><strong>Escenarios eléctricos pendientes:</strong> no se calculan metas de kWh ni CO₂e porque la sede no tiene una lectura de energía asociada en las facturas cargadas.</div>`;
  const energyRows = [
    {period:'Base', value:d.annualProjection},
    {period:'Meta 15%', value:d.target15},
    {period:'Meta 40%', value:d.target40},
    {period:'Solar 80%', value:d.solar80}
  ];
  const co2Rows = [
    {period:'Meta 15%', value:d.co2Target15},
    {period:'Meta 40%', value:d.co2Target40},
    {period:'Solar 80%', value:d.co2Solar80}
  ];
  return `
    <div class="plan-visual-grid two-col">
      ${buildPlanBarChartSvg(energyRows, {
        title:'Comparación de escenarios de reducción (kWh/año)',
        subtitle:'Compara la línea base anual proyectada frente al potencial de reducción por gestión, eficiencia y energía solar.',
        gradId:'planScenarioEnergy',
        colorA:'#26c6a6', colorB:'#109677',
        getValue:(r)=>r.value,
        formatValue:(v)=>fmt(v),
        formatLabel:(r)=>escapeHtml(shortPlanPeriodLabel(r.period))
      })}
      ${buildPlanBarChartSvg(co2Rows, {
        title:'CO₂e evitado estimado por escenario (t/año)',
        subtitle:'Reducción potencial anual de emisiones indirectas asociadas al consumo eléctrico.',
        gradId:'planScenarioCo2',
        colorA:'#5bbdff', colorB:'#1877cf',
        getValue:(r)=>r.value,
        formatValue:(v)=>fmt(v),
        formatLabel:(r)=>escapeHtml(shortPlanPeriodLabel(r.period))
      })}
    </div>`;
}

function buildPlanMonthlyCharts(d){
  const rows = buildPlanMetricSeries(d.recs);
  const cards = [];
  if(d.hasEnergy){
    cards.push(buildPlanBarChartSvg(rows.filter(r=>r.hasEnergy), {
      title:'Consumo de energía eléctrica por periodo',
      subtitle:`Histórico de consumo facturado en kWh para la sede ${d.site}.`,
      gradId:'planEnergyPeriods', colorA:'#19caa4', colorB:'#0a9978', getValue:(r)=>r.energy, formatValue:(v)=>fmt(v), formatLabel:(r)=>escapeHtml(shortPlanPeriodLabel(r.period))
    }));
  }
  if(rows.some(r=>r.water>0)) cards.push(buildPlanBarChartSvg(rows, {
    title:'Consumo de agua por periodo (m³)', subtitle:'Permite identificar periodos de mayor demanda hídrica y posibles oportunidades de ahorro.', gradId:'planWaterPeriods', colorA:'#8ed0ff', colorB:'#2f84d6', getValue:(r)=>r.water, formatValue:(v)=>fmt(v), formatLabel:(r)=>escapeHtml(shortPlanPeriodLabel(r.period))
  }));
  if(d.hasEnergy){
    cards.push(buildPlanBarChartSvg(rows.filter(r=>r.hasEnergy), {
      title:'Emisiones estimadas de CO₂e por periodo (t)', subtitle:`Calculadas a partir del factor ${fmt(FACTOR_CO2_KG_KWH)} kg CO₂e/kWh.`, gradId:'planCo2Periods', colorA:'#66c2ff', colorB:'#1c77d3', getValue:(r)=>r.co2, formatValue:(v)=>fmt(v), formatLabel:(r)=>escapeHtml(shortPlanPeriodLabel(r.period))
    }));
    cards.push(buildPlanBarChartSvg(rows.filter(r=>r.hasEnergy), {
      title:'Árboles equivalentes requeridos por periodo', subtitle:'Estimación de árboles necesarios para compensar las emisiones asociadas al consumo del periodo.', gradId:'planTreesPeriods', colorA:'#acd95c', colorB:'#5ca61c', getValue:(r)=>r.trees, formatValue:(v)=>fmt(v), formatLabel:(r)=>escapeHtml(shortPlanPeriodLabel(r.period))
    }));
  }
  if(rows.some(r => r.waste > 0)) cards.push(buildPlanBarChartSvg(rows, {
    title:'Residuos / aseo por periodo (t)', subtitle:'Comportamiento mensual del componente de residuos identificado en la factura consolidada.', gradId:'planWastePeriods', colorA:'#ffcf70', colorB:'#d58d12', getValue:(r)=>r.waste, formatValue:(v)=>fmt(v), formatLabel:(r)=>escapeHtml(shortPlanPeriodLabel(r.period))
  }));
  if(!cards.length) return '<div class="plan-chart-empty">No hay indicadores cuantitativos suficientes para generar gráficas de esta sede.</div>';
  return `<div class="plan-visual-grid">${cards.join('')}</div>`;
}

function buildPlanSummaryCards(d){
  const rows = buildPlanMetricSeries(d.recs);
  if(!rows.length) return '';
  const cards=[];
  const energyRows=rows.filter(r=>r.hasEnergy);
  if(energyRows.length){
    const maxEnergy=energyRows.reduce((a,b)=>a.energy>=b.energy?a:b);
    const avgEnergy=energyRows.reduce((sum,r)=>sum+r.energy,0)/energyRows.length;
    const maxCo2=energyRows.reduce((a,b)=>a.co2>=b.co2?a:b);
    cards.push(`<div><span>Periodo de mayor consumo eléctrico</span><strong>${escapeHtml(maxEnergy.period)}</strong><small>${fmt(maxEnergy.energy)} kWh</small></div>`);
    cards.push(`<div><span>Promedio mensual de energía</span><strong>${fmt(avgEnergy)} kWh</strong><small>${energyRows.length} periodo(s) con dato</small></div>`);
    cards.push(`<div><span>Mayor impacto en CO₂e</span><strong>${escapeHtml(maxCo2.period)}</strong><small>${fmt(maxCo2.co2)} t CO₂e</small></div>`);
  }else{
    cards.push(d.energyException?'<div><span>Consumo eléctrico</span><strong>Contrato separado</strong><small>Pendiente de integrar desde la fuente no regulada</small></div>':'<div><span>Consumo eléctrico</span><strong>Sin dato asociado</strong><small>No se interpreta como 0 kWh</small></div>');
  }
  if(rows.some(r=>r.water>0)){
    const maxWater=rows.reduce((a,b)=>a.water>=b.water?a:b);
    cards.push(`<div><span>Periodo de mayor consumo de agua</span><strong>${escapeHtml(maxWater.period)}</strong><small>${fmt(maxWater.water)} m³</small></div>`);
  }
  return `<div class="plan-summary-grid">${cards.join('')}</div>`;
}

function buildPlanInteractiveToolbar(){
  return `<nav class="plan-interactive-toolbar" aria-label="Navegación del informe">
    <div class="plan-interactive-nav">
      <button type="button" data-plan-jump="plan-sec-diagnostico">Diagnóstico</button>
      <button type="button" data-plan-jump="plan-sec-graficas">Gráficas</button>
      <button type="button" data-plan-jump="plan-sec-metas">Metas</button>
      <button type="button" data-plan-jump="plan-sec-acciones">Acciones</button>
      <button type="button" data-plan-jump="plan-sec-indicadores">Indicadores</button>
      <button type="button" data-plan-jump="plan-sec-registros">Registros</button>
    </div>
    <div class="plan-interactive-actions">
      <button type="button" data-plan-toggle="charts">Mostrar/ocultar gráficas</button>
      <button type="button" data-plan-toggle="tables">Mostrar/ocultar tablas</button>
      <button type="button" data-plan-toggle="compact">Vista compacta</button>
    </div>
  </nav>`;
}
function handlePlanInteractiveClick(ev){
  const jump=ev.target.closest('[data-plan-jump]');
  if(jump){
    ev.preventDefault();
    const target=document.getElementById(jump.dataset.planJump);
    target?.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  const toggle=ev.target.closest('[data-plan-toggle]');
  if(!toggle)return;
  ev.preventDefault();
  const report=$('planReport');
  if(!report)return;
  const mode=toggle.dataset.planToggle;
  if(mode==='charts') report.classList.toggle('plan-hide-charts');
  else if(mode==='tables') report.classList.toggle('plan-hide-tables');
  else if(mode==='compact'){
    report.classList.toggle('plan-compact-view');
    toggle.classList.toggle('active',report.classList.contains('plan-compact-view'));
  }
}

function buildPlanHtml(d){
  const periodText = d.periods.length ? `${d.periods[0]} a ${d.periods[d.periods.length-1]} (${d.periods.length} periodo(s) importado(s))` : 'Sin periodo';
  const consolidatedMonths=buildPlanMetricSeries(d.recs);
  const monthlyRows = consolidatedMonths.map(r=>`<tr><td>${escapeHtml(r.period)}</td><td>${r.hasEnergy?`${fmt(r.energy)} kWh`:(d.energyException?'<span class="not-available">Contrato separado</span>':'<span class="not-available">Sin dato</span>')}</td><td>${r.water!=null?`${fmt(r.water)} m³`:'—'}</td><td>${r.alc!=null?`${fmt(r.alc)} m³`:'—'}</td><td>${r.gas!=null?`${fmt(r.gas)} m³`:'—'}</td><td>${r.hasEnergy?`${fmt(r.co2)} t CO₂e`:'No calculable'}</td><td>${r.hasEnergy?fmt(r.trees):'No calculable'}</td><td>${r.waste!=null?`${fmt(r.waste)} t`:'—'}</td><td>${escapeHtml(r.source||'PDF')}</td></tr>`).join('');
  const summaryCards = buildPlanSummaryCards(d);
  const monthlyCharts = buildPlanMonthlyCharts(d);
  const reductionCharts = buildPlanReductionCharts(d);
  const energyStatusNote=d.hasEnergy?'':(d.energyException?`<p class="plan-note plan-data-warning external-contract-note"><strong>Energía en contrato separado:</strong> ${escapeHtml(d.energyException.summary||d.energyException.dataState)} El consumo eléctrico queda pendiente de integrar desde esa fuente y no se interpreta como 0 kWh.</p>`:`<p class="plan-note plan-data-warning"><strong>Energía no identificada en la factura consolidada:</strong> la sede aparece en ${d.periods.length} periodo(s), pero ninguno incluye una lectura eléctrica individualizada para este nombre/dirección. Esto no implica consumo cero. El sistema conserva los datos de agua, alcantarillado, gas y aseo que sí existan y evita interpretar la ausencia como 0 kWh.</p>`);
  const energyGoals=d.hasEnergy?`<table class="plan-table"><thead><tr><th>Horizonte</th><th>Meta</th><th>Reducción estimada</th><th>CO₂e evitado estimado</th></tr></thead><tbody><tr><td>Corto plazo · 1 año</td><td>Reducir 15% del consumo mediante hábitos, control operativo, sensores y LED.</td><td>${fmt(d.target15)} kWh/año</td><td>${fmt(d.co2Target15)} t CO₂e/año</td></tr><tr><td>Mediano plazo · 3 años</td><td>Reducir 40% mediante eficiencia energética integral y gestión sistemática.</td><td>${fmt(d.target40)} kWh/año</td><td>${fmt(d.co2Target40)} t CO₂e/año</td></tr><tr><td>Escenario solar</td><td>Reducir hasta 80% de compra a la red, sujeto a cubierta disponible, radiación y dimensionamiento.</td><td>${fmt(d.solar80)} kWh/año</td><td>${fmt(d.co2Solar80)} t CO₂e/año</td></tr></tbody></table>`:(d.energyException?`<table class="plan-table"><thead><tr><th>Prioridad</th><th>Acción requerida</th><th>Resultado esperado</th></tr></thead><tbody><tr><td>1 · Integración contractual</td><td>Obtener la facturación o medición mensual del contrato de energía para usuario no regulado correspondiente a la sede.</td><td>Incorporar una serie kWh verificable sin mezclarla con el consolidado educativo.</td></tr><tr><td>2 · Trazabilidad</td><td>Registrar contrato, producto/medidor, periodo y documento fuente para cada lectura.</td><td>Mantener evidencia auditable de la energía.</td></tr><tr><td>3 · Línea base</td><td>Calcular CO₂e y metas de reducción solo después de integrar lecturas eléctricas verificadas.</td><td>Evitar estimaciones basadas en ausencia de datos.</td></tr></tbody></table>`:`<table class="plan-table"><thead><tr><th>Prioridad</th><th>Acción requerida</th><th>Resultado esperado</th></tr></thead><tbody><tr><td>1 · Identificación</td><td>Localizar la cuenta, contrato o medidor de energía que corresponde a la sede y verificar si está facturado bajo otro nombre o dirección.</td><td>Vincular correctamente la fuente eléctrica.</td></tr><tr><td>2 · Asociación</td><td>Actualizar la equivalencia institucional en SiMeCO₂ sin modificar los valores originales de la factura.</td><td>Contar con una serie mensual trazable.</td></tr><tr><td>3 · Línea base</td><td>Acumular al menos tres periodos de energía antes de fijar porcentajes de reducción.</td><td>Evitar metas basadas en datos incompletos.</td></tr></tbody></table>`);
  const commitmentText=d.hasEnergy?`La sede educativa <strong>${escapeHtml(d.site)}</strong> se compromete a promover una gestión responsable de la energía eléctrica, asignando capacidades humanas, pedagógicas y técnicas para reducir progresivamente su huella de carbono y fortalecer una cultura ambiental escolar.`:(d.energyException?`La sede educativa <strong>${escapeHtml(d.site)}</strong> se compromete a integrar con trazabilidad la información eléctrica proveniente de su contratación separada como usuario no regulado y a mantener acciones preventivas de eficiencia mientras se construye una línea base verificable.`:`La sede educativa <strong>${escapeHtml(d.site)}</strong> se compromete a fortalecer la calidad y trazabilidad de sus datos de servicios públicos, identificar la cuenta eléctrica correspondiente y mantener acciones preventivas de uso eficiente mientras se construye una línea base energética confiable.`);
  const objectiveText=d.hasEnergy?`Reducir la huella de carbono en alcance 2 de la sede <strong>${escapeHtml(d.site)}</strong> mediante estrategias de eficiencia energética, monitoreo del consumo, educación ambiental y evaluación de soluciones solares fotovoltaicas.`:(d.energyException?`Integrar la serie mensual de consumo eléctrico de la fuente contractual separada de <strong>${escapeHtml(d.site)}</strong>, conservar el seguimiento de los demás servicios y establecer una línea base energética auditable antes de calcular emisiones de alcance 2 o metas porcentuales de reducción.`:`Completar la identificación y asociación del consumo eléctrico de la sede <strong>${escapeHtml(d.site)}</strong>, conservar el seguimiento de agua y residuos disponible y establecer una línea base energética verificable antes de calcular emisiones de alcance 2 o metas porcentuales de reducción.`);
  const indicatorsRows=d.hasEnergy?`<tr><td>Consumo eléctrico mensual</td><td>kWh facturados por mes</td><td>Mensual</td><td>Disminución progresiva</td></tr><tr><td>Emisiones alcance 2</td><td>kWh × ${fmt(FACTOR_CO2_KG_KWH)} kg CO₂e/kWh</td><td>Mensual</td><td>Reducir 15% en un año</td></tr><tr><td>Árboles equivalentes</td><td>kg CO₂e ÷ ${fmt(TREE_CO2_KG_YEAR)} kg/árbol/año</td><td>Semestral</td><td>Disminuir necesidad de compensación</td></tr>`:`<tr><td>Cobertura del dato eléctrico</td><td>Periodos con kWh asociados ÷ periodos de factura × 100</td><td>Mensual</td><td>Alcanzar 100% antes de calcular la huella de alcance 2</td></tr><tr><td>Consumo de agua</td><td>m³ facturados por mes</td><td>Mensual</td><td>Mantener seguimiento y detectar variaciones atípicas</td></tr><tr><td>Trazabilidad documental</td><td>Facturas con fuente y página identificada ÷ facturas revisadas × 100</td><td>Mensual</td><td>100%</td></tr>`;
  return `
    <article class="plan-document">
      ${buildPlanInteractiveToolbar()}
      <div class="plan-cover">
        <div>
          <p class="plan-code">Código: GEI-R-001 · Plan de Reducciones 2025</p>
          <h2>Plan de Gestión de Reducción de GEI</h2>
          <h3>${escapeHtml(d.site)}</h3>
          <p>${mapAddressLink(d.address,d.address||'Sin dirección',d.site)}</p>${d.invoiceSite&&d.invoiceSite!==d.site?`<p class="plan-invoice-alias">Nombre en factura: ${escapeHtml(d.invoiceSite)}</p>`:''}
        </div>
        <div class="plan-badge ${d.intensity.cls}">${escapeHtml(d.intensity.level)}</div>
      </div>

      <div class="plan-meta-grid">
        <div><span>Elaborado por</span><strong>Juan Carlos Blandón Vargas · Los Yoguis</strong></div>
        <div><span>Aprobación técnica sugerida</span><strong>GSV Ingeniería</strong></div>
        <div><span>Fecha de generación</span><strong>${escapeHtml(d.generatedAt)}</strong></div>
        <div><span>Periodo analizado</span><strong>${escapeHtml(periodText)}</strong></div>
      </div>

      <h3 id="plan-sec-diagnostico" class="plan-section-anchor">1. Diagnóstico energético y ambiental</h3>
      <p>Este informe personalizado toma como base los registros importados desde las facturas EPM procesadas por SiMeCO₂. Conserva los servicios que sí aparecen asociados a la sede y diferencia explícitamente un dato ausente de un consumo igual a cero.</p>${energyStatusNote}
      <div class="plan-kpi-grid">
        <div><span>Energía acumulada</span><strong>${d.hasEnergy?`${fmt(d.energy)} kWh`:(d.energyException?'Contrato separado':'Sin dato')}</strong></div>
        <div><span>Promedio mensual</span><strong>${d.hasEnergy?`${fmt(d.avgMonth)} kWh/mes`:'No calculable'}</strong></div>
        <div><span>Proyección anual</span><strong>${d.hasEnergy?`${fmt(d.annualProjection)} kWh/año`:'No calculable'}</strong></div>
        <div><span>CO₂e estimado</span><strong>${d.hasEnergy?`${fmt(d.co2t)} t CO₂e`:'No calculable'}</strong></div>
        <div><span>Árboles equivalentes</span><strong>${d.hasEnergy?`${fmt(d.trees)} árboles/año`:'No calculable'}</strong></div>
        <div><span>Agua registrada</span><strong>${fmt(d.water)} m³</strong></div>
        <div><span>Alcantarillado</span><strong>${fmt(d.alc)} m³</strong></div>
        <div><span>Gas registrado</span><strong>${d.gas?`${fmt(d.gas)} m³`:'Sin dato'}</strong></div>
        <div><span>Residuos / aseo</span><strong>${d.waste?`${fmt(d.waste)} t`:'Sin dato'}</strong></div>
      </div>
      <p class="plan-note"><strong>Lectura técnica:</strong> ${escapeHtml(d.intensity.text)}</p>
      <h3 id="plan-sec-graficas" class="plan-section-anchor">1.1 Panel gráfico del diagnóstico</h3>
      <p>Las siguientes gráficas presentan los principales indicadores medibles y comparables de la sede: energía, agua, CO₂e, árboles equivalentes y, cuando aplica, residuos/aseo. <strong>Cada barra representa un único periodo mensual consolidado</strong>, incluso cuando la factura contiene más de un registro asociado a la sede. Estas visualizaciones también quedan integradas en el informe generado para consulta, impresión o descarga.</p>
      ${summaryCards}
      ${monthlyCharts}

      <h3>2. Declaración de compromiso institucional</h3>
      <p>${commitmentText}</p>

      <h3>3. Objetivo general</h3>
      <p>${objectiveText}</p>

      <h3 id="plan-sec-metas" class="plan-section-anchor">4. Metas y acciones sugeridas</h3>
      ${energyGoals}
      ${reductionCharts}

      <h3 id="plan-sec-acciones" class="plan-section-anchor">5. Acciones recomendadas de gestión y eficiencia</h3>
      <div class="actions-grid">
        ${d.hasEnergy?'':(d.energyException?`<div><strong>Integrar la fuente eléctrica separada</strong><p>Solicitar la facturación o medición del contrato de usuario no regulado y vincularla a la sede con trazabilidad documental.</p></div>`:`<div><strong>Asociar la cuenta eléctrica</strong><p>Verificar contrato, medidor, nombre facturado y dirección para identificar dónde aparece el consumo de energía de esta sede.</p></div>`)}
        <div><strong>Diagnóstico y línea base</strong><p>${d.hasEnergy?'Revisar facturas mensuales, validar medidores, construir tendencia kWh/mes y detectar meses atípicos.':'Conservar los servicios ya identificados y construir la tendencia eléctrica únicamente cuando existan lecturas verificadas.'}</p></div>
        <div><strong>Iluminación eficiente</strong><p>Sustituir luminarias fluorescentes o incandescentes por LED y priorizar zonas de mayor permanencia.</p></div>
        <div><strong>Sensores y control horario</strong><p>Instalar sensores de movimiento en baños, corredores, oficinas y espacios de uso intermitente.</p></div>
        <div><strong>Gestión de computadores</strong><p>Activar suspensión automática, apagar equipos al finalizar jornada y renovar gradualmente equipos ineficientes.</p></div>
        <div><strong>Monitoreo energético</strong><p>Implementar lectura mensual y, si es posible, medidores inteligentes para seguimiento por bloques o circuitos.</p></div>
        <div><strong>Energía solar fotovoltaica</strong><p>Realizar prefactibilidad técnica para autoconsumo solar, estimando potencia requerida y retorno ambiental.</p></div>
      </div>

      <h3>5.1 Matriz operativa de intervención</h3>
      <table class="plan-table compact">
        <thead><tr><th>Acción</th><th>Responsable sugerido</th><th>Tiempo</th><th>Indicador</th><th>Evidencia</th></tr></thead>
        <tbody>
          <tr><td>Inventario de luminarias y equipos</td><td>Comité ambiental escolar / servicios generales</td><td>Primer mes</td><td>% de espacios caracterizados</td><td>Formato de inventario y fotografías</td></tr>
          <tr><td>Campaña de apagado y uso eficiente</td><td>Docentes líderes y Guardianes Climáticos</td><td>Mensual</td><td>Número de grupos participantes</td><td>Actas, piezas gráficas y registro fotográfico</td></tr>
          <tr><td>Sustitución progresiva a tecnología LED</td><td>Rectoría / infraestructura / aliado técnico</td><td>3 a 6 meses</td><td>kWh reducidos frente a línea base</td><td>Cotizaciones, facturas e informe de instalación</td></tr>
          <tr><td>Evaluación de sistema solar FV</td><td>Aliado técnico especializado</td><td>6 meses</td><td>Potencia estimada y % de cobertura</td><td>Informe de prefactibilidad</td></tr>
        </tbody>
      </table>

      <h3>6. Cronograma operativo sugerido</h3>
      <table class="plan-table compact">
        <thead><tr><th>Fase</th><th>Actividad</th><th>Meses sugeridos</th><th>Evidencia</th></tr></thead>
        <tbody>
          <tr><td>Fase 1</td><td>Diagnóstico y línea base de consumo eléctrico.</td><td>Enero · Febrero · Marzo</td><td>Facturas, matriz kWh, reporte SiMeCO₂.</td></tr>
          <tr><td>Fase 2</td><td>Diseño de estrategias LED, sensores, control de equipos y cultura energética.</td><td>Marzo · Abril · Mayo · Junio</td><td>Plan de intervención, cotizaciones, actas.</td></tr>
          <tr><td>Fase 3</td><td>Implementación de acciones de eficiencia y capacitación.</td><td>Julio · Agosto · Septiembre</td><td>Fotos, asistencia, registros de instalación.</td></tr>
          <tr><td>Fase 4</td><td>Seguimiento, comparación de consumos y ajuste de estrategias.</td><td>Octubre · Noviembre · Diciembre</td><td>Informe final, dashboard, indicadores.</td></tr>
        </tbody>
      </table>

      <h3 id="plan-sec-indicadores" class="plan-section-anchor">7. Indicadores de seguimiento</h3>
      <table class="plan-table compact">
        <thead><tr><th>Indicador</th><th>Fórmula</th><th>Frecuencia</th><th>Meta</th></tr></thead>
        <tbody>
          ${indicatorsRows}
          <tr><td>Cultura ambiental y energética</td><td>Personas capacitadas ÷ población objetivo × 100</td><td>Semestral</td><td>Capacitar mínimo 80%</td></tr>
        </tbody>
      </table>

      <h3 id="plan-sec-registros" class="plan-section-anchor">8. Registros mensuales usados por el plan</h3>
      <p>La siguiente tabla resume los datos importados que soportan el diagnóstico y las comparaciones del plan de gestión. Se incluyen los principales indicadores mensuales medibles para la sede.</p>
      <table class="plan-table compact">
        <thead><tr><th>Periodo</th><th>Energía</th><th>Agua</th><th>Alc.</th><th>Gas</th><th>CO₂e</th><th>Árboles</th><th>Residuos</th><th>Fuente</th></tr></thead>
        <tbody>${monthlyRows}</tbody>
      </table>

      <h3>9. Responsable y seguimiento</h3>
      <p><strong>Responsable sugerido:</strong> líder ambiental de la sede, comité escolar ambiental, directivos docentes y equipo de apoyo técnico. <strong>Frecuencia:</strong> mensual para carga de facturas, semestral para revisión del plan y anual para informe de resultados.</p>
    </article>`;
}

function collectEmbeddedStyles(){
  const chunks=[];
  [...document.styleSheets].forEach(sheet=>{
    try{ chunks.push([...sheet.cssRules].map(rule=>rule.cssText).join('\n')); }catch(_err){}
  });
  return chunks.join('\n');
}
function downloadCurrentPlan(){
  if(!CURRENT_PLAN_HTML){alert('Primero genera el informe de una sede.');return;}
  const styles=collectEmbeddedStyles();
  const interactiveScript=`<script>
  document.addEventListener('click',function(ev){
    var jump=ev.target.closest('[data-plan-jump]');
    if(jump){ev.preventDefault();var target=document.getElementById(jump.getAttribute('data-plan-jump'));if(target)target.scrollIntoView({behavior:'smooth',block:'start'});return;}
    var toggle=ev.target.closest('[data-plan-toggle]');if(!toggle)return;
    var report=document.querySelector('.plan-document');if(!report)return;
    var mode=toggle.getAttribute('data-plan-toggle');
    if(mode==='charts')report.classList.toggle('plan-hide-charts');
    else if(mode==='tables')report.classList.toggle('plan-hide-tables');
    else if(mode==='compact'){report.classList.toggle('plan-compact-view');toggle.classList.toggle('active',report.classList.contains('plan-compact-view'));}
  });
  <\/script>`;
  const documentHtml=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Plan de Gestión Ambiental - SiMeCO₂</title><style>${styles}</style></head><body><main style="max-width:1200px;margin:24px auto;padding:0 16px">${CURRENT_PLAN_HTML}</main>${interactiveScript}</body></html>`;
  downloadBlob(documentHtml,CURRENT_PLAN_FILENAME,'text/html;charset=utf-8');
  log(`Informe HTML descargado: ${CURRENT_PLAN_FILENAME}.`);
}

function printCurrentPlan(){
  if(!CURRENT_PLAN_HTML){ alert('Primero genera el informe de una sede.'); return; }
  const btn = $('printPlanBtn');
  if(btn){ btn.disabled=true; btn.textContent='Preparando informe…'; }
  setTimeout(()=>{
    try{
      openPdfPrintDocument('Plan de Gestión Ambiental por sede','Informe institucional de eficiencia energética y reducción de emisiones',CURRENT_PLAN_HTML);
    }catch(err){
      console.error(err);
      alert('No fue posible preparar el informe. Recarga la página e inténtalo nuevamente.');
    }finally{
      if(btn){ btn.disabled=false; btn.textContent='Descargar informe PDF'; }
    }
  },40);
}


/* SiMeCO2 Servicios Públicos - v52 progreso real de carga y experiencia móvil */
let FACTOR_CO2_KG_KWH = 0.126; // kg CO2e/kWh. Ajustable desde el dashboard.
let TREE_CO2_KG_YEAR = 22; // kg CO2e capturados por árbol al año. Ajustable desde el dashboard.
const FACTOR_KEY = 'simeco2_factores_ambientales_v8';
const STORE_KEY = 'simeco2_servicios_v7';
const CONFIG_KEY = 'simeco2_repo_config_v7';

const $ = (id)=>document.getElementById(id);
const state = loadStore();
let chartData = [];
let selectedSiteKey = "";
let autocompleteIndex = -1;
let isScanningData = false;
let dashboardSiteKey = "";
const siteAutocompleteState = new Map();
const territoryMetaCache = new WeakMap();
let saveTimer = 0;
let filterTimer = 0;
let renderFrame = 0;
const RANKING_PAGE_SIZE = 10;
let rankingPage = 0;
let rankingRowsCache = [];
let rankingPeriod = "";
let rankingPriority = "";
let rankingSelectedKey = "";
let rankingAutocompleteIndex = -1;

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
function territoryMeta(record){
  if(record && typeof record === 'object' && territoryMetaCache.has(record)) return territoryMetaCache.get(record);
  const hay=loose(`${record?.site||''} ${record?.address||''}`);
  const exact=TERRITORY_CATALOG.find(x=>x.match.some(m=>hay.includes(loose(m))));
  let result;
  if(exact) result={...exact};
  else {
    for(const [needle,name] of CORREGIMIENTO_RULES){
      if(hay.includes(loose(needle))){ result={type:'Corregimiento',territory:name,nucleus:'Sin clasificar'}; break; }
    }
    if(!result){
      const comuna=hay.match(/(?:comuna|c)\s*0?([1-9]|1[0-6])\b/);
      result=comuna ? {type:'Comuna',territory:`Comuna ${Number(comuna[1])}`,nucleus:'Sin clasificar'} : {type:'Sin clasificar',territory:'Sin clasificar',nucleus:'Sin clasificar'};
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
  const baseTerritories = type==='Comuna' ? Array.from({length:16},(_,i)=>`Comuna ${i+1}`) : type==='Corregimiento' ? ['Altavista','San Antonio de Prado','San Cristóbal','San Sebastián de Palmitas','Santa Elena'] : [];
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

window.addEventListener('DOMContentLoaded', () => {
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
      log(`Datos cargados desde memoria local: ${state.records.length} registros.`);
      setInvoiceLoading(false, 'Datos listos. Verificando facturas nuevas...');
      setTimeout(() => scanDataFolder({automatic:true, quiet:true}), 900);
    }else{
      log('Espere, cargando facturas...');
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
  input.addEventListener('input',render);
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


function initSiteAutocompleteField(config){
  const input=$(config.inputId), list=$(config.listId), clear=$(config.clearId);
  if(!input || !list || !clear) return;
  const stateItem={...config,input,list,clear,index:-1};
  siteAutocompleteState.set(config.inputId,stateItem);
  input.addEventListener('input',()=>{
    stateItem.index=-1;
    clear.classList.toggle('visible',Boolean(input.value));
    if(config.mode==='compare'){
      $('compareSite').value='';
      renderCompareControls({keepSite:true});
      comparePeriods();
    }else{
      dashboardSiteKey='';
      renderDashboard();
    }
    renderSiteAutocomplete(stateItem,input.value);
  });
  input.addEventListener('focus',()=>renderSiteAutocomplete(stateItem,input.value));
  input.addEventListener('keydown',e=>handleSiteFieldKeydown(e,stateItem));
  list.addEventListener('mousedown',e=>{
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
    item.list.innerHTML=options.map(x=>`<button type="button" class="autocomplete-option" role="option" data-key="${escapeHtml(x.key)}"><span><strong>${highlightMatch(x.site,q)}</strong><small>${highlightMatch(x.address||'Sin dirección registrada',q)} · ${escapeHtml(x.meta?.territory||'Sin clasificar')} · Núcleo ${escapeHtml(x.meta?.nucleus||'Sin clasificar')}</small></span><em>${x.periodCount} periodo${x.periodCount===1?'':'s'}</em></button>`).join('');
  }
  item.list.hidden=false;
  item.input.setAttribute('aria-expanded','true');
}
function chooseSiteFieldSuggestion(item,key){
  const option=siteSearchOptions(item.mode==='compare'?'compare':'dashboard').find(x=>x.key===key);
  if(!option) return;
  item.input.value=option.site;
  item.clear.classList.add('visible');
  if(item.mode==='compare'){
    $('compareSite').value=key;
    renderCompareControls({keepSite:true});
    comparePeriods();
  }else{
    dashboardSiteKey=key;
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

function initPdfJs(){
  const pdfStatus = $('pdfStatus');
  if(window.pdfjsLib){
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    if(pdfStatus) pdfStatus.textContent = 'PDF.js activo';
  } else if(pdfStatus) {
    pdfStatus.textContent = 'PDF.js no cargó';
    pdfStatus.classList.add('bad');
  }
}
function bindEvents(){
  $("scanDataBtn").addEventListener("click", scanDataFolder);
  document.querySelectorAll('.mobile-section-tab[data-action="actualizar"]').forEach(button=>{
    button.addEventListener('click',()=>scanDataFolder());
  });
  $("localPdfInput").addEventListener("change", handleLocalPdf);
  $("clearBtn").addEventListener("click", ()=>{ if(confirm("¿Reiniciar todos los datos importados?")){ localStorage.removeItem(STORE_KEY); location.reload(); }});
  if($("saveRepoBtn")) $("saveRepoBtn").addEventListener("click", saveConfig);
  if($("updateFactorsBtn")) $("updateFactorsBtn").addEventListener("click", updateFactors);
  ["periodFilter","serviceFilter","sortFilter"].forEach(id=>$(id).addEventListener("change", applyFilters));
  $("siteSearch").addEventListener("input", handleSiteSearchInput);
  $("siteSearch").addEventListener("keydown", handleAutocompleteKeydown);
  $("siteSearch").addEventListener("focus", ()=>renderAutocompleteSuggestions($("siteSearch").value));
  $("clearSearchBtn").addEventListener("click", clearSiteSearch);
  $("clearFiltersBtn").addEventListener("click", clearAllFilters);
  $("siteSuggestions").addEventListener("mousedown", handleSuggestionClick);
  document.addEventListener("click", e=>{ if(!$("siteAutocomplete").contains(e.target)) closeAutocomplete(); });
  if($("downloadFilteredPdfBtn")) $("downloadFilteredPdfBtn").addEventListener("click", downloadFilteredPdfReport);
  if($("downloadHistoryPdfBtn")) $("downloadHistoryPdfBtn").addEventListener("click", downloadHistoryPdfReport);
  if($("compareMode")) $("compareMode").addEventListener("change", ()=>{ renderCompareControls(); comparePeriods(); });
  if($("compareSite")) $("compareSite").addEventListener("change", ()=>{ renderCompareControls({keepSite:true}); comparePeriods(); });
  initSiteAutocompleteField({inputId:'compareSiteSearch',listId:'compareSiteSuggestions',clearId:'clearCompareSiteBtn',mode:'compare'});
  initSiteAutocompleteField({inputId:'dashboardSiteSearch',listId:'dashboardSiteSuggestions',clearId:'clearDashboardSiteBtn',mode:'dashboard'});
  $("compareBtn").addEventListener("click", comparePeriods);
  if($("printPlanBtn")) $("printPlanBtn").addEventListener("click", printCurrentPlan);
  if($("environmentBody")) $("environmentBody").addEventListener("click", handlePlanButtonClick);
  $("refreshRankingBtn")?.addEventListener("click", refreshFullRanking);
  $("rankingPeriodFilter")?.addEventListener("change", ()=>{ rankingPeriod=$("rankingPeriodFilter").value||""; rankingSelectedKey=""; rankingPage=0; renderRanking(); });
  $("rankingPriorityFilters")?.addEventListener("click", handleRankingPriorityClick);
  $("rankingSiteSearch")?.addEventListener("input", handleRankingSearchInput);
  $("rankingSiteSearch")?.addEventListener("focus", ()=>renderRankingSuggestions($("rankingSiteSearch").value));
  $("rankingSiteSearch")?.addEventListener("keydown", handleRankingSearchKeydown);
  $("rankingSiteSuggestions")?.addEventListener("mousedown", handleRankingSuggestionClick);
  $("clearRankingSearchBtn")?.addEventListener("click", clearRankingSearch);
  document.addEventListener("click", e=>{ const box=$("rankingSiteAutocomplete"); if(box && !box.contains(e.target)) closeRankingSuggestions(); });
  $("rankingFirstBtn")?.addEventListener("click", ()=>setRankingPage(0));
  $("rankingPrevBtn")?.addEventListener("click", ()=>setRankingPage(rankingPage-1));
  $("rankingNextBtn")?.addEventListener("click", ()=>setRankingPage(rankingPage+1));
  $("rankingLastBtn")?.addEventListener("click", ()=>setRankingPage(Math.max(0,Math.ceil(rankingRowsCache.length/RANKING_PAGE_SIZE)-1)));
  document.addEventListener("click", handlePlanButtonClick);
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
function loadStore(){
  try{ return JSON.parse(localStorage.getItem(STORE_KEY)) || {records:[], files:{}, sites:{}}; }
  catch{ return {records:[], files:{}, sites:{}}; }
}
function saveStore(immediate=false){
  clearTimeout(saveTimer);
  const persist=()=>{ try{ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }catch(err){ console.warn('No fue posible guardar la caché local:',err); } };
  if(immediate) persist(); else saveTimer=setTimeout(persist,120);
}
function scheduleRenderAll(){
  if(renderFrame) cancelAnimationFrame(renderFrame);
  renderFrame=requestAnimationFrame(()=>{ renderFrame=0; renderAll(); });
}
function log(msg){
  const t = new Date().toLocaleTimeString();
  $('logBox').textContent += `[${t}] ${msg}\n`;
  $('logBox').scrollTop = $('logBox').scrollHeight;
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
    if(state.files[fingerprint]) skipped++;
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
  const existingKeys = new Set(state.records.map(r=>r.key));
  for(const r of result.records){
    if(!existingKeys.has(r.key)) state.records.push(r);
    if(r.site) state.sites[siteKey(r.site,r.address)] = {site:r.site,address:r.address};
  }
  state.files[fingerprint] = {name:result.fileName, period:result.period, importedAt:new Date().toISOString(), count:result.records.length};
}

async function parsePdfArrayBuffer(arrayBuffer, fileName, sourceUrl, onProgress=null){
  if(!window.pdfjsLib) throw new Error('PDF.js no está cargado.');
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
  // Si no estructura bloques, por lo menos importa resumen consolidado página 1.
  if(!records.length && (summary.energyKwh || summary.waterM3 || summary.alcM3 || summary.gasM3)){
    records.push({
      key:`${period}|RESUMEN CONSOLIDADO|${fileName}`,
      period, site:'RESUMEN CONSOLIDADO MUNICIPIO DE MEDELLÍN - EDUCACIÓN', address:'Contrato 1538220',
      waterM3:summary.waterM3, alcM3:summary.alcM3, energyKwh:summary.energyKwh, gasM3:summary.gasM3,
      waterValue:summary.waterValue, alcValue:summary.alcValue, energyValue:summary.energyValue, gasValue:summary.gasValue,
      wasteValue:summary.wasteValue, wasteTon:null, co2kg:round((summary.energyKwh||0)*FACTOR_CO2_KG_KWH,2),
      source:fileName, page:1, sourceUrl, type:'resumen'
    });
  }
  return {fileName, period, records, numPages:pdf.numPages, sample:allText.slice(0,3000)};
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
      if(current.lines.length>120){ blocks.push(current); current=null; }
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
function extractServiceConsumption(text, service){
  const lower = loose(text);
  let start = 0;
  if(service==='agua') start = Math.max(0, lower.indexOf('total agua')-900);
  if(service==='alcantarillado') start = Math.max(0, lower.indexOf('total alcantarillado')-900);
  if(service==='gas') start = Math.max(0, lower.indexOf('total gas')-900);
  const fragment = text.slice(start, start+1100);
  const m = fragment.match(/Lectura actual[\s\S]{0,150}?([\d.,]+)\s*m(?:t3|3|³)/i) || fragment.match(/Consumo\s+\w+-\d{2}\s+([\d.,]+)\s*x/i);
  return m ? parseNumber(m[1]) : null;
}
function extractBeforeTotal(text,totalLabel,unit){
  const idx = loose(text).indexOf(loose(totalLabel));
  if(idx<0) return null;
  const fragment = text.slice(Math.max(0,idx-800), idx+80);
  const matches = [...fragment.matchAll(new RegExp('([\\d.,]+)\\s*m(?:t3|3|³)','gi'))];
  if(matches.length) return parseNumber(matches[matches.length-1][1]);
  return null;
}
function extractEnergyKwh(text){
  const matches = [...text.matchAll(/([\d.,]+)\s*kWh/gi)].map(m=>parseNumber(m[1])).filter(n=>Number.isFinite(n));
  if(!matches.length) return null;
  // En el bloque los kWh principales suelen estar junto a Lectura actual. Evitar valores de histórico muy altos si aparecen.
  return matches[0];
}
function extractWasteTon(text){
  const m = text.match(/No Aprov-Ordinarios\s+([\d.,]+)/i) || text.match(/No aprovechables\s+([\d.,]+)/i);
  return m ? parseNumber(m[1]) : null;
}
function valueAfter(text,label){
  const idx = loose(text).indexOf(loose(label));
  if(idx<0) return null;
  const fragment = text.slice(idx, idx+220);
  const m = fragment.match(/\$\s*-?\s*([\d.,]+)/);
  return m ? parseMoney(m[1]) : null;
}
function extractAfter(text,re){ const m = text.match(re); return m ? parseNumber(m[1]) : null; }
function parseNumber(v){
  if(v==null) return null;
  let s=String(v).trim().replace(/\s/g,'').replace(/[^0-9,.-]/g,'');
  if(!s) return null;
  const negative=s.startsWith('-');
  s=s.replace(/-/g,'');
  const commas=(s.match(/,/g)||[]).length;
  const dots=(s.match(/\./g)||[]).length;

  if(commas && dots){
    // En las facturas colombianas el último separador suele ser el decimal.
    if(s.lastIndexOf(',')>s.lastIndexOf('.')) s=s.replace(/\./g,'').replace(',','.');
    else s=s.replace(/,/g,'');
  }else if(dots){
    const parts=s.split('.');
    const looksThousands=parts.length>2 || (parts.length===2 && parts[1].length===3 && parts[0]!=='0');
    if(looksThousands) s=parts.join('');
  }else if(commas){
    const parts=s.split(',');
    const looksThousands=parts.length>2 || (parts.length===2 && parts[1].length===3 && parts[0]!=='0');
    s=looksThousands ? parts.join('') : parts.join('.');
  }

  const n=parseFloat((negative?'-':'')+s);
  return Number.isFinite(n)?n:null;
}
function parseMoney(v){ return parseNumber(v); }
function round(n,d=2){ return Number.isFinite(n) ? Math.round(n*Math.pow(10,d))/Math.pow(10,d) : 0; }
function hasAnyMeasure(r){ return [r.waterM3,r.alcM3,r.energyKwh,r.gasM3,r.wasteValue,r.wasteTon].some(v=>v!==null && v!==undefined && v!==0); }
function siteKey(site,address=''){ return `${loose(site)}|${loose(address)}`; }

function searchTokens(value){ return loose(value).split(/\s+/).filter(Boolean); }
function recordMatchesSearch(r, query){
  if(selectedSiteKey) return siteKey(r.site,r.address)===selectedSiteKey;
  const tokens = searchTokens(query);
  if(!tokens.length) return true;
  const haystack = loose(`${r.site||''} ${r.address||''}`);
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
  const q = $('siteSearch').value||'';
  const p = $('periodFilter').value;
  const service = $('serviceFilter').value;
  return sortRecords(state.records.filter(r=>recordMatchesTerritory(r,territoryFilterValues('table')) && recordMatchesSearch(r,q) && (!p || r.period===p) && serviceHasValue(r,service)));
}
function applyFilters(immediate=false){
  clearTimeout(filterTimer);
  const run=()=>{ renderTable(); renderDashboard(); renderFilterSummary(); syncAllSearchableSelects(); };
  if(immediate) run(); else filterTimer=setTimeout(run,90);
}
function clearSiteSearch(){
  $('siteSearch').value=''; selectedSiteKey=''; $('clearSearchBtn').classList.remove('visible'); closeAutocomplete(); applyFilters(); $('siteSearch').focus();
}
function clearAllFilters(){
  $('siteSearch').value=''; selectedSiteKey=''; ['territoryTypeFilter','territoryFilter','nucleusFilter'].forEach(id=>{if($(id)) $(id).value='';}); updateTerritoryCascade('table'); $('periodFilter').value=''; $('serviceFilter').value=''; $('sortFilter').value='period-desc'; $('clearSearchBtn').classList.remove('visible'); closeAutocomplete(); applyFilters();
}
function handleSiteSearchInput(){
  selectedSiteKey=''; $('clearSearchBtn').classList.toggle('visible',Boolean($('siteSearch').value)); renderAutocompleteSuggestions($('siteSearch').value); applyFilters();
}
function siteSearchOptions(scope='all'){
  const map = new Map();
  const records = scope==='compare' ? territoryScopedRecords('compare') : scope==='dashboard' ? territoryScopedRecords('dashboard') : scope==='table' ? territoryScopedRecords('table') : state.records;
  for(const r of records){ const key=siteKey(r.site,r.address); if(!map.has(key)) map.set(key,{key,site:r.site||'Sin nombre',address:r.address||'',periods:new Set(),meta:territoryMeta(r)}); map.get(key).periods.add(r.period); }
  return [...map.values()].map(x=>({...x,periodCount:x.periods.size}));
}
function suggestionScore(item, query){
  const q=loose(query), site=loose(item.site), address=loose(item.address), all=`${site} ${address}`;
  if(!q) return 1;
  const tokens=searchTokens(q); if(!tokens.every(t=>all.includes(t))) return -1;
  let score=0; if(site===q) score+=1000; if(site.startsWith(q)) score+=600; if(site.includes(q)) score+=300; if(address.startsWith(q)) score+=120;
  tokens.forEach(t=>{ if(site.split(' ').some(w=>w.startsWith(t))) score+=40; else if(site.includes(t)) score+=20; else score+=5; });
  return score;
}
function highlightMatch(text, query){
  let safe=escapeHtml(text||''); const tokens=[...new Set(searchTokens(query))].sort((a,b)=>b.length-a.length); if(!tokens.length) return safe;
  for(const token of tokens){ const re=new RegExp(`(${token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'gi'); safe=safe.replace(re,'<mark>$1</mark>'); }
  return safe;
}
function renderAutocompleteSuggestions(query=''){
  const box=$('siteSuggestions'); const q=String(query||'').trim();
  const options=siteSearchOptions('table').map(x=>({...x,score:suggestionScore(x,q)})).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score || a.site.localeCompare(b.site,'es')).slice(0,10);
  autocompleteIndex=-1;
  if(!options.length){ box.innerHTML='<div class="autocomplete-empty">No se encontraron sedes. Prueba con otra palabra.</div>'; box.hidden=false; $('siteSearch').setAttribute('aria-expanded','true'); return; }
  box.innerHTML=options.map((x,i)=>`<button type="button" class="autocomplete-option" role="option" data-key="${escapeHtml(x.key)}" data-index="${i}"><span><strong>${highlightMatch(x.site,q)}</strong><small>${highlightMatch(x.address||'Sin dirección registrada',q)} · ${escapeHtml(x.meta?.territory||'Sin clasificar')} · Núcleo ${escapeHtml(x.meta?.nucleus||'Sin clasificar')}</small></span><em>${x.periodCount} periodo${x.periodCount===1?'':'s'}</em></button>`).join('');
  box.hidden=false; $('siteSearch').setAttribute('aria-expanded','true');
}
function closeAutocomplete(){ $('siteSuggestions').hidden=true; $('siteSearch').setAttribute('aria-expanded','false'); autocompleteIndex=-1; }
function chooseSuggestion(button){
  const item=siteSearchOptions().find(x=>x.key===button.dataset.key); if(!item) return;
  selectedSiteKey=item.key; $('siteSearch').value=item.site; $('clearSearchBtn').classList.add('visible'); closeAutocomplete(); applyFilters();
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
  const recs=filteredRecords(); const uniqueSites=new Set(recs.map(r=>siteKey(r.site,r.address))).size;
  $('filterResultCount').textContent=`${recs.length} registro${recs.length===1?'':'s'} · ${uniqueSites} sede${uniqueSites===1?'':'s'}`;
  const chips=[]; const q=$('siteSearch').value.trim(); const p=$('periodFilter').value; const service=$('serviceFilter');
  const tf=territoryFilterValues('table');
  if(tf.type) chips.push(`<button type="button" data-clear="territoryType">Ámbito: ${escapeHtml(tf.type)} ×</button>`);
  if(tf.territory) chips.push(`<button type="button" data-clear="territory">Territorio: ${escapeHtml(tf.territory)} ×</button>`);
  if(tf.nucleus) chips.push(`<button type="button" data-clear="nucleus">Núcleo: ${escapeHtml(tf.nucleus)} ×</button>`);
  if(q) chips.push(`<button type="button" data-clear="search">Búsqueda: ${escapeHtml(q)} ×</button>`);
  if(p) chips.push(`<button type="button" data-clear="period">Periodo: ${escapeHtml(p)} ×</button>`);
  if(service.value) chips.push(`<button type="button" data-clear="service">${escapeHtml(service.selectedOptions[0].textContent)} ×</button>`);
  $('activeFilters').innerHTML=chips.join('') || '<span>Mostrando toda la información disponible.</span>';
  $('activeFilters').querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
    const t=btn.dataset.clear;
    if(t==='search') return clearSiteSearch();
    if(t==='territoryType'){ $('territoryTypeFilter').value=''; updateTerritoryCascade('table','type'); }
    else if(t==='territory'){ $('territoryFilter').value=''; updateTerritoryCascade('table','territory'); }
    else if(t==='nucleus') $('nucleusFilter').value='';
    else $(t==='period'?'periodFilter':'serviceFilter').value='';
    applyFilters();
  }));
}
function renderAll(){ recalculateCo2(); refreshAllTerritoryFilters(); renderControls(); renderCards(); renderExecutiveSummary(); renderProjectImpact(); renderDashboard(); renderTable(); drawChart(aggregateByPeriod(state.records)); refreshSiteAutocompleteFields(); }
function renderControls(){
  const periods = [...new Set(state.records.map(r=>r.period))].sort();
  const options = '<option value="">Todos los periodos</option>'+periods.map(p=>`<option value="${p}">${p}</option>`).join('');
  const current = $('periodFilter').value;
  $('periodFilter').innerHTML = options; $('periodFilter').value = current;
  renderCompareControls();
  renderFilterSummary();
  syncAllSearchableSelects();
}
function renderCards(){
  const recs = state.records;
  const periods = new Set(recs.map(r=>r.period)).size;
  const sites = new Set(recs.map(r=>siteKey(r.site,r.address))).size;
  const sum = (field)=>recs.reduce((a,r)=>a+(Number(r[field])||0),0);
  $('kPeriods').textContent = periods;
  $('kSites').textContent = sites;
  $('kKwh').textContent = fmt(sum('energyKwh'))+' kWh';
  $('kCo2').textContent = fmt(sum('co2kg')/1000)+' t CO₂e';
  if($('kTrees')) $('kTrees').textContent = fmt(Math.ceil(sum('co2kg')/TREE_CO2_KG_YEAR));
  $('kWater').textContent = fmt(sum('waterM3'))+' m³';
  $('kWaste').textContent = fmt(sum('wasteTon'))+' t';
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
function renderTable(){
  const recs = filteredRecords();
  renderFilterSummary();
  $('recordsBody').innerHTML = recs.map(r=>`<tr>
    <td data-label="Periodo">${r.period}</td>
    <td data-label="Sede">${escapeHtml(r.site)}</td>
    <td data-label="Dirección">${escapeHtml(r.address||'')}</td>
    <td data-label="Agua m³">${num(r.waterM3)}</td>
    <td data-label="Alc. m³">${num(r.alcM3)}</td>
    <td data-label="Energía kWh">${num(r.energyKwh)}</td>
    <td data-label="Gas m³">${num(r.gasM3)}</td>
    <td data-label="Aseo $">${money(r.wasteValue)}</td>
    <td data-label="Residuos t">${num(r.wasteTon)}</td>
    <td data-label="CO₂ kg">${num(r.co2kg)}</td>
    <td data-label="Fuente">${renderSourceDownload(r)}</td>
  </tr>`).join('') || `<tr><td colspan="11"><div class="empty-filter-state"><strong>No hay coincidencias</strong><span>Prueba con menos palabras, cambia el periodo o limpia los filtros.</span><button type="button" onclick="clearAllFilters()" class="secondary">Limpiar filtros</button></div></td></tr>`;
}
function aggregateByPeriod(records){
  const map = {};
  for(const r of records){
    map[r.period] ||= {period:r.period, energyKwh:0, waterM3:0, alcM3:0, gasM3:0, wasteTon:0, co2kg:0};
    ['energyKwh','waterM3','alcM3','gasM3','wasteTon','co2kg'].forEach(k=>map[r.period][k]+=Number(r[k])||0);
  }
  return Object.values(map).sort((a,b)=>a.period.localeCompare(b.period));
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
    map[key] ||= {key, period:groupLabel(key, mode), energyKwh:0, waterM3:0, alcM3:0, gasM3:0, wasteTon:0, co2kg:0, records:0};
    ['energyKwh','waterM3','alcM3','gasM3','wasteTon','co2kg'].forEach(k=>map[key][k]+=Number(r[k])||0);
    map[key].records += 1;
  }
  return Object.values(map).sort((a,b)=>a.key.localeCompare(b.key));
}
function renderCompareControls(opts={}){
  if(!$('compareA') || !$('compareB')) return;
  const currentSite = opts.keepSite && $('compareSite') ? $('compareSite').value : ($('compareSite') ? $('compareSite').value : '');
  if($('compareSite')){
    const siteOptions = aggregateBySite(territoryScopedRecords('compare')).map(x=>({site:x.site,address:x.address}));
    $('compareSite').innerHTML = '<option value="">Todas las sedes</option>' + siteOptions.map(s=>{
      const key = siteKey(s.site,s.address);
      const label = `${s.site}${s.address ? ' · '+s.address : ''}`;
      return `<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`;
    }).join('');
    if([...$('compareSite').options].some(o=>o.value===currentSite)) $('compareSite').value = currentSite;
    refreshSiteAutocompleteFields();
  }
  const mode = $('compareMode') ? $('compareMode').value : 'month';
  const currentA = $('compareA').value;
  const currentB = $('compareB').value;
  const groups = aggregateByComparison(recordsForCompareScope(), mode);
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
  const a=$('compareA').value, b=$('compareB').value;
  const agg = aggregateByComparison(recordsForCompareScope(), mode);
  const A = agg.find(x=>x.key===a), B = agg.find(x=>x.key===b);
  if(!A||!B){
    $('compareResult').innerHTML='<p class="bad">Se requieren al menos dos periodos equivalentes para comparar con el filtro seleccionado.</p>';
    if($('compareNarrative')) $('compareNarrative').textContent = 'Aún no hay suficientes datos comparables para generar una interpretación automática.';
    drawChart(agg);
    return;
  }
  const siteText = site ? (($('compareSite').selectedOptions[0]||{}).textContent || 'Sede seleccionada') : 'Todas las sedes';
  const metrics=[['energyKwh','Energía','kWh'],['waterM3','Agua','m³'],['co2kg','CO₂','kg'],['wasteTon','Residuos','t']];
  const summary = `<div class="compare-summary"><strong>${escapeHtml(compareModeLabel(mode))}</strong><span>${escapeHtml(siteText)}</span><small>${escapeHtml(A.period)} vs ${escapeHtml(B.period)}</small></div>`;
  $('compareResult').innerHTML = summary + metrics.map(([k,label,unit])=>{
    const diff=(B[k]||0)-(A[k]||0); const pct=(A[k]||0)? diff/A[k]*100 : 0;
    const trendClass = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
    return `<div class="metric ${trendClass}"><span>${label}</span><strong>${fmt(diff)} ${unit}</strong><small>${escapeHtml(A.period)}: ${fmt(A[k])} · ${escapeHtml(B.period)}: ${fmt(B[k])} · ${pct>=0?'+':''}${fmt(pct)}%</small></div>`;
  }).join('');
  if($('compareNarrative')) $('compareNarrative').innerHTML = buildComparisonNarrative(A, B, mode, siteText);
  drawChart(agg);
}

function drawChart(data){
  chartData=data;
  const c=$('chart'), ctx=c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);
  ctx.fillStyle='#13312d';
  ctx.font='bold 18px Arial';
  ctx.fillText('Comparativo de energía por periodo (kWh)',24,34);
  if(!data.length){
    ctx.font='14px Arial';
    ctx.fillText('Sin datos importados',24,80);
    return;
  }
  const top = 56;
  const pad = 76;
  const bottomSpace = 90;
  const w = c.width - pad*2;
  const h = c.height - top - bottomSpace;
  const baseY = top + h;
  const max = Math.max(...data.map(d=>d.energyKwh), 1);
  ctx.strokeStyle='#d7e6e2';
  ctx.lineWidth=1;
  ctx.beginPath();
  ctx.moveTo(pad, top);
  ctx.lineTo(pad, baseY);
  ctx.lineTo(pad+w, baseY);
  ctx.stroke();

  const gap = w / data.length;
  const bw = Math.max(26, Math.min(gap * 0.54, 52));
  data.forEach((d,i)=>{
    const x = pad + i*gap + gap/2 - bw/2;
    const bh = (d.energyKwh / max) * h;
    const y = baseY - bh;
    const grad = ctx.createLinearGradient(0, y, 0, baseY);
    grad.addColorStop(0, '#16d2a6');
    grad.addColorStop(1, '#0b9878');
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, bw, bh, 10);
    ctx.fill();

    ctx.fillStyle = '#13312d';
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px Arial';
    ctx.fillText(fmt(d.energyKwh), x + bw/2, Math.max(top + 14, y - 10));

    const lines = chartLabelLines(d);
    ctx.font = '11px Arial';
    let labelY = baseY + 22;
    lines.forEach(line => {
      ctx.fillText(line, x + bw/2, labelY);
      labelY += 13;
    });
  });
  ctx.textAlign='left';
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
  const rows=recs.map(r=>`<tr><td>${escapeHtml(r.period||'')}</td><td>${escapeHtml(r.site||'')}</td><td>${escapeHtml(r.address||'')}</td><td>${fmt(r.energyKwh)} kWh</td><td>${fmt(r.waterM3)} m³</td><td>${fmt(r.co2kg)} kg</td><td>${escapeHtml(r.source||'PDF')}</td></tr>`).join('');
  const filters=[activeTerritoryText('table'),$('periodFilter')?.value&&`Periodo: ${$('periodFilter').value}`,$('serviceFilter')?.value&&`Servicio: ${$('serviceFilter').value}`,$('siteSearch')?.value&&`Sede: ${$('siteSearch').value}`].filter(Boolean).join(' · ');
  openPdfPrintDocument('Informe de facturas por institución educativa',filters,`<div class="report-grid"><div class="metric"><span>Registros</span><strong>${recs.length}</strong></div><div class="metric"><span>Energía acumulada</span><strong>${fmt(energy)} kWh</strong></div><div class="metric"><span>Emisiones</span><strong>${fmt(co2/1000)} t CO₂e</strong></div></div><div class="report-card"><h2>Resumen de la consulta</h2><p>Agua acumulada: <strong>${fmt(water)} m³</strong></p></div><table><thead><tr><th>Periodo</th><th>Institución / sede</th><th>Dirección</th><th>Energía</th><th>Agua</th><th>CO₂e</th><th>Fuente</th></tr></thead><tbody>${rows}</tbody></table>`);
}
function downloadHistoryPdfReport(){
  const mode = $('compareMode') ? $('compareMode').value : 'month';
  const groups = aggregateByComparison(recordsForCompareScope(), mode);
  if(!groups.length){alert('No hay datos históricos para generar el informe PDF.');return;}
  const first = groups[0];
  const last = groups[groups.length-1];
  if($('compareA')) $('compareA').value = first.key;
  if($('compareB')) $('compareB').value = last.key;
  comparePeriods();
  const selectedKeys = new Set([first.key,last.key]);
  const raw = recordsForCompareScope().filter(r=>selectedKeys.has(groupKeyForPeriod(r.period,mode)));
  const rows = raw.map(r=>`<tr><td>${escapeHtml(groupLabel(groupKeyForPeriod(r.period,mode),mode))}</td><td>${escapeHtml(r.site||'')}</td><td>${fmt(r.energyKwh)} kWh</td><td>${fmt((Number(r.energyKwh)||0)*FACTOR_CO2_KG_KWH/1000)} t</td><td>${fmt(r.waterM3)} m³</td></tr>`).join('');
  const narrative = $('compareNarrative')?.textContent || `Comparación entre ${first.period} y ${last.period}.`;
  openPdfPrintDocument('Informe histórico de consumos',`${first.period} vs ${last.period}`,`<div class="report-card"><h2>Comparación seleccionada</h2><p>${escapeHtml(narrative)}</p></div><div class="report-grid"><div class="metric"><span>Periodo inicial</span><strong>${escapeHtml(first.period)}</strong></div><div class="metric"><span>Periodo final</span><strong>${escapeHtml(last.period)}</strong></div><div class="metric"><span>Variación de energía</span><strong>${fmt(last.energyKwh-first.energyKwh)} kWh</strong></div></div><table><thead><tr><th>Periodo</th><th>Institución / sede</th><th>Energía</th><th>CO₂e</th><th>Agua</th></tr></thead><tbody>${rows}</tbody></table>`);
}

function downloadDashboardPdfReport(){
  const recs=dashboardFilteredRecords();
  if(!recs.length){alert('No hay información para generar el informe PDF.');return;}
  const agg=aggregateBySite(recs); const rows=agg.map((x,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(x.site)}</td><td>${escapeHtml(x.address||'')}</td><td>${x.periods}</td><td>${fmt(x.energyKwh)} kWh</td><td>${fmt(x.co2kg/1000)} t</td><td>${Math.ceil(x.co2kg/TREE_CO2_KG_YEAR)}</td></tr>`).join('');
  const energy=agg.reduce((a,x)=>a+x.energyKwh,0), co2=agg.reduce((a,x)=>a+x.co2kg,0);
  openPdfPrintDocument('Informe ambiental por sede',activeTerritoryText('dashboard'),`<div class="report-grid"><div class="metric"><span>Sedes</span><strong>${agg.length}</strong></div><div class="metric"><span>Energía</span><strong>${fmt(energy)} kWh</strong></div><div class="metric"><span>CO₂ equivalente</span><strong>${fmt(co2/1000)} t</strong></div></div><table><thead><tr><th>#</th><th>Sede</th><th>Dirección</th><th>Periodos</th><th>Energía</th><th>CO₂e</th><th>Árboles</th></tr></thead><tbody>${rows}</tbody></table>`);
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
  const recs = state.records || [];
  const periods = [...new Set(recs.map(r=>r.period).filter(Boolean))].sort();
  const sites = aggregateBySite(recs.filter(r=>Number(r.energyKwh)>0));
  const sum = (field)=>recs.reduce((a,r)=>a+(Number(r[field])||0),0);
  const energy = sum('energyKwh');
  const co2kg = sum('co2kg');
  const water = sum('waterM3');
  const waste = sum('wasteTon');
  const trees = Math.ceil(co2kg / TREE_CO2_KG_YEAR);
  const topSite = sites[0] || null;
  return {recs, periods, sites, energy, co2kg, water, waste, trees, topSite};
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
  const byPeriod = aggregateByPeriod(s.recs);
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

function buildComparisonNarrative(A, B, mode, siteText){
  const diff = (B.energyKwh||0) - (A.energyKwh||0);
  const pct = (A.energyKwh||0) ? diff/A.energyKwh*100 : 0;
  const co2Diff = diff * FACTOR_CO2_KG_KWH / 1000;
  const scope = escapeHtml(siteText || 'Todas las sedes');
  if(diff > 0){
    return `<strong>Interpretación automática:</strong> En ${scope}, el consumo eléctrico aumentó <strong>${fmt(diff)} kWh</strong> frente al periodo base (${fmt(pct)}%). Este incremento representa aproximadamente <strong>${fmt(co2Diff)} t CO₂e adicionales</strong>. Se recomienda revisar cambios de jornada, uso de iluminación, equipos tecnológicos, ventilación y posibles consumos atípicos.`;
  }
  if(diff < 0){
    return `<strong>Interpretación automática:</strong> En ${scope}, el consumo eléctrico disminuyó <strong>${fmt(Math.abs(diff))} kWh</strong> frente al periodo base (${fmt(Math.abs(pct))}%). Esta reducción evita aproximadamente <strong>${fmt(Math.abs(co2Diff))} t CO₂e</strong>. Se recomienda identificar y documentar las prácticas que explican la disminución para replicarlas en otras sedes.`;
  }
  return `<strong>Interpretación automática:</strong> En ${scope}, el consumo eléctrico se mantuvo estable entre los periodos comparados. Se recomienda sostener el monitoreo mensual y definir una meta de reducción gradual.`;
}

function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function fmt(n){ return new Intl.NumberFormat('es-CO',{maximumFractionDigits:2}).format(Number(n)||0); }
function num(n){ return n==null||n==='' ? '—' : fmt(n); }
function money(n){ return n==null||n==='' ? '—' : '$ '+fmt(n); }

/* Dashboard ambiental por sede - v8 */
function dashboardRecords(){
  const q = $('dashboardSiteSearch') ? $('dashboardSiteSearch').value||'' : '';
  const p = '';
  const service = '';
  return state.records.filter(r=>recordMatchesTerritory(r,territoryFilterValues('dashboard')) && recordMatchesSearch(r,q) && (!dashboardSiteKey || siteKey(r.site,r.address)===dashboardSiteKey) && (!p || r.period===p) && serviceHasValue(r,service) && Number(r.energyKwh)>0);
}
function aggregateBySite(records){
  const map = {};
  for(const r of records){
    const key = siteKey(r.site, r.address);
    if(!map[key]) map[key] = {site:r.site, address:r.address||'', periods:new Set(), energyKwh:0, co2kg:0, count:0};
    map[key].periods.add(r.period);
    map[key].energyKwh += Number(r.energyKwh)||0;
    map[key].co2kg += Number(r.co2kg)||0;
    map[key].count += 1;
  }
  return Object.values(map).map(x=>({
    ...x,
    periodCount:x.periods.size,
    trees: Math.ceil((x.co2kg||0) / TREE_CO2_KG_YEAR),
    avgKwhMonth: x.periods.size ? x.energyKwh / x.periods.size : x.energyKwh
  })).sort((a,b)=>b.energyKwh-a.energyKwh);
}
function renderDashboard(){
  if(!$('environmentBody')) return;
  const rows = aggregateBySite(dashboardRecords());
  const totalKwh = rows.reduce((a,r)=>a+r.energyKwh,0);
  const totalCo2kg = rows.reduce((a,r)=>a+r.co2kg,0);
  const totalTrees = Math.ceil(totalCo2kg / TREE_CO2_KG_YEAR);
  $('dashTotalKwh').textContent = fmt(totalKwh) + ' kWh';
  $('dashTotalCo2').textContent = fmt(totalCo2kg/1000) + ' t CO₂e';
  $('dashTotalTrees').textContent = fmt(totalTrees) + ' árboles';
  if(!rows.length){
    $('environmentBody').innerHTML = '<tr><td colspan="10">No hay registros de energía eléctrica para mostrar. Importa una factura PDF o revisa los filtros.</td></tr>';
    renderRanking();
    return;
  }
  const body = rows.map((r,i)=>{
    const priority = classifyEnergyIntensity(r.avgKwhMonth);
    return `<tr>
    <td data-label="#">${i+1}</td>
    <td data-label="Sede">${escapeHtml(r.site)}</td>
    <td data-label="Dirección">${escapeHtml(r.address)}</td>
    <td data-label="Periodos">${fmt(r.periodCount)}</td>
    <td data-label="Energía total kWh"><strong>${fmt(r.energyKwh)}</strong></td>
    <td data-label="CO₂e t">${fmt(r.co2kg/1000)}</td>
    <td data-label="Árboles requeridos"><strong>${fmt(r.trees)}</strong></td>
    <td data-label="Promedio kWh/mes">${fmt(r.avgKwhMonth)}</td>
    <td data-label="Prioridad"><span class="priority-chip ${priority.cls}" title="${escapeHtml(priority.level)}">${escapeHtml(priority.short || priority.level)}</span></td>
    <td data-label="Plan" class="plan-cell"><button type="button" class="plan-btn primary" data-site-key="${escapeHtml(siteKey(r.site,r.address))}" title="Generar, visualizar y descargar el Plan de Gestión de ${escapeHtml(r.site)}">📄 Generar informe<br><small>Plan de Gestión</small></button></td>
  </tr>`;
  }).join('');
  const totalRow = `<tr class="total-row"><td colspan="4">TOTAL</td><td>${fmt(totalKwh)}</td><td>${fmt(totalCo2kg/1000)}</td><td>${fmt(totalTrees)}</td><td>—</td><td>—</td><td>—</td></tr>`;
  $('environmentBody').innerHTML = totalRow + body;
  renderRanking();
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
  const records=(state.records||[]).filter(r=>Number(r.energyKwh)>0 && (!rankingPeriod || r.period===rankingPeriod));
  return aggregateBySite(records).filter(row=>!rankingPriority || classifyEnergyIntensity(row.avgKwhMonth).cls===rankingPriority);
}
function updateRankingPriorityButtons(){
  document.querySelectorAll('#rankingPriorityFilters [data-priority]').forEach(btn=>{
    const active=(btn.dataset.priority||'')===rankingPriority;
    btn.classList.toggle('is-active',active);
    btn.setAttribute('aria-pressed',String(active));
  });
}
function handleRankingPriorityClick(e){
  const btn=e.target.closest('[data-priority]');
  if(!btn) return;
  rankingPriority=btn.dataset.priority||'';
  rankingSelectedKey='';
  rankingPage=0;
  if($('rankingSiteSearch')) $('rankingSiteSearch').value='';
  $('clearRankingSearchBtn')?.classList.remove('visible');
  closeRankingSuggestions();
  renderRanking();
  log(`Ranking filtrado por prioridad: ${rankingPriority ? ({high:'Alta',medium:'Media',low:'Preventiva'}[rankingPriority]||rankingPriority) : 'Todas'}.`);
}
function rankingSearchOptions(){
  return rankingRowsCache.map((r,index)=>({...r,index,key:siteKey(r.site,r.address)}));
}
function closeRankingSuggestions(){
  const list=$('rankingSiteSuggestions'), input=$('rankingSiteSearch');
  if(list) list.hidden=true;
  if(input) input.setAttribute('aria-expanded','false');
  rankingAutocompleteIndex=-1;
}
function clearRankingSearch(){
  rankingSelectedKey='';
  rankingAutocompleteIndex=-1;
  if($('rankingSiteSearch')) $('rankingSiteSearch').value='';
  if($('clearRankingSearchBtn')) $('clearRankingSearchBtn').classList.remove('visible');
  closeRankingSuggestions();
  rankingPage=0;
  drawSiteChart(rankingRowsCache);
}
function rankingMatches(query){
  const tokens=loose(query).split(/\s+/).filter(Boolean);
  const opts=rankingSearchOptions();
  if(!tokens.length) return opts.slice(0,20);
  return opts.map(o=>{
    const hay=loose(`${o.site} ${o.address}`);
    if(!tokens.every(t=>hay.includes(t))) return null;
    let score=0; const site=loose(o.site), address=loose(o.address);
    tokens.forEach(t=>{ if(site.startsWith(t)) score+=8; else if(site.includes(t)) score+=5; if(address.includes(t)) score+=2; });
    return {...o,score};
  }).filter(Boolean).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,20);
}
function highlightRankingMatch(value,query){
  const safe=escapeHtml(value||'');
  const token=loose(query).split(/\s+/).filter(Boolean)[0];
  if(!token) return safe;
  const raw=String(value||''); const idx=loose(raw).indexOf(token);
  if(idx<0) return safe;
  return `${escapeHtml(raw.slice(0,idx))}<mark>${escapeHtml(raw.slice(idx,idx+token.length))}</mark>${escapeHtml(raw.slice(idx+token.length))}`;
}
function renderRankingSuggestions(query=''){
  const list=$('rankingSiteSuggestions'), input=$('rankingSiteSearch');
  if(!list||!input) return;
  const matches=rankingMatches(query);
  rankingAutocompleteIndex=-1;
  list.innerHTML=matches.length?matches.map((o,i)=>`<button type="button" class="autocomplete-option" role="option" data-ranking-key="${escapeHtml(o.key)}" data-ranking-index="${o.index}"><span><strong>${highlightRankingMatch(o.site,query)}</strong><small>${highlightRankingMatch(o.address||'Sin dirección',query)}</small></span><em>Puesto ${o.index+1}</em></button>`).join(''):'<div class="autocomplete-empty">No se encontraron instituciones o sedes.</div>';
  list.hidden=false; input.setAttribute('aria-expanded','true');
}
function handleRankingSearchInput(){
  rankingSelectedKey='';
  const value=$('rankingSiteSearch').value;
  $('clearRankingSearchBtn')?.classList.toggle('visible',Boolean(value));
  renderRankingSuggestions(value);
}
function selectRankingSuggestion(key,index){
  const row=rankingRowsCache[index] || rankingRowsCache.find(r=>siteKey(r.site,r.address)===key);
  if(!row) return;
  rankingSelectedKey=key;
  $('rankingSiteSearch').value=row.site;
  $('clearRankingSearchBtn')?.classList.add('visible');
  closeRankingSuggestions();
  const actualIndex=rankingRowsCache.findIndex(r=>siteKey(r.site,r.address)===key);
  rankingPage=Math.max(0,Math.floor(actualIndex/RANKING_PAGE_SIZE));
  drawSiteChart(rankingRowsCache);
  requestAnimationFrame(()=>$('siteChart')?.scrollIntoView({behavior:'smooth',block:'center'}));
}
function handleRankingSuggestionClick(e){
  const btn=e.target.closest('[data-ranking-key]'); if(!btn) return;
  e.preventDefault(); selectRankingSuggestion(btn.dataset.rankingKey,Number(btn.dataset.rankingIndex));
}
function handleRankingSearchKeydown(e){
  const list=$('rankingSiteSuggestions');
  const options=[...(list?.querySelectorAll('.autocomplete-option')||[])];
  if(e.key==='ArrowDown'){e.preventDefault();rankingAutocompleteIndex=Math.min(rankingAutocompleteIndex+1,options.length-1);}
  else if(e.key==='ArrowUp'){e.preventDefault();rankingAutocompleteIndex=Math.max(rankingAutocompleteIndex-1,0);}
  else if(e.key==='Enter' && rankingAutocompleteIndex>=0 && options[rankingAutocompleteIndex]){e.preventDefault();options[rankingAutocompleteIndex].dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));return;}
  else if(e.key==='Escape'){closeRankingSuggestions();return;} else return;
  options.forEach((o,i)=>o.classList.toggle('active',i===rankingAutocompleteIndex));
  options[rankingAutocompleteIndex]?.scrollIntoView({block:'nearest'});
}
function refreshFullRanking(){
  dashboardSiteKey='';
  const field=siteAutocompleteState.get('dashboardSiteSearch');
  if(field){field.input.value='';field.clear.classList.remove('visible');}
  rankingPeriod=''; rankingPriority=''; rankingSelectedKey=''; rankingPage=0;
  renderRankingPeriodOptions();
  if($('rankingPeriodFilter')) $('rankingPeriodFilter').value='';
  if($('rankingSiteSearch')) $('rankingSiteSearch').value='';
  $('clearRankingSearchBtn')?.classList.remove('visible');
  closeRankingSuggestions();
  rankingRowsCache=getFullRankingRows();
  drawSiteChart(rankingRowsCache);
  log('Ranking actualizado: se muestran nuevamente todas las sedes y todos los meses.');
}
function setRankingPage(page){
  const pages=Math.max(1,Math.ceil(rankingRowsCache.length/RANKING_PAGE_SIZE));
  rankingPage=Math.max(0,Math.min(Number(page)||0,pages-1));
  drawSiteChart(rankingRowsCache);
}
function renderRanking(){
  renderRankingPeriodOptions();
  updateRankingPriorityButtons();
  rankingRowsCache=getFullRankingRows();
  if(rankingSelectedKey && !rankingRowsCache.some(r=>siteKey(r.site,r.address)===rankingSelectedKey)){
    rankingSelectedKey='';
    if($('rankingSiteSearch')) $('rankingSiteSearch').value='';
    $('clearRankingSearchBtn')?.classList.remove('visible');
  }
  const pages=Math.max(1,Math.ceil(rankingRowsCache.length/RANKING_PAGE_SIZE));
  if(rankingPage>=pages) rankingPage=pages-1;
  drawSiteChart(rankingRowsCache);
}
function drawSiteChart(rows){
  const c = $('siteChart');
  if(!c) return;
  const ctx = c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);
  ctx.fillStyle='#13312d';
  ctx.font='bold 17px Arial';
  ctx.textAlign='left';
  ctx.fillText('Ranking de sedes por consumo eléctrico total (kWh)',24,34);
  ctx.font='12px Arial';
  ctx.fillStyle='#637772';
  ctx.fillText(`Ordenado de mayor a menor consumo · ${rankingPeriod ? groupLabel(rankingPeriod,'month') : 'todos los meses'} · ${rankingPriority ? 'prioridad '+({high:'alta',medium:'media',low:'preventiva'}[rankingPriority]||rankingPriority) : 'todas las prioridades'} · vista de 10 sedes.`,24,54);

  const total=rows.length;
  const pages=Math.max(1,Math.ceil(total/RANKING_PAGE_SIZE));
  rankingPage=Math.max(0,Math.min(rankingPage,pages-1));
  const start=rankingPage*RANKING_PAGE_SIZE;
  const visible=rows.slice(start,start+RANKING_PAGE_SIZE);
  const end=Math.min(start+visible.length,total);
  if($('rankingPageInfo')) $('rankingPageInfo').textContent=total ? `${start+1}–${end} de ${total} sedes · Página ${rankingPage+1} de ${pages}` : 'Sin sedes disponibles';
  ['rankingFirstBtn','rankingPrevBtn'].forEach(id=>{if($(id)) $(id).disabled=rankingPage===0||!total;});
  ['rankingNextBtn','rankingLastBtn'].forEach(id=>{if($(id)) $(id).disabled=rankingPage>=pages-1||!total;});
  const most=rows[0], least=rows[rows.length-1];
  if($('rankingExtremes')) $('rankingExtremes').innerHTML=total ? `<article><span>Mayor consumo</span><strong>${escapeHtml(most.site)}</strong><small>${fmt(most.energyKwh)} kWh acumulados</small></article><article><span>Menor consumo</span><strong>${escapeHtml(least.site)}</strong><small>${fmt(least.energyKwh)} kWh acumulados</small></article>` : '<p>No hay datos para construir el ranking.</p>';

  if(!visible.length){ ctx.fillStyle='#13312d'; ctx.fillText('Sin datos para graficar',24,92); return; }
  const padL = 255;
  const padR = 28;
  const valueX = Math.max(735, c.width - 330);
  const top = 82;
  const rowH = 36;
  const barH = 20;
  const max = Math.max(...rows.map(r=>r.energyKwh),1);
  const maxBarW = Math.max(180, valueX - padL - 18);
  ctx.font='12px Arial';
  visible.forEach((r,i)=>{
    const y = top + i*rowH;
    const position=start+i+1;
    const rawLabel=`${position}. ${r.site||''}`;
    const label = rawLabel.length>36 ? rawLabel.slice(0,36)+'…' : rawLabel;
    const isSelected = rankingSelectedKey && siteKey(r.site,r.address)===rankingSelectedKey;
    if(isSelected){
      ctx.fillStyle='#fff3bf';
      roundRect(ctx,12,y-7,c.width-24,rowH-1,10); ctx.fill();
    }
    ctx.fillStyle=isSelected?'#075846':'#315650';
    ctx.font=isSelected?'bold 12px Arial':'12px Arial';
    ctx.textAlign='right';
    ctx.fillText(label, padL-12, y+15);
    const bw = Math.max(8, (r.energyKwh/max)*maxBarW);
    const grad = ctx.createLinearGradient(padL,0,padL+bw,0);
    grad.addColorStop(0,'#0b9878');
    grad.addColorStop(1,'#0fc39a');
    ctx.fillStyle=grad;
    roundRect(ctx,padL,y,bw,barH,8); ctx.fill();
    const available = c.width - valueX - padR;
    const fullLabel = `${fmt(r.energyKwh)} kWh · ${fmt(r.co2kg/1000)} t CO₂e · ${fmt(r.trees)} árboles`;
    ctx.fillStyle='#13312d';
    ctx.textAlign='left';
    ctx.font='bold 11.5px Arial';
    ctx.fillText(fitCanvasText(ctx, fullLabel, available), valueX, y+15);
  });
  ctx.textAlign='left';
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
  btn.classList.add('is-generating');
  btn.innerHTML = 'Generando…';
  setTimeout(()=>{
    generateManagementPlan(key);
    btn.classList.remove('is-generating');
    btn.innerHTML = '📄 Generar informe<br><small>Plan de Gestión</small>';
  }, 30);
}

function recordsForSiteKey(key){
  return state.records.filter(r => siteKey(r.site, r.address) === key).sort((a,b)=>String(a.period).localeCompare(String(b.period)));
}

function generateManagementPlan(key){
  const recs = recordsForSiteKey(key);
  if(!recs.length){
    log('No se encontraron registros para generar el plan de gestión.');
    alert('No se encontraron registros para generar el plan de gestión de esta sede.');
    return;
  }
  const site = recs[0].site || 'Sede educativa';
  const address = recs[0].address || 'Sin dirección registrada';
  const periods = [...new Set(recs.map(r=>r.period))].sort();
  const energy = recs.reduce((a,r)=>a+(Number(r.energyKwh)||0),0);
  const water = recs.reduce((a,r)=>a+(Number(r.waterM3)||0),0);
  const waste = recs.reduce((a,r)=>a+(Number(r.wasteTon)||0),0);
  const co2kg = energy * FACTOR_CO2_KG_KWH;
  const co2t = co2kg / 1000;
  const trees = Math.ceil(co2kg / TREE_CO2_KG_YEAR);
  const avgMonth = periods.length ? energy / periods.length : energy;
  const annualProjection = avgMonth * 12;
  const target15 = annualProjection * 0.15;
  const target40 = annualProjection * 0.40;
  const solar80 = annualProjection * 0.80;
  const co2Target15 = target15 * FACTOR_CO2_KG_KWH / 1000;
  const co2Target40 = target40 * FACTOR_CO2_KG_KWH / 1000;
  const co2Solar80 = solar80 * FACTOR_CO2_KG_KWH / 1000;
  const intensity = classifyEnergyIntensity(avgMonth);
  const latest = recs[recs.length-1];
  const generatedAt = new Date().toLocaleDateString('es-CO', {year:'numeric', month:'long', day:'numeric'});

  CURRENT_PLAN_FILENAME = `plan-gestion-${slugify(site)}.html`;
  CURRENT_PLAN_HTML = buildPlanHtml({site,address,periods,energy,water,waste,co2t,trees,avgMonth,annualProjection,target15,target40,solar80,co2Target15,co2Target40,co2Solar80,intensity,latest,generatedAt,recs});
  $('planReport').className = 'plan-report';
  $('planReport').innerHTML = CURRENT_PLAN_HTML;
  $('printPlanBtn').disabled = false;
  if(window.simecoOpenSection) window.simecoOpenSection('seccion-3', {scroll:false});
  requestAnimationFrame(()=>$('planPanel').scrollIntoView({behavior:'smooth', block:'start'}));
  log(`Plan de Gestión generado para ${site}.`);
}

function classifyEnergyIntensity(avgMonth){
  if(avgMonth >= 5000) return {level:'Alta prioridad', short:'Alta', cls:'high', text:'La sede presenta un consumo eléctrico mensual alto. Se recomienda priorizar diagnóstico técnico, medición por circuitos, sustitución LED y evaluación solar fotovoltaica.'};
  if(avgMonth >= 2000) return {level:'Prioridad media', short:'Media', cls:'medium', text:'La sede presenta un consumo eléctrico moderado. Se recomienda fortalecer hábitos de ahorro, optimizar iluminación y controlar horarios de equipos.'};
  return {level:'Prioridad preventiva', short:'Preventiva', cls:'low', text:'La sede presenta un consumo eléctrico bajo o moderado. Se recomienda mantener monitoreo, formación ambiental y acciones preventivas de eficiencia.'};
}


function buildPlanMetricSeries(recs){
  return [...recs]
    .map(r=>({
      period:String(r.period||''),
      energy:Number(r.energyKwh)||0,
      water:Number(r.waterM3)||0,
      waste:Number(r.wasteTon)||0,
      co2:((Number(r.energyKwh)||0)*FACTOR_CO2_KG_KWH)/1000,
      trees:Math.ceil(((Number(r.energyKwh)||0)*FACTOR_CO2_KG_KWH)/TREE_CO2_KG_YEAR),
      source:r.source||'PDF'
    }))
    .sort((a,b)=>a.period.localeCompare(b.period));
}

function buildPlanBarChartSvg(rows, cfg={}){
  if(!rows || !rows.length) return `<div class="plan-chart-empty">No hay datos suficientes para graficar ${escapeHtml(cfg.title||'este indicador')}.</div>`;
  const width = cfg.width || 980;
  const height = cfg.height || 350;
  const padL = 74, padR = 28, padT = 28, padB = 62;
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
    bars += `<text x="${(x+barW/2).toFixed(1)}" y="${(padT+chartH+22).toFixed(1)}" text-anchor="middle" font-size="11.5" font-weight="800" fill="#36524d">${label}</text>`;
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
        formatLabel:(r)=>escapeHtml(r.period)
      })}
      ${buildPlanBarChartSvg(co2Rows, {
        title:'CO₂e evitado estimado por escenario (t/año)',
        subtitle:'Reducción potencial anual de emisiones indirectas asociadas al consumo eléctrico.',
        gradId:'planScenarioCo2',
        colorA:'#5bbdff', colorB:'#1877cf',
        getValue:(r)=>r.value,
        formatValue:(v)=>fmt(v),
        formatLabel:(r)=>escapeHtml(r.period)
      })}
    </div>`;
}

function buildPlanMonthlyCharts(d){
  const rows = buildPlanMetricSeries(d.recs);
  const cards = [];
  cards.push(buildPlanBarChartSvg(rows, {
    title:'Consumo de energía eléctrica por periodo',
    subtitle:`Histórico de consumo facturado en kWh para la sede ${d.site}.`,
    gradId:'planEnergyPeriods',
    colorA:'#19caa4', colorB:'#0a9978',
    getValue:(r)=>r.energy,
    formatValue:(v)=>fmt(v),
    formatLabel:(r)=>escapeHtml(r.period)
  }));
  cards.push(buildPlanBarChartSvg(rows, {
    title:'Consumo de agua por periodo (m³)',
    subtitle:'Permite identificar periodos de mayor demanda hídrica y posibles oportunidades de ahorro.',
    gradId:'planWaterPeriods',
    colorA:'#8ed0ff', colorB:'#2f84d6',
    getValue:(r)=>r.water,
    formatValue:(v)=>fmt(v),
    formatLabel:(r)=>escapeHtml(r.period)
  }));
  cards.push(buildPlanBarChartSvg(rows, {
    title:'Emisiones estimadas de CO₂e por periodo (t)',
    subtitle:`Calculadas a partir del factor ${fmt(FACTOR_CO2_KG_KWH)} kg CO₂e/kWh.`,
    gradId:'planCo2Periods',
    colorA:'#66c2ff', colorB:'#1c77d3',
    getValue:(r)=>r.co2,
    formatValue:(v)=>fmt(v),
    formatLabel:(r)=>escapeHtml(r.period)
  }));
  cards.push(buildPlanBarChartSvg(rows, {
    title:'Árboles equivalentes requeridos por periodo',
    subtitle:'Estimación de árboles necesarios para compensar las emisiones asociadas al consumo del periodo.',
    gradId:'planTreesPeriods',
    colorA:'#acd95c', colorB:'#5ca61c',
    getValue:(r)=>r.trees,
    formatValue:(v)=>fmt(v),
    formatLabel:(r)=>escapeHtml(r.period)
  }));
  if(rows.some(r => r.waste > 0)){
    cards.push(buildPlanBarChartSvg(rows, {
      title:'Residuos / aseo por periodo (t)',
      subtitle:'Comportamiento mensual del componente de residuos identificado en la factura consolidada.',
      gradId:'planWastePeriods',
      colorA:'#ffcf70', colorB:'#d58d12',
      getValue:(r)=>r.waste,
      formatValue:(v)=>fmt(v),
      formatLabel:(r)=>escapeHtml(r.period)
    }));
  }
  return `<div class="plan-visual-grid">${cards.join('')}</div>`;
}

function buildPlanSummaryCards(d){
  const rows = buildPlanMetricSeries(d.recs);
  if(!rows.length) return '';
  const maxEnergy = rows.reduce((a,b)=>a.energy>=b.energy?a:b);
  const maxWater = rows.reduce((a,b)=>a.water>=b.water?a:b);
  const maxCo2 = rows.reduce((a,b)=>a.co2>=b.co2?a:b);
  const avgEnergy = rows.reduce((s,r)=>s+r.energy,0) / rows.length;
  return `
    <div class="plan-summary-grid">
      <div><span>Periodo de mayor consumo eléctrico</span><strong>${escapeHtml(maxEnergy.period)}</strong><small>${fmt(maxEnergy.energy)} kWh</small></div>
      <div><span>Promedio mensual de energía</span><strong>${fmt(avgEnergy)} kWh</strong><small>${rows.length} periodo(s) analizado(s)</small></div>
      <div><span>Periodo de mayor consumo de agua</span><strong>${escapeHtml(maxWater.period)}</strong><small>${fmt(maxWater.water)} m³</small></div>
      <div><span>Mayor impacto en CO₂e</span><strong>${escapeHtml(maxCo2.period)}</strong><small>${fmt(maxCo2.co2)} t CO₂e</small></div>
    </div>`;
}

function buildPlanHtml(d){
  const periodText = d.periods.length ? `${d.periods[0]} a ${d.periods[d.periods.length-1]} (${d.periods.length} periodo(s) importado(s))` : 'Sin periodo';
  const monthlyRows = d.recs.map(r=>`<tr><td>${escapeHtml(r.period)}</td><td>${fmt(r.energyKwh)} kWh</td><td>${fmt(Number(r.waterM3)||0)} m³</td><td>${fmt((Number(r.energyKwh)||0)*FACTOR_CO2_KG_KWH/1000)} t CO₂e</td><td>${fmt(Math.ceil(((Number(r.energyKwh)||0)*FACTOR_CO2_KG_KWH)/TREE_CO2_KG_YEAR))}</td><td>${fmt(Number(r.wasteTon)||0)} t</td><td>${escapeHtml(r.source||'PDF')}</td></tr>`).join('');
  const summaryCards = buildPlanSummaryCards(d);
  const monthlyCharts = buildPlanMonthlyCharts(d);
  const reductionCharts = buildPlanReductionCharts(d);
  return `
    <article class="plan-document">
      <div class="plan-cover">
        <div>
          <p class="plan-code">Código: GEI-R-001 · Plan de Reducciones 2025</p>
          <h2>Plan de Gestión de Reducción de GEI</h2>
          <h3>${escapeHtml(d.site)}</h3>
          <p>${escapeHtml(d.address)}</p>
        </div>
        <div class="plan-badge ${d.intensity.cls}">${escapeHtml(d.intensity.level)}</div>
      </div>

      <div class="plan-meta-grid">
        <div><span>Elaborado por</span><strong>Juan Carlos Blandón Vargas · Los Yoguis</strong></div>
        <div><span>Aprobación técnica sugerida</span><strong>GSV Ingeniería</strong></div>
        <div><span>Fecha de generación</span><strong>${escapeHtml(d.generatedAt)}</strong></div>
        <div><span>Periodo analizado</span><strong>${escapeHtml(periodText)}</strong></div>
      </div>

      <h3>1. Diagnóstico energético y ambiental</h3>
      <p>Este informe personalizado toma como línea base los registros importados desde las facturas EPM procesadas por SiMeCO₂. El objetivo es orientar acciones concretas para minimizar el consumo de energía eléctrica de la sede y reducir sus emisiones indirectas de gases de efecto invernadero en alcance 2.</p>
      <div class="plan-kpi-grid">
        <div><span>Energía acumulada</span><strong>${fmt(d.energy)} kWh</strong></div>
        <div><span>Promedio mensual</span><strong>${fmt(d.avgMonth)} kWh/mes</strong></div>
        <div><span>Proyección anual</span><strong>${fmt(d.annualProjection)} kWh/año</strong></div>
        <div><span>CO₂e estimado</span><strong>${fmt(d.co2t)} t CO₂e</strong></div>
        <div><span>Árboles equivalentes</span><strong>${fmt(d.trees)} árboles/año</strong></div>
        <div><span>Agua registrada</span><strong>${fmt(d.water)} m³</strong></div>
      </div>
      <p class="plan-note"><strong>Lectura técnica:</strong> ${escapeHtml(d.intensity.text)}</p>
      <h3>1.1 Panel gráfico del diagnóstico</h3>
      <p>Las siguientes gráficas presentan los principales indicadores medibles y comparables de la sede: energía, agua, CO₂e, árboles equivalentes y, cuando aplica, residuos/aseo. Estas visualizaciones también quedan integradas en el informe generado para consulta, impresión o descarga.</p>
      ${summaryCards}
      ${monthlyCharts}

      <h3>2. Declaración de compromiso institucional</h3>
      <p>La sede educativa <strong>${escapeHtml(d.site)}</strong> se compromete a promover una gestión responsable de la energía eléctrica, asignando capacidades humanas, pedagógicas y técnicas para reducir progresivamente su huella de carbono y fortalecer una cultura ambiental escolar.</p>

      <h3>3. Objetivo general</h3>
      <p>Reducir la huella de carbono en alcance 2 de la sede <strong>${escapeHtml(d.site)}</strong> mediante estrategias de eficiencia energética, monitoreo del consumo, educación ambiental y evaluación de soluciones solares fotovoltaicas.</p>

      <h3>4. Metas de reducción sugeridas</h3>
      <table class="plan-table">
        <thead><tr><th>Horizonte</th><th>Meta</th><th>Reducción estimada</th><th>CO₂e evitado estimado</th></tr></thead>
        <tbody>
          <tr><td>Corto plazo · 1 año</td><td>Reducir 15% del consumo mediante hábitos, control operativo, sensores y LED.</td><td>${fmt(d.target15)} kWh/año</td><td>${fmt(d.co2Target15)} t CO₂e/año</td></tr>
          <tr><td>Mediano plazo · 3 años</td><td>Reducir 40% mediante eficiencia energética integral y gestión sistemática.</td><td>${fmt(d.target40)} kWh/año</td><td>${fmt(d.co2Target40)} t CO₂e/año</td></tr>
          <tr><td>Escenario solar</td><td>Reducir hasta 80% de compra a la red, sujeto a cubierta disponible, radiación y dimensionamiento.</td><td>${fmt(d.solar80)} kWh/año</td><td>${fmt(d.co2Solar80)} t CO₂e/año</td></tr>
        </tbody>
      </table>
      ${reductionCharts}

      <h3>5. Acciones recomendadas para minimizar el consumo eléctrico</h3>
      <div class="actions-grid">
        <div><strong>Diagnóstico y línea base</strong><p>Revisar facturas mensuales, validar medidores, construir tendencia kWh/mes y detectar meses atípicos.</p></div>
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

      <h3>7. Indicadores de seguimiento</h3>
      <table class="plan-table compact">
        <thead><tr><th>Indicador</th><th>Fórmula</th><th>Frecuencia</th><th>Meta</th></tr></thead>
        <tbody>
          <tr><td>Consumo eléctrico mensual</td><td>kWh facturados por mes</td><td>Mensual</td><td>Disminución progresiva</td></tr>
          <tr><td>Emisiones alcance 2</td><td>kWh × ${fmt(FACTOR_CO2_KG_KWH)} kg CO₂e/kWh</td><td>Mensual</td><td>Reducir 15% en un año</td></tr>
          <tr><td>Árboles equivalentes</td><td>kg CO₂e ÷ ${fmt(TREE_CO2_KG_YEAR)} kg/árbol/año</td><td>Semestral</td><td>Disminuir necesidad de compensación</td></tr>
          <tr><td>Cultura energética</td><td>Personas capacitadas ÷ población objetivo × 100</td><td>Semestral</td><td>Capacitar mínimo 80%</td></tr>
        </tbody>
      </table>

      <h3>8. Registros mensuales usados por el plan</h3>
      <p>La siguiente tabla resume los datos importados que soportan el diagnóstico y las comparaciones del plan de gestión. Se incluyen los principales indicadores mensuales medibles para la sede.</p>
      <table class="plan-table compact">
        <thead><tr><th>Periodo</th><th>Energía</th><th>Agua</th><th>CO₂e</th><th>Árboles</th><th>Residuos</th><th>Fuente</th></tr></thead>
        <tbody>${monthlyRows}</tbody>
      </table>

      <h3>9. Responsable y seguimiento</h3>
      <p><strong>Responsable sugerido:</strong> líder ambiental de la sede, comité escolar ambiental, directivos docentes y equipo de apoyo técnico. <strong>Frecuencia:</strong> mensual para carga de facturas, semestral para revisión del plan y anual para informe de resultados.</p>
    </article>`;
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


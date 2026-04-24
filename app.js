/* SiMeCO2 Servicios Públicos - v7 data/PDF scanner */
let FACTOR_CO2_KG_KWH = 0.126; // kg CO2e/kWh. Ajustable desde el dashboard.
let TREE_CO2_KG_YEAR = 22; // kg CO2e capturados por árbol al año. Ajustable desde el dashboard.
const FACTOR_KEY = 'simeco2_factores_ambientales_v8';
const STORE_KEY = 'simeco2_servicios_v7';
const CONFIG_KEY = 'simeco2_repo_config_v7';

const $ = (id)=>document.getElementById(id);
const state = loadStore();
let chartData = [];

window.addEventListener('load', () => {
  initPdfJs();
  initConfig();
  initFactors();
  bindEvents();
  renderAll();
  log('Sistema listo. Sube los PDF a /data y presiona “Buscar nuevos PDF en /data”.');
});

function initPdfJs(){
  if(window.pdfjsLib){
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    $('pdfStatus').textContent = 'PDF.js activo';
  } else {
    $('pdfStatus').textContent = 'PDF.js no cargó';
    $('pdfStatus').classList.add('bad');
  }
}
function bindEvents(){
  $("scanDataBtn").addEventListener("click", scanDataFolder);
  $("localPdfInput").addEventListener("change", handleLocalPdf);
  $("clearBtn").addEventListener("click", ()=>{ if(confirm("¿Reiniciar todos los datos importados?")){ localStorage.removeItem(STORE_KEY); location.reload(); }});
  $("saveRepoBtn").addEventListener("click", saveConfig);
  if($("updateFactorsBtn")) $("updateFactorsBtn").addEventListener("click", updateFactors);
  ["siteSearch","periodFilter","serviceFilter"].forEach(id=>$(id).addEventListener("input", ()=>{ renderTable(); renderDashboard(); }));
  $("exportCsvBtn").addEventListener("click", exportCsv);
  $("exportJsonBtn").addEventListener("click", exportJson);
  $("compareBtn").addEventListener("click", comparePeriods);
  if($("printPlanBtn")) $("printPlanBtn").addEventListener("click", printCurrentPlan);
  if($("downloadPlanBtn")) $("downloadPlanBtn").addEventListener("click", downloadCurrentPlan);
  if($("environmentBody")) $("environmentBody").addEventListener("click", handlePlanButtonClick);
  document.addEventListener("click", handlePlanButtonClick);
}
function initConfig(){
  const cfg = loadConfig();
  const detected = detectGitHubRepo();
  $('repoOwner').value = cfg.owner || detected.owner || '';
  $('repoName').value = cfg.repo || detected.repo || '';
  $('repoBranch').value = cfg.branch || 'main';
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
  const cfg = { owner:$('repoOwner').value.trim(), repo:$('repoName').value.trim(), branch:$('repoBranch').value.trim()||'main' };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  log(`Configuración guardada: ${cfg.owner}/${cfg.repo}@${cfg.branch}`);
}
function loadStore(){
  try{ return JSON.parse(localStorage.getItem(STORE_KEY)) || {records:[], files:{}, sites:{}}; }
  catch{ return {records:[], files:{}, sites:{}}; }
}
function saveStore(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function log(msg){
  const t = new Date().toLocaleTimeString();
  $('logBox').textContent += `[${t}] ${msg}\n`;
  $('logBox').scrollTop = $('logBox').scrollHeight;
}

async function scanDataFolder(){
  log('Buscando PDFs nuevos en carpeta /data...');
  const cfg = { owner:$('repoOwner').value.trim(), repo:$('repoName').value.trim(), branch:$('repoBranch').value.trim()||'main' };
  let files = [];
  if(cfg.owner && cfg.repo){
    try{
      const api = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/data?ref=${encodeURIComponent(cfg.branch)}`;
      const res = await fetch(api, {cache:'no-store'});
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
      const res = await fetch('data/manifest.json?ts='+Date.now(), {cache:'no-store'});
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
    return;
  }
  let imported=0, skipped=0, failed=0;
  for(const file of files){
    const fingerprint = file.sha || file.url || file.name;
    if(state.files[fingerprint]){ skipped++; continue; }
    try{
      log(`Importando ${file.name}...`);
      const buf = await (await fetch(file.url, {cache:'no-store'})).arrayBuffer();
      const result = await parsePdfArrayBuffer(buf, file.name, file.url);
      if(result.records.length){
        addImport(result, fingerprint);
        imported++;
        log(`OK ${file.name}: ${result.records.length} registros, periodo ${result.period}.`);
      }else{
        failed++;
        log(`Sin registros estructurados en ${file.name}. Muestra: ${result.sample.slice(0,500).replace(/\s+/g,' ')}`);
      }
    }catch(err){ failed++; log(`Error importando ${file.name}: ${err.message}`); }
  }
  log(`Proceso terminado. Importados: ${imported}. Omitidos ya existentes: ${skipped}. Fallidos: ${failed}.`);
  saveStore(); renderAll();
}
async function handleLocalPdf(ev){
  const file = ev.target.files[0]; if(!file) return;
  log(`Leyendo PDF local: ${file.name}`);
  const buf = await file.arrayBuffer();
  const result = await parsePdfArrayBuffer(buf, file.name, 'local');
  if(result.records.length){
    const fingerprint = 'local-'+file.name+'-'+file.size+'-'+file.lastModified;
    addImport(result, fingerprint);
    saveStore(); renderAll();
    log(`PDF local importado: ${result.records.length} registros, periodo ${result.period}.`);
  } else {
    log(`PDF abierto, pero no se estructuraron registros. Muestra: ${result.sample.slice(0,1000).replace(/\s+/g,' ')}`);
    alert('El PDF fue abierto, pero no se pudieron estructurar registros. Revisa el diagnóstico.');
  }
  ev.target.value='';
}
function addImport(result, fingerprint){
  const existingKeys = new Set(state.records.map(r=>r.key));
  for(const r of result.records){
    if(!existingKeys.has(r.key)) state.records.push(r);
    if(r.site) state.sites[siteKey(r.site,r.address)] = {site:r.site,address:r.address};
  }
  state.files[fingerprint] = {name:result.fileName, period:result.period, importedAt:new Date().toISOString(), count:result.records.length};
}

async function parsePdfArrayBuffer(arrayBuffer, fileName, sourceUrl){
  if(!window.pdfjsLib) throw new Error('PDF.js no está cargado.');
  const pdf = await pdfjsLib.getDocument({data:arrayBuffer}).promise;
  log(`PDF cargado: ${fileName}, ${pdf.numPages} páginas.`);
  let allText = '';
  const allLines = [];
  for(let p=1;p<=pdf.numPages;p++){
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items.map(it=>({str:it.str||'', x:it.transform[4]||0, y:it.transform[5]||0})).filter(i=>i.str.trim());
    const lines = groupTextItemsIntoLines(items);
    allLines.push(...lines.map(line=>({page:p, text:line})));
    allText += `\nPÁGINA ${p}\n` + lines.join('\n');
    if(p%40===0) log(`Leídas ${p}/${pdf.numPages} páginas...`);
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
  return {fileName, period, records, sample:allText.slice(0,3000)};
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
  let s=String(v).trim().replace(/\s/g,'');
  if(!s) return null;
  if(s.includes(',') && s.includes('.')) s=s.replace(/\./g,'').replace(',','.');
  else if(s.includes(',')) s=s.replace(',','.');
  const n=parseFloat(s); return Number.isFinite(n)?n:null;
}
function parseMoney(v){ return parseNumber(v); }
function round(n,d=2){ return Number.isFinite(n) ? Math.round(n*Math.pow(10,d))/Math.pow(10,d) : 0; }
function hasAnyMeasure(r){ return [r.waterM3,r.alcM3,r.energyKwh,r.gasM3,r.wasteValue,r.wasteTon].some(v=>v!==null && v!==undefined && v!==0); }
function siteKey(site,address=''){ return `${loose(site)}|${loose(address)}`; }

function filteredRecords(){
  const q = loose($('siteSearch').value||'');
  const p = $('periodFilter').value;
  const s = $('serviceFilter').value;
  return state.records.filter(r=>{
    if(q && !(`${loose(r.site)} ${loose(r.address)}`.includes(q))) return false;
    if(p && r.period!==p) return false;
    if(s==='energia' && !r.energyKwh) return false;
    if(s==='agua' && !r.waterM3) return false;
    if(s==='alcantarillado' && !r.alcM3) return false;
    if(s==='gas' && !r.gasM3) return false;
    if(s==='aseo' && !(r.wasteValue||r.wasteTon)) return false;
    return true;
  });
}
function renderAll(){ recalculateCo2(); renderControls(); renderCards(); renderDashboard(); renderTable(); drawChart(aggregateByPeriod(state.records)); }
function renderControls(){
  const periods = [...new Set(state.records.map(r=>r.period))].sort();
  const options = '<option value="">Todos</option>'+periods.map(p=>`<option value="${p}">${p}</option>`).join('');
  const current = $('periodFilter').value;
  $('periodFilter').innerHTML = options; $('periodFilter').value = current;
  ['compareA','compareB'].forEach(id=>$(id).innerHTML = periods.map(p=>`<option value="${p}">${p}</option>`).join(''));
  if(periods.length){ $('compareA').value=periods[Math.max(0,periods.length-2)]; $('compareB').value=periods[periods.length-1]; }
  const siteValues = Object.values(state.sites).sort((a,b)=>a.site.localeCompare(b.site));
  $('siteList').innerHTML = siteValues.map(s=>`<option value="${escapeHtml(s.site)}${s.address?' · '+escapeHtml(s.address):''}"></option>`).join('');
}
function renderCards(){
  const recs = state.records;
  const periods = new Set(recs.map(r=>r.period)).size;
  const sites = new Set(recs.map(r=>siteKey(r.site,r.address))).size;
  const sum = (field)=>recs.reduce((a,r)=>a+(Number(r[field])||0),0);
  $('kPeriods').textContent = periods;
  $('kSites').textContent = sites;
  $('kKwh').textContent = fmt(sum('energyKwh'))+' kWh';
  $('kCo2').textContent = fmt(sum('co2kg')/1000)+' t';
  if($('kTrees')) $('kTrees').textContent = fmt(Math.ceil(sum('co2kg')/TREE_CO2_KG_YEAR));
  $('kWater').textContent = fmt(sum('waterM3'))+' m³';
  $('kWaste').textContent = fmt(sum('wasteTon'))+' t';
}
function renderTable(){
  const recs = filteredRecords();
  $('recordsBody').innerHTML = recs.map(r=>`<tr>
    <td>${r.period}</td><td>${escapeHtml(r.site)}</td><td>${escapeHtml(r.address||'')}</td>
    <td>${num(r.waterM3)}</td><td>${num(r.alcM3)}</td><td>${num(r.energyKwh)}</td><td>${num(r.gasM3)}</td><td>${money(r.wasteValue)}</td><td>${num(r.wasteTon)}</td><td>${num(r.co2kg)}</td><td>${escapeHtml(r.source||'')}</td>
  </tr>`).join('') || `<tr><td colspan="11">No hay registros para los filtros seleccionados.</td></tr>`;
}
function aggregateByPeriod(records){
  const map = {};
  for(const r of records){
    map[r.period] ||= {period:r.period, energyKwh:0, waterM3:0, alcM3:0, gasM3:0, wasteTon:0, co2kg:0};
    ['energyKwh','waterM3','alcM3','gasM3','wasteTon','co2kg'].forEach(k=>map[r.period][k]+=Number(r[k])||0);
  }
  return Object.values(map).sort((a,b)=>a.period.localeCompare(b.period));
}
function comparePeriods(){
  const a=$('compareA').value, b=$('compareB').value;
  const agg = aggregateByPeriod(state.records);
  const A = agg.find(x=>x.period===a), B = agg.find(x=>x.period===b);
  if(!A||!B){ $('compareResult').innerHTML='<p class="bad">Se requieren dos periodos importados para comparar.</p>'; return; }
  const metrics=[['energyKwh','Energía','kWh'],['waterM3','Agua','m³'],['co2kg','CO₂','kg'],['wasteTon','Residuos','t']];
  $('compareResult').innerHTML = metrics.map(([k,label,unit])=>{
    const diff=(B[k]||0)-(A[k]||0); const pct=(A[k]||0)? diff/A[k]*100 : 0;
    return `<div class="metric"><span>${label}</span><strong>${fmt(diff)} ${unit}</strong><small>${a}: ${fmt(A[k])} · ${b}: ${fmt(B[k])} · ${pct>=0?'+':''}${fmt(pct)}%</small></div>`;
  }).join('');
  drawChart([A,B]);
}
function drawChart(data){
  chartData=data;
  const c=$('chart'), ctx=c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height);
  ctx.font='16px Arial'; ctx.fillStyle='#13312d'; ctx.fillText('Comparativo de energía por periodo (kWh)',24,34);
  if(!data.length){ ctx.fillText('Sin datos importados',24,80); return; }
  const pad=70, w=c.width-pad*2, h=c.height-110; const max=Math.max(...data.map(d=>d.energyKwh),1);
  ctx.strokeStyle='#d7e6e2'; ctx.beginPath(); ctx.moveTo(pad,55); ctx.lineTo(pad,55+h); ctx.lineTo(pad+w,55+h); ctx.stroke();
  const bw=Math.max(24,w/data.length*.55); const gap=w/data.length;
  data.forEach((d,i)=>{
    const x=pad+i*gap+gap/2-bw/2; const bh=(d.energyKwh/max)*h; const y=55+h-bh;
    const grad=ctx.createLinearGradient(0,y,0,55+h); grad.addColorStop(0,'#0fc39a'); grad.addColorStop(1,'#0b9878');
    ctx.fillStyle=grad; roundRect(ctx,x,y,bw,bh,10); ctx.fill();
    ctx.fillStyle='#13312d'; ctx.textAlign='center'; ctx.fillText(d.period,x+bw/2,55+h+28); ctx.fillText(fmt(d.energyKwh),x+bw/2,Math.max(72,y-8));
  });
  ctx.textAlign='left';
}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function exportCsv(){
  const recs=filteredRecords();
  const headers=['periodo','sede','direccion','agua_m3','alcantarillado_m3','energia_kwh','gas_m3','aseo_valor','residuos_t','co2_kg','fuente'];
  const rows=recs.map(r=>[r.period,r.site,r.address,r.waterM3,r.alcM3,r.energyKwh,r.gasM3,r.wasteValue,r.wasteTon,r.co2kg,r.source]);
  downloadBlob([headers,...rows].map(row=>row.map(csvCell).join(',')).join('\n'),'simeco2_servicios.csv','text/csv;charset=utf-8');
}
function exportJson(){ downloadBlob(JSON.stringify(state,null,2),'simeco2_servicios.json','application/json'); }
function downloadBlob(content,name,type){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
function csvCell(v){ const s=(v??'').toString(); return '"'+s.replace(/"/g,'""')+'"'; }
function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function fmt(n){ return new Intl.NumberFormat('es-CO',{maximumFractionDigits:2}).format(Number(n)||0); }
function num(n){ return n==null||n==='' ? '—' : fmt(n); }
function money(n){ return n==null||n==='' ? '—' : '$ '+fmt(n); }

/* Dashboard ambiental por sede - v8 */
function dashboardRecords(){
  const q = $('siteSearch') ? loose($('siteSearch').value||'') : '';
  const p = $('periodFilter') ? $('periodFilter').value : '';
  return state.records.filter(r=>{
    if(q && !(`${loose(r.site)} ${loose(r.address)}`.includes(q))) return false;
    if(p && r.period!==p) return false;
    return Number(r.energyKwh) > 0;
  });
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
    $('environmentBody').innerHTML = '<tr><td colspan="9">No hay registros de energía eléctrica para mostrar. Importa una factura PDF o revisa los filtros.</td></tr>';
    drawSiteChart([]);
    return;
  }
  const body = rows.map((r,i)=>`<tr>
    <td>${i+1}</td>
    <td>${escapeHtml(r.site)}</td>
    <td>${escapeHtml(r.address)}</td>
    <td>${fmt(r.periodCount)}</td>
    <td><strong>${fmt(r.energyKwh)}</strong></td>
    <td>${fmt(r.co2kg/1000)}</td>
    <td><strong>${fmt(r.trees)}</strong></td>
    <td>${fmt(r.avgKwhMonth)}</td>
    <td class="plan-cell"><button type="button" class="plan-btn primary" data-site-key="${escapeHtml(siteKey(r.site,r.address))}" title="Generar, visualizar y descargar el Plan de Gestión de ${escapeHtml(r.site)}">📄 Generar informe<br><small>Plan de Gestión</small></button></td>
  </tr>`).join('');
  const totalRow = `<tr class="total-row"><td colspan="4">TOTAL</td><td>${fmt(totalKwh)}</td><td>${fmt(totalCo2kg/1000)}</td><td>${fmt(totalTrees)}</td><td>—</td><td>—</td></tr>`;
  $('environmentBody').innerHTML = totalRow + body;
  drawSiteChart(rows.slice(0,12));
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
  ctx.fillText('Dato visible por sede: kWh acumulados · t CO₂e · árboles requeridos.',24,54);
  if(!rows.length){ ctx.fillStyle='#13312d'; ctx.fillText('Sin datos para graficar',24,92); return; }

  // v11: barras más cortas y columna fija para que siempre se vean kWh, CO₂e y árboles.
  const padL = 255;
  const padR = 28;
  const valueX = Math.max(735, c.width - 330);
  const top = 82;
  const rowH = 32;
  const barH = 18;
  const max = Math.max(...rows.map(r=>r.energyKwh),1);
  const maxBarW = Math.max(180, valueX - padL - 18);

  ctx.font='12px Arial';
  rows.forEach((r,i)=>{
    const y = top + i*rowH;
    const label = (r.site||'').length>34 ? r.site.slice(0,34)+'…' : r.site;

    ctx.fillStyle='#315650';
    ctx.textAlign='right';
    ctx.fillText(label, padL-12, y+14);

    const bw = Math.max(8, (r.energyKwh/max)*maxBarW);
    const grad = ctx.createLinearGradient(padL,0,padL+bw,0);
    grad.addColorStop(0,'#0b9878');
    grad.addColorStop(1,'#0fc39a');
    ctx.fillStyle=grad;
    roundRect(ctx,padL,y,bw,barH,8); ctx.fill();

    const textX = valueX;
    const available = c.width - textX - padR;
    const fullLabel = `${fmt(r.energyKwh)} kWh · ${fmt(r.co2kg/1000)} t CO₂e · ${fmt(r.trees)} árboles`;
    ctx.fillStyle='#13312d';
    ctx.textAlign='left';
    ctx.font='bold 11.5px Arial';
    ctx.fillText(fitCanvasText(ctx, fullLabel, available), textX, y+14);
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
  $('downloadPlanBtn').disabled = false;
  $('planPanel').scrollIntoView({behavior:'smooth', block:'start'});
  log(`Plan de Gestión generado para ${site}.`);
}

function classifyEnergyIntensity(avgMonth){
  if(avgMonth >= 5000) return {level:'Alta prioridad', cls:'high', text:'La sede presenta un consumo eléctrico mensual alto. Se recomienda priorizar diagnóstico técnico, medición por circuitos, sustitución LED y evaluación solar fotovoltaica.'};
  if(avgMonth >= 2000) return {level:'Prioridad media', cls:'medium', text:'La sede presenta un consumo eléctrico moderado. Se recomienda fortalecer hábitos de ahorro, optimizar iluminación y controlar horarios de equipos.'};
  return {level:'Prioridad preventiva', cls:'low', text:'La sede presenta un consumo eléctrico bajo o moderado. Se recomienda mantener monitoreo, formación ambiental y acciones preventivas de eficiencia.'};
}


function buildPlanEnergyChartSvg(recs, site){
  const rows = [...recs].sort((a,b)=>String(a.period).localeCompare(String(b.period)));
  if(!rows.length){
    return `<div class="plan-chart-empty">No hay datos suficientes para graficar el consumo de energía por periodo.</div>`;
  }
  const width = 980;
  const height = 360;
  const padL = 72;
  const padR = 24;
  const padT = 28;
  const padB = 54;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const max = Math.max(...rows.map(r=>Number(r.energyKwh)||0), 1);
  const step = chartW / rows.length;
  const barW = Math.max(30, Math.min(66, step * 0.56));

  let grid = '';
  [0,0.25,0.5,0.75,1].forEach(ratio=>{
    const y = padT + chartH - chartH*ratio;
    const value = max * ratio;
    grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${(padL+chartW).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#d9ebe5" stroke-width="1" />`;
    grid += `<text x="${padL-10}" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#6a7d78">${escapeHtml(fmt(value))}</text>`;
  });

  let bars = '';
  rows.forEach((r,i)=>{
    const value = Number(r.energyKwh)||0;
    const bh = (value / max) * chartH;
    const x = padL + i*step + step/2 - barW/2;
    const y = padT + chartH - bh;
    const label = escapeHtml(String(r.period||''));
    const valueLabel = escapeHtml(fmt(value));
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(bh,2).toFixed(1)}" rx="12" fill="url(#planBarGradient)" />`;
    bars += `<text x="${(x+barW/2).toFixed(1)}" y="${Math.max(y-8, padT+14).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="#173b35">${valueLabel}</text>`;
    bars += `<text x="${(x+barW/2).toFixed(1)}" y="${(padT+chartH+24).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="#315650">${label}</text>`;
  });

  return `
  <div class="plan-chart-wrap">
    <svg class="plan-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfica del consumo de energía eléctrica por periodo de la sede ${escapeHtml(site||'')}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="planBarGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#18c6a0"></stop>
          <stop offset="100%" stop-color="#0b9878"></stop>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="#fbfffd"></rect>
      ${grid}
      <line x1="${padL}" y1="${padT+chartH}" x2="${padL+chartW}" y2="${padT+chartH}" stroke="#adcfc5" stroke-width="1.5" />
      ${bars}
      <text x="${padL}" y="18" font-size="13" font-weight="700" fill="#173b35">kWh por periodo</text>
    </svg>
  </div>`;
}

function buildPlanHtml(d){
  const periodText = d.periods.length ? `${d.periods[0]} a ${d.periods[d.periods.length-1]} (${d.periods.length} periodo(s) importado(s))` : 'Sin periodo';
  const monthlyRows = d.recs.map(r=>`<tr><td>${escapeHtml(r.period)}</td><td>${fmt(r.energyKwh)} kWh</td><td>${fmt((Number(r.energyKwh)||0)*FACTOR_CO2_KG_KWH/1000)} t CO₂e</td><td>${fmt(Math.ceil(((Number(r.energyKwh)||0)*FACTOR_CO2_KG_KWH)/TREE_CO2_KG_YEAR))}</td><td>${escapeHtml(r.source||'PDF')}</td></tr>`).join('');
  const energyChartSvg = buildPlanEnergyChartSvg(d.recs, d.site);
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
      <div class="plan-chart-card">
        <div class="plan-chart-head">
          <h4>Consumo de energía eléctrica por periodo</h4>
          <p>Visualización del consumo facturado en cada periodo importado para la sede ${escapeHtml(d.site)}.</p>
        </div>
        ${energyChartSvg}
      </div>
      <p class="plan-note"><strong>Lectura técnica:</strong> ${escapeHtml(d.intensity.text)}</p>

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

      <h3>5. Acciones recomendadas para minimizar el consumo eléctrico</h3>
      <div class="actions-grid">
        <div><strong>Diagnóstico y línea base</strong><p>Revisar facturas mensuales, validar medidores, construir tendencia kWh/mes y detectar meses atípicos.</p></div>
        <div><strong>Iluminación eficiente</strong><p>Sustituir luminarias fluorescentes o incandescentes por LED y priorizar zonas de mayor permanencia.</p></div>
        <div><strong>Sensores y control horario</strong><p>Instalar sensores de movimiento en baños, corredores, oficinas y espacios de uso intermitente.</p></div>
        <div><strong>Gestión de computadores</strong><p>Activar suspensión automática, apagar equipos al finalizar jornada y renovar gradualmente equipos ineficientes.</p></div>
        <div><strong>Monitoreo energético</strong><p>Implementar lectura mensual y, si es posible, medidores inteligentes para seguimiento por bloques o circuitos.</p></div>
        <div><strong>Energía solar fotovoltaica</strong><p>Realizar prefactibilidad técnica para autoconsumo solar, estimando potencia requerida y retorno ambiental.</p></div>
      </div>

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
      <table class="plan-table compact">
        <thead><tr><th>Periodo</th><th>Energía</th><th>CO₂e</th><th>Árboles</th><th>Fuente</th></tr></thead>
        <tbody>${monthlyRows}</tbody>
      </table>

      <h3>9. Responsable y seguimiento</h3>
      <p><strong>Responsable sugerido:</strong> líder ambiental de la sede, comité escolar ambiental, directivos docentes y equipo de apoyo técnico. <strong>Frecuencia:</strong> mensual para carga de facturas, semestral para revisión del plan y anual para informe de resultados.</p>
    </article>`;
}

function printCurrentPlan(){
  if(!CURRENT_PLAN_HTML) return;
  const w = window.open('', '_blank');
  const css = document.querySelector('style')?.innerHTML || '';
  const linkCss = '<link rel="stylesheet" href="styles.css">';
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(CURRENT_PLAN_FILENAME)}</title>${linkCss}<style>${css}body{background:white}.plan-document{box-shadow:none}.plan-actions,.hero,footer{display:none}</style></head><body><main><section class="panel plan-panel">${CURRENT_PLAN_HTML}</section></main><script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

function downloadCurrentPlan(){
  if(!CURRENT_PLAN_HTML) return;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(CURRENT_PLAN_FILENAME)}</title><link rel="stylesheet" href="styles.css"></head><body><main><section class="panel plan-panel">${CURRENT_PLAN_HTML}</section></main></body></html>`;
  downloadBlob(html, CURRENT_PLAN_FILENAME, 'text/html;charset=utf-8');
}

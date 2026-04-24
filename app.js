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
    $('environmentBody').innerHTML = '<tr><td colspan="8">No hay registros de energía eléctrica para mostrar. Importa una factura PDF o revisa los filtros.</td></tr>';
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
  </tr>`).join('');
  const totalRow = `<tr class="total-row"><td colspan="4">TOTAL</td><td>${fmt(totalKwh)}</td><td>${fmt(totalCo2kg/1000)}</td><td>${fmt(totalTrees)}</td><td>—</td></tr>`;
  $('environmentBody').innerHTML = totalRow + body;
  drawSiteChart(rows.slice(0,12));
}
function drawSiteChart(rows){
  const c = $('siteChart');
  if(!c) return;
  const ctx = c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);
  ctx.fillStyle='#13312d';
  ctx.font='16px Arial';
  ctx.fillText('Ranking de sedes por consumo eléctrico total (kWh)',24,34);
  if(!rows.length){ ctx.fillText('Sin datos para graficar',24,78); return; }
  const padL=255, padR=40, top=60, rowH=30, barH=18;
  const max = Math.max(...rows.map(r=>r.energyKwh),1);
  const w = c.width - padL - padR;
  ctx.font='12px Arial';
  rows.forEach((r,i)=>{
    const y = top + i*rowH;
    const label = (r.site||'').length>34 ? r.site.slice(0,34)+'…' : r.site;
    ctx.fillStyle='#13312d';
    ctx.textAlign='right';
    ctx.fillText(label, padL-10, y+14);
    const bw = Math.max(2, (r.energyKwh/max)*w);
    const grad = ctx.createLinearGradient(padL,0,padL+bw,0);
    grad.addColorStop(0,'#0b9878');
    grad.addColorStop(1,'#0fc39a');
    ctx.fillStyle=grad;
    roundRect(ctx,padL,y,bw,barH,8); ctx.fill();
    ctx.fillStyle='#13312d'; ctx.textAlign='left';
    ctx.fillText(fmt(r.energyKwh)+' kWh · '+fmt(r.co2kg/1000)+' t CO₂e · '+fmt(r.trees)+' árboles', padL+bw+8, y+14);
  });
  ctx.textAlign='left';
}

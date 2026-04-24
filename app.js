/* SiMeCO2 v6 - Sistema estático con comparación mensual y exportación a /data */
const STORAGE_KEY = 'simeco2_servicios_publicos_v6';
const MONTHS = {
  enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6,
  julio:7, agosto:8, septiembre:9, setiembre:9, octubre:10, noviembre:11, diciembre:12,
  ene:1, feb:2, mar:3, abr:4, may:5, jun:6, jul:7, ago:8, sep:9, oct:10, nov:11, dic:12
};
const BASE_SITES = [
'Liceo Cristo Rey','Esc.j Acevedo Y Gome','Escuela Cristo Rey','Esc.republ.de Costa Rica','Esc.capilla Del Rosrio','Escuela La Colina','Esc. El Pradito','Escuela La Verde','Colegio Integrad','I.e Manuel J. Betancur','Liceo Mpal Prado','Inst Educ Monseñor Victor Wiedemann','Esc San Antonio','Esc. Carlos Betancur B','Institucion Educativa Fe Y Alegria El Limonar 1','Institucion Educativa Fe Y Alegria El Limonar 2','Escuela Ventanitas','Escuela Rural San Jose','Sec Esc Santa Catalina De Sena','Esc.guillermo Echavarria','Inem J F De Rpo','Colegio Octavio Calderon','Esc.urb.de La Presentac','Liceo Alcaldia De Med','Esc.antonio Jose Rtpo'
];

let state = loadState();
let lastImport = null;
let charts = {};

const $ = id => document.getElementById(id);
const logBox = $('logBox');

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

function loadState(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {records:[], sites: BASE_SITES, imports:[]}; }
  catch { return {records:[], sites: BASE_SITES, imports:[]}; }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function log(msg){ const time = new Date().toLocaleTimeString(); logBox.textContent += `\n[${time}] ${msg}`; logBox.scrollTop = logBox.scrollHeight; }
function setProgress(p){ $('progressBar').style.width = `${Math.max(0, Math.min(100, p))}%`; }
function fmt(n,dec=0){ return Number(n||0).toLocaleString('es-CO',{maximumFractionDigits:dec,minimumFractionDigits:dec}); }
function money(n){ return '$' + Number(n||0).toLocaleString('es-CO',{maximumFractionDigits:0}); }
function parseCoNumber(v){
  if(v===undefined || v===null) return 0;
  let s = String(v).trim().replace(/\s/g,'');
  if(!s || s==='-') return 0;
  s = s.replace(/[^0-9,.-]/g,'');
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
  if(lastComma > lastDot) s = s.replace(/\./g,'').replace(',','.');
  else if(lastDot > lastComma) s = s.replace(/,/g,'');
  else s = s.replace(',','.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function normalizeText(s){
  return String(s||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\bPrestaci\s+o\s+n\b/gi,'Prestacion')
    .replace(/\bEnerg\s+i\s+a\b/gi,'Energia')
    .replace(/\bfacturaci\s+o\s+n\b/gi,'facturacion')
    .replace(/\bconexi\s+o\s+n\b/gi,'conexion')
    .replace(/\bcontribuci\s+o\s+n\b/gi,'contribucion')
    .replace(/\s+/g,' ')
    .trim();
}
function compact(s){ return normalizeText(s).toLowerCase().replace(/[^a-z0-9]/g,''); }
function periodKey(year, month){ return `${year}-${String(month).padStart(2,'0')}`; }
function periodLabel(key){
  if(!key) return 'Sin periodo';
  const [y,m] = key.split('-');
  const name = Object.keys(MONTHS).find(k => MONTHS[k] === Number(m) && k.length>3) || m;
  return `${name.charAt(0).toUpperCase()+name.slice(1)} ${y}`;
}
function safeFileName(s){ return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,''); }

async function readPdf(file){
  if(!window.pdfjsLib) throw new Error('PDF.js no está disponible. Revisa la conexión a internet o sube el sistema a GitHub Pages.');
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({data: buffer}).promise;
  log(`PDF cargado correctamente: ${pdf.numPages} páginas.`);
  let pages = [];
  let full = '';
  for(let p=1; p<=pdf.numPages; p++){
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items.map(it => ({str: it.str, x: it.transform[4], y: it.transform[5]}));
    items.sort((a,b)=> Math.abs(b.y-a.y)>3 ? b.y-a.y : a.x-b.x);
    const lines = [];
    let currentY = null, line = [];
    for(const it of items){
      if(currentY===null || Math.abs(currentY-it.y)<=3){ line.push(it.str); currentY = currentY ?? it.y; }
      else { lines.push(line.join(' ')); line=[it.str]; currentY=it.y; }
    }
    if(line.length) lines.push(line.join(' '));
    const pageText = lines.join('\n');
    pages.push({page:p, text:pageText});
    full += `\nPÁGINA ${p}\n${pageText}\n`;
    if(p % 10 === 0 || p === pdf.numPages) setProgress(10 + (p/pdf.numPages)*55);
  }
  return {pages, fullText: full};
}

function detectPeriod(text, fileName=''){
  const n = normalizeText(text);
  let m = n.match(/Resumen de facturacion\s+([A-Za-z]+)\s+de\s+(20\d{2})/i);
  if(!m) m = n.match(/facturacion\s+([A-Za-z]+)\s+de\s+(20\d{2})/i);
  if(!m) m = normalizeText(fileName).match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[-_\s]*(20\d{2})/i);
  if(m){
    const monthName = m[1].toLowerCase();
    const year = Number(m[2]);
    return {month: MONTHS[monthName] || 0, year, label: `${monthName} ${year}`};
  }
  const today = new Date();
  return {month: today.getMonth()+1, year: today.getFullYear(), label: 'Periodo asignado por fecha actual'};
}

function splitServiceBlocks(text){
  // PDF.js puede extraer "Prestaci ó n". El patrón reconoce ambas formas.
  const marker = /Prestaci\s*(?:ó|o|\u00f3)?\s*n\s+del\s+servicio\s*:/gi;
  const matches = [...text.matchAll(marker)];
  log(`Marcadores encontrados por patrón flexible: ${matches.length}.`);
  const blocks = [];
  for(let i=0;i<matches.length;i++){
    const start = matches[i].index;
    const end = i+1<matches.length ? matches[i+1].index : Math.min(text.length, start+6500);
    blocks.push(text.slice(start,end));
  }
  // Fallback: buscar por texto compactado en páginas y usar aproximación por líneas.
  if(blocks.length===0){
    const lines = text.split(/\n+/);
    let current = [];
    for(const line of lines){
      if(compact(line).includes('prestaciondelservicio')){
        if(current.length) blocks.push(current.join('\n'));
        current = [line];
      } else if(current.length) current.push(line);
    }
    if(current.length) blocks.push(current.join('\n'));
    log(`Marcadores encontrados por fallback compactado: ${blocks.length}.`);
  }
  return blocks;
}

function headerFromBlock(block){
  const clean = normalizeText(block);
  const m = clean.match(/Prestacion\s+del\s+servicio\s*:\s*(.*?)\s+-\s*(.*?)\s+-\s*Municipio\s*:\s*(.*?)(?:\n|Lectura|Valores|Consumo|$)/i);
  if(m){
    return {
      site: titleCase(m[1].trim()),
      address: m[2].trim(),
      municipality: m[3].replace(/Lectura.*$/i,'').trim()
    };
  }
  const m2 = clean.match(/Prestacion\s+del\s+servicio\s*:\s*(.*?)(?:Lectura|Valores|Consumo|Producto|$)/i);
  let raw = m2 ? m2[1].trim() : 'Sede sin identificar';
  const parts = raw.split(/\s+-\s+/);
  return {site: titleCase(parts[0] || raw), address: parts.slice(1,3).join(' - '), municipality:''};
}
function titleCase(s){
  return String(s||'').toLowerCase().replace(/\b([a-záéíóúñü])/g, c => c.toUpperCase()).replace(/\bIe\b/g,'I.E.').replace(/\bEsc\b/g,'Esc.');
}
function extractSection(block, totalLabel){
  const c = normalizeText(block);
  const idx = c.toLowerCase().indexOf(totalLabel.toLowerCase());
  if(idx<0) return '';
  return c.slice(Math.max(0, idx-950), idx+220);
}
function extractConsumption(section, unit, service){
  let s = normalizeText(section);
  let re;
  if(service==='energia'){
    re = /Energia\s+ene-\d{2}\s+([\d.,]+)\s*x/i;
    let m = s.match(re); if(m) return parseCoNumber(m[1]);
    m = s.match(/([\d.,]+)\s*kWh/i); if(m) return parseCoNumber(m[1]);
  } else if(service==='gas'){
    let m = s.match(/Consumo\s+ene-\d{2}\s+([\d.,]+)\s*x/i); if(m) return parseCoNumber(m[1]);
    m = s.match(/([\d.,]+)\s*mt3/i); if(m) return parseCoNumber(m[1]);
  } else {
    let m = s.match(/Consumo\s+ene-\d{2}\s+([\d.,]+)\s*x/i); if(m) return parseCoNumber(m[1]);
    m = s.match(/([\d.,]+)\s*mt3/i); if(m) return parseCoNumber(m[1]);
  }
  return 0;
}
function extractMoney(section, label){
  const s = normalizeText(section);
  const re = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\s*\\$\\s*([\\d.,-]+)','i');
  const m = s.match(re);
  return m ? parseCoNumber(m[1]) : 0;
}
function parseBlock(block, period, factor){
  const h = headerFromBlock(block);
  const aguaSec = extractSection(block,'Total Agua');
  const alcSec = extractSection(block,'Total Alcantarillado');
  const eneSec = extractSection(block,'Total Energia');
  const gasSec = extractSection(block,'Total Gas');
  const aseoSec = extractSection(block,'Total Aseo');

  const energiaKwh = extractConsumption(eneSec,'kWh','energia');
  const aguaM3 = extractConsumption(aguaSec,'mt3','agua');
  const alcantarilladoM3 = extractConsumption(alcSec,'mt3','alcantarillado');
  const gasM3 = extractConsumption(gasSec,'mt3','gas');
  const aseoValor = extractMoney(aseoSec,'Total Aseo');

  const rec = {
    id: `${period.key}_${safeFileName(h.site)}_${safeFileName(h.address)}`,
    period: period.key, month: period.month, year: period.year,
    sede: h.site, direccion: h.address, municipio: h.municipality,
    energiaKwh, aguaM3, alcantarilladoM3, gasM3, aseoValor,
    co2Kg: +(energiaKwh * factor).toFixed(3),
    valorEnergia: extractMoney(eneSec,'Total Energia'),
    valorAgua: extractMoney(aguaSec,'Total Agua'),
    valorAlcantarillado: extractMoney(alcSec,'Total Alcantarillado'),
    valorGas: extractMoney(gasSec,'Total Gas')
  };
  const valid = rec.energiaKwh || rec.aguaM3 || rec.alcantarilladoM3 || rec.gasM3 || rec.aseoValor;
  return valid ? rec : null;
}

function addRecords(records, importInfo){
  const map = new Map(state.records.map(r => [r.id, r]));
  records.forEach(r => map.set(r.id, r));
  state.records = [...map.values()].sort((a,b)=> a.period.localeCompare(b.period) || a.sede.localeCompare(b.sede));
  const siteSet = new Set([...(state.sites||[]), ...records.map(r => r.sede).filter(Boolean)]);
  state.sites = [...siteSet].sort((a,b)=>a.localeCompare(b));
  const imports = new Map((state.imports||[]).map(i => [i.period, i]));
  imports.set(importInfo.period, importInfo);
  state.imports = [...imports.values()].sort((a,b)=>a.period.localeCompare(b.period));
  saveState(); render();
}

async function handlePdf(file){
  logBox.textContent = 'Sistema listo.';
  log('Iniciando lectura profunda del PDF...');
  setProgress(5);
  const factor = Number($('factorCO2').value || 0.126);
  const {fullText} = await readPdf(file);
  const periodRaw = detectPeriod(fullText, file.name);
  const period = { ...periodRaw, key: periodKey(periodRaw.year, periodRaw.month) };
  $('detectedMonth').value = String(period.month).padStart(2,'0');
  $('detectedYear').value = period.year;
  log(`Periodo identificado: ${periodLabel(period.key)}.`);
  setProgress(70);
  const blocks = splitServiceBlocks(fullText);
  const records = blocks.map(b => parseBlock(b, period, factor)).filter(Boolean);
  log(`Bloques leídos: ${blocks.length}. Registros válidos identificados: ${records.length}.`);
  if(records.length === 0){
    log('No se importaron registros. Muestra de texto leído:');
    log(fullText.slice(0,3500));
    alert('El PDF fue abierto, pero no se pudieron estructurar registros. Revisa el diagnóstico inferior.');
    setProgress(0); return;
  }
  const importInfo = {period: period.key, label: periodLabel(period.key), fileName:file.name, importedAt:new Date().toISOString(), records:records.length};
  addRecords(records, importInfo);
  lastImport = {period: period.key, records, importInfo};
  setProgress(100);
  log(`Importación completada. Se cargaron ${records.length} registros para ${periodLabel(period.key)}.`);
  log(`Archivo sugerido para GitHub: data/${period.key}.json`);
}

function getPeriods(){ return [...new Set(state.records.map(r=>r.period))].sort(); }
function filteredRecords(){
  const q = normalizeText($('siteSearch').value).toLowerCase();
  const service = $('serviceFilter').value;
  return state.records.filter(r => {
    const siteOk = !q || normalizeText(`${r.sede} ${r.direccion}`).toLowerCase().includes(q);
    let servOk = true;
    if(service==='energia') servOk = r.energiaKwh>0;
    if(service==='agua') servOk = r.aguaM3>0;
    if(service==='alcantarillado') servOk = r.alcantarilladoM3>0;
    if(service==='gas') servOk = r.gasM3>0;
    if(service==='aseo') servOk = r.aseoValor>0;
    return siteOk && servOk;
  });
}
function render(){
  renderSiteList(); renderPeriods(); renderStats(); renderTable(); renderComparison(); renderCharts();
}
function renderSiteList(){
  $('siteList').innerHTML = (state.sites||[]).map(s=>`<option value="${escapeHtml(s)}"></option>`).join('');
}
function renderPeriods(){
  const periods = getPeriods();
  for(const id of ['periodA','periodB']){
    const current = $(id).value;
    $(id).innerHTML = periods.map(p=>`<option value="${p}">${periodLabel(p)}</option>`).join('');
    if(periods.includes(current)) $(id).value = current;
  }
  if(periods.length){ $('periodA').value = $('periodA').value || periods[0]; $('periodB').value = $('periodB').value || periods[periods.length-1]; }
}
function sum(records, key){ return records.reduce((a,r)=>a+Number(r[key]||0),0); }
function renderStats(){
  $('statPeriods').textContent = getPeriods().length;
  $('statSites').textContent = (state.sites||[]).length;
  $('statEnergy').textContent = `${fmt(sum(state.records,'energiaKwh'),0)} kWh`;
  $('statCo2').textContent = `${fmt(sum(state.records,'co2Kg'),1)} kg`;
  $('statWater').textContent = `${fmt(sum(state.records,'aguaM3'),0)} m³`;
  $('statWaste').textContent = money(sum(state.records,'aseoValor'));
}
function renderTable(){
  const rows = filteredRecords();
  $('recordsBody').innerHTML = rows.map(r=>`<tr>
    <td>${periodLabel(r.period)}</td><td>${escapeHtml(r.sede)}</td><td>${escapeHtml(r.direccion||'')}</td>
    <td>${fmt(r.energiaKwh,1)}</td><td>${fmt(r.aguaM3,1)}</td><td>${fmt(r.alcantarilladoM3,1)}</td><td>${fmt(r.gasM3,1)}</td><td>${money(r.aseoValor)}</td><td>${fmt(r.co2Kg,1)}</td>
  </tr>`).join('');
}
function renderComparison(){
  const a = $('periodA').value, b = $('periodB').value;
  const q = normalizeText($('siteSearch').value).toLowerCase();
  const rows = state.records.filter(r => !q || normalizeText(`${r.sede} ${r.direccion}`).toLowerCase().includes(q));
  const A = rows.filter(r=>r.period===a), B = rows.filter(r=>r.period===b);
  const metrics = [
    ['energiaKwh','Energía kWh','kWh'], ['aguaM3','Agua m³','m³'], ['alcantarilladoM3','Alcantarillado m³','m³'], ['gasM3','Gas m³','m³'], ['co2Kg','CO₂ kg','kg']
  ];
  $('comparisonBox').innerHTML = metrics.map(([key,label,unit])=>{
    const va=sum(A,key), vb=sum(B,key), diff=vb-va, pct=va?diff/va*100:0;
    return `<div class="mini"><span>${label}</span><strong>${fmt(va,1)} → ${fmt(vb,1)} ${unit}</strong><small>${diff>=0?'+':''}${fmt(diff,1)} · ${va?fmt(pct,1)+'%':'sin base'}</small></div>`;
  }).join('');
}
function renderCharts(){
  const periods = getPeriods();
  const energy = periods.map(p=>sum(state.records.filter(r=>r.period===p),'energiaKwh'));
  const water = periods.map(p=>sum(state.records.filter(r=>r.period===p),'aguaM3'));
  const sewer = periods.map(p=>sum(state.records.filter(r=>r.period===p),'alcantarilladoM3'));
  const gas = periods.map(p=>sum(state.records.filter(r=>r.period===p),'gasM3'));
  const labels = periods.map(periodLabel);
  drawChart('energyChart','bar',labels,[{label:'Energía kWh',data:energy}]);
  drawChart('servicesChart','line',labels,[{label:'Agua m³',data:water},{label:'Alcantarillado m³',data:sewer},{label:'Gas m³',data:gas}]);
}
function drawChart(id,type,labels,datasets){
  if(charts[id]) charts[id].destroy();
  charts[id] = new Chart($(id), {type, data:{labels,datasets}, options:{responsive:true,plugins:{legend:{position:'bottom'}},scales:{y:{beginAtZero:true}}}});
}
function escapeHtml(s){ return String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

function makeExportObject(period=null){
  const records = period ? state.records.filter(r=>r.period===period) : state.records;
  return {system:'SiMeCO2 Servicios Publicos', version:'6.0', exportedAt:new Date().toISOString(), period, records, sites:state.sites, imports:state.imports};
}
function downloadBlob(name, content, type='application/json'){
  const blob = new Blob([content], {type});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
function downloadDataJson(){
  const period = lastImport?.period || $('periodB').value || null;
  const obj = makeExportObject(period);
  const name = period ? `${period}.json` : 'simeco2_historico.json';
  downloadBlob(name, JSON.stringify(obj,null,2));
  log(`JSON descargado. Súbelo a la carpeta data/${name} de GitHub.`);
}
function exportCsv(){
  const headers = ['periodo','sede','direccion','energia_kwh','agua_m3','alcantarillado_m3','gas_m3','aseo_valor','co2_kg','valor_energia','valor_agua','valor_alcantarillado','valor_gas'];
  const lines = [headers.join(';')];
  filteredRecords().forEach(r=>lines.push(headers.map(h=>`"${String(mapCsv(r,h)).replace(/"/g,'""')}"`).join(';')));
  downloadBlob('simeco2_registros.csv', lines.join('\n'), 'text/csv;charset=utf-8');
}
function mapCsv(r,h){ return ({periodo:r.period,sede:r.sede,direccion:r.direccion,energia_kwh:r.energiaKwh,agua_m3:r.aguaM3,alcantarillado_m3:r.alcantarilladoM3,gas_m3:r.gasM3,aseo_valor:r.aseoValor,co2_kg:r.co2Kg,valor_energia:r.valorEnergia,valor_agua:r.valorAgua,valor_alcantarillado:r.valorAlcantarillado,valor_gas:r.valorGas})[h] ?? ''; }
async function saveToGitHub(){
  const owner=$('ghOwner').value.trim(), repo=$('ghRepo').value.trim(), branch=$('ghBranch').value.trim()||'main', token=$('ghToken').value.trim();
  const period = lastImport?.period || $('periodB').value;
  if(!owner || !repo || !token || !period){ alert('Completa owner, repo, token y carga o selecciona un periodo.'); return; }
  const path = `data/${period}.json`;
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(makeExportObject(period),null,2))));
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  let sha;
  try{
    const existing = await fetch(`${api}?ref=${encodeURIComponent(branch)}`, {headers:{Authorization:`Bearer ${token}`, Accept:'application/vnd.github+json'}});
    if(existing.ok){ const j = await existing.json(); sha = j.sha; }
  }catch(e){ console.warn(e); }
  const res = await fetch(api, {method:'PUT', headers:{Authorization:`Bearer ${token}`, Accept:'application/vnd.github+json'}, body:JSON.stringify({message:`SiMeCO2: guardar factura ${period}`, content, branch, ...(sha?{sha}:{})})});
  if(!res.ok){ const txt = await res.text(); log(`Error GitHub: ${txt}`); alert('No se pudo guardar en GitHub. Revisa token/permisos.'); return; }
  log(`Guardado correctamente en GitHub: ${path}`); alert(`Guardado en GitHub: ${path}`);
}
function importJson(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const obj = JSON.parse(reader.result);
      const records = Array.isArray(obj.records) ? obj.records : [];
      addRecords(records, {period: obj.period || 'historico', label: obj.period || 'Histórico', fileName:file.name, importedAt:new Date().toISOString(), records:records.length});
      log(`JSON histórico importado: ${records.length} registros.`);
    }catch(e){ alert('JSON inválido.'); }
  };
  reader.readAsText(file);
}

$('pdfInput').addEventListener('change', e => { const f=e.target.files[0]; if(f) handlePdf(f).catch(err=>{log('Error: '+err.message); alert(err.message);}); });
$('btnClear').addEventListener('click',()=>{ if(confirm('¿Reiniciar todos los datos locales?')){ state={records:[], sites:BASE_SITES, imports:[]}; saveState(); render(); logBox.textContent='Datos locales reiniciados.'; }});
$('btnDownloadData').addEventListener('click', downloadDataJson);
$('btnSaveGitHub').addEventListener('click', saveToGitHub);
$('btnCsv').addEventListener('click', exportCsv);
$('btnPrint').addEventListener('click', ()=>window.print());
$('btnImportJson').addEventListener('click', ()=>$('jsonInput').click());
$('jsonInput').addEventListener('change', e=>{ const f=e.target.files[0]; if(f) importJson(f); });
['siteSearch','periodA','periodB','serviceFilter'].forEach(id=>$(id).addEventListener('input',()=>{renderTable();renderComparison();}));
$('factorCO2').addEventListener('change',()=>{ const factor=Number($('factorCO2').value||0.126); state.records.forEach(r=>r.co2Kg=+(Number(r.energiaKwh||0)*factor).toFixed(3)); saveState(); render(); });

render();

(() => {
'use strict';
const $ = id => document.getElementById(id);
const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const mapsUrl = (address,schoolName='') => {
  const raw=String(address||'').replace(/^\s*\d+\s+sedes:\s*/i,'').trim();
  const school=String(schoolName||'').replace(/\s+/g,' ').trim();
  if(!raw || /sin direcci[oó]n/i.test(raw)) return '';
  const query=[school,raw,'Medellín','Antioquia','Colombia'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};
const mapLink = (address,label,schoolName='') => {
  const raw=String(address||'').trim(), text=String(label||raw||'Sin dirección registrada'), school=String(schoolName||'').trim();
  const url=mapsUrl(raw,school);
  return url ? `<a class="map-address school-map-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Abrir ubicación del colegio en Google Maps">🏫 ${esc(text)}</a>` : `<span class="map-address-unavailable">${esc(text)}</span>`;
};
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const nullableNumber = value => (value === null || value === undefined || value === '') ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
const fmt = (value, digits = 2) => new Intl.NumberFormat('es-CO', {maximumFractionDigits: digits}).format(number(value));
const monthLabel = period => {
  const [year, month] = String(period).split('-').map(Number);
  if (!year || !month) return period || 'Sin periodo';
  return new Intl.DateTimeFormat('es-CO', {month:'long', year:'numeric'}).format(new Date(year, month - 1, 1));
};
const safeName = value => norm(value).replace(/\s+/g, '-').slice(0, 80) || 'cuenta-servicios-publicos';
const syncNorm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9$.,%#/-]+/g, ' ').replace(/\s+/g,' ').trim();
const rawKeyOf = record => `${syncNorm(record.site)}|${syncNorm(record.address || '')}`;
const sync = window.SIMECO_TERRITORIAL_SYNC || {};
const metaOf = record => sync[rawKeyOf(record)] || {};
const keyOf = record => { const meta=metaOf(record); return meta.institutionGroupId ? `institution:${norm(meta.institutionGroupId)}` : rawKeyOf(record); };
const serviceExceptions = Array.isArray(window.SIMECO_SERVICE_EXCEPTIONS?.exceptions) ? window.SIMECO_SERVICE_EXCEPTIONS.exceptions : [];
const serviceExceptionFor = item => serviceExceptions.find(ex => ex.service === 'energyKwh' && norm(ex.key||'') === norm(`${item.site}|${item.address}`)) || null;
const records = (Array.isArray(window.SIMECO_REGISTROS) ? window.SIMECO_REGISTROS : [])
  .filter(r => r && r.site && r.period)
  .map(r => {
    const energyKwh=nullableNumber(r.energyKwh);
    return {...r, energyKwh, co2kg:energyKwh===null?null:(nullableNumber(r.co2kg) ?? energyKwh * 0.126), waterM3:nullableNumber(r.waterM3), alcM3:nullableNumber(r.alcM3), gasM3:nullableNumber(r.gasM3), wasteTon:nullableNumber(r.wasteTon), page:Math.max(1, Number(r.page) || 1)};
  });
const institutions = new Map();
for (const record of records) {
  const key = keyOf(record), recordMeta=metaOf(record);
  if (!institutions.has(key)) institutions.set(key, {key, site:record.site, displaySite:recordMeta.institutionDisplayName||recordMeta.displayName||record.site, address:record.address || '', meta:recordMeta, records:[], addresses:new Set(), invoiceSites:new Set(), roles:new Set()});
  const item=institutions.get(key);
  item.records.push(record);
  if(record.address) item.addresses.add(record.address);
  if(record.site) item.invoiceSites.add(record.site);
  if(recordMeta.institutionRole) item.roles.add(recordMeta.institutionRole);
}
for(const item of institutions.values()){
  if(item.addresses.size>1) item.address=`${item.addresses.size} sedes: ${[...item.addresses].join(' · ')}`;
}
const institutionList = [...institutions.values()].sort((a,b) => (a.displaySite||a.site).localeCompare(b.displaySite||b.site, 'es', {numeric:true}));
let selectedKey = '';
let suggestionIndex = -1;
let institutionSearchTimer = 0;

function unique(values) { return [...new Set(values.filter(Boolean))]; }
function selectedInstitution() { return institutions.get(selectedKey) || null; }
function populateGlobalFilters() {
  const years = unique(records.map(r => r.period.slice(0,4))).sort();
  $('institutionYear').innerHTML = '<option value="">Todos</option>' + years.map(y => `<option value="${esc(y)}">${esc(y)}</option>`).join('');
  refreshPeriodFilter();
}
function refreshPeriodFilter() {
  const year = $('institutionYear').value;
  const institution = selectedInstitution();
  const source = institution ? institution.records : records;
  const periods = unique(source.map(r => r.period).filter(p => !year || p.startsWith(year))).sort();
  const current = $('institutionPeriod').value;
  $('institutionPeriod').innerHTML = '<option value="">Todos los meses</option>' + periods.map(p => `<option value="${esc(p)}">${esc(monthLabel(p))}</option>`).join('');
  if (periods.includes(current)) $('institutionPeriod').value = current;
}
function showSuggestions(query) {
  const box = $('institutionSuggestions');
  const q = norm(query);
  if (!q) { box.hidden = true; box.innerHTML = ''; return; }
  const matches = institutionList.filter(item => {
    const meta=item.meta||{};
    const memberText=item.records.map(r=>{const m=metaOf(r);return `${r.site} ${r.address||''} ${m.displayName||''} ${m.matchedName||''} ${m.aliases||''} ${m.institutionRole||''}`;}).join(' ');
    return norm(`${item.displaySite||''} ${item.site} ${item.address} ${meta.institutionDisplayName||''} ${meta.matchedName||''} ${meta.aliases||''} ${memberText}`).includes(q);
  }).slice(0, 15);
  box.innerHTML = matches.map((item, index) => `<button type="button" role="option" data-key="${esc(item.key)}" data-index="${index}"><strong>${esc(item.displaySite||item.site)}</strong><span>${item.invoiceSites?.size>1?`En factura: ${esc([...item.invoiceSites].join(' / '))} · `:(item.displaySite!==item.site?`En factura: ${esc(item.site)} · `:'')}${item.address?`<span class="map-address-action school-map-action" data-map-address="${esc(item.address)}" data-map-school="${esc(item.displaySite||item.site)}" title="Abrir ubicación precisa del colegio en Google Maps">🏫 ${esc(item.address)}</span>`:'Sin dirección registrada'}</span></button>`).join('');
  box.hidden = !matches.length;
  suggestionIndex = -1;
}
function selectInstitution(key) {
  const item = institutions.get(key);
  if (!item) return;
  selectedKey = key;
  $('institutionSearch').value = item.displaySite || item.site;
  $('institutionSuggestions').hidden = true;
  refreshPeriodFilter();
  renderReport();
}
function filteredInstitutionRecords(item) {
  const year = $('institutionYear').value;
  const period = $('institutionPeriod').value;
  return item.records.filter(r => (!year || r.period.startsWith(year)) && (!period || r.period === period));
}
function monthlySummary(recordsForInstitution) {
  const map = new Map();
  for (const r of recordsForInstitution) {
    if (!map.has(r.period)) map.set(r.period, {period:r.period, energy:0, co2:0, water:0, alc:0, gas:0, waste:0, counts:{energy:0,co2:0,water:0,alc:0,gas:0,waste:0}, sources:new Map()});
    const row = map.get(r.period);
    [['energyKwh','energy'],['co2kg','co2'],['waterM3','water'],['alcM3','alc'],['gasM3','gas'],['wasteTon','waste']].forEach(([field,key])=>{
      if(r[field]!==null && r[field]!==undefined && Number.isFinite(Number(r[field]))){row[key]+=Number(r[field]);row.counts[key]+=1;}
    });
    const sourceKey = `${r.sourceUrl || `data/${r.source}`}|${r.page}`;
    if (!row.sources.has(sourceKey)) row.sources.set(sourceKey, {url:r.sourceUrl || `data/${r.source}`, source:r.source || (r.sourceUrl || '').split('/').pop(), page:r.page});
  }
  return [...map.values()].sort((a,b) => b.period.localeCompare(a.period));
}
function serviceValue(value, unit, available=true, missingText='Sin dato') { return available ? `${fmt(value)} ${unit}` : `<span class="not-available">${esc(missingText)}</span>`; }
function sourceButtons(row, institution) {
  const sources = [...row.sources.values()];
  if (!sources.length) return '<span class="not-available">Sin PDF asociado</span>';
  return sources.map((src, i) => {
    const label = sources.length > 1 ? `Cuenta ${i + 1}` : 'Ver cuenta';
    return `<div class="bill-actions">
      <a class="bill-view-button" href="${esc(src.url)}#page=${src.page}" target="_blank" rel="noopener">${label} · pág. ${src.page}</a>
      <button class="bill-download-button" type="button" data-url="${esc(src.url)}" data-page="${src.page}" data-site="${esc(institution.site)}" data-period="${esc(row.period)}">Descargar página</button>
    </div>`;
  }).join('');
}
function renderReport() {
  const item = selectedInstitution();
  if (!item) { $('institutionReport').hidden = true; $('institutionEmpty').hidden = false; return; }
  const filtered = filteredInstitutionRecords(item);
  const rows = monthlySummary(filtered);
  const meta = item.meta || {};
  $('institutionEmpty').hidden = true;
  $('institutionReport').hidden = false;
  $('institutionName').textContent = item.displaySite || item.site;
  $('institutionAddress').innerHTML = mapLink(item.address,item.address || 'Sin dirección registrada en la factura',item.displaySite||item.site);
  $('institutionMeta').innerHTML = [meta.zone, meta.commune, meta.nucleus ? `Núcleo ${meta.nucleus}` : ''].filter(v => v && v !== 'Sin clasificar').map(v => `<span>${esc(v)}</span>`).join('') || '<span>Información territorial pendiente de clasificación</span>';
  if(item.invoiceSites?.size>1) $('institutionMeta').innerHTML += `<span>${item.invoiceSites.size} sedes integradas</span><span>En factura: ${esc([...item.invoiceSites].join(' / '))}</span>`; else if(item.displaySite!==item.site) $('institutionMeta').innerHTML += `<span>En factura: ${esc(item.site)}</span>`;
  const hasEnergy=filtered.some(r=>r.energyKwh!==null), hasWater=filtered.some(r=>r.waterM3!==null), hasGas=filtered.some(r=>r.gasM3!==null), energyException=serviceExceptionFor(item);
  const energy = filtered.reduce((a,r) => a + (r.energyKwh??0), 0), co2 = filtered.reduce((a,r) => a + (r.co2kg??0), 0), water = filtered.reduce((a,r) => a + (r.waterM3??0), 0), gas = filtered.reduce((a,r) => a + (r.gasM3??0), 0);
  $('kpiMonths').textContent = fmt(rows.length, 0);
  $('kpiEnergy').textContent = hasEnergy ? `${fmt(energy)} kWh` : (energyException?'Contrato separado':'No identificada');
  $('kpiCo2').textContent = hasEnergy ? `${fmt(co2 / 1000)} t CO₂e` : (energyException?'Pendiente de integrar':'No calculable');
  $('kpiWater').textContent = hasWater ? `${fmt(water)} m³` : 'Sin dato';
  $('kpiGas').textContent = hasGas ? `${fmt(gas)} m³` : 'Sin dato';
  $('institutionBillsBody').innerHTML = rows.map(row => `<tr>
    <td><strong>${esc(monthLabel(row.period))}</strong><small>${esc(row.period)}</small></td>
    <td>${serviceValue(row.energy, 'kWh', row.counts.energy>0, energyException?'Contrato separado':'No identificada')}</td><td>${serviceValue(row.co2 / 1000, 't', row.counts.energy>0, energyException?'Pendiente de integrar':'No calculable')}</td><td>${serviceValue(row.water, 'm³', row.counts.water>0)}</td><td>${serviceValue(row.alc, 'm³', row.counts.alc>0)}</td><td>${serviceValue(row.gas, 'm³', row.counts.gas>0)}</td><td>${serviceValue(row.waste, 't', row.counts.waste>0)}</td>
    <td>${sourceButtons(row, item)}</td>
  </tr>`).join('') || '<tr><td colspan="8">No hay facturas para el año o periodo seleccionado.</td></tr>';
  const energyStatus=hasEnergy?'con energía identificada':(energyException?'con energía gestionada mediante contrato separado':'con energía no identificada en esta factura consolidada');
  const evidence=energyException?` <span class="institution-external-note"><strong>Importante:</strong> ${esc(energyException.summary||energyException.dataState||'')} ${(energyException.evidence||[]).map(ev=>`<a href="${esc(ev.url)}" target="_blank" rel="noopener">${esc(ev.title||'Evidencia')}</a>`).join(' · ')}</span>`:'';
  $('institutionSearchStatus').innerHTML = `Mostrando <strong>${fmt(rows.length,0)} mes(es)</strong> y <strong>${fmt(filtered.length,0)} registro(s)</strong> de ${esc(item.displaySite||item.site)} · ${esc(energyStatus)}.${evidence}`;
}

let pdfLibPromise=null;
function ensurePdfLib(){
  if(window.PDFLib?.PDFDocument) return Promise.resolve(window.PDFLib);
  if(pdfLibPromise) return pdfLibPromise;
  pdfLibPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
    script.async=true;
    script.onload=()=>resolve(window.PDFLib);
    script.onerror=()=>{pdfLibPromise=null;reject(new Error('No fue posible cargar la herramienta PDF.'));};
    document.head.appendChild(script);
  });
  return pdfLibPromise;
}
async function downloadPage(button) {
  const originalText = button.textContent;
  button.disabled = true; button.textContent = 'Preparando…';
  try {
    await ensurePdfLib();
    if (!window.PDFLib?.PDFDocument) throw new Error('La herramienta para extraer páginas no está disponible.');
    const response = await fetch(button.dataset.url, {cache:'force-cache'});
    if (!response.ok) throw new Error(`No fue posible abrir el PDF (${response.status}).`);
    const bytes = await response.arrayBuffer();
    const sourceDoc = await PDFLib.PDFDocument.load(bytes);
    const pageIndex = Math.max(0, Number(button.dataset.page) - 1);
    if (pageIndex >= sourceDoc.getPageCount()) throw new Error('La página asociada no existe en el PDF.');
    const output = await PDFLib.PDFDocument.create();
    const [page] = await output.copyPages(sourceDoc, [pageIndex]);
    output.addPage(page);
    output.setTitle(`Cuenta de servicios públicos - ${button.dataset.site} - ${button.dataset.period}`);
    const outputBytes = await output.save();
    const blob = new Blob([outputBytes], {type:'application/pdf'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `${safeName(button.dataset.site)}-${button.dataset.period}-pagina-${button.dataset.page}.pdf`;
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    button.textContent = 'Descargada ✓';
  } catch (error) {
    console.error(error);
    window.open(`${button.dataset.url}#page=${button.dataset.page}`, '_blank', 'noopener');
    button.textContent = 'PDF abierto';
  } finally { setTimeout(() => { button.disabled = false; button.textContent = originalText; }, 1800); }
}
function reset() {
  selectedKey = ''; $('institutionSearch').value = ''; $('institutionYear').value = ''; refreshPeriodFilter(); $('institutionPeriod').value = ''; $('institutionSuggestions').hidden = true; $('institutionReport').hidden = true; $('institutionEmpty').hidden = false; $('institutionSearchStatus').textContent = `${fmt(institutionList.length,0)} instituciones o sedes disponibles en la base de facturas.`;
}
document.addEventListener('DOMContentLoaded', () => {
  const status = $('institutionSearchStatus');
  if (!status) { console.error('SiMeCO₂: no se encontró el contenedor del módulo institucional.'); return; }
  if (!records.length) {
    status.innerHTML = '<strong>No fue posible cargar la base consolidada de facturas.</strong> Verifica que la carpeta <code>data</code> y el archivo <code>registros.js</code> estén publicados junto a esta página.';
    const empty = $('institutionEmpty');
    if (empty) { empty.hidden = false; empty.querySelector('h2').textContent = 'Base de facturas no disponible'; empty.querySelector('p').textContent = 'Recarga la página o comprueba la publicación completa del proyecto.'; }
    return;
  }
  populateGlobalFilters();
  $('institutionSearchStatus').textContent = `${fmt(institutionList.length,0)} instituciones o sedes disponibles en la base de facturas.`;
  $('institutionSearch').addEventListener('input', e => { selectedKey = ''; clearTimeout(institutionSearchTimer); const value=e.target.value; institutionSearchTimer=setTimeout(()=>requestAnimationFrame(()=>showSuggestions(value)),35); });
  $('institutionSearch').addEventListener('keydown', e => {
    const buttons = [...$('institutionSuggestions').querySelectorAll('button')];
    if (!buttons.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); suggestionIndex = e.key === 'ArrowDown' ? Math.min(buttons.length - 1, suggestionIndex + 1) : Math.max(0, suggestionIndex - 1); buttons.forEach((b,i) => b.classList.toggle('active', i === suggestionIndex)); }
    if (e.key === 'Enter' && suggestionIndex >= 0) { e.preventDefault(); selectInstitution(buttons[suggestionIndex].dataset.key); }
  });
  $('institutionSuggestions').addEventListener('click', e => {
    const map=e.target.closest('[data-map-address]');
    if(map){e.preventDefault();e.stopPropagation();const url=mapsUrl(map.dataset.mapAddress,map.dataset.mapSchool||'');if(url)window.open(url,'_blank','noopener,noreferrer');return;}
    const button = e.target.closest('button[data-key]'); if (button) selectInstitution(button.dataset.key);
  });
  document.addEventListener('click', e => { if (!e.target.closest('.institutional-search-field')) $('institutionSuggestions').hidden = true; });
  $('institutionYear').addEventListener('change', () => { refreshPeriodFilter(); renderReport(); });
  $('institutionPeriod').addEventListener('change', renderReport);
  $('clearInstitutionBtn').addEventListener('click', reset);
  $('institutionBillsBody').addEventListener('click', e => { const button = e.target.closest('.bill-download-button'); if (button) downloadPage(button); });
});
})();

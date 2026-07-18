(() => {
'use strict';
const $ = id => document.getElementById(id);
const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const fmt = (value, digits = 2) => new Intl.NumberFormat('es-CO', {maximumFractionDigits: digits}).format(number(value));
const monthLabel = period => {
  const [year, month] = String(period).split('-').map(Number);
  if (!year || !month) return period || 'Sin periodo';
  return new Intl.DateTimeFormat('es-CO', {month:'long', year:'numeric'}).format(new Date(year, month - 1, 1));
};
const safeName = value => norm(value).replace(/\s+/g, '-').slice(0, 80) || 'cuenta-servicios-publicos';
const keyOf = record => `${norm(record.site)}|${norm(record.address || '')}`;
const records = (Array.isArray(window.SIMECO_REGISTROS) ? window.SIMECO_REGISTROS : [])
  .filter(r => r && r.site && r.period)
  .map(r => ({...r, energyKwh:number(r.energyKwh), co2kg:number(r.co2kg) || number(r.energyKwh) * 0.126, waterM3:number(r.waterM3), alcM3:number(r.alcM3), gasM3:number(r.gasM3), wasteTon:number(r.wasteTon), page:Math.max(1, Number(r.page) || 1)}));
const sync = window.SIMECO_TERRITORIAL_SYNC || {};
const institutions = new Map();
for (const record of records) {
  const key = keyOf(record);
  if (!institutions.has(key)) institutions.set(key, {key, site:record.site, address:record.address || '', records:[]});
  institutions.get(key).records.push(record);
}
const institutionList = [...institutions.values()].sort((a,b) => a.site.localeCompare(b.site, 'es', {numeric:true}));
let selectedKey = '';
let suggestionIndex = -1;

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
  const matches = institutionList.filter(item => norm(`${item.site} ${item.address}`).includes(q)).slice(0, 15);
  box.innerHTML = matches.map((item, index) => `<button type="button" role="option" data-key="${esc(item.key)}" data-index="${index}"><strong>${esc(item.site)}</strong><span>${esc(item.address || 'Sin dirección registrada')}</span></button>`).join('');
  box.hidden = !matches.length;
  suggestionIndex = -1;
}
function selectInstitution(key) {
  const item = institutions.get(key);
  if (!item) return;
  selectedKey = key;
  $('institutionSearch').value = item.site;
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
    if (!map.has(r.period)) map.set(r.period, {period:r.period, energy:0, co2:0, water:0, alc:0, gas:0, waste:0, sources:new Map()});
    const row = map.get(r.period);
    row.energy += r.energyKwh; row.co2 += r.co2kg; row.water += r.waterM3; row.alc += r.alcM3; row.gas += r.gasM3; row.waste += r.wasteTon;
    const sourceKey = `${r.sourceUrl || `data/${r.source}`}|${r.page}`;
    if (!row.sources.has(sourceKey)) row.sources.set(sourceKey, {url:r.sourceUrl || `data/${r.source}`, source:r.source || (r.sourceUrl || '').split('/').pop(), page:r.page});
  }
  return [...map.values()].sort((a,b) => b.period.localeCompare(a.period));
}
function serviceValue(value, unit) { return value > 0 ? `${fmt(value)} ${unit}` : '<span class="not-available">No registrado</span>'; }
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
  const meta = sync[item.key] || {};
  $('institutionEmpty').hidden = true;
  $('institutionReport').hidden = false;
  $('institutionName').textContent = item.site;
  $('institutionAddress').textContent = item.address || 'Sin dirección registrada en la factura';
  $('institutionMeta').innerHTML = [meta.zone, meta.commune, meta.nucleus].filter(v => v && v !== 'Sin clasificar').map(v => `<span>${esc(v)}</span>`).join('') || '<span>Información territorial pendiente de clasificación</span>';
  const energy = filtered.reduce((a,r) => a + r.energyKwh, 0), co2 = filtered.reduce((a,r) => a + r.co2kg, 0), water = filtered.reduce((a,r) => a + r.waterM3, 0), gas = filtered.reduce((a,r) => a + r.gasM3, 0);
  $('kpiMonths').textContent = fmt(rows.length, 0);
  $('kpiEnergy').textContent = `${fmt(energy)} kWh`;
  $('kpiCo2').textContent = `${fmt(co2 / 1000)} t CO₂e`;
  $('kpiWater').textContent = `${fmt(water)} m³`;
  $('kpiGas').textContent = `${fmt(gas)} m³`;
  $('institutionBillsBody').innerHTML = rows.map(row => `<tr>
    <td><strong>${esc(monthLabel(row.period))}</strong><small>${esc(row.period)}</small></td>
    <td>${serviceValue(row.energy, 'kWh')}</td><td>${serviceValue(row.co2 / 1000, 't')}</td><td>${serviceValue(row.water, 'm³')}</td><td>${serviceValue(row.alc, 'm³')}</td><td>${serviceValue(row.gas, 'm³')}</td><td>${serviceValue(row.waste, 't')}</td>
    <td>${sourceButtons(row, item)}</td>
  </tr>`).join('') || '<tr><td colspan="8">No hay facturas para el año o periodo seleccionado.</td></tr>';
  $('institutionSearchStatus').innerHTML = `Mostrando <strong>${fmt(rows.length,0)} mes(es)</strong> y <strong>${fmt(filtered.length,0)} registro(s)</strong> de ${esc(item.site)}.`;
}
async function downloadPage(button) {
  const originalText = button.textContent;
  button.disabled = true; button.textContent = 'Preparando…';
  try {
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
  $('institutionSearch').addEventListener('input', e => { selectedKey = ''; showSuggestions(e.target.value); });
  $('institutionSearch').addEventListener('keydown', e => {
    const buttons = [...$('institutionSuggestions').querySelectorAll('button')];
    if (!buttons.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); suggestionIndex = e.key === 'ArrowDown' ? Math.min(buttons.length - 1, suggestionIndex + 1) : Math.max(0, suggestionIndex - 1); buttons.forEach((b,i) => b.classList.toggle('active', i === suggestionIndex)); }
    if (e.key === 'Enter' && suggestionIndex >= 0) { e.preventDefault(); selectInstitution(buttons[suggestionIndex].dataset.key); }
  });
  $('institutionSuggestions').addEventListener('click', e => { const button = e.target.closest('button[data-key]'); if (button) selectInstitution(button.dataset.key); });
  document.addEventListener('click', e => { if (!e.target.closest('.institutional-search-field')) $('institutionSuggestions').hidden = true; });
  $('institutionYear').addEventListener('change', () => { refreshPeriodFilter(); renderReport(); });
  $('institutionPeriod').addEventListener('change', renderReport);
  $('clearInstitutionBtn').addEventListener('click', reset);
  $('institutionBillsBody').addEventListener('click', e => { const button = e.target.closest('.bill-download-button'); if (button) downloadPage(button); });
});
})();

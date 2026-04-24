/* SiMeCO2 Servicios Publicos Educativos
   Version 4.0 - Parser compatible con facturas consolidadas EPM.
   Correccion clave: normalizacion por compactacion para detectar textos como
   "Prestaci ó n del servicio" y "Energ í a", producidos por PDF.js en algunos navegadores.
*/

(function () {
  'use strict';

  const STORAGE_KEY = 'simeco2_servicios_publicos_v4';
  const DEFAULT_FACTOR = 0.126;

  const state = {
    records: [],
    currentPeriod: new Date().toISOString().slice(0, 7),
    factor: DEFAULT_FACTOR,
    charts: {},
    lastDiagnostics: '',
  };

  const $ = (id) => document.getElementById(id);

  const el = {
    pdfFile: $('pdfFile'),
    btnSelect: $('btnSelect'),
    btnReset: $('btnReset'),
    btnDemo: $('btnDemo'),
    btnExportCsv: $('btnExportCsv'),
    btnExportJson: $('btnExportJson'),
    btnPrint: $('btnPrint'),
    periodo: $('periodo'),
    factorCo2: $('factorCo2'),
    searchInput: $('searchInput'),
    serviceFilter: $('serviceFilter'),
    dropZone: $('dropZone'),
    libraryStatus: $('libraryStatus'),
    progressPanel: $('progressPanel'),
    progressTitle: $('progressTitle'),
    progressText: $('progressText'),
    progressBar: $('progressBar'),
    logBox: $('logBox'),
    kpiKwh: $('kpiKwh'),
    kpiCo2: $('kpiCo2'),
    kpiEnergyCost: $('kpiEnergyCost'),
    kpiSites: $('kpiSites'),
    kpiWater: $('kpiWater'),
    kpiWaste: $('kpiWaste'),
    recordsTable: $('recordsTable'),
    emptyRow: $('emptyRow'),
    monthlyChart: $('monthlyChart'),
    serviceChart: $('serviceChart'),
  };

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    el.periodo.value = state.currentPeriod;
    loadState();
    bindEvents();
    setupPdfJs();
    render();
  }

  function setupPdfJs() {
    if (!window.pdfjsLib) {
      el.libraryStatus.textContent = 'PDF.js no cargó. Publica en GitHub Pages o verifica internet.';
      el.libraryStatus.classList.add('error');
      return;
    }
    const version = window.pdfjsLib.version || 'activa';
    try {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    } catch (err) {}
    el.libraryStatus.textContent = `PDF.js cargado correctamente (${version}). Listo para importar facturas EPM.`;
  }

  function bindEvents() {
    el.btnSelect.addEventListener('click', () => el.pdfFile.click());
    el.pdfFile.addEventListener('change', (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (file) processPdf(file);
      ev.target.value = '';
    });

    ['dragenter', 'dragover'].forEach((type) => {
      el.dropZone.addEventListener(type, (ev) => {
        ev.preventDefault();
        el.dropZone.classList.add('dragging');
      });
    });
    ['dragleave', 'drop'].forEach((type) => {
      el.dropZone.addEventListener(type, (ev) => {
        ev.preventDefault();
        el.dropZone.classList.remove('dragging');
      });
    });
    el.dropZone.addEventListener('drop', (ev) => {
      const file = ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (file) processPdf(file);
    });

    el.periodo.addEventListener('change', () => {
      state.currentPeriod = el.periodo.value || state.currentPeriod;
      saveState();
      render();
    });
    el.factorCo2.addEventListener('input', () => {
      state.factor = Number(el.factorCo2.value) || DEFAULT_FACTOR;
      saveState();
      render();
    });
    el.searchInput.addEventListener('input', renderTable);
    el.serviceFilter.addEventListener('change', renderTable);

    el.btnReset.addEventListener('click', () => {
      if (!confirm('¿Deseas borrar todos los registros guardados en este navegador?')) return;
      state.records = [];
      localStorage.removeItem(STORAGE_KEY);
      log('Sistema reiniciado. No hay registros almacenados.');
      render();
    });
    el.btnDemo.addEventListener('click', loadDemo);
    el.btnExportCsv.addEventListener('click', exportCsv);
    el.btnExportJson.addEventListener('click', exportJson);
    el.btnPrint.addEventListener('click', () => window.print());
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      state.records = Array.isArray(parsed.records) ? parsed.records : [];
      state.factor = Number(parsed.factor) || DEFAULT_FACTOR;
      state.currentPeriod = parsed.currentPeriod || state.currentPeriod;
      el.periodo.value = state.currentPeriod;
      el.factorCo2.value = state.factor;
    } catch (err) {
      console.warn('No se pudo cargar estado local', err);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      records: state.records,
      factor: state.factor,
      currentPeriod: state.currentPeriod,
      updatedAt: new Date().toISOString(),
    }));
  }

  async function processPdf(file) {
    if (!window.pdfjsLib) {
      alert('PDF.js no está disponible. Publica el sistema en GitHub Pages o verifica conexión a internet.');
      return;
    }

    const periodo = el.periodo.value || inferPeriodFromFile(file.name) || state.currentPeriod;
    state.currentPeriod = periodo;
    el.periodo.value = periodo;

    showProgress('Procesando PDF...', 0);
    clearLog();
    log('Iniciando lectura profunda del PDF...');
    log(`Archivo: ${file.name} (${formatBytes(file.size)}). Periodo asignado: ${periodo}.`);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      log(`PDF cargado correctamente: ${pdf.numPages} páginas.`);

      const extraction = await extractPdfText(pdf);
      log(`Extracción terminada. Líneas leídas: ${extraction.lines.length.toLocaleString('es-CO')}. Items PDF: ${extraction.itemsCount.toLocaleString('es-CO')}.`);
      log(`Muestra normalizada de página 3: ${samplePage(extraction.pages, 3)}`);

      const parsed = parseEpmInvoice(extraction, periodo);
      state.lastDiagnostics = parsed.diagnostics;
      log(parsed.diagnostics);

      if (!parsed.records.length) {
        const summary = parseConsolidatedSummary(extraction.fullText, periodo);
        if (summary) {
          log('No se estructuraron sedes individuales, pero se importó el resumen consolidado de la página 1.');
          parsed.records.push(summary);
        }
      }

      if (!parsed.records.length) {
        log('No se importaron registros. Revisa la muestra de texto:');
        log(extraction.fullText.slice(0, 5000));
        alert('El PDF fue abierto, pero no se pudieron estructurar registros. El diagnóstico quedó visible en la caja de proceso.');
        hideProgressLater(false);
        return;
      }

      mergeRecords(parsed.records, periodo);
      saveState();
      render();
      showProgress(`Importación completada: ${parsed.records.length} registros`, 100);
      log(`Importación completada. Registros incorporados para ${periodo}: ${parsed.records.length}.`);
      log(`Energía importada: ${formatNumber(sum(parsed.records, 'energia_kwh'))} kWh. Agua: ${formatNumber(sum(parsed.records, 'agua_m3'))} m³.`);
      hideProgressLater(true);
    } catch (err) {
      console.error(err);
      log(`ERROR: ${err.message || err}`);
      alert('No fue posible procesar el PDF. Revisa el diagnóstico visible en pantalla.');
      hideProgressLater(false);
    }
  }

  async function extractPdfText(pdf) {
    const pages = [];
    let itemsCount = 0;
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
      itemsCount += textContent.items.length;
      const lines = itemsToLines(textContent.items);
      const plain = textContent.items.map((it) => it.str || '').join(' ');
      pages.push({ pageNum, lines, plain });
      if (pageNum % 10 === 0 || pageNum === pdf.numPages) {
        showProgress('Leyendo texto del PDF...', Math.round((pageNum / pdf.numPages) * 55));
      }
    }
    const lines = pages.flatMap((p) => [`PÁGINA ${p.pageNum}`, ...p.lines]);
    const fullText = pages.map((p) => `PÁGINA ${p.pageNum}\n${p.lines.join('\n')}`).join('\n\n');
    return { pages, lines, fullText, itemsCount };
  }

  function itemsToLines(items) {
    const cleanItems = items
      .filter((it) => (it.str || '').trim())
      .map((it) => ({
        text: String(it.str || '').trim(),
        x: it.transform ? it.transform[4] : 0,
        y: it.transform ? it.transform[5] : 0,
        h: Math.abs(it.height || 0),
      }))
      .sort((a, b) => (Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x));

    const rows = [];
    for (const item of cleanItems) {
      let row = rows.find((r) => Math.abs(r.y - item.y) <= 3);
      if (!row) {
        row = { y: item.y, items: [] };
        rows.push(row);
      }
      row.items.push(item);
      row.y = (row.y * (row.items.length - 1) + item.y) / row.items.length;
    }

    rows.sort((a, b) => b.y - a.y);
    return rows.map((row) => row.items.sort((a, b) => a.x - b.x).map((it) => it.text).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  }

  function parseEpmInvoice(extraction, periodo) {
    showProgress('Estructurando registros...', 65);
    const lineRecords = parseFromLines(extraction.lines, periodo, 'líneas por coordenadas');
    const flatRecords = parseFromFlatText(extraction.fullText, periodo);

    let records = lineRecords.records;
    let method = lineRecords.records.length ? 'líneas por coordenadas' : 'lectura plana alternativa';
    if (!records.length && flatRecords.records.length) records = flatRecords.records;

    // Si ambos métodos producen datos, combinar por sede/dirección para rescatar servicios faltantes.
    if (lineRecords.records.length && flatRecords.records.length) {
      records = combineRecordSets(lineRecords.records, flatRecords.records);
      method = 'combinado líneas + lectura plana';
    }

    const diagnostics = [
      `Marcadores "Prestación del servicio" encontrados: líneas=${lineRecords.markers}, lectura plana=${flatRecords.markers}.`,
      `Método usado: ${method}.`,
      `Registros válidos identificados: ${records.length}.`,
      `Nota técnica: el parser usa compactación de texto para reconocer casos como "Prestaci ó n" y "Energ í a".`,
    ].join('\n');

    return { records: records.map(enrichRecord), diagnostics };
  }

  function parseFromLines(lines, periodo, source) {
    const markerIdx = [];
    for (let i = 0; i < lines.length; i++) {
      if (isMarkerLine(lines[i])) markerIdx.push(i);
    }
    const records = [];
    for (let k = 0; k < markerIdx.length; k++) {
      const start = markerIdx[k];
      const end = k + 1 < markerIdx.length ? markerIdx[k + 1] : lines.length;
      const block = lines.slice(start, end);
      const header = lines.slice(start, Math.min(start + 4, end)).join(' ');
      const rec = parseBlock(block, header, periodo, k, source);
      if (isValidRecord(rec)) records.push(rec);
    }
    return { markers: markerIdx.length, records };
  }

  function parseFromFlatText(fullText, periodo) {
    const lines = fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const markerIdx = [];
    for (let i = 0; i < lines.length; i++) if (isMarkerLine(lines[i])) markerIdx.push(i);
    // Plan B: si no hay línea completa, cortar por texto compactado con índice aproximado no es fiable; se usa resumen.
    const records = [];
    for (let k = 0; k < markerIdx.length; k++) {
      const start = markerIdx[k];
      const end = k + 1 < markerIdx.length ? markerIdx[k + 1] : lines.length;
      const block = lines.slice(start, end);
      const header = lines.slice(start, Math.min(start + 5, end)).join(' ');
      const rec = parseBlock(block, header, periodo, k, 'lectura plana');
      if (isValidRecord(rec)) records.push(rec);
    }
    return { markers: markerIdx.length, records };
  }

  function isMarkerLine(line) {
    const c = compact(line);
    return c.includes('prestaciondelservicio') || c.includes('prestacindelservicio');
  }

  function parseBlock(lines, header, periodo, index, source) {
    const info = parseHeader(header);
    const rec = {
      id: `${periodo}-${index}-${slug(info.sede)}-${slug(info.direccion)}`,
      periodo,
      sede: info.sede || 'Sede sin nombre',
      direccion: info.direccion || '',
      municipio: info.municipio || 'Medellín',
      agua_m3: 0,
      agua_valor: 0,
      alcantarillado_m3: 0,
      alcantarillado_valor: 0,
      energia_kwh: 0,
      energia_valor: 0,
      gas_m3: 0,
      gas_valor: 0,
      aseo_valor: 0,
      residuos_ton: 0,
      productos: [],
      alertas: [],
      fuente: source,
      rawPreview: lines.slice(0, 60).join(' | '),
    };

    const totalAgua = findFirstTotal(lines, ['totalagua', 'totalacueducto']);
    if (totalAgua >= 0) {
      rec.agua_valor = findMoneyNear(lines, totalAgua);
      rec.agua_m3 = findConsumptionNear(lines, totalAgua, 'm3', ['consumo', 'agua']);
    }

    const totalAlc = findFirstTotal(lines, ['totalalcantarillado']);
    if (totalAlc >= 0) {
      rec.alcantarillado_valor = findMoneyNear(lines, totalAlc);
      rec.alcantarillado_m3 = findConsumptionNear(lines, totalAlc, 'm3', ['consumo', 'alcantarillado']);
    }

    const totalEnergia = findFirstTotal(lines, ['totalenergia']);
    if (totalEnergia >= 0) {
      rec.energia_valor = findMoneyNear(lines, totalEnergia);
      rec.energia_kwh = findConsumptionNear(lines, totalEnergia, 'kwh', ['energia']);
    }

    const totalGas = findFirstTotal(lines, ['totalgas', 'totalgasnatural']);
    if (totalGas >= 0) {
      rec.gas_valor = findMoneyNear(lines, totalGas);
      rec.gas_m3 = findConsumptionNear(lines, totalGas, 'm3', ['gas']);
    }

    const totalAseo = findFirstTotal(lines, ['totalaseo']);
    if (totalAseo >= 0) rec.aseo_valor = findMoneyNear(lines, totalAseo);

    // Si el orden visual parte el valor en la línea anterior, buscar patrones explícitos.
    const joined = lines.join(' ');
    if (!rec.energia_kwh) rec.energia_kwh = findExplicitEnergy(joined);
    if (!rec.agua_m3) rec.agua_m3 = findExplicitM3BeforeTotal(joined, 'agua');
    if (!rec.alcantarillado_m3) rec.alcantarillado_m3 = findExplicitM3BeforeTotal(joined, 'alcantarillado');

    rec.productos = Array.from(new Set((joined.match(/Producto:\s*\d+/gi) || []).map((p) => p.replace(/Producto:\s*/i, ''))));
    rec.residuos_ton = findWasteTons(lines);
    rec.alertas = findAlerts(lines);

    return rec;
  }

  function parseHeader(header) {
    let raw = header.replace(/\s+/g, ' ').trim();
    raw = raw.replace(/^.*?servicio\s*:\s*/i, '').trim();
    raw = raw.replace(/^.*?servici\s*o\s*:\s*/i, '').trim();
    const normalized = removeMarks(raw).replace(/\s+/g, ' ').trim();
    const muniMatch = normalized.match(/Municipio\s*:\s*([^\-]+)(?:\s*-\s*([^\-]+))?/i);
    const municipio = muniMatch ? (muniMatch[2] || muniMatch[1] || '').trim() : 'Medellín';
    const left = normalized.split(/\s+-\s+Municipio\s*:/i)[0];
    const parts = left.split(/\s+-\s+/).filter(Boolean);
    const sede = (parts.shift() || 'Sede sin nombre').trim();
    const direccion = parts.join(' - ').trim();
    return { sede, direccion, municipio };
  }

  function findFirstTotal(lines, compactLabels) {
    for (let i = 0; i < lines.length; i++) {
      const c = compact(lines[i]);
      if (compactLabels.some((label) => c.includes(label))) return i;
    }
    return -1;
  }

  function findMoneyNear(lines, idx) {
    const candidates = [];
    const start = Math.max(0, idx - 8);
    const end = Math.min(lines.length - 1, idx + 8);
    for (let i = start; i <= end; i++) {
      const found = moneyValues(lines[i]);
      for (const v of found) candidates.push({ i, v });
    }
    if (!candidates.length) return 0;
    // Preferir valores cercanos a la línea del total y de mayor magnitud razonable.
    candidates.sort((a, b) => Math.abs(a.i - idx) - Math.abs(b.i - idx) || b.v - a.v);
    return candidates[0].v;
  }

  function moneyValues(line) {
    const out = [];
    const re = /\$\s*([-\d.,]+)/g;
    let m;
    while ((m = re.exec(line))) out.push(parseNumber(m[1]));
    // A veces pdftotext pone '$' en una línea y el valor en la siguiente; esto lo cubre findMoneyNear si hay valor con separadores.
    if (!out.length && /^[-\d.,]+$/.test(line.trim()) && /[.,]/.test(line)) out.push(parseNumber(line));
    return out.filter((n) => n > 0);
  }

  function findConsumptionNear(lines, idx, unit, hints) {
    const start = Math.max(0, idx - 45);
    const end = Math.min(lines.length - 1, idx + 8);
    const windowLines = lines.slice(start, end + 1);
    const joined = windowLines.join(' ');

    if (unit === 'kwh') {
      let m = joined.match(/(?:Energ(?:i|í|\s*i\s*)a)\s+\w{3}-\d{2}\s+([\d.,]+)\s*x/i);
      if (m) return parseNumber(m[1]);
      m = joined.match(/([\d.,]+)\s*k\s*w\s*h/i);
      if (m) return parseNumber(m[1]);
      for (let i = windowLines.length - 1; i >= 0; i--) {
        const val = numberBeforeUnit(windowLines[i], 'kwh');
        if (val) return val;
      }
    }

    if (unit === 'm3') {
      let m = joined.match(/Consumo\s+\w{3}-\d{2}\s+([\d.,]+)\s*x/i);
      if (m) return parseNumber(m[1]);
      m = joined.match(/([\d.,]+)\s*(?:m\s*3|mt\s*3)/i);
      if (m) return parseNumber(m[1]);
      for (let i = windowLines.length - 1; i >= 0; i--) {
        const val = numberBeforeUnit(windowLines[i], 'm3');
        if (val) return val;
      }
    }
    return 0;
  }

  function findExplicitEnergy(text) {
    const m = text.match(/(?:Energ(?:i|í|\s*i\s*)a)\s+\w{3}-\d{2}\s+([\d.,]+)\s*x/i) || text.match(/([\d.,]+)\s*k\s*w\s*h/i);
    return m ? parseNumber(m[1]) : 0;
  }

  function findExplicitM3BeforeTotal(text, service) {
    const serviceNorm = service === 'agua' ? 'Total Agua' : 'Total Alcantarillado';
    const idx = removeMarks(text).toLowerCase().indexOf(removeMarks(serviceNorm).toLowerCase());
    const part = idx >= 0 ? text.slice(Math.max(0, idx - 1200), idx + 100) : text;
    const m = part.match(/Consumo\s+\w{3}-\d{2}\s+([\d.,]+)\s*x/i) || part.match(/([\d.,]+)\s*(?:m\s*3|mt\s*3)/i);
    return m ? parseNumber(m[1]) : 0;
  }

  function numberBeforeUnit(line, unit) {
    const re = unit === 'kwh' ? /([\d.,]+)\s*k\s*w\s*h/i : /([\d.,]+)\s*(?:m\s*3|mt\s*3)/i;
    const m = line.match(re);
    return m ? parseNumber(m[1]) : 0;
  }

  function findWasteTons(lines) {
    const joined = lines.join(' ');
    const m = joined.match(/No\s*Aprov[^\d]*([\d.,]+)/i) || joined.match(/No\s*aprovechables\s*([\d.,]+)/i);
    return m ? parseNumber(m[1]) : 0;
  }

  function findAlerts(lines) {
    const alerts = [];
    const text = compact(lines.join(' '));
    if (text.includes('desviacionsignificativa')) alerts.push('Desviación significativa');
    if (text.includes('imposibilidaddeacceso')) alerts.push('Imposibilidad de acceso');
    if (text.includes('medidorcambiado')) alerts.push('Medidor cambiado');
    if (text.includes('destruido')) alerts.push('Medidor destruido');
    return Array.from(new Set(alerts));
  }

  function parseConsolidatedSummary(fullText, periodo) {
    const t = fullText;
    const c = compact(t.slice(0, 8000));
    if (!c.includes('resumendefacturacion')) return null;
    const first = t.slice(0, 10000);
    const rec = {
      id: `${periodo}-resumen-consolidado`,
      periodo,
      sede: 'Resumen consolidado contrato 1538220',
      direccion: 'Municipio de Medellín - Educación - Sedes Educativas',
      municipio: 'Medellín',
      agua_m3: findAfterLabel(first, 'ACTUAL', 'm3'),
      agua_valor: findValueAfterLabel(first, 'Total Acueducto'),
      alcantarillado_m3: 0,
      alcantarillado_valor: findValueAfterLabel(first, 'Total Alcantarillado'),
      energia_kwh: findKwhSummary(first),
      energia_valor: findValueAfterLabel(first, 'Total Energ'),
      gas_m3: 0,
      gas_valor: findValueAfterLabel(first, 'Total Gas'),
      aseo_valor: findValueAfterLabel(t.slice(0, 16000), 'Total Otras Entidades'),
      residuos_ton: 0,
      productos: ['1538220'],
      alertas: ['Resumen consolidado importado'],
      fuente: 'resumen página 1',
    };
    return enrichRecord(rec);
  }

  function findAfterLabel(text, label, unit) {
    const idx = removeMarks(text).toLowerCase().indexOf(removeMarks(label).toLowerCase());
    if (idx < 0) return 0;
    const part = text.slice(idx, idx + 500);
    const m = unit === 'kwh' ? part.match(/([\d.,]+)\s*k\s*w\s*h/i) : part.match(/([\d.,]+)\s*m\s*3/i);
    return m ? parseNumber(m[1]) : 0;
  }

  function findKwhSummary(text) {
    const matches = [...text.matchAll(/([\d.,]+)\s*k\s*w\s*h/gi)].map((m) => parseNumber(m[1])).filter(Boolean);
    return matches.length ? matches[0] : 0;
  }

  function findValueAfterLabel(text, label) {
    const textNorm = removeMarks(text).toLowerCase();
    const idx = textNorm.indexOf(removeMarks(label).toLowerCase());
    if (idx < 0) return 0;
    const part = text.slice(idx, idx + 300);
    const money = moneyValues(part);
    return money.length ? money[money.length - 1] : 0;
  }

  function combineRecordSets(a, b) {
    const map = new Map();
    [...a, ...b].forEach((r) => {
      const key = `${r.periodo}|${slug(r.sede)}|${slug(r.direccion)}`;
      if (!map.has(key)) map.set(key, { ...r });
      else {
        const base = map.get(key);
        for (const field of ['agua_m3', 'agua_valor', 'alcantarillado_m3', 'alcantarillado_valor', 'energia_kwh', 'energia_valor', 'gas_m3', 'gas_valor', 'aseo_valor', 'residuos_ton']) {
          if (!base[field] && r[field]) base[field] = r[field];
        }
        base.alertas = Array.from(new Set([...(base.alertas || []), ...(r.alertas || [])]));
        base.productos = Array.from(new Set([...(base.productos || []), ...(r.productos || [])]));
      }
    });
    return Array.from(map.values());
  }

  function enrichRecord(r) {
    const factor = Number(el.factorCo2?.value) || state.factor || DEFAULT_FACTOR;
    return { ...r, co2_kg: round((Number(r.energia_kwh) || 0) * factor, 2) };
  }

  function isValidRecord(r) {
    return Boolean(r && (r.agua_m3 || r.agua_valor || r.alcantarillado_m3 || r.alcantarillado_valor || r.energia_kwh || r.energia_valor || r.gas_m3 || r.gas_valor || r.aseo_valor));
  }

  function mergeRecords(newRecords, periodo) {
    const incomingIds = new Set(newRecords.map((r) => r.id));
    state.records = state.records.filter((r) => !(r.periodo === periodo && incomingIds.has(r.id)));
    // Evitar duplicar el mismo periodo y sede si se reimporta.
    const newKeys = new Set(newRecords.map((r) => `${r.periodo}|${slug(r.sede)}|${slug(r.direccion)}`));
    state.records = state.records.filter((r) => !newKeys.has(`${r.periodo}|${slug(r.sede)}|${slug(r.direccion)}`));
    state.records.push(...newRecords);
  }

  function render() {
    state.factor = Number(el.factorCo2.value) || DEFAULT_FACTOR;
    state.records = state.records.map(enrichRecord);
    renderKpis();
    renderTable();
    renderCharts();
  }

  function currentPeriodRecords() {
    return state.records.filter((r) => r.periodo === (el.periodo.value || state.currentPeriod));
  }

  function filteredRecords() {
    const q = removeMarks(el.searchInput.value || '').toLowerCase();
    const service = el.serviceFilter.value;
    return currentPeriodRecords().filter((r) => {
      const text = removeMarks(`${r.sede} ${r.direccion}`).toLowerCase();
      const matchesText = !q || text.includes(q);
      const matchesService = service === 'all' ||
        (service === 'energia' && (r.energia_kwh || r.energia_valor)) ||
        (service === 'agua' && (r.agua_m3 || r.agua_valor)) ||
        (service === 'alcantarillado' && (r.alcantarillado_m3 || r.alcantarillado_valor)) ||
        (service === 'gas' && (r.gas_m3 || r.gas_valor)) ||
        (service === 'aseo' && r.aseo_valor);
      return matchesText && matchesService;
    });
  }

  function renderKpis() {
    const records = currentPeriodRecords();
    el.kpiKwh.textContent = `${formatNumber(sum(records, 'energia_kwh'))} kWh`;
    el.kpiCo2.textContent = `${formatNumber(sum(records, 'co2_kg'))} kg CO₂`;
    el.kpiEnergyCost.textContent = currency(sum(records, 'energia_valor'));
    el.kpiSites.textContent = new Set(records.map((r) => `${r.sede}|${r.direccion}`)).size;
    el.kpiWater.textContent = `${formatNumber(sum(records, 'agua_m3'))} m³`;
    el.kpiWaste.textContent = currency(sum(records, 'aseo_valor'));
  }

  function renderTable() {
    const records = filteredRecords().sort((a, b) => (b.energia_kwh || 0) - (a.energia_kwh || 0));
    el.recordsTable.innerHTML = '';
    if (!records.length) {
      el.recordsTable.appendChild(el.emptyRow.content.cloneNode(true));
      return;
    }
    for (const r of records) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(r.sede)}</strong><small>${escapeHtml((r.productos || []).join(', '))}</small></td>
        <td>${escapeHtml(r.direccion || '-')}</td>
        <td>${escapeHtml(r.periodo)}</td>
        <td>${formatNumber(r.agua_m3)}</td>
        <td>${formatNumber(r.alcantarillado_m3)}</td>
        <td><strong>${formatNumber(r.energia_kwh)}</strong></td>
        <td>${formatNumber(r.co2_kg)}</td>
        <td>${currency(r.energia_valor)}</td>
        <td>${currency(r.aseo_valor)}</td>
        <td>${(r.alertas || []).map((a) => `<span class="badge">${escapeHtml(a)}</span>`).join('') || '<span class="muted">Sin alerta</span>'}</td>`;
      el.recordsTable.appendChild(tr);
    }
  }

  function renderCharts() {
    if (!window.Chart) return renderSimpleChartsFallback();
    const byMonth = groupBy(state.records, 'periodo');
    const months = Object.keys(byMonth).sort();
    const kwh = months.map((m) => sum(byMonth[m], 'energia_kwh'));
    const current = currentPeriodRecords();
    const services = [sum(current, 'agua_valor'), sum(current, 'alcantarillado_valor'), sum(current, 'energia_valor'), sum(current, 'gas_valor'), sum(current, 'aseo_valor')];

    destroyCharts();
    state.charts.monthly = new Chart(el.monthlyChart, {
      type: 'bar',
      data: { labels: months, datasets: [{ label: 'kWh', data: kwh }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });
    state.charts.services = new Chart(el.serviceChart, {
      type: 'doughnut',
      data: { labels: ['Agua', 'Alcantarillado', 'Energía', 'Gas', 'Aseo'], datasets: [{ data: services }] },
      options: { responsive: true, maintainAspectRatio: false },
    });
  }

  function renderSimpleChartsFallback() {
    // Si Chart.js no está disponible, la tabla y KPIs siguen funcionando.
  }

  function destroyCharts() {
    Object.values(state.charts).forEach((chart) => chart && chart.destroy && chart.destroy());
    state.charts = {};
  }

  function loadDemo() {
    const periodo = el.periodo.value || '2025-01';
    const demo = [
      { sede: 'Liceo Cristo Rey', direccion: 'Cl 2 Sur Cr 50 D -30', energia_kwh: 2684, energia_valor: 2432133.44, agua_m3: 66, agua_valor: 318618.29, alcantarillado_m3: 66, alcantarillado_valor: 242103.66, aseo_valor: 735617.78 },
      { sede: 'Esc. J. Acevedo y Gómez', direccion: 'Cl 8 Sur Cr 52 C -25', energia_kwh: 3163, energia_valor: 3048752.89, agua_m3: 130, agua_valor: 618609.33, alcantarillado_m3: 130, alcantarillado_valor: 471710.70, aseo_valor: 498182.23, alertas: ['Medidor cambiado'] },
      { sede: 'I.E. Manuel J. Betancur', direccion: 'Cl 44 Sur Cr 81 -28', energia_kwh: 63, energia_valor: 56138.67, agua_m3: 11, agua_valor: 60813.49, alcantarillado_m3: 11, alcantarillado_valor: 44785.11, aseo_valor: 48793.99 },
    ].map((r, i) => enrichRecord({ id: `${periodo}-demo-${i}`, periodo, municipio: 'Medellín', gas_m3: 0, gas_valor: 0, residuos_ton: 0, productos: [], alertas: [], fuente: 'demo', ...r }));
    mergeRecords(demo, periodo);
    saveState();
    log('Ejemplo cargado correctamente.');
    render();
  }

  function exportCsv() {
    const rows = filteredRecords();
    const headers = ['periodo', 'sede', 'direccion', 'agua_m3', 'agua_valor', 'alcantarillado_m3', 'alcantarillado_valor', 'energia_kwh', 'energia_valor', 'co2_kg', 'gas_m3', 'gas_valor', 'aseo_valor', 'residuos_ton', 'alertas'];
    const csv = [headers.join(';')].concat(rows.map((r) => headers.map((h) => csvCell(Array.isArray(r[h]) ? r[h].join('|') : r[h])).join(';'))).join('\n');
    downloadBlob(csv, `simeco2_${el.periodo.value || 'datos'}.csv`, 'text/csv;charset=utf-8');
  }

  function exportJson() {
    downloadBlob(JSON.stringify(filteredRecords(), null, 2), `simeco2_${el.periodo.value || 'datos'}.json`, 'application/json');
  }

  function showProgress(title, pct) {
    el.progressPanel.classList.remove('hidden');
    el.progressTitle.textContent = title;
    el.progressText.textContent = `${pct}%`;
    el.progressBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  }

  function hideProgressLater(success) {
    if (success) setTimeout(() => el.progressPanel.classList.add('hidden'), 5000);
  }

  function clearLog() { el.logBox.textContent = ''; }

  function log(message) {
    const line = `[${new Date().toLocaleTimeString('es-CO')}] ${message}`;
    el.logBox.textContent += `${line}\n`;
    el.logBox.scrollTop = el.logBox.scrollHeight;
  }

  function samplePage(pages, pageNum) {
    const page = pages.find((p) => p.pageNum === pageNum) || pages[0];
    if (!page) return 'sin muestra';
    return page.lines.slice(0, 8).join(' / ').slice(0, 600);
  }

  function removeMarks(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function compact(s) {
    return removeMarks(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function parseNumber(value) {
    if (value == null) return 0;
    let s = String(value).replace(/[^0-9.,-]/g, '').trim();
    if (!s || s === '-' || s === ',' || s === '.') return 0;
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    else {
      const parts = s.split('.');
      if (parts.length > 2) s = parts.join('');
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }

  function slug(s) { return compact(s).slice(0, 80) || 'x'; }
  function sum(rows, field) { return rows.reduce((a, r) => a + (Number(r[field]) || 0), 0); }
  function round(n, d = 2) { const p = 10 ** d; return Math.round((n + Number.EPSILON) * p) / p; }
  function formatNumber(n) { return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(Number(n) || 0); }
  function currency(n) { return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0); }
  function groupBy(rows, field) { return rows.reduce((acc, r) => ((acc[r[field]] ||= []).push(r), acc), {}); }
  function escapeHtml(s) { return String(s ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
  function csvCell(v) { const s = String(v ?? '').replace(/"/g, '""'); return `"${s}"`; }
  function formatBytes(bytes) { return `${(bytes / 1024 / 1024).toFixed(2)} MB`; }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function inferPeriodFromFile(filename) {
    const months = { enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06', julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10', noviembre: '11', diciembre: '12' };
    const name = removeMarks(filename).toLowerCase();
    const y = (name.match(/20\d{2}/) || [String(new Date().getFullYear())])[0];
    for (const [m, num] of Object.entries(months)) if (name.includes(m)) return `${y}-${num}`;
    return null;
  }
})();

(function () {
  "use strict";

  const STORAGE_KEY = "simeco2_servicios_v3";
  const $ = (id) => document.getElementById(id);

  const state = {
    records: loadRecords(),
    charts: {},
    lastRawTextSample: "",
  };

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    [
      "pdfFile", "btnSelect", "dropZone", "periodo", "factorCo2", "searchInput",
      "serviceFilter", "progressPanel", "progressBar", "progressText", "progressTitle",
      "logBox", "recordsTable", "btnExportCsv", "btnExportJson", "btnPrint", "btnReset",
      "btnDemo", "libraryStatus"
    ].forEach((id) => { els[id] = $(id); });

    const now = new Date();
    if (!els.periodo.value) els.periodo.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    configurePdfJs();
    bindEvents();
    render();
  }

  function configurePdfJs() {
    if (window.pdfjsLib) {
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      } catch (e) { /* no action */ }
      setLibraryStatus("PDF.js cargado correctamente. Ya puedes seleccionar la factura consolidada de EPM.", "ok");
    } else {
      setLibraryStatus("PDF.js no cargó. Publica el sitio en GitHub Pages o revisa la conexión a internet.", "error");
    }
  }

  function bindEvents() {
    els.btnSelect.addEventListener("click", () => els.pdfFile.click());
    els.pdfFile.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) importPdf(file);
    });

    ["dragenter", "dragover"].forEach((evt) => {
      els.dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        els.dropZone.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach((evt) => {
      els.dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        els.dropZone.classList.remove("dragover");
      });
    });

    els.dropZone.addEventListener("drop", (e) => {
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file && /pdf$/i.test(file.name)) importPdf(file);
      else alert("Selecciona un archivo PDF válido.");
    });

    [els.periodo, els.factorCo2, els.searchInput, els.serviceFilter].forEach((el) => {
      el.addEventListener("input", render);
      el.addEventListener("change", render);
    });

    els.btnExportCsv.addEventListener("click", exportCsv);
    els.btnExportJson.addEventListener("click", exportJson);
    els.btnPrint.addEventListener("click", () => window.print());
    els.btnReset.addEventListener("click", resetSystem);
    els.btnDemo.addEventListener("click", loadDemo);
  }

  async function importPdf(file) {
    if (!window.pdfjsLib) {
      alert("No se pudo cargar PDF.js. Revisa la conexión a internet o publica el sitio en GitHub Pages.");
      return;
    }
    const period = els.periodo.value;
    if (!period) {
      alert("Selecciona primero el mes de análisis.");
      return;
    }

    showProgress(true, `Procesando ${file.name}`);
    log("Iniciando lectura profunda del PDF...");

    try {
      const buffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
      log(`PDF cargado correctamente: ${pdf.numPages} páginas.`);

      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
        const layoutText = textContentToLayoutText(content.items);
        const plainText = content.items.map((item) => item.str || "").join(" ");
        pages.push({ page: i, layoutText: normalizeText(layoutText), plainText: normalizeText(plainText) });
        if (i % 5 === 0 || i === pdf.numPages) setProgress(Math.round((i / pdf.numPages) * 100));
      }

      state.lastRawTextSample = pages.slice(0, 3).map((p) => `PÁGINA ${p.page}\n${p.layoutText.slice(0, 2000)}`).join("\n\n");

      const countLayout = countMarkers(pages.map((p) => p.layoutText).join("\n"));
      const countPlain = countMarkers(pages.map((p) => p.plainText).join("\n"));
      log(`Marcadores encontrados: lectura por líneas=${countLayout}, lectura plana=${countPlain}.`);

      let parsed = parseEpmPages(pages, period, file.name, "layoutText");
      if (!parsed.length) {
        log("No se logró con lectura por líneas. Intentando lectura plana alternativa...");
        parsed = parseEpmPages(pages, period, file.name, "plainText");
      }

      log(`Registros válidos identificados: ${parsed.length}.`);

      if (!parsed.length) {
        log("No se importaron registros. Revisa el diagnóstico inferior para ver si el texto del PDF fue leído.");
        log("Muestra de texto leído:\n" + state.lastRawTextSample.slice(0, 2500));
        render();
        alert("El PDF sí fue abierto, pero no se pudieron estructurar registros. En esta versión queda el diagnóstico visible en la caja de proceso.");
        return;
      }

      const before = state.records.length;
      state.records = upsertRecords(state.records, parsed);
      saveRecords(state.records);
      log(`Base actualizada. Registros antes: ${before}. Registros actuales: ${state.records.length}.`);
      render();
      alert(`Carga finalizada. Se agregaron o actualizaron ${parsed.length} registros del periodo ${period}.`);
    } catch (err) {
      console.error(err);
      log(`Error: ${err.message || err}`);
      alert("No fue posible procesar el PDF. Verifica que el archivo no esté protegido o dañado.");
    } finally {
      els.pdfFile.value = "";
    }
  }

  function textContentToLayoutText(items) {
    const rows = items
      .filter((it) => String(it.str || "").trim())
      .map((it) => ({
        str: String(it.str || "").trim(),
        x: it.transform ? it.transform[4] : 0,
        y: it.transform ? it.transform[5] : 0,
      }))
      .sort((a, b) => Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x);

    const lines = [];
    rows.forEach((it) => {
      const last = lines[lines.length - 1];
      if (!last || Math.abs(last.y - it.y) > 2.5) lines.push({ y: it.y, items: [it] });
      else last.items.push(it);
    });
    return lines.map((line) => line.items.sort((a, b) => a.x - b.x).map((i) => i.str).join(" ")).join("\n");
  }

  function countMarkers(text) {
    return (text.match(/Prestaci[oó]n\s+del\s+servicio\s*:/gi) || []).length;
  }

  function parseEpmPages(pages, period, sourceFile, textKey) {
    const blocks = [];
    pages.forEach((p) => {
      const pageText = p[textKey] || "";
      const parts = pageText.split(/Prestaci[oó]n\s+del\s+servicio\s*:/i).slice(1);
      parts.forEach((part) => {
        const clean = normalizeText(part);
        if (clean.length > 30) blocks.push({ page: p.page, text: clean });
      });
    });

    const grouped = new Map();
    blocks.forEach((block) => {
      const site = extractSite(block.text);
      if (!site.name || site.name.length < 3) return;
      const key = `${period}|${site.name}|${site.address}`.toLowerCase();
      if (!grouped.has(key)) grouped.set(key, baseRecord(period, site, block.page, sourceFile));
      const rec = grouped.get(key);
      rec.pages.add(block.page);
      mergeServiceData(rec, block.text);
    });

    return Array.from(grouped.values()).map(finalizeRecord).filter(hasMeaningfulData);
  }

  function normalizeText(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/\$\s+/g, "$ ")
      .trim();
  }

  function oneLine(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function extractSite(text) {
    const t = oneLine(text.slice(0, 900));
    let head = t;
    const stop = head.search(/Lectura actual|Valores facturados|Emvarias|Empresas Varias|Consumo Del|Informaci[oó]n T[eé]cnica|Total Agua|Total Alcantarillado|Total Energ[ií]a|Total Gas/i);
    if (stop > -1) head = head.slice(0, stop).trim();
    head = head.split(/-\s*Municipio\s*:/i)[0].trim();

    let name = "";
    let address = "";
    const m = head.match(/^(.+?)\s+-\s+(.+)$/);
    if (m) {
      name = m[1].trim();
      address = m[2].trim();
    } else {
      name = head.trim();
      address = "Sin dirección";
    }

    name = cleanName(name);
    address = cleanAddress(address || "Sin dirección");
    return { name: titleCase(name), address };
  }

  function cleanName(value) {
    return String(value || "")
      .replace(/\s*\*+\s*/g, " ")
      .replace(/\bMUNICIPIO\b/gi, "Municipio")
      .replace(/\bINST\b/gi, "Institución")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanAddress(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/\s+-\s*$/, "")
      .trim();
  }

  function titleCase(text) {
    const lowerWords = new Set(["de", "del", "la", "las", "el", "los", "y", "en", "a"]);
    return String(text || "").toLowerCase().split(" ").map((w, i) => {
      if (i > 0 && lowerWords.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(" ")
      .replace(/\bI\.e\b/gi, "I.E.")
      .replace(/\bIe\b/g, "I.E.")
      .replace(/\bMpal\b/gi, "Mpal")
      .replace(/\bJ\.f\b/gi, "J.F.")
      .replace(/\bEpm\b/g, "EPM");
  }

  function baseRecord(period, site, page, sourceFile) {
    return {
      id: createId(), period, sede: site.name, direccion: site.address, sourceFile,
      pages: new Set([page]),
      aguaM3: 0, alcantarilladoM3: 0, energiaKwh: 0, gasM3: 0,
      valorAgua: 0, valorAlcantarillado: 0, valorEnergia: 0, valorGas: 0, valorAseo: 0,
      productoEnergia: "", medidorEnergia: "", categoria: "",
      alertas: [], importedAt: new Date().toISOString(),
    };
  }

  function mergeServiceData(rec, text) {
    const flat = oneLine(text);
    if (!rec.categoria) rec.categoria = matchText(flat, /Categor[ií]a:\s*([^\s]+(?:\s+[^\s]+)?)/i) || "";

    const aguaBlock = sliceBefore(flat, /Total Agua\s*\$/i, 900);
    if (/Total Agua/i.test(flat)) {
      rec.aguaM3 += extractConsumption(aguaBlock || flat, "m3", "mt3");
      rec.valorAgua += moneyAfter(flat, /Total Agua\s*\$\s*([\d\.,]+)/i);
    }

    const alcBlock = sliceBetween(flat, /Total Agua\s*\$[\d\.,]+/i, /Total Alcantarillado\s*\$/i, 1000) || sliceBefore(flat, /Total Alcantarillado\s*\$/i, 900);
    if (/Total Alcantarillado/i.test(flat)) {
      rec.alcantarilladoM3 += extractConsumption(alcBlock || flat, "m3", "mt3");
      rec.valorAlcantarillado += moneyAfter(flat, /Total Alcantarillado\s*\$\s*([\d\.,]+)/i);
    }

    const energyStart = flat.search(/Lectura actual\s+Lectura anterior\s+Constante|Valores facturados\s+kwh|Valores facturados\s+kWh|Energ[ií]a ene/i);
    const energyEnd = flat.search(/Total Energ[ií]a\s*\$/i);
    const energyBlock = energyEnd > -1 ? flat.slice(Math.max(0, energyStart > -1 ? energyStart : energyEnd - 800), Math.min(flat.length, energyEnd + 160)) : "";
    if (/Total Energ[ií]a|\bkWh\b|energia activa|energ[ií]a activa/i.test(flat)) {
      const kwh = extractConsumption(energyBlock || flat, "kWh");
      const total = moneyAfter(flat, /Total Energ[ií]a\s*\$\s*([\d\.,]+)/i) || moneyAfter(flat, /Costo energ[ií]a activa\s*\$\s*([\d\.,]+)/i) || moneyAfter(flat, /Costo energia activa\s*\$\s*([\d\.,]+)/i);
      rec.energiaKwh += kwh;
      rec.valorEnergia += total;
      const producto = matchText(energyBlock || flat, /Producto:\s*(\d+)/i) || matchText(flat, /Producto:\s*(\d+)/i);
      const medidor = matchText(energyBlock || flat, /Medidor:\s*([^\s]+)/i) || matchText(flat, /Medidor:\s*([^\s]+)/i);
      if (producto && !rec.productoEnergia) rec.productoEnergia = producto;
      if (medidor && !rec.medidorEnergia) rec.medidorEnergia = medidor;
      addAlertIf(rec, /reactiva/i.test(flat), "Reactiva");
      addAlertIf(rec, /desviaci[oó]n significativa|debajo del l[ií]mite|encima del l[ií]mite/i.test(flat), "Desviación");
      addAlertIf(rec, /medidor cambiado|destruido|imposibilidad de acceso/i.test(flat), "Revisión medidor");
    }

    const gasBlock = sliceBefore(flat, /Total Gas\s*\$/i, 700);
    if (/Total Gas|Gas Natural|Tarifa Plena/i.test(flat)) {
      rec.gasM3 += extractConsumption(gasBlock || flat, "m3", "mt3");
      rec.valorGas += moneyAfter(flat, /Total Gas\s*\$\s*([\d\.,]+)/i);
    }

    if (/Emvarias|Total Aseo|Aforo \(m3\)|Cargo variable aprovechables/i.test(flat)) {
      rec.valorAseo += moneyAfter(flat, /Total Aseo\s*\$\s*([\d\.,]+)/i);
    }
  }

  function sliceBefore(text, endRegex, maxChars) {
    const m = text.search(endRegex);
    if (m < 0) return "";
    return text.slice(Math.max(0, m - maxChars), m + 120);
  }

  function sliceBetween(text, startRegex, endRegex, maxChars) {
    const s = text.search(startRegex);
    const e = text.search(endRegex);
    if (e < 0) return "";
    const start = s > -1 && s < e ? s : Math.max(0, e - maxChars);
    return text.slice(start, e + 120);
  }

  function extractConsumption(text, unitA, unitB) {
    const unit = unitB ? `(?:${unitA}|${unitB})` : unitA;
    const patterns = [
      new RegExp(`Lectura actual.{0,320}?([\\d\\.,]+)\\s*${unit}\\b.{0,180}?=\\s*Consumo`, "i"),
      new RegExp(`([\\d\\.,]+)\\s*${unit}\\b.{0,140}?=\\s*Consumo`, "i"),
      new RegExp(`Consumo\\s+ene-\\d{2}\\s+([\\d\\.,]+)x`, "i"),
      new RegExp(`Energ[ií]a\\s+ene-\\d{2}\\s+([\\d\\.,]+)x`, "i"),
      new RegExp(`([\\d\\.,]+)\\s*${unit}\\b`, "i"),
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m) return parseLocaleNumber(m[1]);
    }
    return 0;
  }

  function addAlertIf(rec, condition, label) {
    if (condition) rec.alertas.push(label);
  }

  function finalizeRecord(rec) {
    rec.pages = Array.from(rec.pages).sort((a, b) => a - b);
    rec.alertas = Array.from(new Set(rec.alertas));
    ["aguaM3", "alcantarilladoM3", "energiaKwh", "gasM3", "valorAgua", "valorAlcantarillado", "valorEnergia", "valorGas", "valorAseo"].forEach((k) => {
      rec[k] = round(rec[k]);
    });
    return rec;
  }

  function hasMeaningfulData(r) {
    return Boolean(r.aguaM3 || r.alcantarilladoM3 || r.energiaKwh || r.gasM3 || r.valorAseo || r.valorEnergia || r.valorAgua || r.valorAlcantarillado || r.valorGas);
  }

  function moneyAfter(text, regex) {
    const m = text.match(regex);
    return m ? parseLocaleNumber(m[1]) : 0;
  }

  function matchText(text, regex) {
    const m = text.match(regex);
    return m ? m[1].trim() : "";
  }

  function parseLocaleNumber(value) {
    if (!value) return 0;
    let s = String(value).trim().replace(/\s/g, "");
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function round(n, d) {
    const dec = d === undefined ? 3 : d;
    return Number((n || 0).toFixed(dec));
  }

  function upsertRecords(existing, incoming) {
    const map = new Map(existing.map((r) => [recordKey(r), r]));
    incoming.forEach((r) => map.set(recordKey(r), r));
    return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period) || (b.energiaKwh || 0) - (a.energiaKwh || 0));
  }

  function recordKey(r) {
    return `${r.period}|${r.sede}|${r.direccion}`.toLowerCase();
  }

  function loadRecords() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch (e) { return []; }
  }

  function saveRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  function getFilteredRecords() {
    const q = els.searchInput.value.trim().toLowerCase();
    const period = els.periodo.value;
    const service = els.serviceFilter.value;
    return state.records.filter((r) => {
      const matchesPeriod = !period || r.period === period;
      const matchesText = !q || `${r.sede} ${r.direccion} ${r.productoEnergia}`.toLowerCase().includes(q);
      const matchesService = service === "all" ||
        (service === "energia" && r.energiaKwh) ||
        (service === "agua" && r.aguaM3) ||
        (service === "alcantarillado" && r.alcantarilladoM3) ||
        (service === "gas" && r.gasM3) ||
        (service === "aseo" && r.valorAseo);
      return matchesPeriod && matchesText && matchesService;
    });
  }

  function render() {
    const records = getFilteredRecords();
    const factor = Number(els.factorCo2.value) || 0;
    const totals = records.reduce((a, r) => {
      a.kwh += r.energiaKwh || 0;
      a.co2 += (r.energiaKwh || 0) * factor;
      a.energyCost += r.valorEnergia || 0;
      a.water += r.aguaM3 || 0;
      a.waste += r.valorAseo || 0;
      a.aguaCost += r.valorAgua || 0;
      a.alcCost += r.valorAlcantarillado || 0;
      a.gasCost += r.valorGas || 0;
      return a;
    }, { kwh: 0, co2: 0, energyCost: 0, water: 0, waste: 0, aguaCost: 0, alcCost: 0, gasCost: 0 });

    $("kpiKwh").textContent = `${fmt(totals.kwh)} kWh`;
    $("kpiCo2").textContent = `${fmt(totals.co2)} kg CO₂`;
    $("kpiEnergyCost").textContent = money(totals.energyCost);
    $("kpiSites").textContent = fmt(records.length, 0);
    $("kpiWater").textContent = `${fmt(totals.water)} m³`;
    $("kpiWaste").textContent = money(totals.waste);
    renderTable(records, factor);
    renderCharts(records, totals);
  }

  function renderTable(records, factor) {
    els.recordsTable.innerHTML = "";
    if (!records.length) {
      els.recordsTable.appendChild($("emptyRow").content.cloneNode(true));
      return;
    }

    records.sort((a, b) => (b.energiaKwh || 0) - (a.energiaKwh || 0)).forEach((r) => {
      const tr = document.createElement("tr");
      const co2 = (r.energiaKwh || 0) * factor;
      tr.innerHTML = `
        <td><strong>${escapeHtml(r.sede)}</strong><br><small>Producto energía: ${escapeHtml(r.productoEnergia || "N/D")}</small></td>
        <td>${escapeHtml(r.direccion)}<br><small>Pág. ${(r.pages || []).join(", ") || "N/D"}</small></td>
        <td>${escapeHtml(r.period)}</td>
        <td>${fmt(r.aguaM3)}</td>
        <td>${fmt(r.alcantarilladoM3)}</td>
        <td><strong>${fmt(r.energiaKwh)}</strong></td>
        <td>${fmt(co2)}</td>
        <td>${money(r.valorEnergia)}</td>
        <td>${money(r.valorAseo)}</td>
        <td>${renderBadges(r.alertas)}</td>`;
      els.recordsTable.appendChild(tr);
    });
  }

  function renderBadges(alertas) {
    const list = alertas || [];
    if (!list.length) return '<span class="badge">OK</span>';
    return list.map((a) => `<span class="badge warn">${escapeHtml(a)}</span>`).join("");
  }

  function renderCharts(records, totals) {
    if (!window.Chart) return;
    const byMonth = new Map();
    state.records.forEach((r) => byMonth.set(r.period, (byMonth.get(r.period) || 0) + (r.energiaKwh || 0)));
    const labels = Array.from(byMonth.keys()).sort();
    const values = labels.map((l) => byMonth.get(l));
    drawChart("monthlyChart", "bar", labels, [{ label: "kWh", data: values }]);
    drawChart("serviceChart", "doughnut", ["Agua", "Alcantarillado", "Energía", "Gas", "Aseo"], [{
      label: "Valor facturado",
      data: [totals.aguaCost || 0, totals.alcCost || 0, totals.energyCost || 0, totals.gasCost || 0, totals.waste || 0]
    }]);
  }

  function drawChart(canvasId, type, labels, datasets) {
    const ctx = $(canvasId);
    if (!ctx) return;
    if (state.charts[canvasId]) state.charts[canvasId].destroy();
    state.charts[canvasId] = new window.Chart(ctx, {
      type,
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true }, tooltip: { callbacks: { label: (c) => `${c.dataset.label || c.label}: ${fmt(c.raw)}` } } },
        scales: type === "doughnut" ? {} : { y: { beginAtZero: true } }
      }
    });
  }

  function exportCsv() {
    const rows = getFilteredRecords();
    const headers = ["periodo", "sede", "direccion", "agua_m3", "alcantarillado_m3", "energia_kwh", "co2_kg", "gas_m3", "valor_agua", "valor_alcantarillado", "valor_energia", "valor_gas", "valor_aseo", "producto_energia", "medidor_energia", "categoria", "paginas", "alertas"];
    const factor = Number(els.factorCo2.value) || 0;
    const csv = [headers.join(",")].concat(rows.map((r) => headers.map((h) => csvValue(valueForCsv(r, h, factor))).join(","))).join("\n");
    downloadBlob(csv, `simeco2_${els.periodo.value || "datos"}.csv`, "text/csv;charset=utf-8");
  }

  function valueForCsv(r, h, factor) {
    const map = {
      periodo: r.period, sede: r.sede, direccion: r.direccion, agua_m3: r.aguaM3,
      alcantarillado_m3: r.alcantarilladoM3, energia_kwh: r.energiaKwh,
      co2_kg: round((r.energiaKwh || 0) * factor), gas_m3: r.gasM3,
      valor_agua: r.valorAgua, valor_alcantarillado: r.valorAlcantarillado,
      valor_energia: r.valorEnergia, valor_gas: r.valorGas, valor_aseo: r.valorAseo,
      producto_energia: r.productoEnergia, medidor_energia: r.medidorEnergia,
      categoria: r.categoria, paginas: (r.pages || []).join("|"), alertas: (r.alertas || []).join("|")
    };
    return map[h] === undefined ? "" : map[h];
  }

  function exportJson() {
    downloadBlob(JSON.stringify(state.records, null, 2), `simeco2_base_${Date.now()}.json`, "application/json");
  }

  function csvValue(v) {
    return `"${String(v === undefined || v === null ? "" : v).replace(/"/g, '""')}"`;
  }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function resetSystem() {
    if (!confirm("¿Deseas borrar todos los datos almacenados en este navegador?")) return;
    localStorage.removeItem(STORAGE_KEY);
    state.records = [];
    render();
  }

  function loadDemo() {
    const period = els.periodo.value || "2025-01";
    const demo = [
      { sede: "Liceo Cristo Rey", direccion: "Cl 2 Sur Cr 50 D -30", energiaKwh: 2684, valorEnergia: 2432133.44, aguaM3: 66, alcantarilladoM3: 66, valorAgua: 318618.29, valorAlcantarillado: 242103.66, valorAseo: 735617.78 },
      { sede: "Escuela J. Acevedo y Gómez", direccion: "Cl 8 Sur Cr 52 C -25", energiaKwh: 3163, valorEnergia: 3048752.89, aguaM3: 130, alcantarilladoM3: 130, valorAgua: 618609.33, valorAlcantarillado: 471710.70, valorAseo: 498182.23, alertas: ["Revisión medidor"] },
      { sede: "I.E. Manuel J. Betancur", direccion: "Cl 44 Sur Cr 81 -28", energiaKwh: 63, valorEnergia: 56138.67, aguaM3: 11, alcantarilladoM3: 11, valorAgua: 60813.49, valorAlcantarillado: 44785.11, valorAseo: 48793.99 },
      { sede: "INEM José Félix de Restrepo", direccion: "Cr 48 Cl 1 -125", energiaKwh: 1535, valorEnergia: 1390955.60, aguaM3: 3205, alcantarilladoM3: 3205, valorAgua: 15032241.33, valorAlcantarillado: 11503611.45, valorAseo: 3954436.70 }
    ].map((x) => {
      const r = baseRecord(period, { name: x.sede, address: x.direccion }, 1, "demo");
      Object.assign(r, x);
      r.pages = new Set([1]);
      r.alertas = x.alertas || [];
      return finalizeRecord(r);
    });
    state.records = upsertRecords(state.records, demo);
    saveRecords(state.records);
    render();
  }

  function showProgress(show, title) {
    els.progressPanel.classList.toggle("hidden", !show);
    els.progressTitle.textContent = title || "Procesando PDF...";
    if (show) {
      setProgress(0);
      els.logBox.textContent = "";
    }
  }

  function setProgress(n) {
    els.progressBar.style.width = `${n}%`;
    els.progressText.textContent = `${n}%`;
  }

  function log(msg) {
    els.logBox.textContent += `[${new Date().toLocaleTimeString()}] ${msg}\n`;
    els.logBox.scrollTop = els.logBox.scrollHeight;
  }

  function setLibraryStatus(text, type) {
    els.libraryStatus.textContent = text;
    els.libraryStatus.className = `status-strip ${type || ""}`;
  }

  function fmt(value, decimals) {
    const d = decimals === undefined ? 2 : decimals;
    return new Intl.NumberFormat("es-CO", { maximumFractionDigits: d }).format(value || 0);
  }

  function money(value) {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value || 0);
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
  }

  function createId() {
    return `r_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
})();

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));
}

const recordsBundle = readJson('registros.compact.json');
const syncBundle = readJson('sincronizacion-territorial.json');
const exceptionsBundle = readJson('excepciones-servicios.json');
const summariesBundle = readJson('resumenes.json');

function decodeCompactRecords(bundle) {
  if (Array.isArray(bundle?.records)) return bundle.records;
  const columns=Array.isArray(bundle?.c)?bundle.c:[];
  const dictColumns=Array.isArray(bundle?.dictColumns)?bundle.dictColumns:[];
  const dictCount=dictColumns.length;
  const dictionaries=bundle?.d||{};
  const rows=Array.isArray(bundle?.r)?bundle.r:[];
  return rows.map(row=>{
    const record={};
    for(let i=0;i<columns.length;i++){
      const key=columns[i];
      record[key]=i<dictCount ? dictionaries[key]?.[row[i]] : row[i];
    }
    return record;
  });
}
const records = decodeCompactRecords(recordsBundle);
const sync = syncBundle && typeof syncBundle.metadata === 'object' ? syncBundle.metadata : {};
const exceptions = Array.isArray(exceptionsBundle.exceptions) ? exceptionsBundle.exceptions : [];
const summaries = Array.isArray(summariesBundle.summaries) ? summariesBundle.summaries : [];

const METRICS = {
  energyKwh: { label: 'Energía eléctrica', unit: 'kWh', valueField: 'energyValue' },
};

function norm(value) {
  return String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function syncNorm(value) {
  return String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9$.,%#/-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function rawKey(record) {
  return `${syncNorm(record.site)}|${syncNorm(record.address || '')}`;
}

function metaFor(record) {
  return sync[rawKey(record)] || {};
}

function institutionKey(record) {
  const meta = metaFor(record);
  return meta.institutionGroupId ? `institution:${norm(meta.institutionGroupId)}` : `site:${rawKey(record)}`;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function exceptionForRecord(record, service = 'energyKwh') {
  const key = norm(`${record.site}|${record.address || ''}`);
  return exceptions.find(ex => ex.service === service && norm(ex.key || `${ex.site}|${ex.address}`) === key) || null;
}

function buildInstitutions() {
  const map = new Map();
  for (const record of records) {
    const key = institutionKey(record);
    const meta = metaFor(record);
    if (!map.has(key)) {
      map.set(key, {
        key,
        records: [],
        memberMap: new Map(),
        aliases: new Set(),
        directoryIds: new Set(),
        nuclei: new Set(),
        territories: new Set(),
        neighborhoods: new Set(),
        displayName: meta.institutionDisplayName || meta.displayName || meta.matchedName || record.site || 'Sede sin nombre',
      });
    }
    const item = map.get(key);
    item.records.push(record);
    const mkey = rawKey(record);
    if (!item.memberMap.has(mkey)) {
      item.memberMap.set(mkey, {
        key: mkey,
        site: record.site || 'Sede sin nombre',
        address: record.address || '',
        displayName: meta.displayName || meta.matchedName || record.site || 'Sede sin nombre',
        role: meta.institutionRole || meta.siteType || '',
        directoryId: meta.directoryId || '',
        meta,
      });
    }
    [record.site, record.address, meta.displayName, meta.institutionDisplayName, meta.matchedName, meta.aliases, meta.invoiceSite, meta.invoiceAddress, meta.directoryId]
      .filter(Boolean).forEach(v => item.aliases.add(String(v)));
    if (meta.directoryId) item.directoryIds.add(meta.directoryId);
    if (meta.nucleus) item.nuclei.add(String(meta.nucleus));
    if (meta.commune) item.territories.add(meta.commune);
    if (meta.neighborhood) item.neighborhoods.add(meta.neighborhood);
  }
  return [...map.values()].map(item => {
    const members = [...item.memberMap.values()];
    const first = item.records[0] || {};
    const firstMeta = metaFor(first);
    if (firstMeta.institutionDisplayName) item.displayName = firstMeta.institutionDisplayName;
    else if (members.length === 1 && members[0].displayName) item.displayName = members[0].displayName;
    return {
      ...item,
      members,
      aliases: [...item.aliases],
      directoryIds: [...item.directoryIds],
      nuclei: [...item.nuclei],
      territories: [...item.territories],
      neighborhoods: [...item.neighborhoods],
    };
  }).sort((a,b) => a.displayName.localeCompare(b.displayName, 'es', {numeric:true}));
}

const institutions = buildInstitutions();
const institutionMap = new Map(institutions.map(i => [i.key, i]));

function scoreText(text, query) {
  const t = norm(text), q = norm(query);
  if (!q || !t) return 0;
  if (t === q) return 1000;
  if (t.startsWith(q)) return 850;
  if (t.includes(q)) return 700;
  if (q.includes(t) && t.length >= 5) return 650;
  const qt = q.split(' ').filter(x => x.length > 1);
  const tt = new Set(t.split(' '));
  const matched = qt.filter(token => tt.has(token) || [...tt].some(x => x.startsWith(token) || token.startsWith(x))).length;
  const ratio = qt.length ? matched / qt.length : 0;
  return Math.round(ratio * 500) - Math.max(0, qt.length - matched) * 35;
}

function institutionSearchText(item) {
  return [item.displayName, ...item.aliases, ...item.directoryIds, ...item.nuclei, ...item.territories, ...item.neighborhoods,
    ...item.members.flatMap(m => [m.site, m.address, m.displayName, m.role])].filter(Boolean).join(' | ');
}

function searchInstitutions(query, limit = 8) {
  const q = String(query || '').trim();
  if (!q) return [];
  return institutions.map(item => {
    const fields = [item.displayName, ...item.aliases, ...item.members.flatMap(m => [m.site, m.address, m.displayName]), institutionSearchText(item)];
    const score = Math.max(...fields.map(field => scoreText(field, q)));
    return { item, score };
  }).filter(x => x.score > 0)
    .sort((a,b) => b.score - a.score || a.item.displayName.localeCompare(b.item.displayName, 'es'))
    .slice(0, Math.max(1, Math.min(Number(limit) || 8, 20)))
    .map(({item,score}) => ({
      key: item.key,
      name: item.displayName,
      score,
      directoryIds: item.directoryIds,
      nuclei: item.nuclei,
      territories: item.territories,
      members: item.members.map(m => ({name:m.displayName, invoiceName:m.site, address:m.address, role:m.role, directoryId:m.directoryId})),
    }));
}

function resolveInstitution(query) {
  if (institutionMap.has(query)) return institutionMap.get(query);
  const found = searchInstitutions(query, 3);
  if (!found.length || found[0].score < 120) return { notFound: true, suggestions: found };
  // Evita resolver automáticamente cuando dos resultados son casi iguales.
  if (found[1] && found[0].score < 700 && found[0].score - found[1].score < 40) {
    return { ambiguous: true, suggestions: found };
  }
  return institutionMap.get(found[0].key);
}

function periodFilter(list, period, year) {
  let out = list;
  if (period) out = out.filter(r => String(r.period || '') === String(period));
  else if (year) out = out.filter(r => String(r.period || '').startsWith(String(year)));
  return out;
}

function sumNullable(list, field) {
  const vals = list.map(r => nullableNumber(r[field])).filter(v => v !== null);
  return { value: vals.reduce((a,b) => a+b, 0), available: vals.length > 0, rowsWithData: vals.length };
}

function monthlyRows(list) {
  const map = new Map();
  for (const r of list) {
    if (!map.has(r.period)) map.set(r.period, []);
    map.get(r.period).push(r);
  }
  return [...map.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([period, rows]) => {
    const result = { period };
    for (const field of Object.keys(METRICS)) {
      const s = sumNullable(rows, field);
      result[field] = s.available ? s.value : null;
    }
    const co2 = sumNullable(rows, 'co2kg');
    // Si no existe energía identificada en el periodo, CO₂e de alcance 2 no es calculable.
    result.co2kg = result.energyKwh === null ? null : (co2.available ? co2.value : null);
    result.cost = {};
    for (const [field, metric] of Object.entries(METRICS)) {
      const s = sumNullable(rows, metric.valueField);
      result.cost[field] = s.available ? s.value : null;
    }
    result.evidence = [...new Map(rows.map(r => [`${r.source}|${r.page}`, {
      source: r.source,
      page: r.page,
      url: r.sourceUrl || (r.source ? `data/${r.source}` : ''),
      invoiceName: r.site,
      address: r.address,
    }])).values()];
    return result;
  });
}

function qualityForInstitution(item, list = item.records) {
  const periods = [...new Set(list.map(r => r.period).filter(Boolean))].sort();
  const coverage = {};
  for (const [field, meta] of Object.entries(METRICS)) {
    const byPeriod = new Set(list.filter(r => nullableNumber(r[field]) !== null).map(r => r.period));
    coverage[field] = {
      label: meta.label,
      periodsWithData: byPeriod.size,
      totalPeriods: periods.length,
      percent: periods.length ? Math.round(byPeriod.size * 1000 / periods.length) / 10 : 0,
    };
  }
  const energyExceptions = item.members.flatMap(member => {
    const candidate = item.records.find(r => rawKey(r) === member.key);
    const ex = candidate ? exceptionForRecord(candidate, 'energyKwh') : null;
    return ex ? [ex] : [];
  });
  let status = 'cobertura_electrica_parcial';
  let label = 'Cobertura eléctrica parcial';
  if (coverage.energyKwh.periodsWithData === 0 && energyExceptions.length) {
    status = 'energia_contrato_separado'; label = 'Energía en contrato separado';
  } else if (coverage.energyKwh.periodsWithData === 0) {
    status = 'energia_no_identificada'; label = 'Energía no identificada';
  } else if (coverage.energyKwh.percent === 100) {
    status = 'energia_identificada'; label = 'Energía identificada';
  }
  return {
    status, label, periods: periods.length, coverage,
    exceptions: energyExceptions.map(ex => ({
      service: ex.service, status: ex.status, label: ex.label, summary: ex.summary, dataState: ex.dataState,
      confidence: ex.confidence, evidence: ex.evidence || [], recommendedAction: ex.recommendedAction,
    })),
  };
}

function totalsFor(list) {
  const out = {};
  for (const field of Object.keys(METRICS)) {
    const s = sumNullable(list, field);
    out[field] = s.available ? s.value : null;
    const cost = sumNullable(list, METRICS[field].valueField);
    out[`${field}Cost`] = cost.available ? cost.value : null;
  }
  const co2 = sumNullable(list, 'co2kg');
  // CO2e de alcance 2 solo es calculable cuando existe consumo eléctrico identificado.
  out.co2kg = out.energyKwh === null ? null : (co2.available ? co2.value : null);
  return out;
}

function yearComparison(monthly, metric) {
  if (!METRICS[metric]) return null;
  const byYear = new Map();
  for (const row of monthly) {
    const value = nullableNumber(row[metric]);
    if (value === null) continue;
    const year = String(row.period).slice(0,4);
    const month = String(row.period).slice(5,7);
    if (!byYear.has(year)) byYear.set(year, new Map());
    byYear.get(year).set(month, value);
  }
  const years = [...byYear.keys()].sort();
  if (years.length < 2) return null;
  const previous = years[years.length - 2], current = years[years.length - 1];
  const commonMonths = [...byYear.get(previous).keys()].filter(m => byYear.get(current).has(m)).sort();
  if (!commonMonths.length) return null;
  const a = commonMonths.reduce((sum,m) => sum + byYear.get(previous).get(m), 0);
  const b = commonMonths.reduce((sum,m) => sum + byYear.get(current).get(m), 0);
  return {
    previousYear: previous, currentYear: current, monthsCompared: commonMonths,
    previousValue: a, currentValue: b,
    changePercent: a ? Math.round(((b-a)/a)*1000)/10 : null,
  };
}

function institutionReport(query, opts = {}) {
  const item = resolveInstitution(query);
  if (item.notFound || item.ambiguous) return item;
  const list = periodFilter(item.records, opts.period, opts.year);
  const monthly = monthlyRows(list);
  const totals = totalsFor(list);
  const quality = qualityForInstitution(item, list.length ? list : item.records);
  const latest = monthly.length ? monthly[monthly.length - 1] : null;
  return {
    institution: {
      key: item.key,
      name: item.displayName,
      directoryIds: item.directoryIds,
      nuclei: item.nuclei,
      territories: item.territories,
      neighborhoods: item.neighborhoods,
      members: item.members.map(m => ({name:m.displayName, invoiceName:m.site, address:m.address, role:m.role, directoryId:m.directoryId})),
    },
    filter: { period: opts.period || null, year: opts.year || null },
    recordCount: list.length,
    periodCount: new Set(list.map(r => r.period)).size,
    totals,
    latest,
    monthly,
    comparisons: {
      energyKwh: yearComparison(monthlyRows(item.records), 'energyKwh'),
      waterM3: yearComparison(monthlyRows(item.records), 'waterM3'),
      alcM3: yearComparison(monthlyRows(item.records), 'alcM3'),
      wasteTon: yearComparison(monthlyRows(item.records), 'wasteTon'),
    },
    quality,
  };
}

function history(query, metric = 'energyKwh', opts = {}) {
  if (!METRICS[metric]) metric = 'energyKwh';
  const report = institutionReport(query, {year: opts.year});
  if (report.notFound || report.ambiguous) return report;
  return {
    institution: report.institution,
    metric: { field: metric, ...METRICS[metric] },
    quality: report.quality,
    rows: report.monthly.map(row => ({ period: row.period, value: row[metric], cost: row.cost[metric], evidence: row.evidence })),
    comparison: report.comparisons[metric] || null,
  };
}

function ranking(metric = 'energyKwh', opts = {}) {
  if (!METRICS[metric]) metric = 'energyKwh';
  const period = opts.period || null;
  const year = opts.year || null;
  const limit = Math.max(1, Math.min(Number(opts.limit) || 10, 100));
  const rows = [];
  const excluded = [];
  for (const item of institutions) {
    const list = periodFilter(item.records, period, year);
    if (!list.length) continue;
    const s = sumNullable(list, metric);
    const quality = qualityForInstitution(item, list);
    if (!s.available) {
      excluded.push({ name:item.displayName, reason:quality.label, qualityStatus:quality.status });
      continue;
    }
    rows.push({
      key:item.key, name:item.displayName, value:s.value, periodCount:new Set(list.map(r=>r.period)).size,
      nuclei:item.nuclei, territories:item.territories, qualityStatus:quality.status,
    });
  }
  rows.sort((a,b) => b.value - a.value || a.name.localeCompare(b.name,'es'));
  return {
    metric: { field:metric, ...METRICS[metric] },
    filter: {period, year},
    totalRanked: rows.length,
    totalExcluded: excluded.length,
    ranking: rows.slice(0,limit).map((r,i)=>({position:i+1,...r})),
    excluded: excluded.slice(0,50),
  };
}


function rankingStatusForInstitution(query, metric = 'energyKwh', opts = {}) {
  if (!METRICS[metric]) metric = 'energyKwh';
  const item = resolveInstitution(query);
  if (item.notFound || item.ambiguous) return item;
  const period = opts.period || null;
  const year = opts.year || null;
  const list = periodFilter(item.records, period, year);
  const quality = qualityForInstitution(item, list.length ? list : item.records);
  if (!list.length) {
    return {
      institution:{key:item.key,name:item.displayName}, metric:{field:metric,...METRICS[metric]}, filter:{period,year},
      included:false, position:null, value:null, reason:'No hay registros para el periodo solicitado.',
      qualityStatus:quality.status, qualityLabel:quality.label, quality
    };
  }
  const s = sumNullable(list, metric);
  if (!s.available) {
    return {
      institution:{key:item.key,name:item.displayName}, metric:{field:metric,...METRICS[metric]}, filter:{period,year},
      included:false, position:null, value:null, reason:quality.label,
      qualityStatus:quality.status, qualityLabel:quality.label, quality
    };
  }
  const ranked = [];
  for (const candidate of institutions) {
    const candidateList = periodFilter(candidate.records, period, year);
    if (!candidateList.length) continue;
    const cs = sumNullable(candidateList, metric);
    if (!cs.available) continue;
    ranked.push({key:candidate.key,name:candidate.displayName,value:cs.value});
  }
  ranked.sort((a,b)=>b.value-a.value || a.name.localeCompare(b.name,'es'));
  const index = ranked.findIndex(r=>r.key===item.key);
  return {
    institution:{key:item.key,name:item.displayName}, metric:{field:metric,...METRICS[metric]}, filter:{period,year},
    included:index>=0, position:index>=0?index+1:null, value:s.value, totalRanked:ranked.length,
    reason:index>=0?null:quality.label, qualityStatus:quality.status, qualityLabel:quality.label, quality
  };
}

function compareInstitutions(queries, metric = 'energyKwh', opts = {}) {
  if (!Array.isArray(queries)) queries = [queries];
  if (!METRICS[metric]) metric = 'energyKwh';
  const results = queries.slice(0,8).map(query => {
    const item = resolveInstitution(query);
    if (item.notFound || item.ambiguous) return {query, ...item};
    const list = periodFilter(item.records, opts.period, opts.year);
    const s = sumNullable(list, metric);
    return {
      query, key:item.key, name:item.displayName,
      value:s.available ? s.value : null,
      periodCount:new Set(list.map(r=>r.period)).size,
      quality:qualityForInstitution(item,list.length?list:item.records),
    };
  });
  return { metric:{field:metric,...METRICS[metric]}, filter:{period:opts.period||null,year:opts.year||null}, results };
}

function cityIndicators(opts = {}) {
  const list = periodFilter(records, opts.period, opts.year);
  const totals = totalsFor(list);
  const periodCount = new Set(list.map(r => r.period)).size;
  return {
    filter:{period:opts.period||null,year:opts.year||null},
    recordCount:list.length,
    periodCount,
    institutionCount:new Set(list.map(institutionKey)).size,
    totals,
    officialSummaries: summaries.filter(s => !opts.period || s.period === opts.period).map(s => ({period:s.period,source:s.source,energyKwh:s.energyKwh,waterM3:s.waterM3,alcM3:s.alcM3,gasM3:s.gasM3})),
  };
}

function qualityReport(query) {
  if (query) {
    const item = resolveInstitution(query);
    if (item.notFound || item.ambiguous) return item;
    return { institution:{key:item.key,name:item.displayName,members:item.members.map(m=>({name:m.displayName,address:m.address}))}, quality:qualityForInstitution(item) };
  }
  const groups = { datos_principales_completos:[], datos_parciales:[], energia_no_identificada:[], energia_contrato_separado:[] };
  for (const item of institutions) {
    const q = qualityForInstitution(item);
    if (!groups[q.status]) groups[q.status] = [];
    groups[q.status].push({key:item.key,name:item.displayName,periods:q.periods,energyCoverage:q.coverage.energyKwh.percent});
  }
  return {
    totals:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length])),
    cases:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.slice(0,100)])),
  };
}

module.exports = {
  METRICS,
  records,
  summaries,
  institutions,
  searchInstitutions,
  resolveInstitution,
  institutionReport,
  history,
  ranking,
  rankingStatusForInstitution,
  compareInstitutions,
  cityIndicators,
  qualityReport,
};

const fs=require('fs'),path=require('path'),vm=require('vm');
function ok(v,m){if(!v)throw new Error(m);}
const ROOT=process.cwd();

const active=[
  'index.html','app.js','assistant.js','institucional.js','territorial.js',
  'dashboard.html','busqueda-institucional.html','filtros-territoriales.html','aula-climatica.html',
  'api/_lib/simeco-data.js','api/_lib/assistant-core.js'
];
const banned=/\bwater(?:M3|Value|PeriodCount|RecordCount|Periods)?\b|\balc(?:M3|Value|PeriodCount|RecordCount|Periods)?\b|\bgas(?:M3|Value|PeriodCount|RecordCount|Periods)?\b|\bwaste(?:Ton|Value|PeriodCount|RecordCount|Periods)?\b|\bagua\b|alcantarill|\bgas\b|\baseo\b|\bresiduos\b|servicios públicos|servicio público/i;
for(const file of active){
  const text=fs.readFileSync(file,'utf8');
  ok(!banned.test(text),`${file} contiene una referencia fuera del alcance eléctrico`);
}

const html=fs.readFileSync('index.html','utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const seen=new Set(),dups=[];
for(const id of ids){if(seen.has(id))dups.push(id);seen.add(id);}
ok(!dups.length,`IDs duplicados en index.html: ${dups.join(', ')}`);

for(let i=1;i<=7;i++) ok(html.includes(`id="seccion-${i}"`),`Falta seccion-${i}`);
ok(html.includes('id="rankingPriorityFilters"'),'Falta filtro visible de prioridad del ranking');
for(const p of ['','high','medium','low']) ok(html.includes(`data-priority="${p}"`),`Falta prioridad ${p||'todas'}`);
ok(html.includes('id="rankingCarbonBody"'),'Falta tabla de huella de carbono en Ranking');
ok(html.includes('Huella de carbono<br><small>t CO₂e</small>'),'Falta columna t CO₂e');
ok(html.includes('id="historyDataTable"'),'Falta tabla de valores exactos del Histórico');

function localRefs(file){
  const text=fs.readFileSync(file,'utf8');
  const refs=[];
  for(const m of text.matchAll(/(?:src|href)="([^"]+)"/g)){
    const raw=m[1];
    if(!raw || /^(?:https?:|mailto:|tel:|javascript:|data:|blob:|#|\/\/)/i.test(raw)) continue;
    const clean=raw.split('#')[0].split('?')[0];
    if(clean) refs.push(clean);
  }
  return refs;
}
for(const file of fs.readdirSync(ROOT).filter(x=>x.endsWith('.html'))){
  const pageText=fs.readFileSync(file,'utf8');
  const activeLocalRefs=[...pageText.matchAll(/(?:src|href)="([^"]+\?v=[^"]+)"/g)].map(m=>m[1]).filter(x=>/\.js\?v=|styles\.css\?v=/.test(x));
  for(const ref of activeLocalRefs) ok(ref.includes('?v=92-control-calidad'),`${file}: caché no alineada a v92 en ${ref}`);
  for(const ref of localRefs(file)){
    const target=path.resolve(path.dirname(path.join(ROOT,file)),decodeURIComponent(ref));
    ok(fs.existsSync(target),`${file}: referencia local rota ${ref}`);
  }
}

const dataCtx={window:{}};dataCtx.window=dataCtx;vm.createContext(dataCtx);
vm.runInContext(fs.readFileSync('data/registros.electricidad.min.js','utf8'),dataCtx);
ok(Array.isArray(dataCtx.SIMECO_REGISTROS),'No se cargó SIMECO_REGISTROS');
ok(dataCtx.SIMECO_REGISTROS.length===9147,`Registros esperados 9147, encontrados ${dataCtx.SIMECO_REGISTROS.length}`);
ok(new Set(dataCtx.SIMECO_REGISTROS.map(r=>r.key)).size===9147,'Hay claves duplicadas en registros');
const recordSources=[...new Set(dataCtx.SIMECO_REGISTROS.map(r=>r.source).filter(Boolean))];
ok(recordSources.length===17,`Se esperaban 17 facturas fuente en registros, hay ${recordSources.length}`);
for(const source of recordSources) ok(fs.existsSync(path.join(ROOT,'data',source)),`Factura fuente inexistente: ${source}`);

const summaryCtx={window:{}};summaryCtx.window=summaryCtx;vm.createContext(summaryCtx);
vm.runInContext(fs.readFileSync('data/resumenes.electricidad.min.js','utf8'),summaryCtx);
const summaries=summaryCtx.SIMECO_SUMMARY_BUNDLE.summaries;
ok(summaries.length===17,`Resúmenes oficiales esperados 17, encontrados ${summaries.length}`);
const periodCounts={};
for(const r of dataCtx.SIMECO_REGISTROS) periodCounts[r.period]=(periodCounts[r.period]||0)+1;
for(const s of summaries){
  ok(periodCounts[s.period]===s.detailRecords,`Conteo ${s.period}: esperado ${s.detailRecords}, encontrado ${periodCounts[s.period]||0}`);
}
for(const s of summaries){
  ok(s.source && s.sourceUrl,`Fuente incompleta en ${s.period}`);
  const pdf=path.join(ROOT,s.sourceUrl);
  ok(fs.existsSync(pdf),`PDF faltante: ${s.sourceUrl}`);
  const buf=fs.readFileSync(pdf);
  ok(buf.length>100000,`PDF demasiado pequeño: ${s.sourceUrl}`);
  ok(buf.subarray(0,4).toString()==='%PDF',`Cabecera PDF inválida: ${s.sourceUrl}`);
}

const api=require(path.join(ROOT,'api/_lib/simeco-data.js'));
ok(JSON.stringify(Object.keys(api.METRICS))===JSON.stringify(['energyKwh']),'API expone métricas no eléctricas');
const report=api.institutionReport('Manuel J Betancur');
if(!report.notFound && !report.ambiguous){
  ok(JSON.stringify(Object.keys(report.comparisons))===JSON.stringify(['energyKwh']),'Informe API conserva comparaciones no eléctricas');
}
const city=api.cityIndicators({});
for(const s of city.officialSummaries){
  const keys=Object.keys(s);
  ok(!keys.some(k=>/water|alcM3|gasM3|waste/i.test(k)),'Indicadores ciudad exponen servicios no eléctricos');
}

ok(city.totals.energySource==='resumen_oficial_factura','El total ciudad no usa el resumen oficial');
ok(Math.abs(city.totals.energyKwh-18800429.36)<0.01,`Total oficial inesperado: ${city.totals.energyKwh}`);
const apiRanking=api.ranking('energyKwh',{limit:10});
ok(apiRanking.ranking.length>0,'Ranking API vacío');
ok(apiRanking.ranking.every(r=>Number.isFinite(r.co2eT)),'Ranking API no incluye CO₂e');

const core=fs.readFileSync('api/_lib/assistant-core.js','utf8');
ok(!/waterM3|alcM3|gasM3|wasteTon/.test(core),'Asistente API conserva métricas no eléctricas');
ok(core.includes("enum:['energyKwh']"),'Herramientas del asistente no están limitadas a energía');

const app=fs.readFileSync('app.js','utf8');
ok(app.includes("const DATA_VERSION = 'v92-control-calidad-integral-20260808';"),'DATA_VERSION no corresponde a v92');
ok(app.includes('function historySourceDownloadHtml(item)'),'Falta descarga PDF desde Histórico');
ok(app.includes('function renderRankingCarbonTable(visible,start=0)'),'Falta tabla de CO₂e del Ranking');
ok(html.includes('app.js?v=92-control-calidad'),'Falta cache-busting v92');

console.log(JSON.stringify({
  ok:true,
  activeFiles:active.length,
  ids:ids.length,
  records:dataCtx.SIMECO_REGISTROS.length,
  summaries:summaries.length,
  pdfs:summaries.length,
  sections:7,
  apiMetrics:Object.keys(api.METRICS)
},null,2));

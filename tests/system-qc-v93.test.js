const fs=require('fs'),path=require('path'),vm=require('vm');
function ok(v,m){if(!v)throw new Error(m);}
const ROOT=process.cwd();

const html=fs.readFileSync('index.html','utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const seen=new Set(),dups=[];
for(const id of ids){if(seen.has(id))dups.push(id);seen.add(id);}
ok(!dups.length,`IDs duplicados: ${dups.join(', ')}`);
for(let i=1;i<=8;i++) ok(html.includes(`id="seccion-${i}"`),`Falta seccion-${i}`);
ok(html.includes('data-section="seccion-8"'),'Falta pestaña 8');
ok(html.includes('id="ranking-consumo-agua"'),'Falta ranking de consumo de agua');
ok(html.includes('id="ranking-ahorro-agua"'),'Falta ranking de ahorro de agua');
ok(html.includes('id="plan-ahorro-agua"'),'Falta plan de ahorro de agua');
ok(html.includes('id="waterDownloadPlanPdf"'),'Falta descarga PDF del plan de agua');

function localRefs(file){
  const text=fs.readFileSync(file,'utf8'),refs=[];
  for(const m of text.matchAll(/(?:src|href)="([^"]+)"/g)){
    const raw=m[1];
    if(!raw || /^(?:https?:|mailto:|tel:|javascript:|data:|blob:|#|\/\/)/i.test(raw)) continue;
    const clean=raw.split('#')[0].split('?')[0];
    if(clean) refs.push(clean);
  }
  return refs;
}
for(const file of fs.readdirSync(ROOT).filter(x=>x.endsWith('.html'))){
  for(const ref of localRefs(file)){
    const target=path.resolve(path.dirname(path.join(ROOT,file)),decodeURIComponent(ref));
    ok(fs.existsSync(target),`${file}: referencia local rota ${ref}`);
  }
}

const ectx={window:{}};ectx.window=ectx;vm.createContext(ectx);
vm.runInContext(fs.readFileSync('data/registros.electricidad.min.js','utf8'),ectx);
ok(ectx.SIMECO_REGISTROS.length===9147,'Base eléctrica distinta de 9.147 registros');

const wctx={window:{}};wctx.window=wctx;vm.createContext(wctx);
vm.runInContext(fs.readFileSync('data/registros.agua.min.js','utf8'),wctx);
ok(wctx.SIMECO_WATER_RECORDS.length===9147,'Base de agua no conserva 9.147 registros');
ok(wctx.SIMECO_WATER_RECORDS.filter(r=>r.waterM3!==null&&r.waterM3!==undefined).length===7317,'Cantidad de lecturas de agua inesperada');

const wsctx={window:{}};wsctx.window=wsctx;vm.createContext(wsctx);
vm.runInContext(fs.readFileSync('data/resumenes.agua.min.js','utf8'),wsctx);
const summaries=wsctx.SIMECO_WATER_SUMMARY_BUNDLE.summaries;
ok(summaries.length===17,'Se esperaban 17 resúmenes de agua');
const official=summaries.reduce((a,s)=>a+(Number(s.waterM3)||0),0);
ok(Math.abs(official-1351583.22)<0.01,`Total oficial de agua inesperado: ${official}`);
for(const s of summaries){
  ok(s.source&&s.sourceUrl,`Fuente de agua incompleta ${s.period}`);
  ok(fs.existsSync(path.join(ROOT,s.sourceUrl)),`PDF faltante ${s.sourceUrl}`);
}

const app=fs.readFileSync('app.js','utf8');
ok(app.includes("const DATA_VERSION = 'v93-agua-integrado-20260808';"),'DATA_VERSION no es v93');
ok(app.includes('function extractWaterM3(text)'),'Actualizar datos no extrae agua');
ok(app.includes('waterM3:summary.waterM3'),'Resumen importado no conserva agua');
ok(app.includes('waterM3,'),'Registro importado no conserva agua');

const water=fs.readFileSync('water.js','utf8');
for(const marker of ['aggregateWaterSites','officialWaterStats','buildWaterSavingsRows','buildWaterPlan','downloadWaterPlanPdf']){
  ok(water.includes(marker),`Falta ${marker}`);
}
ok(html.includes('water.js?v=93-agua'),'water.js no está versionado');
console.log(JSON.stringify({ok:true,sections:8,electricRecords:9147,waterRecords:9147,waterReadings:7317,waterSummaries:17,officialWaterM3:official},null,2));

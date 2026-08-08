const fs=require('fs'),path=require('path'),vm=require('vm');
function ok(v,m){if(!v)throw new Error(m);}
const ROOT=process.cwd();

const html=fs.readFileSync('index.html','utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const seen=new Set(),dups=[];
for(const id of ids){if(seen.has(id))dups.push(id);seen.add(id);}
ok(!dups.length,`IDs duplicados: ${dups.join(', ')}`);
for(let i=1;i<=9;i++) ok(html.includes(`id="seccion-${i}"`),`Falta seccion-${i}`);
ok(html.includes('data-section="seccion-9"'),'Falta pestaña 9 Gas');
for(const id of ['ranking-consumo-gas','ranking-ahorro-gas','plan-ahorro-gas','gasDownloadPlanPdf']) ok(html.includes(`id="${id}"`),`Falta ${id}`);

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

function evalBundle(file,globalName){
  const c={window:{}};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(file,'utf8'),c);return c[globalName];
}
const electric=evalBundle('data/registros.electricidad.min.js','SIMECO_REGISTROS');
const water=evalBundle('data/registros.agua.min.js','SIMECO_WATER_RECORDS');
const gas=evalBundle('data/registros.gas.min.js','SIMECO_GAS_RECORDS');
ok(electric.length===9147 && water.length===9147 && gas.length===9147,'Las tres bases deben conservar 9.147 registros');

const wc={window:{}};wc.window=wc;vm.createContext(wc);vm.runInContext(fs.readFileSync('data/resumenes.agua.min.js','utf8'),wc);
const gc={window:{}};gc.window=gc;vm.createContext(gc);vm.runInContext(fs.readFileSync('data/resumenes.gas.min.js','utf8'),gc);
const ws=wc.SIMECO_WATER_SUMMARY_BUNDLE.summaries,gs=gc.SIMECO_GAS_SUMMARY_BUNDLE.summaries;
ok(ws.length===17 && gs.length===17,'Agua y gas deben tener 17 periodos oficiales');
const waterOfficial=ws.reduce((a,s)=>a+(Number(s.waterM3)||0),0);
const gasOfficial=gs.reduce((a,s)=>a+(Number(s.gasM3)||0),0);
ok(Math.abs(waterOfficial-1351583.22)<0.01,'Total oficial de agua cambió');
ok(Math.abs(gasOfficial-1094.52)<0.001,`Total oficial de gas inesperado ${gasOfficial}`);
for(const s of [...ws,...gs]) ok(fs.existsSync(path.join(ROOT,s.sourceUrl)),`PDF faltante ${s.sourceUrl}`);

const app=fs.readFileSync('app.js','utf8');
ok(app.includes("const DATA_VERSION = 'v94-gas-integrado-20260808';"),'DATA_VERSION no es v94');
ok(app.includes('function extractWaterM3(text)') && app.includes('function extractGasM3(text)'),'Parser futuro no soporta agua+gas');
ok(app.includes('gasM3:summary.gasM3'),'Resumen futuro no conserva gas');

const gasJs=fs.readFileSync('gas.js','utf8');
for(const marker of ['aggregateGasSites','officialGasStats','buildGasSavingsRows','buildGasPlan','downloadGasPlanPdf']) ok(gasJs.includes(marker),`Falta ${marker}`);
ok(/personal competente|personal autorizado/i.test(gasJs),'Plan de gas no incluye salvaguarda técnica');
ok(/Nunca buscar ni reparar fugas con métodos caseros/i.test(gasJs),'Falta prohibición de reparación casera');
ok(html.includes('gas.js?v=94-gas'),'gas.js no está versionado');
console.log(JSON.stringify({ok:true,sections:9,electricRecords:9147,waterRecords:9147,gasRecords:9147,waterOfficialM3:waterOfficial,gasOfficialM3:gasOfficial},null,2));

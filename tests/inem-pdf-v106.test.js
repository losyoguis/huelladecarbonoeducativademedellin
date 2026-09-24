const fs=require('fs'),vm=require('vm');
function ok(v,m){if(!v)throw new Error(m);}
const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const vercel=JSON.parse(fs.readFileSync('vercel.json','utf8'));

// 1) La capa INEM debe sobrevivir aunque el bundle principal llegue obsoleto.
const overlayCode=fs.readFileSync('data/inem/registros.inem.js','utf8');
const stale=[];
for(const p of ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07']){
  stale.push({period:p,site:'Inem J F De Rpo',address:'Cr 48 Cl 1 -125',energyKwh:null,sourceUrl:'data/consolidado.pdf'});
}
const c={window:{SIMECO_REGISTROS:stale}};c.window.window=c.window;vm.createContext(c);vm.runInContext(overlayCode,c);
const merged=c.window.SIMECO_REGISTROS.filter(r=>/inem/i.test(String(r.site)));
ok(merged.length===7,'La capa INEM duplicó filas al superponerse sobre un bundle obsoleto');
ok(merged.every(r=>Number(r.energyKwh)>0),'La capa INEM no recuperó todas las lecturas eléctricas');
const total=merged.reduce((a,r)=>a+Number(r.energyKwh||0),0);
ok(Math.abs(total-258461.17)<0.001,`Total INEM incorrecto tras overlay: ${total}`);
ok(merged.every(r=>String(r.sourceUrl||'').startsWith('data/inem/')),'La fuente eléctrica del overlay no apunta a data/inem');

// 2) El generador del informe debe describir datos integrados, no “pendientes”.
ok(app.includes('Contrato separado integrado:'),'El PDF no documenta el contrato INEM como integrado');
ok(app.includes('periodo(s) eléctricos con dato'),'El PDF no informa la cobertura eléctrica real');
ok(app.includes('Sin fuente eléctrica verificada'),'El PDF no diferencia meses históricos sin lectura eléctrica');
ok(app.includes("r.energySourceUrl||r.sourceUrl"),'El PDF no prioriza la fuente eléctrica específica');
ok(app.includes("Los meses históricos sin factura eléctrica específica se muestran como N.I."),'El PDF no explica N.I. para meses sin factura eléctrica');
ok(!app.includes('El consumo eléctrico queda pendiente de integrar desde esa fuente'),'Persiste el mensaje antiguo de integración pendiente en el informe');

// 3) El overlay debe cargar antes de app.js y con nueva versión de caché.
const basePos=html.indexOf('data/registros.electricidad.min.js?v=108-action-plan');
const overlayPos=html.indexOf('data/inem/registros.inem.js?v=108-action-plan');
const appPos=html.indexOf('app.js?v=108-action-plan');
ok(basePos>=0&&overlayPos>basePos&&appPos>overlayPos,'Orden de carga incorrecto: bundle -> overlay INEM -> app.js');

// 4) Los archivos que cambian con nuevas facturas no deben quedar immutable un año.
function cacheValue(source){
  const h=vercel.headers.find(x=>x.source===source);return h?.headers?.find(x=>x.key==='Cache-Control')?.value||'';
}
for(const source of ['/index.html','/app.js','/data/registros.electricidad.min.js','/data/excepciones-servicios.js','/data/inem/registros.inem.js']){
  const v=cacheValue(source);ok(/must-revalidate/.test(v)&&!/immutable/.test(v),`Caché inseguro para ${source}: ${v}`);
}

console.log(JSON.stringify({ok:true,totalKwh:total,months:merged.length,overlay:'data/inem/registros.inem.js'},null,2));

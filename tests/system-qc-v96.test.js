const fs=require('fs'),path=require('path'),vm=require('vm');
function ok(v,m){if(!v)throw new Error(m);}
const ROOT=process.cwd();
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');
const app=fs.readFileSync('app.js','utf8');

const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const seen=new Set(),dups=[];
for(const id of ids){if(seen.has(id))dups.push(id);seen.add(id);}
ok(!dups.length,`IDs duplicados: ${dups.join(', ')}`);
const order=[...html.matchAll(/<div class="app-section[^"]*" id="seccion-(\d+)"/g)].map(m=>Number(m[1]));
ok(JSON.stringify(order)===JSON.stringify([1,2,3,4,5,6,7,8,9]),`Orden físico incorrecto: ${order}`);

const nav=[...html.matchAll(/class="section-tab[^"]*"[^>]*data-section="seccion-(\d+)"[^>]*>[\s\S]*?<strong>(.*?)<\/strong>/g)].map(m=>[Number(m[1]),m[2]]);
const expected=[[1,'Analizar Datos'],[2,'Histórico'],[3,'Ranking'],[4,'Informe por sede'],[5,'Estado de Información'],[6,'Aula'],[7,'Agua'],[8,'Gas'],[9,'Facturas por I.E.']];
ok(JSON.stringify(nav)===JSON.stringify(expected),`Menú incorrecto: ${JSON.stringify(nav)}`);

for(let i=1;i<=6;i++) ok(html.includes(`id="seccion-${i}" data-resource="electricidad"`),`Sección ${i} no es Electricidad`);
ok(html.includes('id="seccion-7" data-resource="agua"'),'Sección 7 no es Agua');
ok(html.includes('id="seccion-8" data-resource="gas"'),'Sección 8 no es Gas');
ok(html.includes('id="seccion-9" data-resource="transversal"'),'Sección 9 no es transversal');
ok(html.includes('Esta sección no pertenece a Electricidad, Agua ni Gas.'),'Falta declaración transversal de Facturas');

const routing={
  "'ranking-sedes': 'seccion-3'":"Ranking",
  "'dashboard-ambiental': 'seccion-4'":"Informe",
  "'calidad-datos': 'seccion-5'":"Estado",
  "'aula-climatica': 'seccion-6'":"Aula",
  "'ranking-consumo-agua': 'seccion-7'":"Agua",
  "'ranking-consumo-gas': 'seccion-8'":"Gas",
  "registros: 'seccion-9'":"Facturas"
};
for(const [needle,label] of Object.entries(routing)) ok(html.includes(needle),`Mapeo roto: ${label}`);
ok(app.includes("window.simecoOpenSection('seccion-4'"),'Informe por sede no abre sección 4');
ok(fs.readFileSync('water.js','utf8').includes("document.getElementById('seccion-7')"),'Agua no escucha sección 7');
ok(fs.readFileSync('gas.js','utf8').includes("document.getElementById('seccion-8')"),'Gas no escucha sección 8');

ok(css.includes('grid-template-columns:repeat(3,minmax(0,1fr))!important'),'Desktop Google Sites no usa grid 3 columnas');
ok(css.includes('@media(max-width:1100px)'),'Falta breakpoint tablet/iframe');
ok(css.includes('@media(max-width:680px)'),'Falta breakpoint móvil');
ok(css.includes('overflow-x:auto'),'Falta protección de overflow móvil');
ok(css.includes('.neutral-section-tab'),'Falta estilo neutral Facturas');

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
  for(const ref of localRefs(file)) ok(fs.existsSync(path.resolve(path.dirname(path.join(ROOT,file)),decodeURIComponent(ref))),`${file}: referencia rota ${ref}`);
}

function evalBundle(file,globalName){
  const c={window:{}};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(file,'utf8'),c);return c[globalName];
}
ok(evalBundle('data/registros.electricidad.min.js','SIMECO_REGISTROS').length===9147,'Base eléctrica alterada');
ok(evalBundle('data/registros.agua.min.js','SIMECO_WATER_RECORDS').length===9147,'Base Agua alterada');
ok(evalBundle('data/registros.gas.min.js','SIMECO_GAS_RECORDS').length===9147,'Base Gas alterada');
ok(app.includes("const DATA_VERSION = 'v96-menu-navegacion-google-sites-20260808';"),'DATA_VERSION no es v96');
ok(html.includes('app.js?v=96-menu-google-sites'),'Cache-busting v96 ausente');

console.log(JSON.stringify({ok:true,sections:9,menuOrder:expected.map(x=>x[1]),electricity:6,water:7,gas:8,invoices:9,invoicesResource:'transversal',googleSitesResponsive:true},null,2));

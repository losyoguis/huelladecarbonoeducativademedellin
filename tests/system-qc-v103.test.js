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

const menuStart=html.indexOf('<nav class="section-switcher top-card-menu"');
const menuEnd=html.indexOf('</nav>',menuStart);
ok(menuStart>=0&&menuEnd>menuStart,'Falta menú superior de tarjetas');
const menu=html.slice(menuStart,menuEnd);
const labels=[...menu.matchAll(/data-section="seccion-(\d+)"[\s\S]*?<strong>(.*?)<\/strong>/g)].map(m=>[Number(m[1]),m[2]]);
const expected=[[1,'Analizar Datos'],[2,'Histórico'],[3,'Ranking'],[4,'Informe por sede'],[5,'Estado de Información'],[6,'Aula'],[7,'Agua'],[8,'Gas'],[9,'Facturas por I.E.']];
ok(JSON.stringify(labels)===JSON.stringify(expected),`Menú incorrecto: ${JSON.stringify(labels)}`);

for(let i=1;i<=6;i++) ok(html.includes(`id="seccion-${i}" data-resource="electricidad"`),`Sección ${i} no es Electricidad`);
ok(html.includes('id="seccion-7" data-resource="agua"'),'Sección 7 no es Agua');
ok(html.includes('id="seccion-8" data-resource="gas"'),'Sección 8 no es Gas');
ok(html.includes('id="seccion-9" data-resource="transversal"'),'Sección 9 no es transversal');

ok((menu.match(/⚡ Electricidad/g)||[]).length===6,'Deben existir 6 tarjetas eléctricas demarcadas');
ok(menu.includes('💧 Agua'),'Agua no está demarcada');
ok(menu.includes('🔥 Gas'),'Gas no está demarcado');
ok(menu.includes('📄 Transversal'),'Facturas no está demarcada como transversal');
ok(!html.includes('id="sideNavigation"'),'El menú lateral no fue retirado');

for(const marker of [
  '.top-card-menu,',
  'grid-template-columns:repeat(5,minmax(0,1fr))!important',
  '@media(max-width:1450px)',
  '@media(max-width:960px)',
  '@media(max-width:620px)',
  '.top-card-menu .water-section-tab',
  '.top-card-menu .gas-section-tab',
  '.top-card-menu .neutral-section-tab'
]) ok(css.includes(marker),`Falta CSS del menú: ${marker}`);

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

ok(app.includes("const DATA_VERSION = 'v103-tutorial-primera-visita-20260811';"),'DATA_VERSION no es v103');
ok(html.includes('app.js?v=103-primera-visita'),'Cache-busting v103 ausente');

ok(menu.includes('<span class="menu-number">10</span>') && menu.includes('<strong>Videotutorial</strong>'),'Falta tarjeta 10 Videotutorial');
ok(html.includes('id="tutorialModal"') && html.includes('id="tutorialVideoFrame"'),'Falta modal de videotutorial');
ok(html.includes('data-open-tutorial'),'Faltan disparadores del videotutorial');
ok(html.includes("const FIRST_VISIT_KEY='simeco-tutorial-bienvenida-v1';"),'Falta persistencia estable de primera visita');
ok(html.includes("if(!hasSeenWelcome())")&&html.includes("openTutorial({welcome:true})"),'Falta apertura automática de bienvenida');
ok(html.includes("window.SIMECO_TUTORIAL_WELCOME_OPEN"),'Loader no coordina con bienvenida');
console.log(JSON.stringify({ok:true,sections:9,menu:'top-cards',cards:10,electricity:6,water:7,gas:8,invoices:9,tutorial:10,firstVisitAuto:true,googleSitesResponsive:true},null,2));

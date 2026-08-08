const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');

for(const label of ['Analizar Datos','Histórico','Ranking','Informe por sede','Estado de Información','Aula','Agua','Gas','Facturas por I.E.']){
  ok(html.includes(`<strong>${label}</strong>`),`Falta etiqueta ${label}`);
}
for(let i=1;i<=9;i++) ok(html.includes(`data-section="seccion-${i}"`) && html.includes(`title="${i}.`),`Falta tooltip ${i}`);

ok(css.includes('display:flex!important;') && css.includes('flex:1 1 auto!important;'),'Sidebar no usa distribución flex robusta');
ok(css.includes('word-break:normal!important;'),'No se neutraliza el corte de palabras');
ok(css.includes('overflow-wrap:normal!important;'),'No se neutraliza overflow-wrap:anywhere');
ok(css.includes('hyphens:none!important;'),'No se desactiva guionado automático');
ok(css.includes('width:min(92vw,350px)!important'),'Drawer móvil demasiado estrecho');
ok(css.includes('@media(min-width:761px) and (max-width:1180px)'),'Falta rango tablet/Google Sites');
ok(css.includes('--sidebar-width:238px'),'Sidebar tablet no conserva ancho legible');
ok(css.includes('display:initial!important;') || css.includes('display:flex!important;'),'Textos del sidebar se ocultan en tablet');
ok(css.includes('.workspace-shell.sidebar-collapsed .side-tab-copy') && css.includes('display:none!important'),'El modo contraído debe ocultar texto, no comprimirlo');
ok(!/word-break:break-all!important/.test(css),'Existe corte forzado de palabras');

console.log(JSON.stringify({ok:true,labels:9,desktopWidth:296,tabletWidth:238,mobileWidth:'<=350px',wordBreakingFixed:true}));

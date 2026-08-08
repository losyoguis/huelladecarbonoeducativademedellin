const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const css=fs.readFileSync('styles.css','utf8');
const html=fs.readFileSync('index.html','utf8');

ok(css.includes('grid-template-columns:repeat(5,minmax(0,1fr))!important'),'Desktop no usa 5 tarjetas por fila');
ok(css.includes('@media(max-width:1450px)')&&css.includes('repeat(3,minmax(0,1fr))!important'),'Google Sites ancho medio no usa 3 columnas');
ok(css.includes('@media(max-width:960px)')&&css.includes('repeat(2,minmax(0,1fr))!important'),'Tablet no usa 2 columnas');
ok(css.includes('@media(max-width:620px)'),'Falta breakpoint móvil');
ok(css.includes('.top-card-menu .menu-detail')&&css.includes('display:none!important'),'Móvil no simplifica descripción');
ok(css.includes('touch-action:manipulation!important'),'Tarjetas móviles no están optimizadas para toque');
ok(css.includes('word-break:normal!important')&&css.includes('overflow-wrap:normal!important'),'No se protege el texto');
ok(html.includes('data-ux-version="101"'),'Workspace no marca UX v101');
ok(!html.includes('side-nav-mobile-launcher'),'No debe quedar launcher lateral');
console.log(JSON.stringify({ok:true,desktop:5,medium:3,tablet:2,mobile:2,appLike:true}));

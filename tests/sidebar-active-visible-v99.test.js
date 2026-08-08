const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');

for(const cls of ['electricity-section-tab','water-section-tab','gas-section-tab','neutral-section-tab']){
  ok(css.includes(`body.is-embedded .side-navigation .${cls}.active`),`Falta override embebido activo para ${cls}`);
  ok(css.includes(`body.is-embedded .side-navigation .${cls}[aria-selected="true"]`),`Falta respaldo ARIA para ${cls}`);
}
ok(css.includes('background-image:linear-gradient(135deg,#08745c'), 'Falta fondo activo Electricidad');
ok(css.includes('background-image:linear-gradient(135deg,#08769a'), 'Falta fondo activo Agua');
ok(css.includes('background-image:linear-gradient(135deg,#995000'), 'Falta fondo activo Gas');
ok(css.includes('background-image:linear-gradient(135deg,#4d5863'), 'Falta fondo activo Facturas');
ok(css.includes('color:#fff!important;') && css.includes('text-shadow:0 1px 1px'), 'Texto activo no garantiza contraste');
ok(css.includes('.section-tab[aria-selected="true"]::after'), 'Falta indicador lateral del seleccionado');
ok(css.includes('@media(max-width:760px)') && css.includes('min-height:62px!important'), 'Activo móvil no se presenta como tarjeta app');

ok(html.includes("control.setAttribute('aria-current', 'page')"), 'No se marca aria-current en la sección activa');
ok(html.includes("control.removeAttribute('aria-current')"), 'No se limpia aria-current en secciones inactivas');
ok(html.includes("sideNav.querySelector('.section-tab.active, .section-tab[aria-selected=\"true\"]')"), 'Drawer móvil no busca elemento activo');
ok(html.includes("scrollIntoView({block:'center',behavior:'smooth'})"), 'Drawer móvil no centra el activo al abrirse');

console.log(JSON.stringify({ok:true,embeddedActiveOverride:true,ariaFallback:true,resources:4,mobileActiveCard:true}));

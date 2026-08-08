const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');
const html=fs.readFileSync('index.html','utf8');
ok(app.includes('function initGoogleSitesResponsiveMode()'),'Falta detección responsive para Google Sites');
ok(app.includes('window.self!==window.top'),'No detecta iframe');
ok(app.includes("classList.toggle('viewport-phone'"),'Falta modo teléfono');
ok(app.includes('ResizeObserver'),'Falta respuesta al tamaño real del contenedor');
ok(css.includes('body.is-embedded .section-switcher'),'Falta navegación embebida');
ok(css.includes('position:fixed') && css.includes('grid-template-columns:repeat(5,minmax(0,1fr))'),'Falta navegación inferior móvil');
ok(css.includes('.dashboard-data-table thead') && css.includes('display:none'),'Dashboard no se transforma a tarjetas en móvil');
ok(css.includes('font-size:16px !important'),'Falta prevención de zoom móvil');
ok(css.includes('safe-area-inset-bottom'),'Falta soporte safe-area');
ok(html.includes('styles.css?v=101-menu-tarjetas'),'No se actualizó cache-busting CSS');
ok(html.includes('app.js?v=101-menu-tarjetas'),'No se actualizó cache-busting JS');
console.log('OK google-sites-responsive');

const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');

ok(html.includes('class="invoice-loading-tutorial"'),'Loader no ofrece videotutorial');
ok(html.includes('Conoce SiMeCO₂ mientras termina la carga'),'Falta copy del tutorial durante carga');
ok(html.includes('class="invoice-tutorial-button" data-open-tutorial'),'Falta botón en barra/carga');

ok(css.includes('.invoice-loading-tutorial{'),'Falta diseño del tutorial de carga');
ok(css.includes('grid-template-columns:48px minmax(0,1fr) auto'),'Tutorial de carga desktop desorganizado');
ok(css.includes('.tutorial-modal-dialog{'),'Falta diálogo responsive');
ok(css.includes('aspect-ratio:16/9'),'Video no conserva 16:9');
ok(css.includes('@media(max-width:760px)') && css.includes('min-height:100dvh'),'Modal móvil no funciona como app');
ok(css.includes('.tutorial-modal-header') && css.includes('position:sticky'),'Header móvil del tutorial no queda accesible');
ok(css.includes('.invoice-tutorial-button') && css.includes('width:100%'),'Botón tutorial no se adapta en móvil');
ok(css.includes('.top-card-menu .tutorial-section-tab'),'Tarjeta 10 no está estilizada');
console.log(JSON.stringify({ok:true,loaderTutorial:true,desktop:true,mobileApp:true,videoAspect:'16:9'}));

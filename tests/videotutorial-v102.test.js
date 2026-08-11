const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');

ok(html.includes('<span class="menu-number">10</span>'),'Falta número 10');
ok(html.includes('<strong>Videotutorial</strong>'),'Falta tarjeta Videotutorial');
ok(html.includes('class="section-tab tutorial-section-tab"'),'Tarjeta 10 no tiene clase tutorial');
ok(html.includes('id="tutorialModal" hidden aria-hidden="true"'),'Modal no inicia cerrado');
ok(html.includes('role="dialog" aria-modal="true"'),'Modal no es accesible');
ok(html.includes('id="tutorialVideoFrame"'),'Falta iframe del video');
ok(html.includes('SrQj2rXw1ow'),'ID del video incorrecto');
ok(html.includes('start=18'),'El video no inicia desde el segundo 18');
ok(html.includes("window.simecoOpenTutorial=openTutorial"),'No se expone apertura del tutorial');
ok(html.includes("window.simecoCloseTutorial=closeTutorial"),'No se expone cierre del tutorial');
ok(html.includes("event.key==='Escape'"),'El modal no cierra con Escape');
ok(html.includes("data-close-tutorial"),'Falta cierre por backdrop/botón');
ok(html.includes("aria-haspopup=\"dialog\""),'Los disparadores no anuncian diálogo');

for(const marker of [
  '.tutorial-modal{',
  '.tutorial-modal-dialog{',
  '.tutorial-video-frame{',
  '.tutorial-section-tab',
  'body.tutorial-modal-open',
  '@media(max-width:760px)'
]) ok(css.includes(marker),`Falta CSS tutorial: ${marker}`);

console.log(JSON.stringify({ok:true,card:10,modal:true,youtubeId:'SrQj2rXw1ow',start:18,accessible:true}));

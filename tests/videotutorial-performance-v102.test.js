const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const html=fs.readFileSync('index.html','utf8');

const iframe=(html.match(/<iframe[\s\S]*?id="tutorialVideoFrame"[\s\S]*?<\/iframe>/)||[])[0]||'';
ok(iframe,'Falta iframe tutorial');
ok(iframe.includes('data-src="https://www.youtube-nocookie.com/embed/SrQj2rXw1ow'),'El video no usa data-src lazy');
ok(!/\ssrc="https:\/\/www\.youtube/.test(iframe),'YouTube se carga antes de abrir el modal');
ok(html.includes("frame.dataset.loaded!=='true'"),'No existe control de carga bajo demanda');
ok(html.includes("frame.removeAttribute('src')"),'El video no libera la conexión al cerrar');

ok(html.includes('data/registros.electricidad.min.js?v=103-primera-visita" as="script" fetchpriority="high"'),'Bundle eléctrico no tiene prioridad alta');
ok(html.includes('data/resumenes.electricidad.min.js?v=103-primera-visita" as="script" fetchpriority="high"'),'Resumen eléctrico no tiene prioridad alta');
ok(html.includes('<script src="data/registros.electricidad.min.js?v=103-primera-visita" fetchpriority="high"></script>'),'Script eléctrico no tiene prioridad alta');
ok(html.includes('<script defer src="app.js?v=103-primera-visita" fetchpriority="high"></script>'),'app.js no tiene prioridad alta');
for(const file of ['data/registros.agua.min.js','data/registros.gas.min.js','assistant.js']){
  ok(html.includes(`${file}?v=103-primera-visita" fetchpriority="low"`),`${file} no tiene prioridad baja`);
}
ok(html.includes('window.SIMECO_FAST_BOOT_DONE=true'),'Fast boot fue eliminado');
ok(html.includes("overlay.style.display='none'"),'Fast boot no libera el overlay');
console.log(JSON.stringify({ok:true,dataFirst:true,electricPriority:'high',optionalPriority:'low',youtubeLazy:true}));

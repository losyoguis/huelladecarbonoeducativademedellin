const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m)}
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
for(const f of ['data/registros.agua.min.js','data/resumenes.agua.min.js','water.js','data/registros.gas.min.js','data/resumenes.gas.min.js','gas.js','assistant.js']){
  ok(!html.includes(`<script defer src="${f}?v=108-action-plan"`),`${f} todavía se carga en el arranque`);
}
ok(html.includes("loadSequence(['data/registros.agua.min.js','data/resumenes.agua.min.js','water.js'])"),'Falta carga bajo demanda de Agua');
ok(html.includes("loadSequence(['data/registros.gas.min.js','data/resumenes.gas.min.js','gas.js'])"),'Falta carga bajo demanda de Gas');
ok(html.includes("loadSequence(['assistant-config.js','assistant.js'])"),'Falta carga bajo demanda del asistente');
ok(html.includes("script('data/sincronizacion-territorial.js')"),'Falta carga diferida territorial');
ok(app.includes("safeBootStep('render inicial liviano',renderInitialView)"),'El arranque sigue usando renderAll');
ok(app.includes("window.simecoPrepareSection=prepareSection"),'Falta renderizado por sección');
ok(app.includes("co2CalculationSignature"),'Falta caché de recálculo CO2');
console.log(JSON.stringify({ok:true,mode:'progressive-load',version:107},null,2));

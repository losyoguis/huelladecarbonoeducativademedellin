const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const app=fs.readFileSync('app.js','utf8');
const compact=fs.readFileSync('data/registros.electricidad.min.js','utf8');
const html=fs.readFileSync('index.html','utf8');

ok(app.includes("const safeBootStep=(name,fn)=>"),'Falta aislamiento de pasos de arranque');
ok(app.includes("finally{") && app.includes("if(state.records.length)"),'El loader no se cierra en finally');
ok(app.includes("Cierre de seguridad del loader inicial"),'Falta salvaguarda para Google Sites');
ok(app.includes("setTimeout(()=>{") && app.includes("},1800);"),'Falta timeout de seguridad');
ok(app.includes("['rankings',renderRanking]"),'renderAll no aísla Ranking');
ok(app.includes("['informe por sede',renderDashboard]"),'renderAll no aísla Informe por sede');
ok(app.includes("const cols=includeTerritory?8:6;"),'Tabla eléctrica conserva colspan antiguo');
ok(compact.includes("window.SIMECO_REGISTROS") || compact.includes("SIMECO_REGISTROS"),'Bundle compacto no expone registros');
ok(html.includes('app.js?v=87-datos-rapidos'),'Falta cache-busting v87');
console.log('OK startup-loader-safety');

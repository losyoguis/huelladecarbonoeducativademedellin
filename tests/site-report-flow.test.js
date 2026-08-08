const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
ok(html.includes('id="generateSelectedReportBtn"'),'Falta botón directo de informe por sede');
ok(app.includes('function generateSelectedSiteReport()'),'Falta generador directo del informe');
ok(app.includes("recordsBySiteKey().get(key)"),'El informe no usa el índice rápido por sede');
ok(app.includes("return Boolean(CURRENT_PLAN_HTML)"),'generateManagementPlan no confirma éxito');
ok(app.includes("try{\n      const ok=generateManagementPlan(key)"),'Botón de tabla no maneja errores');
ok(app.includes("bindEvent('generateSelectedReportBtn','click',generateSelectedSiteReport)"),'Botón directo no está enlazado');
ok(!app.includes("document.addEventListener('click',handlePlanButtonClick);"),'Permanece listener global duplicado');
ok(app.includes("if($('printPlanBtn')) $('printPlanBtn').disabled=false"),'PDF no se habilita tras generar');
ok(app.includes("if($('downloadPlanBtn')) $('downloadPlanBtn').disabled=false"),'HTML no se habilita tras generar');
console.log('OK site-report-flow');

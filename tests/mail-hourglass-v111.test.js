const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m)}
const backend=fs.readFileSync('apps-script-documentos/Code.gs','utf8');
const form=fs.readFileSync('apps-script-documentos/Index.html','utf8');
const plan=fs.readFileSync('plan-ambiental.js','utf8');
const sendPos=backend.indexOf('const mailDelivery = sendMailWithRetry_(mailOptions)');
const dashPos=backend.indexOf('dashboardRef = registerDashboardRequest_(data, codeId, expediente)',sendPos);
ok(sendPos>0,'Falta envío robusto del formulario');
ok(dashPos>sendPos,'El dashboard debe ejecutarse después del correo');
ok(backend.includes('function autorizarYProbarCorreoSiMeCO2()'),'Falta función pública de autorización/prueba');
ok(backend.includes('function sendMailWithRetry_(mailOptions)'),'Falta reintento de correo');
ok(form.includes('id="reportHourglass"'),'Falta reloj de arena del formulario');
ok(form.includes('reportProcessingElapsed'),'Falta tiempo transcurrido');
ok(form.includes('startReportProgress()'),'Falta inicio del progreso');
ok(plan.includes('doc-hourglass'),'Falta reloj de arena en Centro documental');
const bridge=backend.indexOf("var bridgeMailDelivery = sendMailWithRetry_(mail)");
ok(bridge>0,'El puente documental no usa envío robusto');
console.log('✓ v111 correo robusto + reloj de arena');

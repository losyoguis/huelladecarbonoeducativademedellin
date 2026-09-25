const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const plan=fs.readFileSync(path.join(root,'plan-ambiental.js'),'utf8');
const backend=fs.readFileSync(path.join(root,'apps-script-documentos','Code.gs'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
function ok(cond,msg){if(!cond)throw new Error(msg);}
ok(plan.includes('postDocumentsViaIframe'),'Falta transporte POST por iframe');
ok(plan.includes("form.method='POST'"),'El formulario documental no usa POST');
ok(plan.includes("form.target=frameName"),'El formulario no apunta al iframe oculto');
ok(plan.includes("channel!=='simeco2-document-result'"),'Falta validación del canal postMessage');
ok(!plan.includes("await fetch(endpoint,{method:'POST'"),'Permanece el fetch cross-origin problemático');
ok(backend.includes('function siMeCO2IframeResponse_'),'Falta respuesta iframe del backend');
ok(backend.includes("transport === 'iframe'"),'doPost no reconoce transporte iframe');
ok(backend.includes('HtmlService.XFrameOptionsMode.ALLOWALL'),'La respuesta no permite iframe');
ok(backend.includes("channel: 'simeco2-document-result'"),'Backend no publica canal postMessage');
ok(index.includes("const version='110-document-buttons'"),'Cache-busting no actualizado a v110');
console.log('✓ v110 botones documentales cross-origin');

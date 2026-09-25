const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m)}
const plan=fs.readFileSync('plan-ambiental.js','utf8');
const backend=fs.readFileSync('Code.gs','utf8');
const manifest=fs.readFileSync('appsscript.json','utf8');
const index=fs.readFileSync('index.html','utf8');
ok(plan.includes('function normalizeAppsScriptExecUrl'),'Falta normalización de URL Apps Script');
ok(plan.includes('/a\\/macros\\/'),'No se reconoce URL Google Workspace /a/macros');
ok(plan.includes('https://script.google.com/macros/s/${deploymentId}/exec'),'No se canonicaliza la URL de Workspace');
ok(plan.includes('function isAppsScriptExecUrl'),'Falta validación de endpoint');
ok(plan.includes("form.method='POST'"),'El puente documental no usa POST');
ok(plan.includes('postDocumentsViaIframe'),'Falta puente iframe sin CORS');
ok(plan.includes('doc-elapsed'),'Falta tiempo visible del proceso documental');
ok(backend.includes('SiMeCO₂ bridge doPost iniciado'),'Falta diagnóstico doPost');
ok(backend.includes('SiMeCO₂ bridge completado'),'Falta diagnóstico de finalización');
ok(manifest.includes('https://www.googleapis.com/auth/userinfo.email'),'Falta scope userinfo.email');
ok(index.includes("const version='114-fixed-backend'"),'Cache-busting no actualizado a v114');
console.log('✓ v114 conserva integración directa documental desde Informe por sede');

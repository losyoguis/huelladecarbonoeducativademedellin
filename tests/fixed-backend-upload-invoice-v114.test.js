const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m)}
const plan=fs.readFileSync('plan-ambiental.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const styles=fs.readFileSync('styles.css','utf8');
const backend='https://script.google.com/macros/s/AKfycby5UBGXjnvWRnhpXhy7F3X6v497g8Z3S8ekdXX07rst27zZ9Ej1clHuBi7_mDAYsJY/exec';
const upload='https://sites.google.com/iemanueljbetancur.edu.co/lideres-ambientales/sistemas-de-informaci%C3%B3n/sistema-1-1-sube-tu-factura?authuser=0';
ok(plan.includes(`PERMANENT_DOCUMENT_BACKEND_URL = '${backend}'`),'No quedó fija la URL oficial /exec');
ok(plan.includes(`INVOICE_ACTION_PLANS_URL = '${upload}'`),'No quedó fijo el enlace Subir mi factura');
ok(plan.includes('SUBIR MI FACTURA Y TENER PLANES DE ACCIÓN (HOGAR O EMPRESA)'),'Falta CTA Hogar o Empresa');
ok(!plan.includes('id="docBackendUrl"'),'La configuración manual del backend todavía aparece');
ok(plan.includes('Motor documental conectado automáticamente'),'Falta aviso de conexión automática');
ok(plan.includes('const endpoint=normalizeAppsScriptExecUrl(PERMANENT_DOCUMENT_BACKEND_URL)'),'Los botones no usan el endpoint fijo');
ok(plan.includes('360000'),'Timeout documental no ampliado');
ok(styles.includes('.invoice-action-cta'),'Falta estilo del CTA');
ok(index.includes("const version='114-fixed-backend'"),'Cache-busting v114 no actualizado');
console.log('✓ v114 motor fijo + botón Subir mi factura Hogar/Empresa');

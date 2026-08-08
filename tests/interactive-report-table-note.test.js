const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');
ok(!app.includes('<small class="map-address-note">Haz clic en la dirección para abrir Google Maps.</small>'),'La nota sigue repetida en cada dirección');
ok(html.includes('class="table-map-note"'),'Falta nota única al inicio de las tablas');
ok(html.includes('haz clic en cualquier dirección de la tabla para abrirla en Google Maps'),'Falta instrucción de Maps en tabla');
ok(app.includes('function buildPlanInteractiveToolbar()'),'Falta toolbar del informe');
ok(app.includes('data-plan-jump="plan-sec-diagnostico"'),'Falta navegación interna');
ok(app.includes("data-plan-toggle=\"charts\""),'Falta control de gráficas');
ok(app.includes("data-plan-toggle=\"tables\""),'Falta control de tablas');
ok(app.includes("data-plan-toggle=\"compact\""),'Falta vista compacta');
ok(app.includes('interactiveScript'),'HTML descargado no conserva interactividad');
ok(css.includes('@media print') && css.includes('.plan-interactive-toolbar'),'Los controles no se ocultan al imprimir');
console.log('OK interactive-report-table-note');

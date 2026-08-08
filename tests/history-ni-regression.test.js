const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');
ok(html.includes('N.I.</strong> = No identificada'),'Falta leyenda N.I.');
ok(app.includes('title="No identificada">N.I.</span>'),'Falta abreviatura N.I. en tabla');
ok(html.includes('id="compareA" data-no-searchable="true"'),'Periodo A no está protegido de selector personalizado');
ok(html.includes('id="compareB" data-no-searchable="true"'),'Periodo B no está protegido de selector personalizado');
ok(html.includes('id="compareMode" data-no-searchable="true"'),'Modo histórico no usa selector nativo');
ok(app.includes('function refreshHistoryModule(options={})'),'Falta refresco robusto del histórico');
ok(app.includes('window.simecoRefreshHistory=refreshHistoryModule'),'Histórico no expone refresco al cambio de sección');
ok(html.includes("sectionId === 'seccion-2'"),'La sección Histórico no se refresca al abrirse');
ok(app.includes('validKeys.has(currentA)?currentA:groups[0].key'),'No se preserva Periodo A');
ok(app.includes("const containerWidth=Math.max(320"),'Gráfica histórica no usa ancho real');
ok(css.includes('#comparar-periodos .history-chart-scroll'),'Falta scroll responsive del histórico');
console.log('OK history-ni-regression');

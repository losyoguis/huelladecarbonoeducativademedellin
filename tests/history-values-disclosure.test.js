const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');
const html=fs.readFileSync('index.html','utf8');
ok(app.includes('class="history-values-toggle"'),'Falta botón de valores exactos');
ok(app.includes('aria-expanded'),'Falta estado accesible aria-expanded');
ok(app.includes('function handleHistoryValuesToggle(event)'),'Falta controlador del desplegable');
ok(app.includes("bindEvent('historyDataTable','click',handleHistoryValuesToggle)"),'El desplegable no está enlazado');
ok(app.includes("panel.hidden=!open"),'El panel no cambia de visibilidad');
ok(css.includes('.history-values-disclosure.is-open .history-values-caret'),'Falta animación del indicador');
ok(css.includes('.history-values-panel[hidden]'),'Falta regla de panel oculto');
ok(html.includes('styles.css?v=93-agua'),'Falta cache-busting CSS v79');
ok(html.includes('app.js?v=93-agua'),'Falta cache-busting JS v79');
console.log('OK history-values-disclosure');

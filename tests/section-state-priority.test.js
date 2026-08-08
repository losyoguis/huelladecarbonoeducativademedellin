const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');

ok(html.includes('data-section="seccion-5" aria-selected="false"><span>5</span><strong>Estado de Información</strong>'),'Falta sección 6 Estado información');
ok(html.includes('data-section="seccion-6" aria-selected="false"><span>6</span><strong>Aula</strong>'),'Aula no es sección 7');
ok(html.includes('id="seccion-5" data-resource="electricidad" data-page-title="Electricidad · Estado de Información"'),'Falta contenedor eléctrico sección 6');
ok(html.includes('id="seccion-6" data-resource="electricidad" data-page-title="Electricidad · Aula"'),'Falta contenedor eléctrico sección 7');
const sec6=html.indexOf('id="seccion-5"');
const sec7=html.indexOf('id="seccion-6"');
const quality=html.indexOf('id="calidad-datos"');
ok(quality>sec6 && quality<sec7,'Estado de la información no está dentro de sección 6');
ok(html.includes("'calidad-datos': 'seccion-5'"),'Mapeo calidad-datos incorrecto');
ok(html.includes("'aula-climatica': 'seccion-6'"),'Mapeo Aula incorrecto');

const ts=html.indexOf('<table class="dashboard-data-table">');
const te=html.indexOf('</table>',ts);
const table=html.slice(ts,te);
ok(table.indexOf('<th>Periodos</th>') < table.indexOf('<th>Prioridad</th>'),'Prioridad no está después de Periodos');
ok(table.indexOf('<th>Prioridad</th>') < table.indexOf('<th>Plan de acción</th>'),'Prioridad no está antes de Plan de acción');
ok(table.indexOf('<th>Plan de acción</th>') < table.indexOf('<th>Energía total kWh</th>'),'Plan no está antes de indicadores');
ok(app.includes("if(avgMonth >= 5000)"),'Falta criterio Alta');
ok(app.includes("if(avgMonth >= 2000)"),'Falta criterio Media');
ok(app.includes('data-label="Prioridad"') && app.includes('data-label="Plan de acción"'),'Fila del dashboard no respeta nuevo orden');
ok(html.includes('<strong>Alta:</strong> ≥ 5.000 kWh/mes'),'Falta leyenda Alta');
ok(html.includes('<strong>Media:</strong> 2.000–4.999 kWh/mes'),'Falta leyenda Media');
ok(css.includes('.section-switcher{\n  width:min(1500px,calc(100% - 28px));\n  grid-template-columns:repeat(3,minmax(0,1fr))!important;'),'Navegación principal no soporta 9 módulos');
ok(html.includes('app.js?v=96-menu-google-sites'),'Falta cache-busting v96');
console.log('OK section-state-priority');

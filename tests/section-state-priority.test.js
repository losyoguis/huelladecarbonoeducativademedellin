const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');

ok(html.includes('data-section="seccion-6" aria-selected="false"><span>6</span><strong>Estado información</strong>'),'Falta sección 6 Estado información');
ok(html.includes('data-section="seccion-7" aria-selected="false"><span>7</span><strong>Aula</strong>'),'Aula no es sección 7');
ok(html.includes('id="seccion-6" data-page-title="Estado de la información"'),'Falta contenedor sección 6');
ok(html.includes('id="seccion-7" data-page-title="Aula"'),'Falta contenedor sección 7');
const sec6=html.indexOf('id="seccion-6"');
const sec7=html.indexOf('id="seccion-7"');
const quality=html.indexOf('id="calidad-datos"');
ok(quality>sec6 && quality<sec7,'Estado de la información no está dentro de sección 6');
ok(html.includes("'calidad-datos': 'seccion-6'"),'Mapeo calidad-datos incorrecto');
ok(html.includes("'aula-climatica': 'seccion-7'"),'Mapeo Aula incorrecto');

const ts=html.indexOf('<table class="dashboard-data-table">');
const te=html.indexOf('</table>',ts);
const table=html.slice(ts,te);
ok(table.indexOf('<th>Periodos</th>') < table.indexOf('<th>Prioridad</th>'),'Prioridad no está después de Periodos');
ok(table.indexOf('<th>Prioridad</th>') < table.indexOf('<th>Plan de acción</th>'),'Prioridad no está antes de Plan de acción');
ok(table.indexOf('<th>Plan de acción</th>') < table.indexOf('<th>Energía total kWh</th>'),'Plan no está antes de indicadores');
ok(app.includes("if(avgMonth >= 5000)"),'Falta criterio Alta');
ok(app.includes("if(avgMonth >= 2000)"),'Falta criterio Media');
ok(app.includes('data-label="Prioridad"') && app.includes('data-label="Plan de acción"'),'Fila del dashboard no respeta nuevo orden');
ok(html.includes('Alta ≥ 5.000 kWh/mes'),'Falta leyenda Alta');
ok(html.includes('Media 2.000–4.999 kWh/mes'),'Falta leyenda Media');
ok(css.includes('grid-template-columns:repeat(7,minmax(0,1fr))'),'Navegación móvil no soporta 7 secciones');
ok(html.includes('app.js?v=82-estado-prioridad'),'Falta cache-busting v82');
console.log('OK section-state-priority');

const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');

ok(/data-section="seccion-5"[^>]*>[\s\S]*?<span class="menu-number">5<\/span>[\s\S]*?<strong>Estado de Información<\/strong>/.test(html),'Falta sección 5 Estado información');
ok(/data-section="seccion-6"[^>]*>[\s\S]*?<span class="menu-number">6<\/span>[\s\S]*?<strong>Aula<\/strong>/.test(html),'Aula no es sección 5');
ok(html.includes('id="seccion-5" data-resource="electricidad" data-page-title="Electricidad · Estado de Información"'),'Falta contenedor eléctrico sección 5');
ok(html.includes('id="seccion-6" data-resource="electricidad" data-page-title="Electricidad · Aula"'),'Falta contenedor eléctrico sección 6');
const sec6=html.indexOf('id="seccion-5"');
const sec7=html.indexOf('id="seccion-6"');
const quality=html.indexOf('id="calidad-datos"');
ok(quality>sec6 && quality<sec7,'Estado de la información no está dentro de sección 5');
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
ok(css.includes('.top-card-menu,') && html.includes('id="topCardMenu"'),'Menú superior de tarjetas no está disponible');
ok(html.includes('app.js?v=103-primera-visita'),'Falta cache-busting v102');
console.log('OK section-state-priority');

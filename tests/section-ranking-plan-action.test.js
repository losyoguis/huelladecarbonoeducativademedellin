const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');

ok(/data-section="seccion-3"[^>]*>[\s\S]*?<span class="menu-number">3<\/span>[\s\S]*?<strong>Ranking<\/strong>/.test(html),'Falta sección 3 Ranking');
ok(/data-section="seccion-6"[^>]*>[\s\S]*?<span class="menu-number">6<\/span>[\s\S]*?<strong>Aula<\/strong>/.test(html),'Aula no es sección 6');
ok(html.includes('id="seccion-3" data-resource="electricidad" data-page-title="Electricidad · Ranking"'),'Falta contenedor eléctrico de Ranking');
ok(html.includes('id="seccion-6" data-resource="electricidad" data-page-title="Electricidad · Aula"'),'Falta contenedor eléctrico Aula sección 6');
const s5=html.indexOf('id="seccion-3"');
const s6=html.indexOf('id="seccion-4"');
const rank1=html.indexOf('id="ranking-sedes"');
const rank2=html.indexOf('id="ranking-ahorro-energia"');
ok(rank1>s5 && rank1<s6,'Ranking principal no está dentro de sección 3');
ok(rank2>s5 && rank2<s6,'Ranking de ahorro no está dentro de sección 3');
ok(html.includes("'ranking-sedes': 'seccion-3'") && html.includes("'ranking-ahorro-energia': 'seccion-3'"),'Mapeo de rankings incorrecto');
ok(html.includes("'aula-climatica': 'seccion-6'"),'Mapeo Aula incorrecto');

const tableStart=html.indexOf('<table class="dashboard-data-table">');
const tableEnd=html.indexOf('</table>',tableStart);
const table=html.slice(tableStart,tableEnd);
ok(table.indexOf('<th>Periodos</th>') < table.indexOf('<th>Prioridad</th>') && table.indexOf('<th>Prioridad</th>') < table.indexOf('<th>Plan de acción</th>'),'Plan de acción no está después de Periodos');
ok(table.indexOf('<th>Plan de acción</th>') < table.indexOf('<th>Energía total kWh</th>'),'Plan de acción no está antes de Energía');
ok(app.includes('data-label="Plan de acción" class="plan-cell"'),'Fila del dashboard no mueve Plan de acción');
ok(app.includes('<td colspan="4">TOTAL / DATOS DISPONIBLES</td><td>—</td><td>—</td><td>${energyRows.length'),'Fila total no respeta nuevas columnas');
ok(css.includes('.top-card-menu,') && html.includes('id="topCardMenu"'),'Menú superior de tarjetas no está disponible');
ok(html.includes('app.js?v=103-primera-visita'),'Falta cache-busting JS v102');
console.log('OK section-ranking-plan-action');

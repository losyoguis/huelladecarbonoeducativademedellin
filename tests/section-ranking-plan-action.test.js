const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');

ok(html.includes('data-section="seccion-3" aria-selected="false"><span>3</span><strong>Ranking</strong>'),'Falta sección 5 Ranking');
ok(html.includes('data-section="seccion-6" aria-selected="false"><span>6</span><strong>Aula</strong>'),'Aula no es sección 7');
ok(html.includes('id="seccion-3" data-resource="electricidad" data-page-title="Electricidad · Ranking"'),'Falta contenedor eléctrico de Ranking');
ok(html.includes('id="seccion-6" data-resource="electricidad" data-page-title="Electricidad · Aula"'),'Falta contenedor eléctrico Aula sección 7');
const s5=html.indexOf('id="seccion-3"');
const s6=html.indexOf('id="seccion-4"');
const rank1=html.indexOf('id="ranking-sedes"');
const rank2=html.indexOf('id="ranking-ahorro-energia"');
ok(rank1>s5 && rank1<s6,'Ranking principal no está dentro de sección 5');
ok(rank2>s5 && rank2<s6,'Ranking de ahorro no está dentro de sección 5');
ok(html.includes("'ranking-sedes': 'seccion-3'") && html.includes("'ranking-ahorro-energia': 'seccion-3'"),'Mapeo de rankings incorrecto');
ok(html.includes("'aula-climatica': 'seccion-6'"),'Mapeo Aula incorrecto');

const tableStart=html.indexOf('<table class="dashboard-data-table">');
const tableEnd=html.indexOf('</table>',tableStart);
const table=html.slice(tableStart,tableEnd);
ok(table.indexOf('<th>Periodos</th>') < table.indexOf('<th>Prioridad</th>') && table.indexOf('<th>Prioridad</th>') < table.indexOf('<th>Plan de acción</th>'),'Plan de acción no está después de Periodos');
ok(table.indexOf('<th>Plan de acción</th>') < table.indexOf('<th>Energía total kWh</th>'),'Plan de acción no está antes de Energía');
ok(app.includes('data-label="Plan de acción" class="plan-cell"'),'Fila del dashboard no mueve Plan de acción');
ok(app.includes('<td colspan="4">TOTAL / DATOS DISPONIBLES</td><td>—</td><td>—</td><td>${energyRows.length'),'Fila total no respeta nuevas columnas');
ok(css.includes('.section-switcher{\n  width:min(1500px,calc(100% - 28px));\n  grid-template-columns:repeat(3,minmax(0,1fr))!important;'),'Navegación principal no está preparada para 9 módulos');
ok(html.includes('app.js?v=96-menu-google-sites'),'Falta cache-busting JS v96');
console.log('OK section-ranking-plan-action');

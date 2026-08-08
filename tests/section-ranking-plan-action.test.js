const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');

ok(html.includes('data-section="seccion-5" aria-selected="false"><span>5</span><strong>Ranking</strong>'),'Falta sección 5 Ranking');
ok(html.includes('data-section="seccion-6" aria-selected="false"><span>6</span><strong>Aula</strong>'),'Aula no es sección 6');
ok(html.includes('id="seccion-5" data-page-title="Ranking"'),'Falta contenedor de Ranking');
ok(html.includes('id="seccion-6" data-page-title="Aula"'),'Falta contenedor Aula sección 6');
const s5=html.indexOf('id="seccion-5"');
const s6=html.indexOf('id="seccion-6"');
const rank1=html.indexOf('id="ranking-sedes"');
const rank2=html.indexOf('id="ranking-ahorro-energia"');
ok(rank1>s5 && rank1<s6,'Ranking principal no está dentro de sección 5');
ok(rank2>s5 && rank2<s6,'Ranking de ahorro no está dentro de sección 5');
ok(html.includes("'ranking-sedes': 'seccion-5'") && html.includes("'ranking-ahorro-energia': 'seccion-5'"),'Mapeo de rankings incorrecto');
ok(html.includes("'aula-climatica': 'seccion-6'"),'Mapeo Aula incorrecto');

const tableStart=html.indexOf('<table class="dashboard-data-table">');
const tableEnd=html.indexOf('</table>',tableStart);
const table=html.slice(tableStart,tableEnd);
ok(table.indexOf('<th>Periodos</th>') < table.indexOf('<th>Plan de acción</th>'),'Plan de acción no está después de Periodos');
ok(table.indexOf('<th>Plan de acción</th>') < table.indexOf('<th>Energía total kWh</th>'),'Plan de acción no está antes de Energía');
ok(app.includes('data-label="Plan de acción" class="plan-cell"'),'Fila del dashboard no mueve Plan de acción');
ok(app.includes('<td colspan="4">TOTAL / DATOS DISPONIBLES</td><td>—</td><td>${energyRows.length'),'Fila total no respeta nueva columna');
ok(css.includes('grid-template-columns:repeat(6,minmax(0,1fr))'),'Navegación móvil no admite 6 secciones');
ok(html.includes('app.js?v=81-ranking-seccion-plan-accion'),'Falta cache-busting JS v81');
console.log('OK section-ranking-plan-action');

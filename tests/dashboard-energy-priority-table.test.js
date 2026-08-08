const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');

const ts=html.indexOf('<table class="dashboard-data-table">');
const te=html.indexOf('</table>',ts);
const table=html.slice(ts,te);
ok(!table.includes('<th>Agua m³</th>'),'Agua sigue en Informe por sede');
ok(!table.includes('<th>Alc. m³</th>'),'Alcantarillado sigue en Informe por sede');
ok(!table.includes('<th>Gas m³</th>'),'Gas sigue en Informe por sede');
ok(!table.includes('<th>Aseo t</th>'),'Aseo sigue en Informe por sede');
ok(table.includes('<th>Prioridad</th>') && table.includes('<th>Plan de acción</th>'),'Faltan Prioridad o Plan de acción');
ok(html.indexOf('Criterios de prioridad por consumo eléctrico mensual promedio:') < html.indexOf('class="table-map-note"'),'La nota de prioridad no está al inicio de la tabla');
ok(html.includes('<strong>Alta:</strong> ≥ 5.000 kWh/mes'),'Falta criterio Alta');
ok(html.includes('<strong>Media:</strong> 2.000–4.999 kWh/mes'),'Falta criterio Media');
ok(html.includes('<strong>Preventiva:</strong> &lt; 2.000 kWh/mes'),'Falta criterio Preventiva');
const rs=app.indexOf("const body = rows.map((r,idx)=>{");
const re=app.indexOf("const totalRow =",rs);
const dashboardRows=app.slice(rs,re);
ok(!dashboardRows.includes('data-label="Agua m³"'),'Fila dinámica todavía renderiza Agua');
ok(!dashboardRows.includes('data-label="Alcantarillado m³"'),'Fila dinámica todavía renderiza Alcantarillado');
ok(!dashboardRows.includes('data-label="Gas m³"'),'Fila dinámica todavía renderiza Gas');
ok(!dashboardRows.includes('data-label="Aseo / residuos t"'),'Fila dinámica todavía renderiza Aseo');
ok(app.includes('<td colspan="4">TOTAL / DATOS DISPONIBLES</td><td>—</td><td>—</td><td>${energyRows.length'),'Fila total no está alineada');
ok(css.includes('min-width:1120px !important'),'No se actualizó el ancho de tabla');
ok(html.includes('app.js?v=92-control-calidad'),'Falta cache-busting v83');
console.log('OK dashboard-energy-priority-table');

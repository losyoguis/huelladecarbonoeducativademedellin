const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const css=fs.readFileSync('styles.css','utf8');
const html=fs.readFileSync('index.html','utf8');
ok(css.includes('width:285px') && css.includes('min-width:285px'),'La columna Sede no recibió ancho prioritario');
ok(css.includes('font-size:1rem') && css.includes('font-weight:900'),'El nombre de sede no tiene jerarquía visual');
ok(css.includes('hyphens:none !important'),'El nombre todavía puede dividirse con guiones');
ok(css.includes('font-variant-numeric:tabular-nums'),'Las columnas numéricas no están compactadas');
ok(css.includes('width:158px') && css.includes('min-width:158px'),'La columna Plan no está compactada');
ok(html.includes('<th>Aseo t</th>'),'No se compactó encabezado Aseo');
ok(html.includes('<th>Árboles</th>'),'No se compactó encabezado Árboles');
ok(html.includes('<th>Prom. kWh/mes</th>'),'No se compactó Promedio');
ok(html.includes('styles.css?v=78-sede-prioritaria'),'Falta cache-busting CSS v78');
console.log('OK dashboard-site-priority-layout');

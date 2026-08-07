const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');
const html=fs.readFileSync('index.html','utf8');
ok(app.includes('const byPeriod=new Map()'),'El informe no consolida por periodo');
ok(app.includes('function shortPlanPeriodLabel(period)'),'Falta etiqueta corta mensual');
ok(app.includes('rows.length*64+120'),'La gráfica no adapta su ancho al número de periodos');
ok(app.includes('consolidatedMonths=buildPlanMetricSeries(d.recs)'),'La tabla mensual no usa datos consolidados');
ok(app.includes('Cada barra representa un único periodo mensual consolidado'),'Falta explicación de consolidación mensual');
ok(app.includes('Haz clic en la dirección para abrir Google Maps.'),'Falta observación global de Google Maps');
ok(!app.includes('Ver ubicación'),'Todavía aparece texto Ver ubicación en JS');
ok(!css.includes('content:"Ver ubicación"'),'Todavía aparece etiqueta Ver ubicación en CSS');
ok(html.includes('styles.css?v=75-informe-visual'),'Falta cache-busting CSS v75');
ok(html.includes('app.js?v=75-informe-visual'),'Falta cache-busting JS v75');
console.log('OK report-visualization-addresses');

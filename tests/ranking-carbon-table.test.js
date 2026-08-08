const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');

ok(html.includes('id="rankingCarbonBody"'),'Falta cuerpo de tabla de Huella de carbono');
ok(html.includes('Huella de carbono<br><small>t CO₂e</small>'),'Falta columna visible de Huella de carbono');
ok(html.includes('CO₂e = dióxido de carbono equivalente'),'Falta explicación de CO₂e');
ok(app.includes('function renderRankingCarbonTable(visible,start=0)'),'Falta renderizador de tabla');
ok(app.includes('renderRankingCarbonTable(visible,start);'),'La tabla no se sincroniza con la paginación');
ok(app.includes('rankingCo2eT'),'Falta cálculo de CO₂e');
ok(app.includes("data-label=\"Huella de carbono\""),'Falta celda de huella');
ok(css.includes('.ranking-carbon-table'),'Faltan estilos de la tabla');
ok(html.includes('app.js?v=92-control-calidad'),'Falta cache-busting v92');
console.log('OK ranking-carbon-table');

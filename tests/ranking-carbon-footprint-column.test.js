const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');
ok(app.includes('const rankingCo2eT='),'Falta cálculo de huella CO2e en ranking');
ok(app.includes("Huella de carbono"),'Falta encabezado Huella de carbono');
ok(app.includes("(t CO₂e)"),'Falta unidad t CO2e');
ok(app.includes("rankingCo2eT"),'La huella no se incorpora a las filas');
ok(app.includes("N.C."),'Falta estado No calculable para huella');
ok(app.includes("CO₂e significa dióxido de carbono equivalente"),'Falta explicación de CO2e');
ok(html.includes('Huella de carbono (t CO₂e)'),'La descripción inicial no explica huella');
ok(css.includes('.environmental-ranking-chart #siteChart'),'Falta soporte visual del canvas ancho');
ok(html.includes('app.js?v=86-carga-inicial'),'Falta cache-busting JS v80');
console.log('OK ranking-carbon-footprint-column');

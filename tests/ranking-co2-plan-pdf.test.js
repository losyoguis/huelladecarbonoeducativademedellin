const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');

ok(app.includes("const minCanvasWidth=isEnergy?1120:1100"),'Ranking no fue compactado');
ok(app.includes("Math.min(320,barRight-padL)"),'Barra del ranking no tiene ancho reducido');
ok(app.includes("ctx.fillText('Huella de carbono'"),'Falta columna de Huella de carbono');
ok(app.includes("rankingCo2eT"),'Ranking no calcula CO2e');
ok(app.includes('function renderPlanPdfSources(row)'),'Falta generador de enlaces PDF');
ok(app.includes('class="plan-source-download"'),'Fuente del plan no ofrece descarga PDF');
ok(app.includes('download="${escapeHtml(fileName)}"'),'Enlace PDF no usa atributo download');
ok(app.includes('<td>${renderPlanPdfSources(r)}</td>'),'Registros mensuales no usan la descarga PDF');
ok(css.includes('.plan-source-download'),'Faltan estilos de descarga PDF');
ok(html.includes('app.js?v=96-menu-google-sites'),'Falta cache-busting JS v85');
console.log('OK ranking-co2-plan-pdf');

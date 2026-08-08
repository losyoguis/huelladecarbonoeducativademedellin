const fs=require('fs');
const path=require('path');
function ok(v,m){if(!v)throw new Error(m);}
const files=[
  'index.html','app.js','assistant.js','institucional.js','territorial.js',
  'dashboard.html','busqueda-institucional.html','filtros-territoriales.html','aula-climatica.html',
  'api/_lib/simeco-data.js','api/_lib/assistant-core.js'
];
const banned=/agua|alcantarill|\balc\b|gas natural|\bgas\b|aseo|residu/i;
for(const file of files){
  const text=fs.readFileSync(file,'utf8');
  ok(!banned.test(text),`${file} todavía contiene referencias a servicios no eléctricos`);
}
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
ok(html.includes('<option value="energyKwh">Energía eléctrica (kWh)</option>'),'Histórico no está limitado a electricidad');
ok(!html.includes('value="waterM3"') && !html.includes('value="gasM3"'),'Quedan métricas no eléctricas');
ok(html.includes('<th>Energía<br>kWh</th>') && html.includes('<th>CO₂e<br>kg</th>'),'Facturas no muestran columnas eléctricas');
ok(app.includes("const headers=['periodo','sede','direccion','energia_kwh','co2_kg','fuente']"),'CSV no es exclusivamente eléctrico');
ok(app.includes('Plan de Gestión Energética y Reducción de GEI'),'Informe por sede no es exclusivamente energético');
ok(html.includes('app.js?v=88-arranque-inmediato'),'Falta cache-busting v84');
console.log('OK electricity-only-system');

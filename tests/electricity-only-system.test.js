const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const coreFiles=[
  'assistant.js','institucional.js','territorial.js',
  'dashboard.html','busqueda-institucional.html','filtros-territoriales.html','aula-climatica.html',
  'api/_lib/simeco-data.js','api/_lib/assistant-core.js'
];
const bannedLegacy=/alcantarill|\baseo\b|\bresiduos\b|alcM3|wasteTon|wasteValue/i;
for(const file of coreFiles){
  const text=fs.readFileSync(file,'utf8');
  ok(!bannedLegacy.test(text),`${file} todavía contiene servicios heredados fuera del alcance activo`);
}
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
ok(html.includes('<option value="energyKwh">Energía eléctrica (kWh)</option>'),'Histórico eléctrico fue alterado');
ok(!html.includes('value="waterM3"') && !html.includes('value="gasM3"'),'El histórico principal no debe mezclar métricas');
ok(html.includes('<th>Energía<br>kWh</th>') && html.includes('<th>CO₂e<br>kg</th>'),'Facturas eléctricas no mantienen sus columnas');
ok(app.includes("const headers=['periodo','sede','direccion','energia_kwh','co2_kg','fuente']"),'CSV eléctrico fue alterado');
ok(app.includes('Plan de Gestión Energética y Reducción de GEI'),'Plan energético fue alterado');
ok(html.includes('id="seccion-8"') && html.includes('<strong>Agua</strong>'),'Módulo Agua no está aislado en sección 8');
ok(html.includes('id="seccion-9"') && html.includes('<strong>Gas</strong>'),'Módulo Gas no está aislado en sección 9');
ok(fs.existsSync('water.js') && fs.existsSync('gas.js'),'Faltan módulos independientes');
ok(html.includes('app.js?v=94-gas'),'Falta cache-busting v94');
console.log('OK electric-core-plus-water-gas');

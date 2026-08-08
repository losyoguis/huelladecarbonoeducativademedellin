const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const app=fs.readFileSync('app.js','utf8');
const water=fs.readFileSync('water.js','utf8');
ok(app.includes("function extractWaterM3(text)"),'Falta extractor de m³');
ok(app.includes("kind==='water'"),'parseMeasurement no soporta agua');
ok(app.includes("waterValue:valueAfter(text,'Total Agua') ?? valueAfter(text,'Total Acueducto')"),'No se extrae valor de agua');
ok(app.includes("waterM3:summary.waterM3"),'No se guarda resumen oficial de agua');
ok(app.includes("recordHasEnergyReading(r) ||"),'Los registros solo-agua serían descartados');
ok(water.includes("replacementSources"),'El módulo Agua no reemplaza fuentes reimportadas');
ok(water.includes("typeof state!=='undefined'"),'El módulo Agua no integra futuras actualizaciones');
console.log('OK water-future-pdf-import');

const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const app=fs.readFileSync('app.js','utf8');
const gas=fs.readFileSync('gas.js','utf8');
ok(app.includes('function extractGasM3(text)'),'Falta extractor de gas');
ok(app.includes("kind==='gas'"),'parseMeasurement no soporta gas');
ok(app.includes("gasValue:valueAfter(text,'Total Gas Natural') ?? valueAfter(text,'Total Gas')"),'No se extrae valor de gas');
ok(app.includes('gasM3:summary.gasM3'),'No se guarda resumen oficial de gas');
ok(app.includes('(r?.gasM3!==null'),'Los registros solo-gas serían descartados');
ok(gas.includes('replacementSources'),'Módulo Gas no reemplaza fuentes reimportadas');
ok(gas.includes("typeof state!=='undefined'"),'Módulo Gas no integra futuras actualizaciones');
console.log('OK gas-future-pdf-import');

const fs=require('fs'),vm=require('vm');
function ok(v,m){if(!v)throw new Error(m)}
const c={window:{},document:{getElementById(){return null}},localStorage:{getItem(){return null},setItem(){}},console,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:f=>f(),performance,URL,Blob,TextEncoder,TextDecoder,Intl,navigator:{},location:{},history:{},addEventListener(){}};
c.window=c;c.globalThis=c;vm.createContext(c);
vm.runInContext(fs.readFileSync('data/registros.electricidad.min.js','utf8'),c);
vm.runInContext(fs.readFileSync('app.js','utf8'),c);
ok(vm.runInContext("parseMeasurement('1.234,56','water')",c)===1234.56,'Parser de agua decimal incorrecto');
ok(vm.runInContext("parseMeasurement('1.234','water')",c)===1234,'Parser de agua miles incorrecto');
ok(vm.runInContext("extractWaterM3('Consumo JUL-26 1.234,56 x = Consumo\\nTotal Agua')",c)===1234.56,'Extracción m³ incorrecta');
const summary=vm.runInContext("parseSummary('ACTUAL 60.840,85 m3 DATO Acueducto\\nTotal Acueducto $ 292.164.912,47\\nACTUAL 710.596,02 kwh\\nTotal Energía $ 100.000,00')",c);
ok(Math.abs(summary.waterM3-60840.85)<0.001,'Resumen oficial de agua incorrecto');
ok(Math.abs(summary.waterValue-292164912.47)<0.01,'Valor oficial de agua incorrecto');
ok(vm.runInContext("hasAnyMeasure({waterM3:0,energyKwh:null})",c)===true,'0 m³ debe conservarse como lectura válida');
ok(vm.runInContext("hasAnyMeasure({waterM3:25,energyKwh:null})",c)===true,'Registro solo-agua sería descartado');
console.log(JSON.stringify({ok:true,waterParser:true,summaryWaterM3:summary.waterM3}));

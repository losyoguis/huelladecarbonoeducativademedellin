const fs=require('fs'),vm=require('vm');
function ok(v,m){if(!v)throw new Error(m)}
const c={window:{},document:{getElementById(){return null}},localStorage:{getItem(){return null},setItem(){}},console,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:f=>f(),performance,URL,Blob,TextEncoder,TextDecoder,Intl,navigator:{},location:{},history:{},addEventListener(){}};
c.window=c;c.globalThis=c;vm.createContext(c);
vm.runInContext(fs.readFileSync('data/registros.electricidad.min.js','utf8'),c);
vm.runInContext(fs.readFileSync('app.js','utf8'),c);
ok(vm.runInContext("parseMeasurement('87,251','gas')",c)===87.251,'Parser decimal gas incorrecto');
ok(vm.runInContext("extractGasM3('Consumo JUL-26 31,871 x = Consumo\\nTotal Gas')",c)===31.871,'Extracción gas m³ incorrecta');
const summary=vm.runInContext("parseSummary('ACTUAL 100,00 m3 Acueducto\\nACTUAL 100,00 m3 Alcantarillado\\nACTUAL 31,87 m3 Gas Natural\\nTotal Gas Natural $ 195.999,89\\nACTUAL 1.000,00 kwh')",c);
ok(Math.abs(summary.gasM3-31.87)<0.001,`Resumen gas incorrecto ${summary.gasM3}`);
ok(Math.abs(summary.gasValue-195999.89)<0.01,'Valor de gas incorrecto');
ok(vm.runInContext("hasAnyMeasure({gasM3:0,waterM3:null,energyKwh:null})",c)===true,'0 m³ de gas debe ser lectura válida');
ok(vm.runInContext("hasAnyMeasure({gasM3:25,waterM3:null,energyKwh:null})",c)===true,'Registro solo-gas sería descartado');
console.log(JSON.stringify({ok:true,gasParser:true,summaryGasM3:summary.gasM3}));

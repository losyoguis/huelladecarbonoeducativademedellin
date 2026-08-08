const fs=require('fs'),vm=require('vm');
function ok(v,m){if(!v)throw new Error(m)}
const c={window:{},document:{getElementById(){return null}},localStorage:{getItem(){return null},setItem(){}},console,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:f=>f(),performance,URL,Blob,TextEncoder,TextDecoder,Intl,navigator:{},location:{},history:{},addEventListener(){}};c.window=c;c.globalThis=c;vm.createContext(c);vm.runInContext(fs.readFileSync('data/registros.electricidad.min.js','utf8'),c);vm.runInContext(fs.readFileSync('app.js','utf8'),c);
ok(vm.runInContext("parseMeasurement('14.280','energy')",c)===14280,'Parser energético miles incorrecto');
ok(vm.runInContext("parseMeasurement('14.280,50','energy')",c)===14280.5,'Parser energético decimal incorrecto');
ok(vm.runInContext("extractEnergyKwh('Energía activa JUL-26 14.280 x = Consumo')",c)===14280,'Extracción kWh de PDF incorrecta');
ok(vm.runInContext("typeof valueAfter",c)==='function','Falta valueAfter');
console.log(JSON.stringify({ok:true,energyOnly:true,pdfParser:true},null,2));

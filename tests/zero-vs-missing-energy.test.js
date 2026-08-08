const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const app=fs.readFileSync('app.js','utf8');
const assistant=fs.readFileSync('assistant.js','utf8');

ok(app.includes("function hasAnyMeasure(r){ return r?.energyKwh!==null"),'hasAnyMeasure no distingue dato ausente');
ok(app.includes("Number.isFinite(Number(r.energyKwh))"),'0 kWh no se conserva como lectura válida');
ok(app.includes("if(service==='energia') return recordHasEnergyReading(r)"),'Filtro energético excluye 0 kWh');
ok(app.includes("r.co2kg = recordHasEnergyReading(r) ?"),'CO₂e convierte datos ausentes en cero');
ok(app.includes("title=\"No identificada\">N.I.</span>"),'Tabla no marca energía ausente como N.I.');
ok(app.includes("No calculable</span>"),'Tabla no marca CO₂e ausente como No calculable');
ok(assistant.includes("filter(item=>item.energy!==null)"),'Asistente excluye 0 kWh del mínimo válido');

global.window=global;
require('../data/registros.electricidad.min.js');
const rows=global.SIMECO_REGISTROS;
const zeros=rows.filter(r=>r.energyKwh===0).length;
const missing=rows.filter(r=>r.energyKwh==null).length;
ok(zeros===9,`Se esperaban 9 lecturas de 0 kWh, hay ${zeros}`);
ok(missing===1367,`Se esperaban 1367 registros sin lectura, hay ${missing}`);
console.log(JSON.stringify({ok:true,zeroKwh:zeros,missingEnergy:missing}));

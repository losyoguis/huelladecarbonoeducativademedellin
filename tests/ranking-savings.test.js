'use strict';
const assert = require('assert');
const data = require('../api/_lib/simeco-data');

function monthBefore(period){
  const m=String(period||'').match(/^(\d{4})-(\d{2})$/);
  if(!m) return '';
  const d=new Date(Number(m[1]),Number(m[2])-2,1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function energyFor(records, period){
  const list=records.filter(r=>r.period===period && r.energyKwh!==null && r.energyKwh!==undefined && Number.isFinite(Number(r.energyKwh)));
  if(!list.length) return null;
  return list.reduce((sum,r)=>sum+(Number(r.energyKwh)||0),0);
}
const periods=[...new Set(data.records.map(r=>r.period).filter(Boolean))].sort();
assert(periods.includes('2026-06') && periods.includes('2026-07'), 'Deben existir junio y julio de 2026');
assert(!periods.includes('2025-10'), 'Octubre de 2025 no está disponible y no debe inventarse');
assert.strictEqual(monthBefore('2025-11'),'2025-10');

const julySavings=[];
for(const institution of data.institutions){
  const prev=energyFor(institution.records,'2026-06');
  const curr=energyFor(institution.records,'2026-07');
  if(prev===null||curr===null||curr>=prev) continue;
  julySavings.push({name:institution.displayName,saved:prev-curr,prev,curr});
}
julySavings.sort((a,b)=>b.saved-a.saved);
assert(julySavings.length>50, `Se esperaban múltiples sedes con ahorro junio→julio; recibidas ${julySavings.length}`);
assert(julySavings[0].saved>0, 'El primer lugar debe tener ahorro positivo');
assert(!julySavings.some(x=>/INEM/i.test(x.name)), 'INEM no debe aparecer como ahorro con energía ausente/contrato separado');

const comparablePeriods=periods.filter(p=>periods.includes(monthBefore(p)));
assert(!comparablePeriods.includes('2025-11'), 'Noviembre 2025 no debe compararse contra agosto: octubre no existe');
assert(comparablePeriods.includes('2025-12'), 'Diciembre 2025 sí puede compararse con noviembre 2025');

console.log(JSON.stringify({ok:true,julySavings:julySavings.length,top:julySavings[0],comparablePeriods},null,2));
